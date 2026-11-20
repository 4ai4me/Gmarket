import type {
  AggregatedAuctionGroup,
  AuctionRecord,
  CropProfile,
  CropRankingRow,
  CultivationMethodKey,
  MonthlyCashflowPoint,
  PeriodGranularity,
  RoiSimulationInput,
  RoiSimulationResult,
  UnitBasis,
} from '../types/garak';

export const PYEONG_PER_10A = 302.5;

/**
 * Computes annual average kg price across active (non-zero) trading months.
 */
export function getAnnualAvgPricePerKg(crop: CropProfile): number {
  const active = crop.monthlyPricePerKg.filter((p) => p > 0);
  if (active.length === 0) return 0;
  return Math.round(active.reduce((sum, p) => sum + p, 0) / active.length);
}

/**
 * Deterministic 52-week price curve derived from the 12-month seasonal curve
 * and crop-specific weekly volatility amplitude.
 */
export function getWeeklyPriceSeries(crop: CropProfile): Array<{
  week: number;
  month: number;
  label: string;
  pricePerKg: number;
  pricePerNativeUnit: number;
}> {
  const series: Array<{
    week: number;
    month: number;
    label: string;
    pricePerKg: number;
    pricePerNativeUnit: number;
  }> = [];

  for (let week = 1; week <= 52; week++) {
    const exactMonthPos = ((week - 1) / 52) * 12;
    const mIdx = Math.min(11, Math.floor(exactMonthPos));
    const nextIdx = (mIdx + 1) % 12;
    const frac = exactMonthPos - mIdx;

    const pCurr = crop.monthlyPricePerKg[mIdx];
    const pNext = crop.monthlyPricePerKg[nextIdx];

    let basePrice = pCurr;
    if (pCurr > 0 && pNext > 0) {
      basePrice = pCurr * (1 - frac) + pNext * frac;
    }

    // Small deterministic oscillation based on week index + crop id hash
    let hash = 0;
    for (let i = 0; i < crop.id.length; i++) {
      hash = (hash * 31 + crop.id.charCodeAt(i)) % 997;
    }
    const wave =
      basePrice > 0
        ? 1 + Math.sin((week * 1.7 + hash) * 0.65) * (crop.weeklyVolatility * 0.45)
        : 0;
    const pricePerKg = Math.max(0, Math.round(basePrice * wave));

    series.push({
      week,
      month: mIdx + 1,
      label: `${week}주차 (${mIdx + 1}월)`,
      pricePerKg,
      pricePerNativeUnit: Math.round(pricePerKg * crop.standardUnitKg),
    });
  }

  return series;
}

/**
 * Matches an uploaded Garak Market auction record to a CropProfile by item/variety/alias.
 */
export function matchAuctionRecordToCrop(
  record: AuctionRecord,
  crops: CropProfile[]
): CropProfile | null {
  const haystack = `${record.item} ${record.variety}`.replace(/\s+/g, '').toLowerCase();

  // First pass: exact name or variety match (prefer more specific names like 쪽파 over 파)
  const sortedBySpecificity = [...crops].sort((a, b) => b.name.length - a.name.length);

  for (const crop of sortedBySpecificity) {
    const targetName = crop.name.replace(/\s+/g, '').toLowerCase();
    if (haystack.includes(targetName)) {
      return crop;
    }
  }

  for (const crop of sortedBySpecificity) {
    for (const alias of crop.aliases) {
      const aNorm = alias.replace(/\s+/g, '').toLowerCase();
      if (aNorm.length >= 2 && haystack.includes(aNorm)) {
        return crop;
      }
    }
  }

  return null;
}

/**
 * Aggregates uploaded auction records into quantity-weighted averages grouped by
 * (item, variety, unitRaw, grade).
 */
