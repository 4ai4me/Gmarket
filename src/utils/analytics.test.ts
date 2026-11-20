import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGarakUnit } from './unitParser';
import { parseGarakSheetRows, exportAuctionRecordsToCsv } from './excelParser';
import {
  aggregateAuctionRecords,
  buildCropRankings,
  buildUploadedCropPriceOverrides,
  calculateAnnualRoi,
  getAnnualAvgPricePerKg,
  getWeeklyPriceSeries,
  PYEONG_PER_10A,
} from './analytics';
import { CROP_PROFILES, SAMPLE_GARAK_AUCTION_RECORDS } from '../data/crops';
import { EXTRA_CURATED_CROPS } from '../data/extraCrops';
import {
  GARAK_SNAPSHOT_ALL_YEAR,
  GARAK_SNAPSHOT_AUCTION,
} from '../data/garakSnapshot';
import {
  buildCrossAnalysisMatrix,
  buildUnifiedCropUniverse,
  isCultivableDomesticItem,
} from './cropSynthesizer';
import { aggregateAuctionByRegion, parseOriginToRegion } from './koreaOrigin';
import { NATIONWIDE_ORIGIN_BASELINE_RECORDS } from '../data/originAuctionBaseline';
import { MULTI_PERIOD_SAMPLE_AUCTION_RECORDS } from '../data/garakMultiYearTrends';
import {
  buildUploadedMultiPeriodComparison,
  classifyCobwebSignal,
  evaluateCropSupplyRiskMatrix,
} from './supplyRisk';

test('parseGarakUnit parses explicit kg, gram, and decimal units accurately', () => {
  const u1 = parseGarakUnit('10kg');
  assert.equal(u1.kgEquivalent, 10);
  assert.equal(u1.isEstimatedKg, false);

  const u2 = parseGarakUnit('15kg상자');
  assert.equal(u2.kgEquivalent, 15);
  assert.equal(u2.isEstimatedKg, false);

  const u3 = parseGarakUnit('300g', '김');
  assert.equal(u3.kgEquivalent, 0.3);
  assert.equal(u3.isEstimatedKg, false);

  const u4 = parseGarakUnit('2.5kg');
  assert.equal(u4.kgEquivalent, 2.5);
  assert.equal(u4.isEstimatedKg, false);
});

test('parseGarakUnit expands to crop-specific Korean native units (단, 포기, 속, 접, 관)', () => {
  const cabbage = parseGarakUnit('3포기', '배추');
  assert.equal(cabbage.kgEquivalent, 9);
  assert.equal(cabbage.isEstimatedKg, true);
  assert.equal(cabbage.unitCategory, 'count_bundle');

  const perilla = parseGarakUnit('100속', '깻잎');
  assert.equal(perilla.kgEquivalent, 2);
  assert.equal(perilla.isEstimatedKg, true);

  const greenOnion = parseGarakUnit('1단', '대파');
  assert.equal(greenOnion.kgEquivalent, 1);
  assert.equal(greenOnion.isEstimatedKg, true);

  const gwan = parseGarakUnit('1관', '고구마');
  assert.equal(gwan.kgEquivalent, 3.75);
});

test('parseGarakSheetRows accurately parses Garak 경매 결과 screenshot format with comma strings & repeated page headers', () => {
  const mockRows: unknown[][] = [
    ['[일자: 2026.11.20]', '', '경매 결과', '(가락시장)', '', '', '', '', '1/22'],
    ['법인', '품목', '품종', '단위', '등급', '수량', '경락', '출하지', '친환경구분'],
    ['동화청과', '파', '쪽파(BOX)', '10kg', '특(1등)', '30', '42,000', '경기도 양평군', '일반'],
    ['동화청과', '파', '쪽파(BOX)', '10kg', '특(1등)', '24', '26,000', '경기도 포천시', '일반'],
    ['동화청과', '파', '쪽파(BOX)', '15kg', '특(1등)', '13', '38,000', '전남광주통합시 보성군', '일반'],
    // Simulated OZViewer page break header
    ['[일자: 2026.11.20]', '', '경매 결과', '(가락시장)', '', '', '', '', '2/22'],
    ['법인', '품목', '품종', '단위', '등급', '수량', '경락', '출하지', '친환경구분'],
    ['서울청과', '깻잎', '잎들깨', '100속', '특', '10', '28,000', '경남 밀양시', '친환경'],
  ];

  const result = parseGarakSheetRows(mockRows);
  assert.equal(result.errors.length, 0);
  assert.equal(result.detectedFormat, 'auction_result');
  assert.equal(result.detectedDate, '2026-11-20');
  assert.equal(result.records.length, 4);

  assert.equal(result.records[0].pricePerUnit, 42000);
  assert.equal(result.records[0].pricePerKg, 4200);
  assert.equal(result.records[2].kgPerUnit, 15);
  assert.equal(result.records[2].pricePerKg, Math.round(38000 / 15));

  // Non-weight native unit 100속 -> 2kg -> 14,000원/kg
  assert.equal(result.records[3].kgPerUnit, 2);
  assert.equal(result.records[3].pricePerKg, 14000);
});

