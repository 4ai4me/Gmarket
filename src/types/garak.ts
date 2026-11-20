export type CropCategory =
  | '엽채·나물류'
  | '양채·허브류'
  | '과채류'
  | '근채류'
  | '양념채소'
  | '과실류'
  | '버섯류'
  | '두류·곡류';

export type CropDataSourceTier = 'curated' | 'archetype_inferred' | 'excel_measured';

export type CultivationMethodKey = 'open_field' | 'unheated_house' | 'heated_house' | 'smart_farm';

export type PeriodGranularity = 'year' | 'month' | 'week';

export type UnitBasis = 'kg' | 'native' | 'revenue_10a';

export interface ParsedUnit {
  rawUnit: string;
  kgEquivalent: number;
  nativeUnitLabel: string;
  nativeUnitCount: number;
  isEstimatedKg: boolean;
  unitCategory: 'weight' | 'count_bundle';
}

export interface CultivationMethodProfile {
  key: CultivationMethodKey;
  label: string;
  cycleDays: number;
  cyclesPerYear: number;
  yieldKgPer10a: number;
  seedCostPer10a: number;
  materialCostPer10a: number;
  laborCostPer10a: number;
  packagingShippingPerKg: number;
  facilityCapexPer10a: number;
  depreciationYears: number;
  commissionRatePct: number;
  notes: string;
}

export interface CropProfile {
  id: string;
  name: string;
  aliases: string[];
  category: CropCategory;
  representativeVariety: string;
  standardUnitLabel: string;
  standardUnitKg: number;
  nativeUnitType: string;
  nativeUnitDescription: string;
  /** 12-month reference wholesale price in KRW per kg (Jan=index 0 .. Dec=index 11) */
  monthlyPricePerKg: [
    number, number, number, number, number, number,
    number, number, number, number, number, number
  ];
  /** Relative weekly volatility amplitude (0.04 ~ 0.18) for week-level series */
  weeklyVolatility: number;
  sowingMonths: number[];
  harvestMonths: number[];
  peakPriceMonths: number[];
  difficulty: '초급' | '중급' | '고급';
  soilAndClimateNote: string;
  keyRiskNote: string;
  methods: CultivationMethodProfile[];
  /** Provenance: curated precision DB, archetype cross-model for Garak live item, or Excel-only item */
  dataSourceTier?: CropDataSourceTier;
  /** Real Garak trading units observed from live catalog API */
  garakLiveUnits?: string[];
  /** True when present in the currently fetched live Garak Market catalog */
  inLiveGarakCatalog?: boolean;
}

export interface GarakLiveItem {
  itemName: string;
  category: string;
  units: string[];
  hasWeightUnit: boolean;
  hasNonWeightUnit: boolean;
  sourceModes?: ('auction' | 'summary')[];
}

export interface GarakLiveResponse {
  source: 'live' | 'snapshot';
  date: string;
  mode: 'all_year' | 'auction' | 'summary';
  fetchedAt: string;
  itemCount: number;
  rawOptionCount: number;
  cached?: boolean;
  sampledDatesCount?: number;
  items: GarakLiveItem[];
}

export interface AuctionRecord {
  id: string;
  date: string;
  corporation: string;
  item: string;
  variety: string;
  unitRaw: string;
  kgPerUnit: number;
  nativeUnitLabel: string;
  isEstimatedKg: boolean;
  grade: string;
  quantity: number;
  pricePerUnit: number;
  pricePerKg: number;
  origin: string;
  ecoType: string;
  sourceFormat: 'auction_result' | 'item_summary';
  /** Optional prior-year shipment weight (kg) for regional growth/decline comparison */
  prevYearKg?: number;
}

export interface ExcelParseResult {
  records: AuctionRecord[];
  skippedRows: number;
  detectedFormat: 'auction_result' | 'item_summary' | 'unknown';
  detectedDate: string | null;
  warnings: string[];
  errors: string[];
}

export interface AggregatedAuctionGroup {
  key: string;
  item: string;
  variety: string;
  unitRaw: string;
  kgPerUnit: number;
  grade: string;
  recordCount: number;
  totalQuantity: number;
  totalKg: number;
  weightedAvgUnitPrice: number;
  weightedAvgKgPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  origins: string[];
}

export interface CropRankingRow {
  crop: CropProfile;
  periodLabel: string;
  pricePerKg: number;
  pricePerNativeUnit: number;
  annualAvgPricePerKg: number;
  vsAnnualAvgPct: number;
  minMonthlyKgPrice: number;
  maxMonthlyKgPrice: number;
  priceSpreadRatio: number;
  bestMethod: CultivationMethodProfile;
  estimatedAnnualRevenuePer10a: number;
  estimatedAnnualNetProfitPer10a: number;
  hasUploadedOverride: boolean;
  uploadedRecordCount: number;
}

export interface RoiSimulationInput {
  crop: CropProfile;
  methodKey: CultivationMethodKey;
  areaPyeong: number;
  pricePerKg: number;
  cyclesPerYear: number;
  marketableRatePct: number;
  commissionRatePct: number;
  laborCostMultiplier: number;
  includeDepreciation: boolean;
}

export interface MonthlyCashflowPoint {
  month: number;
  label: string;
  cost: number;
  revenue: number;
  net: number;
  cumulative: number;
}

export interface RoiSimulationResult {
  areaPyeong: number;
  area10a: number;
  annualYieldKg: number;
  marketableYieldKg: number;
  marketableNativeUnits: number;
  effectivePricePerKg: number;
  effectivePricePerNativeUnit: number;
  grossRevenue: number;
  commissionCost: number;
  packagingShippingCost: number;
  seedCost: number;
  materialCost: number;
  laborCost: number;
  annualDepreciation: number;
  totalOperatingCost: number;
  totalCostWithCapex: number;
  netProfit: number;
  netProfitPerPyeong: number;
  profitMarginPct: number;
  roiOnOperatingCostPct: number;
  totalCapex: number;
  paybackYears: number | null;
  breakEvenPricePerKg: number;
  breakEvenPricePerNativeUnit: number;
  monthlyCashflow: MonthlyCashflowPoint[];
}
