import type { AuctionRecord } from '../types/garak';

export type KoreaProvinceId =
  | 'seoul'
  | 'incheon'
  | 'gyeonggi'
  | 'gangwon'
  | 'chungbuk'
  | 'chungnam'
  | 'sejong'
  | 'daejeon'
  | 'gyeongbuk'
  | 'daegu'
  | 'jeonbuk'
  | 'jeonnam'
  | 'gwangju'
  | 'gyeongnam'
  | 'ulsan'
  | 'busan'
  | 'jeju'
  | 'other';

export interface KoreaProvinceMeta {
  id: KoreaProvinceId;
  shortName: string;
  fullName: string;
  regionGroup: '수도권' | '강원권' | '충청권' | '호남권' | '영남권' | '제주권' | '기타';
}

export const KOREA_PROVINCES: KoreaProvinceMeta[] = [
  { id: 'seoul', shortName: '서울', fullName: '서울특별시', regionGroup: '수도권' },
  { id: 'incheon', shortName: '인천', fullName: '인천광역시', regionGroup: '수도권' },
  { id: 'gyeonggi', shortName: '경기', fullName: '경기도', regionGroup: '수도권' },
  { id: 'gangwon', shortName: '강원', fullName: '강원특별자치도', regionGroup: '강원권' },
  { id: 'chungbuk', shortName: '충북', fullName: '충청북도', regionGroup: '충청권' },
  { id: 'chungnam', shortName: '충남', fullName: '충청남도', regionGroup: '충청권' },
  { id: 'sejong', shortName: '세종', fullName: '세종특별자치시', regionGroup: '충청권' },
  { id: 'daejeon', shortName: '대전', fullName: '대전광역시', regionGroup: '충청권' },
  { id: 'gyeongbuk', shortName: '경북', fullName: '경상북도', regionGroup: '영남권' },
  { id: 'daegu', shortName: '대구', fullName: '대구광역시', regionGroup: '영남권' },
  { id: 'jeonbuk', shortName: '전북', fullName: '전북특별자치도', regionGroup: '호남권' },
  { id: 'jeonnam', shortName: '전남', fullName: '전라남도', regionGroup: '호남권' },
  { id: 'gwangju', shortName: '광주', fullName: '광주광역시', regionGroup: '호남권' },
  { id: 'gyeongnam', shortName: '경남', fullName: '경상남도', regionGroup: '영남권' },
  { id: 'ulsan', shortName: '울산', fullName: '울산광역시', regionGroup: '영남권' },
  { id: 'busan', shortName: '부산', fullName: '부산광역시', regionGroup: '영남권' },
  { id: 'jeju', shortName: '제주', fullName: '제주특별자치도', regionGroup: '제주권' },
];

export const PROVINCE_BY_ID = new Map<KoreaProvinceId, KoreaProvinceMeta>(
  KOREA_PROVINCES.map((p) => [p.id, p])
);

const SIGUNGU_TO_PROVINCE: Array<[RegExp, KoreaProvinceId]> = [
  [/양평|포천|남양주|이천|여주|평택|안성|화성|파주|연천|가평|고양|김포|용인|광주시|양주|의정부|시흥|구리|하남/, 'gyeonggi'],
  [/평창|홍천|횡성|철원|화천|양구|인제|강릉|춘천|원주|정선|태백|영월|삼척|속초|고성군|동해|양양/, 'gangwon'],
  [/음성|충주|제천|괴산|진천|보은|옥천|영동|청주|단양|증평/, 'chungbuk'],
  [/논산|부여|예산|천안|아산|당진|서산|태안|홍성|청양|공주|금산|보령|서천|계룡/, 'chungnam'],
  [/완주|익산|김제|정읍|고창|부안|남원|임실|순창|진안|무주|장수|전주|군산/, 'jeonbuk'],
  [/보성|해남|무안|나주|담양|곡성|구례|고흥|화순|장흥|강진|영암|함평|영광|장성|완도|진도|신안|순천|여수|광양|목포/, 'jeonnam'],
  [/청송|성주|의성|안동|영주|상주|문경|영천|경산|김천|구미|영덕|울진|포항|경주|예천|봉화|영양|청도|고령|칠곡|군위/, 'gyeongbuk'],
  [/밀양|창녕|진주|함안|거창|합천|산청|하동|남해|사천|통영|거제|김해|양산|창원|의령|함양|고성/, 'gyeongnam'],
  [/서귀포|제주/, 'jeju'],
  [/강화|옹진|인천/, 'incheon'],
  [/기장|부산/, 'busan'],
  [/울주|울산/, 'ulsan'],
  [/달성|대구/, 'daegu'],
  [/유성|대덕|대전/, 'daejeon'],
  [/세종/, 'sejong'],
  [/광산|광주/, 'gwangju'],
  [/서울/, 'seoul'],
];

export interface ParsedOriginRegion {
  provinceId: KoreaProvinceId;
  provinceName: string;
  sigungu: string;
  rawOrigin: string;
}

/**
 * Parses a Garak Market origin string (e.g. "경기도 양평군", "전남광주통합시 보성군",
 * "강원특별자치도 평창군", "경남 밀양시", "논산시") into standardized province & city/county.
 */