test('parseGarakSheetRows parses Format B (품목별 가격) and rejects invalid/empty sheets', () => {
  const formatBRows: unknown[][] = [
    ['품목별 가격', '[ 가락시장 ]'],
    ['날짜', '품목', '등급', '거래단위', '최저가', '최고가', '평균가'],
    ['2026.11.20', '고구마', '특', '10kg상자', '27,000', '42,000', '30,547'],
    ['2026.11.20', '감자 수미', '특', '20kg상자', '30,000', '31,000', '30,562'],
  ];

  const parsedB = parseGarakSheetRows(formatBRows);
  assert.equal(parsedB.detectedFormat, 'item_summary');
  assert.equal(parsedB.records.length, 2);
  assert.equal(parsedB.records[0].pricePerKg, 3055);
  assert.equal(parsedB.records[1].pricePerKg, 1528);

  const empty = parseGarakSheetRows([]);
  assert.equal(empty.records.length, 0);
  assert.ok(empty.errors.length > 0);
});

test('aggregateAuctionRecords computes quantity-weighted average correctly', () => {
  const groups = aggregateAuctionRecords(SAMPLE_GARAK_AUCTION_RECORDS);
  const chive10kg = groups.find((g) => g.variety === '쪽파(BOX)' && g.unitRaw === '10kg');
  assert.ok(chive10kg);
  // 30*42000 + 24*26000 + 40*25000 + 35*60000*3 + 25*21000 = 9,709,000 / 224 boxes
  assert.equal(chive10kg.totalQuantity, 224);
  assert.equal(chive10kg.weightedAvgUnitPrice, Math.round(9709000 / 224));
  assert.equal(chive10kg.weightedAvgKgPrice, Math.round(9709000 / 2240));
});

test('buildCropRankings sorts correctly across year/month/week and kg vs native unit', () => {
  const kgRank = buildCropRankings({
    crops: CROP_PROFILES,
    granularity: 'year',
    selectedMonth: 11,
    selectedWeek: 46,
    unitBasis: 'kg',
  });
  assert.ok(kgRank[0].pricePerKg >= kgRank[1].pricePerKg);
  assert.equal(kgRank[0].crop.id, 'strawberry');

  const nativeRank = buildCropRankings({
    crops: CROP_PROFILES,
    granularity: 'year',
    selectedMonth: 11,
    selectedWeek: 46,
    unitBasis: 'native',
  });
  assert.ok(nativeRank[0].pricePerNativeUnit >= nativeRank[1].pricePerNativeUnit);

  // Verify uploaded overrides update crop price
  const overrides = buildUploadedCropPriceOverrides(SAMPLE_GARAK_AUCTION_RECORDS, CROP_PROFILES);
  assert.ok(overrides.has('chive'));

  const withOverride = buildCropRankings({
    crops: CROP_PROFILES,
    granularity: 'month',
    selectedMonth: 11,
    selectedWeek: 46,
    unitBasis: 'kg',
    uploadedOverrides: overrides,
    applyUploadedOverrides: true,
  });
  const chiveRow = withOverride.find((r) => r.crop.id === 'chive');
  assert.ok(chiveRow?.hasUploadedOverride);
  assert.equal(chiveRow?.pricePerKg, overrides.get('chive')?.weightedAvgKgPrice);
});

