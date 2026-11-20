import type {
  AuctionRecord,
  CropProfile,
  CultivationMethodProfile,
} from '../types/garak';
import {
  GARAK_MULTI_YEAR_BASELINES,
  MULTI_YEAR_BASELINE_BY_CROP_ID,
  type AnnualVolumePricePoint,
} from '../data/garakMultiYearTrends';
import {
  calculateAnnualRoi,
  getAnnualAvgPricePerKg,
  matchAuctionRecordToCrop,
  PYEONG_PER_10A,
} from './analytics';
import { parseOriginToRegion } from './koreaOrigin';

export type CobwebSignal =
  | 'oversupply_warning' // 내년 하락 주의 (올해 고점과열 또는 공급 증가)
  | 'opportunity_tight' // 진입 유망 (공급 감소 · 단가 견조/상승)
  | 'stable_high_roi' // 하방안정 고ROI (물량 안정 + 하락 시나리오 흑자 유지)
  | 'structural_decline' // 동반 위축 주의 (물량·단가 동반 감소)
  | 'neutral'; // 수급 보합

export interface SupplyRiskRow {
  crop: CropProfile;
  bestMethod: CultivationMethodProfile;
  sourceKind: 'curated_5yr' | 'excel_multiyear' | 'category_baseline';
  history: AnnualVolumePricePoint[];
  latestYear: number;
  latestVolumeTons: number;
  prevVolumeTons: number;
  volumeYoYPct: number;
  volume3YrCagrPct: number;
  latestPricePerKg: number;
  threeYearAvgPricePerKg: number;
  fiveYearAvgPricePerKg: number;
  priceYoYPct: number;
  priceVs3YrAvgPct: number;
  cobwebSignal: CobwebSignal;
  cobwebSignalLabel: string;
  cobwebReason: string;
  expandingOrigins: string[];
  shrinkingOrigins: string[];
  concentrationShareTop2Pct: number;
  dominantOriginNote: string;
  earlyWarningNote: string;
  // Stress-tested ROI across price regimes
  currentNetProfit: number;
  threeYearAvgNetProfit: number;
  downsideMinus15NetProfit: number;
  downsideMinus20NetProfit: number;
  downsideMinus25NetProfit: number;
  breakEvenPricePerKg: number;
  safetyMarginPct: number;
  downsideResilienceGrade: '상' | '중' | '하';
}

export interface MultiPeriodComparisonBucket {
  periodKey: string; // e.g. '2025' or '2026-10'
  recordCount: number;
  totalQuantity: number;
  totalKg: number;
  totalAmountKrw: number;
  weightedAvgKgPrice: number;
  volumeChangePct: number | null;
  priceChangePct: number | null;
  topItem: string;
  topOrigin: string;
}

export interface MultiPeriodItemShift {
  item: string;
  prevKg: number;
  latestKg: number;
  volumeChangePct: number;
  prevAvgKgPrice: number;
  latestAvgKgPrice: number;
  priceChangePct: number;
  expandingRegions: string[];
  shrinkingRegions: string[];
}

export interface UploadedMultiPeriodAnalysis {
  granularity: 'year' | 'month';
  periods: MultiPeriodComparisonBucket[];
  prevPeriodLabel: string | null;
  latestPeriodLabel: string | null;
  itemShifts: MultiPeriodItemShift[];
}

export const COBWEB_SIGNAL_META: Record<
  CobwebSignal,
  { label: string; shortLabel: string; description: string }
> = {
  oversupply_warning: {
    label: '내년 하락 주의 (공급↑·고점)',
    shortLabel: '하락 주의',
    description: '전년 대비 반입량이 크게 늘었거나 3년 평균 대비 단가 과열 구간으로 내년 하락 압력이 높음',
  },
  opportunity_tight: {
    label: '진입 유망 (공급↓·단가↑)',
    shortLabel: '진입 유망',
    description: '가락시장 반입 물량이 감소세이면서 단가가 상승·지지되어 수익성 개선 가능성이 높은 품목',
  },
  stable_high_roi: {
    label: '하방안정 고ROI',
    shortLabel: '하방안정',
    description: '물량 급변 없이 안정적이고 단가 -20% 하락 시나리오에서도 10a당 흑자를 방어하는 품목',
  },
  structural_decline: {
    label: '동반 위축 주의 (물량↓·단가↓)',
    shortLabel: '동반 위축',
    description: '산지 물량과 경매 단가가 동반 약세이므로 고품질 특품·품종 전환 검토가 필요한 품목',
  },
  neutral: {
    label: '수급 보합',
    shortLabel: '수급 보합',
    description: '전년 대비 물량·단가 변동이 평년 범위 내인 품목',
  },
};