export function aggregateAuctionRecords(records: AuctionRecord[]): AggregatedAuctionGroup[] {
  const map = new Map<
    string,
    {
      item: string;
      variety: string;
      unitRaw: string;
      kgPerUnit: number;
      grade: string;
      recordCount: number;
      totalQuantity: number;
      totalKg: number;
      totalRevenue: number;
      minUnitPrice: number;
      maxUnitPrice: number;
      origins: Set<string>;
    }
  >();

  for (const rec of records) {
    const key = `${rec.item}__${rec.variety}__${rec.unitRaw}__${rec.grade}`;
    const existing = map.get(key);
    const rev = rec.pricePerUnit * rec.quantity;
    const kg = rec.kgPerUnit * rec.quantity;

    if (!existing) {
      map.set(key, {
        item: rec.item,
        variety: rec.variety,
        unitRaw: rec.unitRaw,
        kgPerUnit: rec.kgPerUnit,
        grade: rec.grade,
        recordCount: 1,
        totalQuantity: rec.quantity,
        totalKg: kg,
        totalRevenue: rev,
        minUnitPrice: rec.pricePerUnit,
        maxUnitPrice: rec.pricePerUnit,
        origins: new Set(rec.origin && rec.origin !== '-' ? [rec.origin] : []),
      });
    } else {
      existing.recordCount += 1;
      existing.totalQuantity += rec.quantity;
      existing.totalKg += kg;
      existing.totalRevenue += rev;
      existing.minUnitPrice = Math.min(existing.minUnitPrice, rec.pricePerUnit);
      existing.maxUnitPrice = Math.max(existing.maxUnitPrice, rec.pricePerUnit);
      if (rec.origin && rec.origin !== '-') {
        existing.origins.add(rec.origin);
      }
    }
  }

  return Array.from(map.entries())
    .map(([key, g]) => ({
      key,
      item: g.item,
      variety: g.variety,
      unitRaw: g.unitRaw,
      kgPerUnit: g.kgPerUnit,
      grade: g.grade,
      recordCount: g.recordCount,
      totalQuantity: g.totalQuantity,
      totalKg: Math.round(g.totalKg * 100) / 100,
      weightedAvgUnitPrice: Math.round(g.totalRevenue / Math.max(1, g.totalQuantity)),
      weightedAvgKgPrice: Math.round(g.totalRevenue / Math.max(0.01, g.totalKg)),
      minUnitPrice: g.minUnitPrice,
      maxUnitPrice: g.maxUnitPrice,
      origins: Array.from(g.origins),
    }))
    .sort((a, b) => b.weightedAvgKgPrice - a.weightedAvgKgPrice);
}

/**
 * Builds a map of cropId -> weighted average kg price from uploaded auction records.
 */
export function buildUploadedCropPriceOverrides(
  records: AuctionRecord[],
  crops: CropProfile[]
): Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }> {
  const accum = new Map<string, { totalRevenue: number; totalKg: number; count: number }>();

  for (const rec of records) {
    const matched = matchAuctionRecordToCrop(rec, crops);
    if (!matched) continue;
    const rev = rec.pricePerUnit * rec.quantity;
    const kg = rec.kgPerUnit * rec.quantity;
    const cur = accum.get(matched.id) || { totalRevenue: 0, totalKg: 0, count: 0 };
    cur.totalRevenue += rev;
    cur.totalKg += kg;
    cur.count += 1;
    accum.set(matched.id, cur);
  }

  const out = new Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>();
  for (const [cropId, v] of accum.entries()) {
    if (v.totalKg > 0) {
      out.set(cropId, {
        weightedAvgKgPrice: Math.round(v.totalRevenue / v.totalKg),
        recordCount: v.count,
        totalKg: Math.round(v.totalKg * 10) / 10,
      });
    }
  }
  return out;
}

/**
 * Calculates full 1-year cultivation revenue, costs, net profit, ROI, payback period,
 * break-even price (both per kg and per crop native unit), and 12-month cashflow.
 */