test('calculateAnnualRoi computes revenue, costs, net profit, break-even, and 12-month cashflow', () => {
  const chive = CROP_PROFILES.find((c) => c.id === 'chive')!;
  const avgPrice = getAnnualAvgPricePerKg(chive);

  const sim = calculateAnnualRoi({
    crop: chive,
    methodKey: 'unheated_house',
    areaPyeong: PYEONG_PER_10A,
    pricePerKg: avgPrice,
    cyclesPerYear: 4,
    marketableRatePct: 90,
    commissionRatePct: 5,
    laborCostMultiplier: 1,
    includeDepreciation: true,
  });

  assert.equal(sim.area10a, 1);
  assert.equal(sim.annualYieldKg, 7400);
  assert.equal(sim.marketableYieldKg, 6660);
  assert.equal(sim.grossRevenue, Math.round(6660 * avgPrice));
  assert.equal(sim.monthlyCashflow.length, 12);
  assert.ok(sim.breakEvenPricePerKg > 0 && sim.breakEvenPricePerKg < avgPrice);
  assert.equal(sim.breakEvenPricePerNativeUnit, Math.round(sim.breakEvenPricePerKg * chive.standardUnitKg));
  assert.ok(sim.netProfit > 0);
});

test('getWeeklyPriceSeries returns 52 weeks and CSV export includes BOM and headers', () => {
  const weekly = getWeeklyPriceSeries(CROP_PROFILES[0]);
  assert.equal(weekly.length, 52);
  const csv = exportAuctionRecordsToCsv(SAMPLE_GARAK_AUCTION_RECORDS.slice(0, 2));
  assert.ok(csv.startsWith('\uFEFF일자,법인,품목'));
  assert.ok(csv.includes('쪽파(BOX)'));
});



test('isCultivableDomesticItem cleanly excludes seafood and imported-only items while keeping domestic crops', () => {
  assert.equal(isCultivableDomesticItem('가리비국산', '수산·건해'), false);
  assert.equal(isCultivableDomesticItem('고등어', '수산·건해'), false);
  assert.equal(isCultivableDomesticItem('바나나(수입)', '수입과일'), false);
  assert.equal(isCultivableDomesticItem('미더덕', '수산·건해'), false);
  assert.equal(isCultivableDomesticItem('브로코리', '양채·허브류'), true);
  assert.equal(isCultivableDomesticItem('당근', '근채류'), true);
  assert.equal(isCultivableDomesticItem('망고 국산', '과실류'), true);
});

test('buildUnifiedCropUniverse maps ALL cultivable Garak items and synthesizes Excel-only crops', () => {
  const allCurated = [...CROP_PROFILES, ...EXTRA_CURATED_CROPS];
  const customExcelRecords = [
    ...SAMPLE_GARAK_AUCTION_RECORDS,
    {
      id: 'xls-custom-1',
      date: '2026-11-20',
      corporation: '서울청과',
      item: '특수쌈채',
      variety: '아이스플랜트',
      unitRaw: '2kg',
      kgPerUnit: 2,
      nativeUnitLabel: '2kg',
      isEstimatedKg: false,
      grade: '특',
      quantity: 20,
      pricePerUnit: 28000,
      pricePerKg: 14000,
      origin: '충남 논산시',
      ecoType: '친환경',
      sourceFormat: 'auction_result' as const,
    },
  ];

  const universe = buildUnifiedCropUniverse({
    curatedCrops: allCurated,
    liveItems: GARAK_SNAPSHOT_AUCTION.items,
    uploadedRecords: customExcelRecords,
  });

  // Curated baseline expanded well beyond 25 crops + synthesized live Garak items
  assert.ok(universe.curatedCount >= 55, `Expected >= 55 curated crops, got ${universe.curatedCount}`);
  assert.ok(universe.crops.length >= 70, `Expected >= 70 total analyzed crops, got ${universe.crops.length}`);
  assert.ok(universe.excludedNonCultivableCount >= 120, 'Should exclude seafood & imported-only items');
  assert.equal(universe.excelOnlyCount, 1);

  // Every cultivable item in Garak snapshot must resolve to a crop ID
  for (const item of GARAK_SNAPSHOT_AUCTION.items) {
    if (isCultivableDomesticItem(item.itemName, item.category)) {
      assert.ok(
        universe.liveItemToCropId.has(item.itemName),
        `Cultivable Garak item "${item.itemName}" was not mapped to ROI universe`
      );
    }
  }

  // Excel-only crop is synthesized with measured price
  const icePlant = universe.crops.find((c) => c.name === '아이스플랜트');
  assert.ok(icePlant);
  assert.equal(icePlant.dataSourceTier, 'excel_measured');
  assert.equal(icePlant.standardUnitKg, 2);
});

