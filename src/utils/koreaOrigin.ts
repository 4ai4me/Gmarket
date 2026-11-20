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

  for (const r of records) {
    if (r.item) itemSet.add(r.item);
    if (filters.item === '전체' || r.item === filters.item) {
      if (r.variety && r.variety !== '-') varietySet.add(r.variety);
      if (r.grade) gradeSet.add(r.grade);
      if (r.unitRaw) unitSet.add(r.unitRaw);
    }
  }

  // 2. Filter and enrich records
  const q = filters.search.trim().toLowerCase();
  const filteredRecords: EnrichedOriginRecord[] = [];

  for (const r of records) {
    if (filters.item !== '전체' && r.item !== filters.item) continue;
    if (filters.variety !== '전체' && r.variety !== filters.variety) continue;
    if (filters.grade !== '전체' && r.grade !== filters.grade) continue;
    if (filters.unitRaw !== '전체' && r.unitRaw !== filters.unitRaw) continue;

    const region = parseOriginToRegion(r.origin);
    if (q) {
      const hay = `${r.item} ${r.variety} ${r.origin} ${region.provinceName} ${region.sigungu} ${r.corporation} ${r.grade} ${r.unitRaw}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const totalKg = Math.round(r.kgPerUnit * r.quantity * 100) / 100;
    const totalAmountKrw = Math.round(r.pricePerUnit * r.quantity);

    filteredRecords.push({
      ...r,
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
    },
  };
}