export function calculateAnnualRoi(input: RoiSimulationInput): RoiSimulationResult {
  const method =
    input.crop.methods.find((m) => m.key === input.methodKey) || input.crop.methods[0];

  const safeAreaPyeong = Math.max(1, Number.isFinite(input.areaPyeong) ? input.areaPyeong : 300);
  const area10a = safeAreaPyeong / PYEONG_PER_10A;
  const safeCycles = Math.max(0.25, Number.isFinite(input.cyclesPerYear) ? input.cyclesPerYear : method.cyclesPerYear);
  const safeMarketableRate = Math.min(100, Math.max(10, input.marketableRatePct)) / 100;
  const safeCommissionRate = Math.min(25, Math.max(0, input.commissionRatePct)) / 100;
  const safeLaborMult = Math.max(0, Number.isFinite(input.laborCostMultiplier) ? input.laborCostMultiplier : 1);
  const effectivePricePerKg = Math.max(0, Number.isFinite(input.pricePerKg) ? input.pricePerKg : getAnnualAvgPricePerKg(input.crop));

  const annualYieldKg = Math.round(method.yieldKgPer10a * area10a * safeCycles);
  const marketableYieldKg = Math.round(annualYieldKg * safeMarketableRate);
  const marketableNativeUnits = Math.round((marketableYieldKg / Math.max(0.01, input.crop.standardUnitKg)) * 10) / 10;

  const grossRevenue = Math.round(marketableYieldKg * effectivePricePerKg);
  const commissionCost = Math.round(grossRevenue * safeCommissionRate);
  const packagingShippingCost = Math.round(marketableYieldKg * method.packagingShippingPerKg);

  const seedCost = Math.round(method.seedCostPer10a * area10a * safeCycles);
  const materialCost = Math.round(method.materialCostPer10a * area10a * safeCycles);
  const laborCost = Math.round(method.laborCostPer10a * area10a * safeCycles * safeLaborMult);

  const totalCapex = Math.round(method.facilityCapexPer10a * area10a);
  const annualDepreciation = input.includeDepreciation
    ? Math.round(totalCapex / Math.max(1, method.depreciationYears))
    : 0;

  const totalOperatingCost =
    commissionCost + packagingShippingCost + seedCost + materialCost + laborCost;
  const totalCostWithCapex = totalOperatingCost + annualDepreciation;
  const netProfit = grossRevenue - totalCostWithCapex;
  const netProfitPerPyeong = Math.round(netProfit / safeAreaPyeong);
  const profitMarginPct =
    grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;
  const roiOnOperatingCostPct =
    totalOperatingCost > 0 ? Math.round((netProfit / totalOperatingCost) * 1000) / 10 : 0;

  const paybackYears =
    totalCapex > 0 && netProfit > 0
      ? Math.round((totalCapex / netProfit) * 10) / 10
      : null;

  // Break-even price per kg solves: P * Q * (1 - c) = nonCommissionCosts
  const nonCommissionCosts =
    packagingShippingCost + seedCost + materialCost + laborCost + annualDepreciation;
  const denom = marketableYieldKg * (1 - safeCommissionRate);
  const breakEvenPricePerKg = denom > 0 ? Math.ceil(nonCommissionCosts / denom) : 0;
  const breakEvenPricePerNativeUnit = Math.round(
    breakEvenPricePerKg * input.crop.standardUnitKg
  );

  // Build 12-month cashflow projection aligned with sowing & harvest months
  const sowingSet = new Set(input.crop.sowingMonths);
  const harvestSet = new Set(input.crop.harvestMonths);
  const harvestCount = Math.max(1, harvestSet.size);
  const sowingCount = Math.max(1, sowingSet.size);

  const monthlyCashflow: MonthlyCashflowPoint[] = [];
  let cumulative = 0;

  for (let m = 1; m <= 12; m++) {
    const monthSeed = sowingSet.has(m) ? seedCost / sowingCount : 0;
    const monthMaterial = materialCost / 12;
    const monthLabor = harvestSet.has(m)
      ? (laborCost * 0.65) / harvestCount + (laborCost * 0.35) / 12
      : (laborCost * 0.35) / 12;
    const monthDepr = annualDepreciation / 12;

    const monthRev = harvestSet.has(m) ? grossRevenue / harvestCount : 0;
    const monthCommPack = harvestSet.has(m)
      ? (commissionCost + packagingShippingCost) / harvestCount
      : 0;

    const cost = Math.round(monthSeed + monthMaterial + monthLabor + monthDepr + monthCommPack);
    const revenue = Math.round(monthRev);
    const net = revenue - cost;
    cumulative += net;

    monthlyCashflow.push({
      month: m,
      label: `${m}월`,
      cost,
      revenue,
      net,
      cumulative,
    });
  }

  return {
    areaPyeong: safeAreaPyeong,
    area10a: Math.round(area10a * 100) / 100,
    annualYieldKg,
    marketableYieldKg,
    marketableNativeUnits,
    effectivePricePerKg,
    effectivePricePerNativeUnit: Math.round(effectivePricePerKg * input.crop.standardUnitKg),
    grossRevenue,
    commissionCost,
    packagingShippingCost,
    seedCost,
    materialCost,
    laborCost,
    annualDepreciation,
    totalOperatingCost,
    totalCostWithCapex,
    netProfit,
    netProfitPerPyeong,
    profitMarginPct,
    roiOnOperatingCostPct,
    totalCapex,
    paybackYears,
    breakEvenPricePerKg,
    breakEvenPricePerNativeUnit,
    monthlyCashflow,
  };
}

/**
 * Generates ranked crop list for Year / Month / Week granularity and kg / native unit / 10a revenue basis.
 */