test('buildCrossAnalysisMatrix evaluates best-per-crop and expanded crop x cultivation-method combinations', () => {
  const allCurated = [...CROP_PROFILES, ...EXTRA_CURATED_CROPS];
  const universe = buildUnifiedCropUniverse({
    curatedCrops: allCurated,
    liveItems: GARAK_SNAPSHOT_AUCTION.items,
  });

  const bestPerCrop = buildCrossAnalysisMatrix({
    crops: universe.crops,
    areaPyeong: PYEONG_PER_10A,
    marketableRatePct: 88,
    laborCostMultiplier: 1,
    includeDepreciation: true,
    expandAllMethods: false,
  });
  assert.equal(bestPerCrop.length, universe.crops.length);

  const allCombos = buildCrossAnalysisMatrix({
    crops: universe.crops,
    areaPyeong: PYEONG_PER_10A,
    marketableRatePct: 88,
    laborCostMultiplier: 1,
    includeDepreciation: true,
    expandAllMethods: true,
  });
  assert.ok(allCombos.length > bestPerCrop.length, 'Expanding all methods should yield more rows than 1-per-crop');
  for (const row of allCombos) {
    assert.ok(Number.isFinite(row.sim.netProfit), `Invalid netProfit for ${row.rowKey}`);
    assert.ok(row.sim.monthlyCashflow.length === 12);
  }
});

test('12-month all_year Garak catalog includes 고수 as standalone curated crop and excludes 국산 seafood', () => {
  assert.ok(
    GARAK_SNAPSHOT_ALL_YEAR.itemCount >= 600,
    `Expected >= 600 year-round Garak items, got ${GARAK_SNAPSHOT_ALL_YEAR.itemCount}`
  );
  const gosuLive = GARAK_SNAPSHOT_ALL_YEAR.items.find((x) => x.itemName === '고수');
  assert.ok(gosuLive, '고수 must exist in 12-month Garak all_year snapshot');
  assert.equal(gosuLive.category, '양채·허브류');

  // Domestic seafood with 국산 suffix must still be excluded from farm cultivation
  assert.equal(isCultivableDomesticItem('게국산', '수산·건해'), false);
  assert.equal(isCultivableDomesticItem('김국산'), false);
  assert.equal(isCultivableDomesticItem('대하국산'), false);
  assert.equal(isCultivableDomesticItem('복어국산'), false);
  assert.equal(isCultivableDomesticItem('당근 수입', '수입품목'), false);

  const allCurated = [...CROP_PROFILES, ...EXTRA_CURATED_CROPS];
  const universe = buildUnifiedCropUniverse({
    curatedCrops: allCurated,
    liveItems: GARAK_SNAPSHOT_ALL_YEAR.items,
  });

  // 고수 must map to its own standalone 'cilantro' profile (not swallowed by 루꼴라)
  assert.equal(universe.liveItemToCropId.get('고수'), 'cilantro');
  const cilantro = universe.crops.find((c) => c.id === 'cilantro');
  assert.ok(cilantro);
  assert.equal(cilantro.name, '고수');
  assert.equal(cilantro.inLiveGarakCatalog, true);

  // Every cultivable item in the 660-item 12-month catalog must resolve to an ROI crop
  for (const item of GARAK_SNAPSHOT_ALL_YEAR.items) {
    if (isCultivableDomesticItem(item.itemName, item.category)) {
      assert.ok(
        universe.liveItemToCropId.has(item.itemName),
        `12-month cultivable Garak item "${item.itemName}" missing from ROI universe`
      );
    }
  }

  // Leading-dot decimal weight units (.75kg, .5kg) must parse as 0.75kg / 0.5kg, never 75kg / 5kg
  assert.equal(parseGarakUnit('.75kg', '수삼').kgEquivalent, 0.75);
  assert.equal(parseGarakUnit('.5kg', '고수').kgEquivalent, 0.5);

  // 블랙망고수박 must be classified as 과채류 (not 양채·허브류 via substring 고수)
  const blackWatermelon = GARAK_SNAPSHOT_ALL_YEAR.items.find((x) => x.itemName === '블랙망고수박');
  assert.ok(blackWatermelon);
  assert.equal(blackWatermelon.category, '과채류');
});