export function parseOriginToRegion(originRaw: string): ParsedOriginRegion {
  const raw = (originRaw || '').trim();
  if (!raw || raw === '-') {
    return { provinceId: 'other', provinceName: '미상/기타', sigungu: '미상', rawOrigin: raw || '-' };
  }
  if (/수입|중국|미국|칠레|필리핀|페루|태국|베트남|호주|뉴질랜드|에콰도르|콜롬비아/.test(raw)) {
    return { provinceId: 'other', provinceName: '수입/해외', sigungu: raw, rawOrigin: raw };
  }

  let provinceId: KoreaProvinceId = 'other';

  // Explicit province prefixes first (including Garak's "전남광주통합시 보성군" format)
  if (/^전남|전라남도|전남광주/.test(raw)) provinceId = 'jeonnam';
  else if (/^전북|전라북도/.test(raw)) provinceId = 'jeonbuk';
  else if (/^경기/.test(raw)) provinceId = 'gyeonggi';
  else if (/^강원/.test(raw)) provinceId = 'gangwon';
  else if (/^충북|충청북도/.test(raw)) provinceId = 'chungbuk';
  else if (/^충남|충청남도/.test(raw)) provinceId = 'chungnam';
  else if (/^경북|경상북도/.test(raw)) provinceId = 'gyeongbuk';
  else if (/^경남|경상남도/.test(raw)) provinceId = 'gyeongnam';
  else if (/^제주/.test(raw)) provinceId = 'jeju';
  else if (/^세종/.test(raw)) provinceId = 'sejong';
  else if (/^대전/.test(raw)) provinceId = 'daejeon';
  else if (/^대구/.test(raw)) provinceId = 'daegu';
  else if (/^광주/.test(raw)) provinceId = 'gwangju';
  else if (/^울산/.test(raw)) provinceId = 'ulsan';
  else if (/^부산/.test(raw)) provinceId = 'busan';
  else if (/^인천/.test(raw)) provinceId = 'incheon';
  else if (/^서울/.test(raw)) provinceId = 'seoul';
  else {
    for (const [pattern, pid] of SIGUNGU_TO_PROVINCE) {
      if (pattern.test(raw)) {
        provinceId = pid;
        break;
      }
    }
  }

  // Extract city/county token
  const tokens = raw.split(/\s+/).filter(Boolean);
  const sigungu = tokens.length >= 2 ? tokens.slice(1).join(' ') : tokens[0];
  const meta = PROVINCE_BY_ID.get(provinceId);

  return {
    provinceId,
    provinceName: meta ? meta.shortName : '기타',
    sigungu,
    rawOrigin: raw,
  };
}

export interface OriginMapFilters {
  item: string; // '전체' or item name
  variety: string; // '전체' or variety
  grade: string; // '전체' or grade
  unitRaw: string; // '전체' or unitRaw
  search: string;
  /** Optional 1..12 month range (supports wrap-around e.g. startMonth=11, endMonth=2 for winter) */
  startMonth?: number;
  endMonth?: number;
  /** Optional YYYY-MM-DD exact date bounds (applied to dated records such as uploaded Excel) */
  startDate?: string;
  endDate?: string;
}

/**
 * Returns the ordered list of calendar months (1..12) covered by [startMonth..endMonth].
 * Supports wrap-around winter intervals such as 11 -> 2 => [11, 12, 1, 2].
 */
export function getMonthsInRange(startMonth = 1, endMonth = 12): number[] {
  const s = Math.min(12, Math.max(1, Math.round(startMonth)));
  const e = Math.min(12, Math.max(1, Math.round(endMonth)));
  const months: number[] = [];
  let curr = s;
  for (let i = 0; i < 12; i++) {
    months.push(curr);
    if (curr === e) break;
    curr = curr === 12 ? 1 : curr + 1;
  }
  return months;
}

export function extractMonthFromDateStr(dateStr?: string): number | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim().replace(/\./g, '-');
  const m = cleaned.match(/^\d{4}-(\d{1,2})/);
  if (!m) return null;
  const num = Number(m[1]);
  return num >= 1 && num <= 12 ? num : null;
}

function normalizeDateIso(dateStr?: string): string {
  return (dateStr || '').trim().replace(/\./g, '-').slice(0, 10);
}

export interface SigunguAuctionSummary {
  key: string;
  provinceId: KoreaProvinceId;
  provinceName: string;
  sigungu: string;
  rawOrigin: string;
  recordCount: number;
  totalQuantity: number;
  totalKg: number;
  prevYearKg: number;
  yoyVolumeChangePct: number | null;
  totalAmountKrw: number;
  weightedAvgKgPrice: number;
  weightedAvgUnitPrice: number;
  topItem: string;
  topGrade: string;
}

export interface ProvinceAuctionSummary {
  provinceId: KoreaProvinceId;
  provinceName: string;
  fullName: string;
  recordCount: number;
  totalQuantity: number;
  totalKg: number;
  prevYearKg: number;
  yoyVolumeChangePct: number | null;
  totalAmountKrw: number;
  weightedAvgKgPrice: number;
  weightedAvgUnitPrice: number;
  minKgPrice: number;
  maxKgPrice: number;
  shareOfTotalKgPct: number;
  shareOfTotalQtyPct: number;
  shareOfTotalAmountPct: number;
  topOrigins: SigunguAuctionSummary[];
  topItems: Array<{ item: string; totalKg: number; sharePct: number }>;
  gradeBreakdown: Array<{ grade: string; totalQuantity: number; sharePct: number }>;
}

export interface EnrichedOriginRecord extends AuctionRecord {
  provinceId: KoreaProvinceId;
  provinceName: string;
  sigungu: string;
  totalKg: number;
  totalAmountKrw: number;
}

export interface RegionalAuctionAggregation {
  filteredRecords: EnrichedOriginRecord[];
  provinces: ProvinceAuctionSummary[];
  provinceMap: Map<KoreaProvinceId, ProvinceAuctionSummary>;
  sigunguList: SigunguAuctionSummary[];
  totals: {
    recordCount: number;
    totalQuantity: number;
    totalKg: number;
    totalAmountKrw: number;
    overallWeightedAvgKgPrice: number;
    minKgPrice: number;
    maxKgPrice: number;
    activeProvinceCount: number;
    activeSigunguCount: number;
    otherRegionRecordCount: number;
    top2ProvinceSharePct: number;
    overallYoYPct: number | null;
  };
  filterOptions: {
    items: string[];
    varieties: string[];
    grades: string[];
    units: string[];
    minDate: string | null;
    maxDate: string | null;
  };
}