function calcCagrPct(startVal: number, endVal: number, periods: number): number {
  if (startVal <= 0 || endVal <= 0 || periods <= 0) return 0;
  const cagr = (Math.pow(endVal / startVal, 1 / periods) - 1) * 100;
  return Math.round(cagr * 10) / 10;
}

function calcPctDelta(prev: number, curr: number): number {
  if (prev <= 0) return 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function buildSynthesizedCategoryHistory(crop: CropProfile): AnnualVolumePricePoint[] {
  const basePrice = Math.max(800, getAnnualAvgPricePerKg(crop));
  let hash = 0;
  for (let i = 0; i < crop.id.length; i++) {
    hash = (hash * 31 + crop.id.charCodeAt(i)) % 97;
  }
  const baseVol =
    crop.category === '엽채·나물류'
      ? 14500
      : crop.category === '양채·허브류'
        ? 1800
        : crop.category === '과채류'
          ? 34000
          : crop.category === '근채류'
            ? 42000
            : crop.category === '양념채소'
              ? 36000
              : crop.category === '과실류'
                ? 28000
                : crop.category === '버섯류'
                  ? 11000
                  : 9500;

  // Deterministic realistic 5-year series keyed by crop hash
  const phase = (hash % 11) - 5; // -5 .. +5
  const volSlope = phase * 0.014;
  return [2022, 2023, 2024, 2025, 2026].map((year, idx) => {
    const t = idx - 4; // -4..0
    const cycle = Math.sin(idx * 1.45 + hash) * 0.06;
    const volFactor = 1 + t * volSlope + cycle;
    const priceFactor = 1 - cycle * 0.95 - t * volSlope * 0.65;
    return {
      year,
      annualVolumeTons: Math.max(120, Math.round(baseVol * Math.max(0.65, volFactor))),
      annualAvgKgPrice: Math.max(400, Math.round(basePrice * Math.max(0.75, priceFactor))),
    };
  });
}

export function classifyCobwebSignal(params: {
  volumeYoYPct: number;
  volume3YrCagrPct: number;
  priceYoYPct: number;
  priceVs3YrAvgPct: number;
  downsideMinus20NetProfit: number;
  safetyMarginPct: number;
}): { signal: CobwebSignal; reason: string } {
  const {
    volumeYoYPct,
    priceYoYPct,
    priceVs3YrAvgPct,
    downsideMinus20NetProfit,
    safetyMarginPct,
  } = params;

  // 1. Oversupply / Cobweb peak warning: volume growing fast (>= +5.5%) OR overheated vs 3Y avg (>= +12%) with rising supply
  if (volumeYoYPct >= 5.5 || (priceVs3YrAvgPct >= 12 && volumeYoYPct >= 1.5)) {
    return {
      signal: 'oversupply_warning',
      reason:
        volumeYoYPct >= 5.5
          ? `전년 대비 반입량 +${volumeYoYPct}% 급증 (공급 확대에 따른 내년 단가 하락 압력)`
          : `3년 평균 대비 단가 +${priceVs3YrAvgPct}% 과열 · 산지 출하 확대 조짐`,
    };
  }

  // 2. Opportunity tight: supply shrinking (<= -2.5%) while price holds/rises (>= -1%)
  if (volumeYoYPct <= -2.5 && priceYoYPct >= -1) {
    return {
      signal: 'opportunity_tight',
      reason: `전년 대비 반입량 ${volumeYoYPct}% 감소 · 단가 ${priceYoYPct >= 0 ? '+' : ''}${priceYoYPct}% 견조 (공급 부족 기반 진입 유망)`,
    };
  }

  // 3. Structural decline: both volume and price falling
  if (volumeYoYPct <= -2.5 && priceYoYPct < -2) {
    return {
      signal: 'structural_decline',
      reason: `반입량(${volumeYoYPct}%) · 단가(${priceYoYPct}%) 동반 약세 — 품종·산지 경쟁력 점검 필요`,
    };
  }

  // 4. Stable High ROI: balanced supply + stays profitable even under -20% price drop with >=20% margin
  if (downsideMinus20NetProfit > 0 && safetyMarginPct >= 20) {
    return {
      signal: 'stable_high_roi',
      reason: `수급 변동 안정적 · 내년 단가 -20% 하락 시에도 흑자 유지 (안전마진 ${safetyMarginPct}%)`,
    };
  }

  return {
    signal: 'neutral',
    reason: `물량(${volumeYoYPct >= 0 ? '+' : ''}${volumeYoYPct}%)·단가(${priceYoYPct >= 0 ? '+' : ''}${priceYoYPct}%) 평년 보합권`,
  };
}

/**
 * Computes multi-year volume/price trends, cobweb price risk signals,
 * regional shift notes, and 3-scenario downside ROI across the crop universe.
 */
export function evaluateCropSupplyRiskMatrix(params: {
  crops: CropProfile[];
  uploadedRecords?: AuctionRecord[];
  uploadedOverrides?: Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>;
  applyUploadedOverrides?: boolean;
  areaPyeong?: number;
  marketableRatePct?: number;
  laborCostMultiplier?: number;
  includeDepreciation?: boolean;
}): SupplyRiskRow[] {
  const {
    crops,
    uploadedRecords = [],
    uploadedOverrides,
    applyUploadedOverrides = false,
    areaPyeong = PYEONG_PER_10A,
    marketableRatePct = 88,
    laborCostMultiplier = 1.0,
    includeDepreciation = true,
  } = params;

  // Group uploaded multi-year stats per crop when uploadedRecords span >= 2 distinct years
  const uploadedYearlyByCrop = new Map<string, Map<number, { kg: number; revenue: number }>>();
  if (uploadedRecords.length > 0 && applyUploadedOverrides) {
    for (const r of uploadedRecords) {
      const y = Number((r.date || '').slice(0, 4));
      if (!Number.isFinite(y) || y < 2015) continue;
      const matched = matchAuctionRecordToCrop(r, crops);
      if (!matched) continue;
      let yearMap = uploadedYearlyByCrop.get(matched.id);
      if (!yearMap) {
        yearMap = new Map();
        uploadedYearlyByCrop.set(matched.id, yearMap);
      }
      const kg = r.kgPerUnit * r.quantity;
      const rev = r.pricePerUnit * r.quantity;
      const cur = yearMap.get(y) || { kg: 0, revenue: 0 };
      cur.kg += kg;
      cur.revenue += rev;
      yearMap.set(y, cur);
    }
  }

  const rows: SupplyRiskRow[] = crops.map((crop) => {
    const baseline = MULTI_YEAR_BASELINE_BY_CROP_ID.get(crop.id);
    const uploadedYearMap = uploadedYearlyByCrop.get(crop.id);

    let history: AnnualVolumePricePoint[];
    let sourceKind: SupplyRiskRow['sourceKind'];

    if (uploadedYearMap && uploadedYearMap.size >= 2) {
      sourceKind = 'excel_multiyear';
      history = Array.from(uploadedYearMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, v]) => ({
          year,
          annualVolumeTons: Math.round((v.kg / 1000) * 100) / 100,
          annualAvgKgPrice: v.kg > 0 ? Math.round(v.revenue / v.kg) : 0,
        }));
    } else if (baseline) {
      sourceKind = 'curated_5yr';
      history = baseline.history.map((pt) => ({ ...pt }));
    } else {
      sourceKind = 'category_baseline';
      history = buildSynthesizedCategoryHistory(crop);
    }

    // Apply single-year uploaded override price to the latest point if active
    const singleOverride = uploadedOverrides?.get(crop.id);
    if (
      sourceKind !== 'excel_multiyear' &&
      applyUploadedOverrides &&
      singleOverride &&
      singleOverride.weightedAvgKgPrice > 0 &&
      history.length > 0
    ) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        annualAvgKgPrice: singleOverride.weightedAvgKgPrice,
      };
    }

    const latest = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : latest;
    const anchor3Yr = history.length >= 4 ? history[history.length - 4] : history[0];

    const last3 = history.slice(-3);
    const threeYearAvgPricePerKg = Math.round(
      last3.reduce((s, p) => s + p.annualAvgKgPrice, 0) / Math.max(1, last3.length)
    );
    const fiveYearAvgPricePerKg = Math.round(
      history.reduce((s, p) => s + p.annualAvgKgPrice, 0) / Math.max(1, history.length)
    );

    const volumeYoYPct = calcPctDelta(prev.annualVolumeTons, latest.annualVolumeTons);
    const volume3YrCagrPct = calcCagrPct(
      anchor3Yr.annualVolumeTons,
      latest.annualVolumeTons,
      Math.max(1, history.length - 1 - history.indexOf(anchor3Yr))
    );
    const priceYoYPct = calcPctDelta(prev.annualAvgKgPrice, latest.annualAvgKgPrice);
    const priceVs3YrAvgPct = calcPctDelta(threeYearAvgPricePerKg, latest.annualAvgKgPrice);

    // Pick best cultivation method by 3-Year Conservative Avg ROI (protects against single-year peak distortion)
    let bestMethod = crop.methods[0];
    let bestThreeYrSim = calculateAnnualRoi({
      crop,
      methodKey: bestMethod.key,
      areaPyeong,
      pricePerKg: threeYearAvgPricePerKg,
      cyclesPerYear: bestMethod.cyclesPerYear,
      marketableRatePct,
      commissionRatePct: bestMethod.commissionRatePct,
      laborCostMultiplier,
      includeDepreciation,
    });

    for (let i = 1; i < crop.methods.length; i++) {
      const m = crop.methods[i];
      const sim = calculateAnnualRoi({
        crop,
        methodKey: m.key,
        areaPyeong,
        pricePerKg: threeYearAvgPricePerKg,
        cyclesPerYear: m.cyclesPerYear,
        marketableRatePct,
        commissionRatePct: m.commissionRatePct,
        laborCostMultiplier,
        includeDepreciation,
      });
      if (sim.netProfit > bestThreeYrSim.netProfit) {
        bestMethod = m;
        bestThreeYrSim = sim;
      }
    }

    const simAtPrice = (p: number) =>
      calculateAnnualRoi({
        crop,
        methodKey: bestMethod.key,
        areaPyeong,
        pricePerKg: Math.max(100, Math.round(p)),
        cyclesPerYear: bestMethod.cyclesPerYear,
        marketableRatePct,
        commissionRatePct: bestMethod.commissionRatePct,
        laborCostMultiplier,
        includeDepreciation,
      });

    const currentSim = simAtPrice(latest.annualAvgKgPrice);
    const minus15Sim = simAtPrice(latest.annualAvgKgPrice * 0.85);
    const minus20Sim = simAtPrice(latest.annualAvgKgPrice * 0.8);
    const minus25Sim = simAtPrice(latest.annualAvgKgPrice * 0.75);

    const safetyMarginPct =
      latest.annualAvgKgPrice > 0
        ? Math.round(
            ((latest.annualAvgKgPrice - currentSim.breakEvenPricePerKg) /
              latest.annualAvgKgPrice) *
              1000
          ) / 10
        : 0;

    const downsideResilienceGrade: '상' | '중' | '하' =
      minus20Sim.netProfit > 0 && safetyMarginPct >= 25
        ? '상'
        : minus15Sim.netProfit > 0 && safetyMarginPct >= 15
          ? '중'
          : '하';

    const { signal, reason } = classifyCobwebSignal({
      volumeYoYPct,
      volume3YrCagrPct,
      priceYoYPct,
      priceVs3YrAvgPct,
      downsideMinus20NetProfit: minus20Sim.netProfit,
      safetyMarginPct,
    });

    return {
      crop,
      bestMethod,
      sourceKind,
      history,
      latestYear: latest.year,
      latestVolumeTons: latest.annualVolumeTons,
      prevVolumeTons: prev.annualVolumeTons,
      volumeYoYPct,
      volume3YrCagrPct,
      latestPricePerKg: latest.annualAvgKgPrice,
      threeYearAvgPricePerKg,
      fiveYearAvgPricePerKg,
      priceYoYPct,
      priceVs3YrAvgPct,
      cobwebSignal: signal,
      cobwebSignalLabel: COBWEB_SIGNAL_META[signal].shortLabel,
      cobwebReason: reason,
      expandingOrigins: baseline?.expandingOrigins || ['전국 시설·스마트팜 확대권'],
      shrinkingOrigins: baseline?.shrinkingOrigins || ['고령화 노지 소규모 산지'],
      concentrationShareTop2Pct: baseline?.concentrationShareTop2Pct ?? 55.0,
      dominantOriginNote: baseline?.dominantOriginNote || `${crop.category} 주산지 분산 분포`,
      earlyWarningNote: baseline?.earlyWarningNote || reason,
      currentNetProfit: currentSim.netProfit,
      threeYearAvgNetProfit: bestThreeYrSim.netProfit,
      downsideMinus15NetProfit: minus15Sim.netProfit,
      downsideMinus20NetProfit: minus20Sim.netProfit,
      downsideMinus25NetProfit: minus25Sim.netProfit,
      breakEvenPricePerKg: currentSim.breakEvenPricePerKg,
      safetyMarginPct,
      downsideResilienceGrade,
    };
  });

  rows.sort((a, b) => b.downsideMinus20NetProfit - a.downsideMinus20NetProfit);
  return rows;
}