test('parseOriginToRegion accurately parses Korean provinces, special self-governing provinces, Garak combined strings, and bare sigungu', () => {
  assert.deepEqual(parseOriginToRegion('경기도 양평군'), {
    provinceId: 'gyeonggi',
    provinceName: '경기',
    sigungu: '양평군',
    rawOrigin: '경기도 양평군',
  });
  assert.equal(parseOriginToRegion('전남광주통합시 보성군').provinceId, 'jeonnam');
  assert.equal(parseOriginToRegion('전남광주통합시 보성군').sigungu, '보성군');
  assert.equal(parseOriginToRegion('강원특별자치도 평창군').provinceId, 'gangwon');
  assert.equal(parseOriginToRegion('전북특별자치도 완주군').provinceId, 'jeonbuk');
  assert.equal(parseOriginToRegion('제주특별자치도 서귀포시').provinceId, 'jeju');
  assert.equal(parseOriginToRegion('논산시').provinceId, 'chungnam');
  assert.equal(parseOriginToRegion('중국 수입').provinceId, 'other');
});

test('aggregateAuctionByRegion aggregates nationwide baseline and filters cleanly by item (e.g., 고수, 파)', () => {
  const all = aggregateAuctionByRegion(NATIONWIDE_ORIGIN_BASELINE_RECORDS, {
    item: '전체',
    variety: '전체',
    grade: '전체',
    unitRaw: '전체',
    search: '',
  });

  assert.equal(all.totals.recordCount, NATIONWIDE_ORIGIN_BASELINE_RECORDS.length);
  assert.ok(all.totals.activeProvinceCount >= 14, `Expected >= 14 active provinces, got ${all.totals.activeProvinceCount}`);
  assert.ok(all.totals.totalKg > 50000);
  assert.ok(all.totals.overallWeightedAvgKgPrice > 0);
  assert.ok(all.filterOptions.items.includes('고수'));
  assert.ok(all.filterOptions.items.includes('파'));

  // Filter strictly to 고수
  const gosu = aggregateAuctionByRegion(NATIONWIDE_ORIGIN_BASELINE_RECORDS, {
    item: '고수',
    variety: '전체',
    grade: '전체',
    unitRaw: '전체',
    search: '',
  });
  assert.equal(gosu.totals.recordCount, 5);
  assert.ok(gosu.totals.activeProvinceCount >= 4);
  const gyeonggi = gosu.provinceMap.get('gyeonggi')!;
  assert.equal(gyeonggi.recordCount, 2);
  assert.equal(gyeonggi.totalKg, (52 + 38) * 4);
  assert.equal(
    gyeonggi.weightedAvgKgPrice,
    Math.round((52 * 36000 + 38 * 38500) / ((52 + 38) * 4))
  );
  assert.ok(all.totals.top2ProvinceSharePct > 0 && all.totals.top2ProvinceSharePct <= 100);
  assert.ok(all.totals.overallYoYPct !== null);
});