export function aggregateAuctionByRegion(
  records: AuctionRecord[],
  filters: OriginMapFilters
): RegionalAuctionAggregation {
  // 1. Collect global filter dropdown options (varieties cascade from selected item)
  const itemSet = new Set<string>();
  const varietySet = new Set<string>();
  const gradeSet = new Set<string>();
  const unitSet = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const r of records) {
    if (r.item) itemSet.add(r.item);
    const iso = normalizeDateIso(r.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      if (!minDate || iso < minDate) minDate = iso;
      if (!maxDate || iso > maxDate) maxDate = iso;
    }
    if (filters.item === '전체' || r.item === filters.item) {
      if (r.variety && r.variety !== '-') varietySet.add(r.variety);
      if (r.grade) gradeSet.add(r.grade);
      if (r.unitRaw) unitSet.add(r.unitRaw);
    }
  }

  // Period filtering state
  const startMonth = filters.startMonth ?? 1;
  const endMonth = filters.endMonth ?? 12;
  const selectedMonths = getMonthsInRange(startMonth, endMonth);
  const isMonthFiltered = selectedMonths.length < 12;
  const selectedMonthSet = new Set(selectedMonths);
  const startDateIso = normalizeDateIso(filters.startDate);
  const endDateIso = normalizeDateIso(filters.endDate);
  const hasDateFilter = Boolean(startDateIso || endDateIso);

  // 2. Filter and enrich records
  const q = filters.search.trim().toLowerCase();
  const filteredRecords: EnrichedOriginRecord[] = [];

  for (const r of records) {
    if (filters.item !== '전체' && r.item !== filters.item) continue;
    if (filters.variety !== '전체' && r.variety !== filters.variety) continue;
    if (filters.grade !== '전체' && r.grade !== filters.grade) continue;
    if (filters.unitRaw !== '전체' && r.unitRaw !== filters.unitRaw) continue;

    // Exact date filter applies to dated records without seasonal weight curves (e.g. uploaded Excel)
    const hasSeasonalCurve =
      Array.isArray(r.monthlyVolumeWeights) && r.monthlyVolumeWeights.length === 12;
    if (hasDateFilter && !hasSeasonalCurve) {
      const rDate = normalizeDateIso(r.date);
      if (startDateIso && rDate && rDate < startDateIso) continue;
      if (endDateIso && rDate && rDate > endDateIso) continue;
    }

    // Month range filter
    let periodScale = 1;
    let periodPriceFactor = 1;
    if (isMonthFiltered) {
      if (hasSeasonalCurve) {
        const weights = r.monthlyVolumeWeights!;
        const sumAll = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
        const sumSelected = selectedMonths.reduce((acc, m) => acc + Math.max(0, weights[m - 1] || 0), 0);
        if (sumAll <= 0 || sumSelected <= 0) {
          // Off-season in this region for the selected months -> exclude!
          continue;
        }
        periodScale = sumSelected / sumAll;
        // Scarcity price adjustment: lower regional supply intensity in shoulder/off-peak months commands higher price
        const avgSelectedWeight = sumSelected / selectedMonths.length;
        const maxWeight = Math.max(...weights, 1);
        const scarcityRatio = 1 - Math.min(1, avgSelectedWeight / maxWeight);
        periodPriceFactor = 1 + scarcityRatio * 0.22;
      } else {
        const recMonth = extractMonthFromDateStr(r.date);
        if (recMonth !== null && !selectedMonthSet.has(recMonth)) {
          continue;
        }
      }
    }

    const region = parseOriginToRegion(r.origin);
    if (q) {
      const hay = `${r.item} ${r.variety} ${r.origin} ${region.provinceName} ${region.sigungu} ${r.corporation} ${r.grade} ${r.unitRaw} ${r.shipmentWindowLabel || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const scaledQuantity =
      periodScale === 1 ? r.quantity : Math.max(1, Math.round(r.quantity * periodScale));
    const scaledPricePerUnit =
      periodPriceFactor === 1 ? r.pricePerUnit : Math.round(r.pricePerUnit * periodPriceFactor);
    const scaledPricePerKg =
      r.kgPerUnit > 0 ? Math.round(scaledPricePerUnit / r.kgPerUnit) : scaledPricePerUnit;
    const totalKg = Math.round(r.kgPerUnit * scaledQuantity * 100) / 100;
    const totalAmountKrw = Math.round(scaledPricePerUnit * scaledQuantity);
    const scaledPrevYearKg =
      typeof r.prevYearKg === 'number'
        ? Math.round(r.prevYearKg * periodScale * 10) / 10
        : undefined;

    filteredRecords.push({
      ...r,
      quantity: scaledQuantity,
      pricePerUnit: scaledPricePerUnit,
      pricePerKg: scaledPricePerKg,
      prevYearKg: scaledPrevYearKg,
      provinceId: region.provinceId,
      provinceName: region.provinceName,
      sigungu: region.sigungu,
      totalKg,
      totalAmountKrw,
    });
  }

  // 3. Accumulate totals & per-province / per-sigungu stats (including multi-year comparison if present)
  const distinctYears = Array.from(
    new Set(
      filteredRecords
        .map((r) => (r.date || '').slice(0, 4))
        .filter((y) => /^20\d{2}$/.test(y))
    )
  ).sort();
  const hasMultiYearUploaded = distinctYears.length >= 2;
  const latestYearStr = hasMultiYearUploaded ? distinctYears[distinctYears.length - 1] : null;
  const prevYearStr = hasMultiYearUploaded ? distinctYears[distinctYears.length - 2] : null;

  let totalQuantity = 0;
  let totalKg = 0;
  let totalPrevYearKg = 0;
  let totalCurrForYoYKg = 0;
  let totalAmountKrw = 0;
  let globalMinKg = Infinity;
  let globalMaxKg = 0;
  let otherRegionRecordCount = 0;

  interface ProvAccum {
    recordCount: number;
    totalQuantity: number;
    totalKg: number;
    currYearKg: number;
    prevYearKg: number;
    hasYoYData: boolean;
    totalAmountKrw: number;
    minKgPrice: number;
    maxKgPrice: number;
    itemKgMap: Map<string, number>;
    gradeQtyMap: Map<string, number>;
  }

  interface SigunguAccum {
    provinceId: KoreaProvinceId;
    provinceName: string;
    sigungu: string;
    rawOrigin: string;
    recordCount: number;
    totalQuantity: number;
    totalKg: number;
    currYearKg: number;
    prevYearKg: number;
    hasYoYData: boolean;
    totalAmountKrw: number;
    itemKgMap: Map<string, number>;
    gradeQtyMap: Map<string, number>;
  }

  const provAccums = new Map<KoreaProvinceId, ProvAccum>();
  const sigunguAccums = new Map<string, SigunguAccum>();

  for (const r of filteredRecords) {
    totalQuantity += r.quantity;
    totalKg += r.totalKg;
    totalAmountKrw += r.totalAmountKrw;
    if (r.pricePerKg > 0 && r.pricePerKg < globalMinKg) globalMinKg = r.pricePerKg;
    if (r.pricePerKg > globalMaxKg) globalMaxKg = r.pricePerKg;

    const rYear = (r.date || '').slice(0, 4);
    if (hasMultiYearUploaded) {
      if (rYear === latestYearStr) totalCurrForYoYKg += r.totalKg;
      else if (rYear === prevYearStr) totalPrevYearKg += r.totalKg;
    } else if (typeof r.prevYearKg === 'number' && r.prevYearKg > 0) {
      totalCurrForYoYKg += r.totalKg;
      totalPrevYearKg += r.prevYearKg;
    }

    if (r.provinceId === 'other') {
      otherRegionRecordCount += 1;
      continue;
    }

    let p = provAccums.get(r.provinceId);
    if (!p) {
      p = {
        recordCount: 0,
        totalQuantity: 0,
        totalKg: 0,
        currYearKg: 0,
        prevYearKg: 0,
        hasYoYData: false,
        totalAmountKrw: 0,
        minKgPrice: Infinity,
        maxKgPrice: 0,
        itemKgMap: new Map(),
        gradeQtyMap: new Map(),
      };
      provAccums.set(r.provinceId, p);
    }
    p.recordCount += 1;
    p.totalQuantity += r.quantity;
    p.totalKg += r.totalKg;
    p.totalAmountKrw += r.totalAmountKrw;
    if (hasMultiYearUploaded) {
      if (rYear === latestYearStr) {
        p.currYearKg += r.totalKg;
        p.hasYoYData = true;
      } else if (rYear === prevYearStr) {
        p.prevYearKg += r.totalKg;
        p.hasYoYData = true;
      }
    } else if (typeof r.prevYearKg === 'number' && r.prevYearKg > 0) {
      p.currYearKg += r.totalKg;
      p.prevYearKg += r.prevYearKg;
      p.hasYoYData = true;
    }
    if (r.pricePerKg > 0 && r.pricePerKg < p.minKgPrice) p.minKgPrice = r.pricePerKg;
    if (r.pricePerKg > p.maxKgPrice) p.maxKgPrice = r.pricePerKg;
    p.itemKgMap.set(r.item, (p.itemKgMap.get(r.item) || 0) + r.totalKg);
    p.gradeQtyMap.set(r.grade || '일반', (p.gradeQtyMap.get(r.grade || '일반') || 0) + r.quantity);

    const sKey = `${r.provinceId}::${r.sigungu}`;
    let s = sigunguAccums.get(sKey);
    if (!s) {
      s = {
        provinceId: r.provinceId,
        provinceName: r.provinceName,
        sigungu: r.sigungu,
        rawOrigin: r.origin,
        recordCount: 0,
        totalQuantity: 0,
        totalKg: 0,
        currYearKg: 0,
        prevYearKg: 0,
        hasYoYData: false,
        totalAmountKrw: 0,
        itemKgMap: new Map(),
        gradeQtyMap: new Map(),
      };
      sigunguAccums.set(sKey, s);
    }
    s.recordCount += 1;
    s.totalQuantity += r.quantity;
    s.totalKg += r.totalKg;
    s.totalAmountKrw += r.totalAmountKrw;
    if (hasMultiYearUploaded) {
      if (rYear === latestYearStr) {
        s.currYearKg += r.totalKg;
        s.hasYoYData = true;
      } else if (rYear === prevYearStr) {
        s.prevYearKg += r.totalKg;
        s.hasYoYData = true;
      }
    } else if (typeof r.prevYearKg === 'number' && r.prevYearKg > 0) {
      s.currYearKg += r.totalKg;
      s.prevYearKg += r.prevYearKg;
      s.hasYoYData = true;
    }
    s.itemKgMap.set(r.item, (s.itemKgMap.get(r.item) || 0) + r.totalKg);
    s.gradeQtyMap.set(r.grade || '일반', (s.gradeQtyMap.get(r.grade || '일반') || 0) + r.quantity);
  }

  const calcYoY = (prev: number, curr: number, enabled: boolean): number | null => {
    if (!enabled || prev <= 0) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  const sigunguList: SigunguAuctionSummary[] = Array.from(sigunguAccums.entries())
    .map(([key, s]) => {
      const topItem =
        Array.from(s.itemKgMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      const topGrade =
        Array.from(s.gradeQtyMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      return {
        key,
        provinceId: s.provinceId,
        provinceName: s.provinceName,
        sigungu: s.sigungu,
        rawOrigin: s.rawOrigin,
        recordCount: s.recordCount,
        totalQuantity: s.totalQuantity,
        totalKg: Math.round(s.totalKg * 10) / 10,
        prevYearKg: Math.round(s.prevYearKg * 10) / 10,
        yoyVolumeChangePct: calcYoY(s.prevYearKg, s.currYearKg, s.hasYoYData),
        totalAmountKrw: s.totalAmountKrw,
        weightedAvgKgPrice: s.totalKg > 0 ? Math.round(s.totalAmountKrw / s.totalKg) : 0,
        weightedAvgUnitPrice:
          s.totalQuantity > 0 ? Math.round(s.totalAmountKrw / s.totalQuantity) : 0,
        topItem,
        topGrade,
      };
    })
    .sort((a, b) => b.totalKg - a.totalKg);

  const provinces: ProvinceAuctionSummary[] = KOREA_PROVINCES.map((meta) => {
    const p = provAccums.get(meta.id);
    if (!p) {
      return {
        provinceId: meta.id,
        provinceName: meta.shortName,
        fullName: meta.fullName,
        recordCount: 0,
        totalQuantity: 0,
        totalKg: 0,
        prevYearKg: 0,
        yoyVolumeChangePct: null,
        totalAmountKrw: 0,
        weightedAvgKgPrice: 0,
        weightedAvgUnitPrice: 0,
        minKgPrice: 0,
        maxKgPrice: 0,
        shareOfTotalKgPct: 0,
        shareOfTotalQtyPct: 0,
        shareOfTotalAmountPct: 0,
        topOrigins: [],
        topItems: [],
        gradeBreakdown: [],
      };
    }

    const topOrigins = sigunguList.filter((s) => s.provinceId === meta.id);
    const topItems = Array.from(p.itemKgMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([item, kg]) => ({
        item,
        totalKg: Math.round(kg * 10) / 10,
        sharePct: p.totalKg > 0 ? Math.round((kg / p.totalKg) * 1000) / 10 : 0,
      }));
    const gradeBreakdown = Array.from(p.gradeQtyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([grade, qty]) => ({
        grade,
        totalQuantity: qty,
        sharePct: p.totalQuantity > 0 ? Math.round((qty / p.totalQuantity) * 1000) / 10 : 0,
      }));

    return {
      provinceId: meta.id,
      provinceName: meta.shortName,
      fullName: meta.fullName,
      recordCount: p.recordCount,
      totalQuantity: p.totalQuantity,
      totalKg: Math.round(p.totalKg * 10) / 10,
      prevYearKg: Math.round(p.prevYearKg * 10) / 10,
      yoyVolumeChangePct: calcYoY(p.prevYearKg, p.currYearKg, p.hasYoYData),
      totalAmountKrw: p.totalAmountKrw,
      weightedAvgKgPrice: p.totalKg > 0 ? Math.round(p.totalAmountKrw / p.totalKg) : 0,
      weightedAvgUnitPrice:
        p.totalQuantity > 0 ? Math.round(p.totalAmountKrw / p.totalQuantity) : 0,
      minKgPrice: p.minKgPrice === Infinity ? 0 : p.minKgPrice,
      maxKgPrice: p.maxKgPrice,
      shareOfTotalKgPct: totalKg > 0 ? Math.round((p.totalKg / totalKg) * 1000) / 10 : 0,
      shareOfTotalQtyPct:
        totalQuantity > 0 ? Math.round((p.totalQuantity / totalQuantity) * 1000) / 10 : 0,
      shareOfTotalAmountPct:
        totalAmountKrw > 0 ? Math.round((p.totalAmountKrw / totalAmountKrw) * 1000) / 10 : 0,
      topOrigins,
      topItems,
      gradeBreakdown,
    };
  });

  const provinceMap = new Map<KoreaProvinceId, ProvinceAuctionSummary>(
    provinces.map((p) => [p.provinceId, p])
  );

  const sortedByShare = [...provinces]
    .filter((p) => p.recordCount > 0)
    .sort((a, b) => b.totalKg - a.totalKg);
  const top2ProvinceSharePct =
    Math.round(
      ((sortedByShare[0]?.shareOfTotalKgPct || 0) + (sortedByShare[1]?.shareOfTotalKgPct || 0)) *
        10
    ) / 10;

  const overallYoYPct =
    totalPrevYearKg > 0
      ? Math.round(((totalCurrForYoYKg - totalPrevYearKg) / totalPrevYearKg) * 1000) / 10
      : null;

  return {
    filteredRecords,
    provinces,
    provinceMap,
    sigunguList,
    totals: {
      recordCount: filteredRecords.length,
      totalQuantity,
      totalKg: Math.round(totalKg * 10) / 10,
      totalAmountKrw,
      overallWeightedAvgKgPrice: totalKg > 0 ? Math.round(totalAmountKrw / totalKg) : 0,
      minKgPrice: globalMinKg === Infinity ? 0 : globalMinKg,
      maxKgPrice: globalMaxKg,
      activeProvinceCount: provinces.filter((p) => p.recordCount > 0).length,
      activeSigunguCount: sigunguList.length,
      otherRegionRecordCount,
      top2ProvinceSharePct,
      overallYoYPct,
    },
    filterOptions: {
      items: Array.from(itemSet).sort((a, b) => a.localeCompare(b, 'ko')),
      varieties: Array.from(varietySet).sort((a, b) => a.localeCompare(b, 'ko')),
      grades: Array.from(gradeSet).sort((a, b) => a.localeCompare(b, 'ko')),
      units: Array.from(unitSet).sort((a, b) => a.localeCompare(b, 'ko')),
      minDate,
      maxDate,
    },
  };
}

export interface MonthlyNationwideShipmentPoint {
  month: number; // 1..12
  totalKg: number;
  sharePct: number;
  activeProvinceCount: number;
  activeProvinces: string[];
  offSeasonProvinces: string[];
  weightedAvgKgPrice: number;
  isGapMonth: boolean;
  isLowSupplyMonth: boolean;
}

export interface RegionalShipmentRow {
  key: string;
  provinceId: KoreaProvinceId;
  provinceName: string;
  sigungu?: string;
  label: string;
  totalAnnualKg: number;
  weightedAvgKgPrice: number;
  /** 12-month estimated/actual kg volume (Jan=0 .. Dec=11) */
  monthlyKg: number[];
  /** 12-month normalized intensity 0..100 relative to this region's peak month */
  monthlyIntensity: number[];
  activeMonths: number[];
  peakMonths: number[];
  offSeasonMonths: number[];
  windowLabel: string;
}

export interface RegionalGapWindow {
  months: number[];
  startMonth: number;
  endMonth: number;
  label: string;
  avgMonthlySharePct: number;
  competingProvinces: string[];
  offSeasonProvinces: string[];
  estAvgKgPrice: number;
  insight: string;
}

export interface RegionalShipmentSchedule {
  monthlyNationwide: MonthlyNationwideShipmentPoint[];
  provinceRows: RegionalShipmentRow[];
  sigunguRows: RegionalShipmentRow[];
  gapMonths: number[];
  gapWindows: RegionalGapWindow[];
  timingDiffSummary: string;
  hasMultiMonthData: boolean;
}

function formatMonthsShortKo(months: number[]): string {
  if (months.length === 0) return '없음';
  const sorted = Array.from(new Set(months)).sort((a, b) => a - b);
  if (sorted.length === 12) return '연중(1~12월)';
  const ranges: string[] = [];
  let s = sorted[0];
  let p = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === p + 1) {
      p = sorted[i];
    } else {
      ranges.push(s === p ? `${s}월` : `${s}~${p}월`);
      s = sorted[i];
      p = sorted[i];
    }
  }
  ranges.push(s === p ? `${s}월` : `${s}~${p}월`);
  return ranges.join('·');
}

/**
 * Analyzes 12-month shipment timing differences across regions (provinces & sigungu)
 * and identifies nationwide off-season / low-competition gap windows (타지역 미출하 공백기).
 */
export function buildRegionalShipmentSchedule(
  records: AuctionRecord[],
  filters: Omit<OriginMapFilters, 'startMonth' | 'endMonth'>
): RegionalShipmentSchedule {
  const q = filters.search.trim().toLowerCase();
  const startDateIso = normalizeDateIso(filters.startDate);
  const endDateIso = normalizeDateIso(filters.endDate);
  const hasDateFilter = Boolean(startDateIso || endDateIso);

  interface Bucket {
    provinceId: KoreaProvinceId;
    provinceName: string;
    sigungu?: string;
    label: string;
    monthlyKg: number[];
    monthlyAmt: number[];
    windowLabels: Set<string>;
  }

  const provBuckets = new Map<KoreaProvinceId, Bucket>();
  const sigunguBuckets = new Map<string, Bucket>();
  const globalMonthKg = Array(12).fill(0);
  const globalMonthAmt = Array(12).fill(0);

  for (const r of records) {
    if (filters.item !== '전체' && r.item !== filters.item) continue;
    if (filters.variety !== '전체' && r.variety !== filters.variety) continue;
    if (filters.grade !== '전체' && r.grade !== filters.grade) continue;
    if (filters.unitRaw !== '전체' && r.unitRaw !== filters.unitRaw) continue;

    const hasCurve = Array.isArray(r.monthlyVolumeWeights) && r.monthlyVolumeWeights.length === 12;
    if (hasDateFilter && !hasCurve) {
      const rDate = normalizeDateIso(r.date);
      if (startDateIso && rDate && rDate < startDateIso) continue;
      if (endDateIso && rDate && rDate > endDateIso) continue;
    }

    const region = parseOriginToRegion(r.origin);
    if (region.provinceId === 'other') continue;
    if (q) {
      const hay = `${r.item} ${r.variety} ${r.origin} ${region.provinceName} ${region.sigungu} ${r.corporation} ${r.grade} ${r.unitRaw} ${r.shipmentWindowLabel || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const totalKg = r.kgPerUnit * r.quantity;
    const totalAmt = r.pricePerUnit * r.quantity;
    if (totalKg <= 0) continue;

    const perMonthKg = Array(12).fill(0);
    const perMonthAmt = Array(12).fill(0);

    if (hasCurve) {
      const weights = r.monthlyVolumeWeights!;
      const sumW = weights.reduce((a, b) => a + Math.max(0, b), 0);
      const maxW = Math.max(...weights, 1);
      if (sumW > 0) {
        for (let m = 0; m < 12; m++) {
          const w = Math.max(0, weights[m] || 0);
          if (w <= 0) continue;
          const share = w / sumW;
          const scarcityFactor = 1 + (1 - Math.min(1, w / maxW)) * 0.22;
          perMonthKg[m] = totalKg * share;
          perMonthAmt[m] = totalAmt * share * scarcityFactor;
        }
      }
    } else {
      const recMonth = extractMonthFromDateStr(r.date);
      if (recMonth !== null) {
        perMonthKg[recMonth - 1] = totalKg;
        perMonthAmt[recMonth - 1] = totalAmt;
      }
    }

    let pb = provBuckets.get(region.provinceId);
    if (!pb) {
      pb = {
        provinceId: region.provinceId,
        provinceName: region.provinceName,
        label: region.provinceName,
        monthlyKg: Array(12).fill(0),
        monthlyAmt: Array(12).fill(0),
        windowLabels: new Set(),
      };
      provBuckets.set(region.provinceId, pb);
    }
    if (r.shipmentWindowLabel) pb.windowLabels.add(r.shipmentWindowLabel);

    const sKey = `${region.provinceId}::${region.sigungu}`;
    let sb = sigunguBuckets.get(sKey);
    if (!sb) {
      sb = {
        provinceId: region.provinceId,
        provinceName: region.provinceName,
        sigungu: region.sigungu,
        label: `${region.provinceName} ${region.sigungu}`,
        monthlyKg: Array(12).fill(0),
        monthlyAmt: Array(12).fill(0),
        windowLabels: new Set(),
      };
      sigunguBuckets.set(sKey, sb);
    }
    if (r.shipmentWindowLabel) sb.windowLabels.add(r.shipmentWindowLabel);

    for (let m = 0; m < 12; m++) {
      pb.monthlyKg[m] += perMonthKg[m];
      pb.monthlyAmt[m] += perMonthAmt[m];
      sb.monthlyKg[m] += perMonthKg[m];
      sb.monthlyAmt[m] += perMonthAmt[m];
      globalMonthKg[m] += perMonthKg[m];
      globalMonthAmt[m] += perMonthAmt[m];
    }
  }

  const finalizeRows = (buckets: Iterable<[string, Bucket]>): RegionalShipmentRow[] => {
    const out: RegionalShipmentRow[] = [];
    for (const [key, b] of buckets) {
      const totalAnnualKg = b.monthlyKg.reduce((a, x) => a + x, 0);
      if (totalAnnualKg <= 0) continue;
      const totalAnnualAmt = b.monthlyAmt.reduce((a, x) => a + x, 0);
      const maxMonthKg = Math.max(...b.monthlyKg, 0.0001);
      const monthlyIntensity = b.monthlyKg.map((kg) => Math.round((kg / maxMonthKg) * 100));
      const activeMonths: number[] = [];
      const peakMonths: number[] = [];
      const offSeasonMonths: number[] = [];
      for (let m = 0; m < 12; m++) {
        if (monthlyIntensity[m] >= 12) activeMonths.push(m + 1);
        else offSeasonMonths.push(m + 1);
        if (monthlyIntensity[m] >= 65) peakMonths.push(m + 1);
      }
      const fallbackLabel = formatMonthsShortKo(peakMonths.length > 0 ? peakMonths : activeMonths);
      const explicitLabel = Array.from(b.windowLabels)[0];
      out.push({
        key,
        provinceId: b.provinceId,
        provinceName: b.provinceName,
        sigungu: b.sigungu,
        label: b.label,
        totalAnnualKg: Math.round(totalAnnualKg * 10) / 10,
        weightedAvgKgPrice: Math.round(totalAnnualAmt / totalAnnualKg),
        monthlyKg: b.monthlyKg.map((kg) => Math.round(kg * 10) / 10),
        monthlyIntensity,
        activeMonths,
        peakMonths,
        offSeasonMonths,
        windowLabel: b.windowLabels.size === 1 && explicitLabel ? explicitLabel : fallbackLabel,
      });
    }
    return out.sort((a, b) => b.totalAnnualKg - a.totalAnnualKg);
  };

  const provinceRows = finalizeRows(Array.from(provBuckets.entries()).map(([k, v]) => [k, v]));
  const sigunguRows = finalizeRows(Array.from(sigunguBuckets.entries()));

  const totalGlobalKg = globalMonthKg.reduce((a, b) => a + b, 0);
  const activeGlobalMonths = globalMonthKg.filter((kg) => kg > 0).length;
  const avgMonthlyKg = totalGlobalKg > 0 ? totalGlobalKg / 12 : 0;
  const maxActiveProvCount = Math.max(
    1,
    ...Array.from({ length: 12 }, (_, m) =>
      provinceRows.filter((p) => p.monthlyIntensity[m] >= 15).length
    )
  );

  const monthlyNationwide: MonthlyNationwideShipmentPoint[] = Array.from({ length: 12 }, (_, m) => {
    const kg = Math.round(globalMonthKg[m] * 10) / 10;
    const sharePct = totalGlobalKg > 0 ? Math.round((globalMonthKg[m] / totalGlobalKg) * 1000) / 10 : 0;
    const activeProvinces = provinceRows
      .filter((p) => p.monthlyIntensity[m] >= 15)
      .map((p) => p.provinceName);
    const offSeasonProvinces = provinceRows
      .filter((p) => p.monthlyIntensity[m] < 15)
      .map((p) => p.provinceName);
    const weightedAvgKgPrice = globalMonthKg[m] > 0 ? Math.round(globalMonthAmt[m] / globalMonthKg[m]) : 0;
    const isGapMonth =
      totalGlobalKg > 0 &&
      (kg === 0 ||
        globalMonthKg[m] < avgMonthlyKg * 0.45 ||
        (maxActiveProvCount >= 3 && activeProvinces.length <= Math.max(1, Math.floor(maxActiveProvCount * 0.4))));
    const isLowSupplyMonth = totalGlobalKg > 0 && globalMonthKg[m] < avgMonthlyKg * 0.72;
    return {
      month: m + 1,
      totalKg: kg,
      sharePct,
      activeProvinceCount: activeProvinces.length,
      activeProvinces,
      offSeasonProvinces,
      weightedAvgKgPrice,
      isGapMonth,
      isLowSupplyMonth,
    };
  });

  // Identify gap months (fallback to lowest 2~3 supply months if crop ships year-round)
  let gapMonths = monthlyNationwide.filter((m) => m.isGapMonth).map((m) => m.month);
  if (gapMonths.length === 0 && totalGlobalKg > 0 && activeGlobalMonths >= 4) {
    gapMonths = [...monthlyNationwide]
      .sort((a, b) => a.totalKg - b.totalKg)
      .slice(0, 3)
      .filter((m) => m.sharePct < 7.5)
      .map((m) => m.month)
      .sort((a, b) => a - b);
  }

  // Group contiguous gap months into actionable gap windows
  const gapWindows: RegionalGapWindow[] = [];
  if (gapMonths.length > 0 && gapMonths.length < 12) {
    const groups: number[][] = [];
    let current: number[] = [gapMonths[0]];
    for (let i = 1; i < gapMonths.length; i++) {
      if (gapMonths[i] === gapMonths[i - 1] + 1) {
        current.push(gapMonths[i]);
      } else {
        groups.push(current);
        current = [gapMonths[i]];
      }
    }
    groups.push(current);

    for (const grp of groups) {
      const pts = grp.map((m) => monthlyNationwide[m - 1]);
      const avgShare =
        Math.round((pts.reduce((a, p) => a + p.sharePct, 0) / pts.length) * 10) / 10;
      const competingSet = new Set<string>();
      const offSet = new Set<string>();
      for (const p of pts) {
        p.activeProvinces.forEach((n) => competingSet.add(n));
        p.offSeasonProvinces.forEach((n) => offSet.add(n));
      }
      const competingProvinces = Array.from(competingSet);
      const offSeasonProvinces = Array.from(offSet).filter((n) => !competingSet.has(n));
      const pricedPts = pts.filter((p) => p.weightedAvgKgPrice > 0);
      const estAvgKgPrice =
        pricedPts.length > 0
          ? Math.round(pricedPts.reduce((a, p) => a + p.weightedAvgKgPrice, 0) / pricedPts.length)
          : 0;
      const startM = grp[0];
      const endM = grp[grp.length - 1];
      const label = startM === endM ? `${startM}월` : `${startM}~${endM}월`;
      const insight =
        competingProvinces.length === 0
          ? `주요 출하지 전체 미출하 공백기 — 저장출하·가온·고랭지 작형 진입 시 가격 결정력 극대화`
          : offSeasonProvinces.length > 0
            ? `${offSeasonProvinces.slice(0, 3).join('·')} 미출하 구간 (경쟁 출하: ${competingProvinces.slice(0, 3).join('·')} 중심, 월 물량 비중 ${avgShare}%)`
            : `연중 대비 저공급 단경기 (월평균 비중 ${avgShare}%, 경쟁 산지 ${competingProvinces.length}개 시·도)`;
      gapWindows.push({
        months: grp,
        startMonth: startM,
        endMonth: endM,
        label,
        avgMonthlySharePct: avgShare,
        competingProvinces,
        offSeasonProvinces,
        estAvgKgPrice,
        insight,
      });
    }
  }

  // Build concise regional timing difference summary
  let timingDiffSummary = '선택 조건에서 비교할 출하지가 1곳 이하입니다.';
  if (provinceRows.length >= 2) {
    // Compare top provinces by peak month dispersion
    const withPeak = provinceRows
      .map((p) => ({
        row: p,
        primaryPeak: p.peakMonths[0] ?? p.activeMonths[0] ?? 1,
      }))
      .sort((a, b) => a.primaryPeak - b.primaryPeak);

    // Find pair with largest circular month separation among top 6 volume regions
    const topCandidates = provinceRows.slice(0, 6);
    let bestPair: [RegionalShipmentRow, RegionalShipmentRow] | null = null;
    let maxDiff = 0;
    for (let i = 0; i < topCandidates.length; i++) {
      for (let j = i + 1; j < topCandidates.length; j++) {
        const aPeak = topCandidates[i].peakMonths[0] ?? topCandidates[i].activeMonths[0] ?? 1;
        const bPeak = topCandidates[j].peakMonths[0] ?? topCandidates[j].activeMonths[0] ?? 1;
        const rawDiff = Math.abs(aPeak - bPeak);
        const circDiff = Math.min(rawDiff, 12 - rawDiff);
        if (circDiff > maxDiff) {
          maxDiff = circDiff;
          bestPair = [topCandidates[i], topCandidates[j]];
        }
      }
    }

    if (bestPair && maxDiff >= 2) {
      const [a, b] = bestPair;
      timingDiffSummary = `${a.provinceName}(${a.windowLabel}) ↔ ${b.provinceName}(${b.windowLabel}) 간 약 ${maxDiff}개월 출하 시차 확인 — 릴레이 공백기 공략 가능`;
    } else {
      const first = withPeak[0].row;
      const second = withPeak[1].row;
      timingDiffSummary = `${first.provinceName}(${first.windowLabel}) · ${second.provinceName}(${second.windowLabel}) 등 주요 산지 출하 시점이 유사해 성수기 동시 출하 경쟁이 강합니다.`;
    }
  }

  return {
    monthlyNationwide,
    provinceRows,
    sigunguRows,
    gapMonths,
    gapWindows,
    timingDiffSummary,
    hasMultiMonthData: activeGlobalMonths >= 2,
  };
}