/**
 * Analyzes uploaded Excel auction records across multiple years (or months within a single year)
 * to reveal real uploaded volume & price shifts by item and production region.
 */
export function buildUploadedMultiPeriodComparison(
  records: AuctionRecord[]
): UploadedMultiPeriodAnalysis | null {
  if (records.length === 0) return null;

  const yearSet = new Set<string>();
  const monthSet = new Set<string>();
  for (const r of records) {
    if (/^20\d{2}/.test(r.date)) {
      yearSet.add(r.date.slice(0, 4));
      monthSet.add(r.date.slice(0, 7));
    }
  }

  const useYearGranularity = yearSet.size >= 2;
  const keyLen = useYearGranularity ? 4 : 7;
  if (!useYearGranularity && monthSet.size < 2) {
    return null;
  }

  interface BucketAccum {
    recordCount: number;
    totalQuantity: number;
    totalKg: number;
    totalAmountKrw: number;
    itemKg: Map<string, number>;
    originKg: Map<string, number>;
  }

  const periodAccums = new Map<string, BucketAccum>();
  const itemPeriodStats = new Map<
    string,
    Map<string, { kg: number; revenue: number; origins: Map<string, number> }>
  >();

  for (const r of records) {
    if (!/^20\d{2}/.test(r.date)) continue;
    const pKey = r.date.slice(0, keyLen);
    const kg = r.kgPerUnit * r.quantity;
    const rev = r.pricePerUnit * r.quantity;
    const reg = parseOriginToRegion(r.origin);
    const regLabel =
      reg.provinceId === 'other' ? reg.provinceName : `${reg.provinceName} ${reg.sigungu}`;

    let b = periodAccums.get(pKey);
    if (!b) {
      b = {
        recordCount: 0,
        totalQuantity: 0,
        totalKg: 0,
        totalAmountKrw: 0,
        itemKg: new Map(),
        originKg: new Map(),
      };
      periodAccums.set(pKey, b);
    }
    b.recordCount += 1;
    b.totalQuantity += r.quantity;
    b.totalKg += kg;
    b.totalAmountKrw += rev;
    b.itemKg.set(r.item, (b.itemKg.get(r.item) || 0) + kg);
    b.originKg.set(regLabel, (b.originKg.get(regLabel) || 0) + kg);

    let itemMap = itemPeriodStats.get(r.item);
    if (!itemMap) {
      itemMap = new Map();
      itemPeriodStats.set(r.item, itemMap);
    }
    let ip = itemMap.get(pKey);
    if (!ip) {
      ip = { kg: 0, revenue: 0, origins: new Map() };
      itemMap.set(pKey, ip);
    }
    ip.kg += kg;
    ip.revenue += rev;
    ip.origins.set(regLabel, (ip.origins.get(regLabel) || 0) + kg);
  }

  const sortedKeys = Array.from(periodAccums.keys()).sort();
  if (sortedKeys.length < 2) return null;

  const periods: MultiPeriodComparisonBucket[] = sortedKeys.map((key, idx) => {
    const b = periodAccums.get(key)!;
    const prev = idx > 0 ? periodAccums.get(sortedKeys[idx - 1])! : null;
    const avgPrice = b.totalKg > 0 ? Math.round(b.totalAmountKrw / b.totalKg) : 0;
    const prevAvgPrice =
      prev && prev.totalKg > 0 ? Math.round(prev.totalAmountKrw / prev.totalKg) : 0;

    const topItem = Array.from(b.itemKg.entries()).sort((a, x) => x[1] - a[1])[0]?.[0] || '-';
    const topOrigin = Array.from(b.originKg.entries()).sort((a, x) => x[1] - a[1])[0]?.[0] || '-';

    return {
      periodKey: key,
      recordCount: b.recordCount,
      totalQuantity: b.totalQuantity,
      totalKg: Math.round(b.totalKg * 10) / 10,
      totalAmountKrw: b.totalAmountKrw,
      weightedAvgKgPrice: avgPrice,
      volumeChangePct: prev && prev.totalKg > 0 ? calcPctDelta(prev.totalKg, b.totalKg) : null,
      priceChangePct:
        prev && prevAvgPrice > 0 ? calcPctDelta(prevAvgPrice, avgPrice) : null,
      topItem,
      topOrigin,
    };
  });

  const prevKey = sortedKeys[sortedKeys.length - 2];
  const latestKey = sortedKeys[sortedKeys.length - 1];

  const itemShifts: MultiPeriodItemShift[] = [];
  for (const [item, pMap] of itemPeriodStats.entries()) {
    const prev = pMap.get(prevKey);
    const latest = pMap.get(latestKey);
    const prevKg = Math.round((prev?.kg || 0) * 10) / 10;
    const latestKg = Math.round((latest?.kg || 0) * 10) / 10;
    const prevAvgKgPrice = prev && prev.kg > 0 ? Math.round(prev.revenue / prev.kg) : 0;
    const latestAvgKgPrice = latest && latest.kg > 0 ? Math.round(latest.revenue / latest.kg) : 0;

    const allRegions = new Set<string>([
      ...(prev ? prev.origins.keys() : []),
      ...(latest ? latest.origins.keys() : []),
    ]);
    const regionDeltas: Array<{ reg: string; delta: number }> = [];
    for (const reg of allRegions) {
      const d = (latest?.origins.get(reg) || 0) - (prev?.origins.get(reg) || 0);
      regionDeltas.push({ reg, delta: d });
    }

    itemShifts.push({
      item,
      prevKg,
      latestKg,
      volumeChangePct:
        prevKg > 0 ? calcPctDelta(prevKg, latestKg) : latestKg > 0 ? 100 : 0,
      prevAvgKgPrice,
      latestAvgKgPrice,
      priceChangePct:
        prevAvgKgPrice > 0 ? calcPctDelta(prevAvgKgPrice, latestAvgKgPrice) : 0,
      expandingRegions: regionDeltas
        .filter((d) => d.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 3)
        .map((d) => d.reg),
      shrinkingRegions: regionDeltas
        .filter((d) => d.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 3)
        .map((d) => d.reg),
    });
  }

  itemShifts.sort((a, b) => Math.abs(b.latestKg - b.prevKg) - Math.abs(a.latestKg - a.prevKg));

  return {
    granularity: useYearGranularity ? 'year' : 'month',
    periods,
    prevPeriodLabel: prevKey,
    latestPeriodLabel: latestKey,
    itemShifts,
  };
}

export function getReferenceBaselineCropsCount(): number {
  return GARAK_MULTI_YEAR_BASELINES.length;
}