test('classifyCobwebSignal distinguishes oversupply warning, tight supply opportunity, and stable high ROI', () => {
  const over = classifyCobwebSignal({
    volumeYoYPct: 8.4,
    volume3YrCagrPct: 6.2,
    priceYoYPct: -4.1,
    priceVs3YrAvgPct: -2.0,
    downsideMinus20NetProfit: 2000000,
    safetyMarginPct: 24,
  });
  assert.equal(over.signal, 'oversupply_warning');

  const opp = classifyCobwebSignal({
    volumeYoYPct: -4.8,
    volume3YrCagrPct: -3.2,
    priceYoYPct: 6.5,
    priceVs3YrAvgPct: 4.0,
    downsideMinus20NetProfit: 4500000,
    safetyMarginPct: 32,
  });
  assert.equal(opp.signal, 'opportunity_tight');

  const stable = classifyCobwebSignal({
    volumeYoYPct: 1.2,
    volume3YrCagrPct: 0.8,
    priceYoYPct: 1.5,
    priceVs3YrAvgPct: 2.0,
    downsideMinus20NetProfit: 5200000,
    safetyMarginPct: 28,
  });
  assert.equal(stable.signal, 'stable_high_roi');
});

test('evaluateCropSupplyRiskMatrix computes 5-year downside ROI, safety margin, and multi-year uploaded Excel override', () => {
  const allCurated = [...CROP_PROFILES, ...EXTRA_CURATED_CROPS];
  const matrix = evaluateCropSupplyRiskMatrix({
    crops: allCurated,
    areaPyeong: PYEONG_PER_10A,
  });

  assert.equal(matrix.length, allCurated.length);
  const shine = matrix.find((r) => r.crop.id === 'shine_muscat')!;
  assert.equal(shine.sourceKind, 'curated_5yr');
  assert.equal(shine.cobwebSignal, 'oversupply_warning');
  assert.ok(shine.volumeYoYPct > 5);
  assert.ok(shine.safetyMarginPct < 100);

  // Verify multi-year uploaded records override matching crops (chive, garlic, cilantro, sweet_potato)
  const overrides = buildUploadedCropPriceOverrides(MULTI_PERIOD_SAMPLE_AUCTION_RECORDS, allCurated);
  const matrixWithMultiExcel = evaluateCropSupplyRiskMatrix({
    crops: allCurated,
    uploadedRecords: MULTI_PERIOD_SAMPLE_AUCTION_RECORDS,
    uploadedOverrides: overrides,
    applyUploadedOverrides: true,
    areaPyeong: PYEONG_PER_10A,
  });

  const chiveExcel = matrixWithMultiExcel.find((r) => r.crop.id === 'chive')!;
  assert.equal(chiveExcel.sourceKind, 'excel_multiyear');
  assert.equal(chiveExcel.history.length, 3); // 2024, 2025, 2026
  assert.ok(chiveExcel.volumeYoYPct < 0); // 1860kg -> 1720kg
  assert.equal(chiveExcel.cobwebSignal, 'opportunity_tight');
});

test('buildUploadedMultiPeriodComparison & aggregateAuctionByRegion compute real multi-year volume, price, and origin shifts', () => {
  const comparison = buildUploadedMultiPeriodComparison(MULTI_PERIOD_SAMPLE_AUCTION_RECORDS);
  assert.ok(comparison);
  assert.equal(comparison.granularity, 'year');
  assert.deepEqual(
    comparison.periods.map((p) => p.periodKey),
    ['2024', '2025', '2026']
  );
  assert.equal(comparison.prevPeriodLabel, '2025');
  assert.equal(comparison.latestPeriodLabel, '2026');

  const garlicShift = comparison.itemShifts.find((s) => s.item === '마늘')!;
  assert.ok(garlicShift);
  assert.ok(garlicShift.volumeChangePct > 20); // 110*20 -> 138*20 = +25.5%
  assert.ok(garlicShift.priceChangePct < 0); // 4600 -> 3950

  const gosuShift = comparison.itemShifts.find((s) => s.item === '고수')!;
  assert.ok(gosuShift);
  assert.ok(gosuShift.expandingRegions.some((r) => r.includes('논산시')));

  const regionalYoY = aggregateAuctionByRegion(MULTI_PERIOD_SAMPLE_AUCTION_RECORDS, {
    item: '전체',
    variety: '전체',
    grade: '전체',
    unitRaw: '전체',
    search: '',
  });
  const gyeongnam = regionalYoY.provinceMap.get('gyeongnam')!;
  assert.ok(gyeongnam.yoyVolumeChangePct !== null && gyeongnam.yoyVolumeChangePct > 20);
  assert.ok(regionalYoY.totals.overallYoYPct !== null);
});

