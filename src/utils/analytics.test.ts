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