export function buildCropRankings(params: {
  crops: CropProfile[];
  granularity: PeriodGranularity;
  selectedMonth: number; // 1..12
  selectedWeek: number; // 1..52
  unitBasis: UnitBasis;
  uploadedOverrides?: Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>;
  applyUploadedOverrides?: boolean;
}): CropRankingRow[] {
  const {
    crops,
    granularity,
    selectedMonth,
    selectedWeek,
    unitBasis,
    uploadedOverrides,
    applyUploadedOverrides = false,
  } = params;

  const rows: CropRankingRow[] = crops.map((crop) => {
    const annualAvg = getAnnualAvgPricePerKg(crop);
    const activePrices = crop.monthlyPricePerKg.filter((p) => p > 0);
    const minMonthly = activePrices.length ? Math.min(...activePrices) : 0;
    const maxMonthly = activePrices.length ? Math.max(...activePrices) : 0;

    let pricePerKg = annualAvg;
    let periodLabel = '연간 평균';

    if (granularity === 'month') {
      const mIdx = Math.min(11, Math.max(0, selectedMonth - 1));
      pricePerKg = crop.monthlyPricePerKg[mIdx];
      periodLabel = `${selectedMonth}월 평균`;
    } else if (granularity === 'week') {
      const weekly = getWeeklyPriceSeries(crop);
      const wObj = weekly[Math.min(51, Math.max(0, selectedWeek - 1))];
      pricePerKg = wObj.pricePerKg;
      periodLabel = `${selectedWeek}주차 (${wObj.month}월)`;
    }

    const override = uploadedOverrides?.get(crop.id);
    const hasUploadedOverride = Boolean(applyUploadedOverrides && override && override.weightedAvgKgPrice > 0);
    if (hasUploadedOverride && override) {
      pricePerKg = override.weightedAvgKgPrice;
      periodLabel = `${periodLabel} · 엑셀 실측`;
    }

    const pricePerNativeUnit = Math.round(pricePerKg * crop.standardUnitKg);
    const vsAnnualAvgPct =
      annualAvg > 0 && pricePerKg > 0
        ? Math.round(((pricePerKg - annualAvg) / annualAvg) * 1000) / 10
        : 0;

    // Pick best-performing method on 10a (302.5평) for comparative economics
    let bestMethod = crop.methods[0];
    let bestRoi = calculateAnnualRoi({
      crop,
      methodKey: bestMethod.key,
      areaPyeong: PYEONG_PER_10A,
      pricePerKg: hasUploadedOverride && override ? override.weightedAvgKgPrice : annualAvg,
      cyclesPerYear: bestMethod.cyclesPerYear,
      marketableRatePct: 88,
      commissionRatePct: bestMethod.commissionRatePct,
      laborCostMultiplier: 1,
      includeDepreciation: true,
    });

    for (let i = 1; i < crop.methods.length; i++) {
      const m = crop.methods[i];
      const sim = calculateAnnualRoi({
        crop,
        methodKey: m.key,
        areaPyeong: PYEONG_PER_10A,
        pricePerKg: hasUploadedOverride && override ? override.weightedAvgKgPrice : annualAvg,
        cyclesPerYear: m.cyclesPerYear,
        marketableRatePct: 88,
        commissionRatePct: m.commissionRatePct,
        laborCostMultiplier: 1,
        includeDepreciation: true,
      });
      if (sim.netProfit > bestRoi.netProfit) {
        bestMethod = m;
        bestRoi = sim;
      }
    }

    return {
      crop,
      periodLabel,
      pricePerKg,
      pricePerNativeUnit,
      annualAvgPricePerKg: annualAvg,
      vsAnnualAvgPct,
      minMonthlyKgPrice: minMonthly,
      maxMonthlyKgPrice: maxMonthly,
      priceSpreadRatio: minMonthly > 0 ? Math.round((maxMonthly / minMonthly) * 100) / 100 : 1,
      bestMethod,
      estimatedAnnualRevenuePer10a: bestRoi.grossRevenue,
      estimatedAnnualNetProfitPer10a: bestRoi.netProfit,
      hasUploadedOverride,
      uploadedRecordCount: override?.recordCount || 0,
    };
  });

  rows.sort((a, b) => {
    if (unitBasis === 'kg') return b.pricePerKg - a.pricePerKg;
    if (unitBasis === 'native') return b.pricePerNativeUnit - a.pricePerNativeUnit;
    return b.estimatedAnnualRevenuePer10a - a.estimatedAnnualRevenuePer10a;
  });

  return rows;
}
