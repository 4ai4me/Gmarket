import type {
  AuctionRecord,
  CropCategory,
  CropProfile,
  CultivationMethodProfile,
  GarakLiveItem,
  RoiSimulationResult,
} from '../types/garak';
import {
  calculateAnnualRoi,
  getAnnualAvgPricePerKg,
  matchAuctionRecordToCrop,
} from './analytics';
import { parseGarakUnit } from './unitParser';

const NON_CULTIVABLE_CATEGORIES = new Set(['수산·건해', '수입과일', '수입품목']);

const SEAFOOD_REGEX =
  /멸치|오징어|김($|\(|국산|수입)|파래김|미역|건포|고등어|갈치|명태|조기|새우|대하|게($|\(|지|국산|수입)|꽃게|칠게|낙지|문어|전복|굴($|\(|국산|수입)|각굴|봉지굴|바지락|홍합|조개|어묵|수산|황태|다시마|북어|동태|생선|연어|광어|우럭|쭈꾸미|가리비|가무락|가자미|숭어|골뱅이|금태|어류|꼬막|새고막|꼴뚜기|꼴어|꽁치|냉태|농어|능성어|다랭어|대구|도미|동자개|빠가사리|동죽|매생이|메기|물매기|미꾸라지|민어|방어|백합|병어|복($|어)|삼치|생태|소라|아귀|오만둥이|오만리|우렁|은어|임면수어|임연수어|잡어|장대|장어|재첩|전갱이|전어|중하|청어|패류|한치|해조류|호키알|홍어|미더덕|멍게|다루마|동백하|곤지|해락|맛($|국산)|백$|가제|가재|범치|재치|정어리|준치|해삼|꼬시래기|가물치|고둥|상어|서대|잉어|간재미|도다리|양태|열기|밴댕이|벤뎅어|적어|쥐치|헷데기/;

const IMPORT_ONLY_TROPICAL_REGEX =
  /^(바나나|파인애플|람부탄|레몬|자몽|오렌지|석류|아보카도|아보카드|용과|망고스틴|두리안|코코넛|라임)/;

/**
 * Returns true if a Garak Market item is a domestically cultivable agricultural crop
 * (excludes seafood/marine products even when domestic, and explicitly imported-only items).
 */
export function isCultivableDomesticItem(itemName: string, serverCategory?: string): boolean {
  const clean = (itemName || '').replace(/^=+/, '').trim();
  if (!clean) return false;
  if (serverCategory && NON_CULTIVABLE_CATEGORIES.has(serverCategory)) return false;
  if (SEAFOOD_REGEX.test(clean)) return false;
  if (/수입/.test(clean) && !/국산/.test(clean)) return false;
  if (IMPORT_ONLY_TROPICAL_REGEX.test(clean) && !/국산/.test(clean)) return false;
  return true;
}

/**
 * Maps any raw server category or Korean crop name into one of our 8 agronomic CropCategory buckets.
 */
export function resolveAgronomicCategory(itemName: string, serverCategory?: string): CropCategory {
  const validCategories: CropCategory[] = [
    '엽채·나물류',
    '양채·허브류',
    '과채류',
    '근채류',
    '양념채소',
    '과실류',
    '버섯류',
    '두류·곡류',
  ];
  if (serverCategory && validCategories.includes(serverCategory as CropCategory)) {
    return serverCategory as CropCategory;
  }

  const n = itemName.replace(/^=+/, '').trim();
  if (/버섯|느타리|표고|새송이|팽이|양송이|만가닥|송이|목이|상황|노루궁뎅이/.test(n)) return '버섯류';
  if (/브로콜리|브로코리|브로커리|콜리플라워|칼리|칼라후라워|양상추|로메인|셀러리|세러리|파슬리|파세리|루꼴라|로케트|바질|바실|딜$|양채|적채|아스파라거스|아스파라가스|(^|\s)고수($|\s|\()|케일|치커리|비타민|엔다이브|래디쉬|펜넬|로즈마리|민트|허브/.test(n)) {
    return '양채·허브류';
  }
  if (/딸기|수박|참외|메론|멜론|토마토|오이|가지|호박|고추|피망|파프리카|청초|여주|동아|수세미/.test(n)) {
    return '과채류';
  }
  if (/옥수수|콩|완두|동부|팥|녹두|땅콩|두류|빈스|숙주|보리|쌀|현미|찹쌀|수수|기장|율무|참깨|들깨/.test(n)) {
    return '두류·곡류';
  }
  if (/사과|배$|배\s|배\(|감귤|귤|만감|한라봉|천혜향|레드향|황금향|포도|복숭아|자두|단감|감$|감\s|대봉|곶감|떫은감|키위|다래|망고|블루베리|체리|버찌|대추|밤|무화과|유자|매실|살구|오디|앵두|모과|패션푸룻|탄제린|과실|과일/.test(n)) {
    return '과실류';
  }
  if (/마늘|양파|대파|쪽파|파$|파\(|실파|부추|생강|양념/.test(n)) return '양념채소';
  if (/고구마(?!순)|감자|무$|무\(|무\s|알타리|총각무|당근|연근|우엉|도라지|더덕|마$|비트|순무|콜라비|근채|인삼|토란|야콘|하수오|칡|돼지감자|초석잠/.test(n)) {
    return '근채류';
  }
  return '엽채·나물류';
}

interface AgronomicArchetype {
  monthly: [
    number, number, number, number, number, number,
    number, number, number, number, number, number
  ];
  vol: number;
  sow: number[];
  harvest: number[];
  peak: number[];
  diff: '초급' | '중급' | '고급';
  soil: string;
  risk: string;
  defaultUnitKg: number;
  methods: CultivationMethodProfile[];
}

const ARCHETYPES: Record<CropCategory, AgronomicArchetype> = {
  '엽채·나물류': {
    monthly: [5400, 5800, 4800, 4000, 3600, 4200, 5600, 6800, 6000, 4700, 4400, 5000],
    vol: 0.14,
    sow: [2, 4, 6, 8, 10],
    harvest: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peak: [1, 7, 8, 9],
    diff: '초급',
    soil: '엽채·나물류 표준 작형(배수 양호 양토, 연 3~5기작 다기작 회전 가능).',
    risk: '여름철 고온기 무름병·추대 및 수확·소포장 인건비 관리가 핵심.',
    defaultUnitKg: 4,
    methods: [
      {
        key: 'unheated_house',
        label: '비닐하우스 다기작 (연 4기작)',
        cycleDays: 55,
        cyclesPerYear: 4,
        yieldKgPer10a: 1450,
        seedCostPer10a: 300000,
        materialCostPer10a: 720000,
        laborCostPer10a: 2150000,
        packagingShippingPerKg: 540,
        facilityCapexPer10a: 24000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '가락시장 엽채·나물류 표준 하우스 모델 (엑셀 실측가 반영 시 정밀화).',
      },
      {
        key: 'open_field',
        label: '노지 재배 (연 2.5기작)',
        cycleDays: 65,
        cyclesPerYear: 2.5,
        yieldKgPer10a: 1300,
        seedCostPer10a: 250000,
        materialCostPer10a: 480000,
        laborCostPer10a: 1850000,
        packagingShippingPerKg: 500,
        facilityCapexPer10a: 3000000,
        depreciationYears: 7,
        commissionRatePct: 5,
        notes: '초기 투자비가 낮은 노지 엽채·나물 표준 모델.',
      },
    ],
  },
  '양채·허브류': {
    monthly: [7600, 8100, 7000, 5800, 5100, 5600, 6900, 8200, 7500, 6400, 6600, 7300],
    vol: 0.13,
    sow: [2, 4, 7, 9],
    harvest: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peak: [1, 2, 8, 12],
    diff: '중급',
    soil: '양채·허브류 표준 작형(서늘한 온습도 관리, 샐러드·외식 틈새 고단가).',
    risk: '출하 물량 집중 시 가격 하락 및 저온 유통(콜드체인) 관리 필요.',
    defaultUnitKg: 2,
    methods: [
      {
        key: 'unheated_house',
        label: '비닐하우스 토경 (연 4기작)',
        cycleDays: 60,
        cyclesPerYear: 4,
        yieldKgPer10a: 1350,
        seedCostPer10a: 420000,
        materialCostPer10a: 950000,
        laborCostPer10a: 2350000,
        packagingShippingPerKg: 680,
        facilityCapexPer10a: 26000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '가락시장 양채·허브류 표준 시설 모델.',
      },
      {
        key: 'smart_farm',
        label: '수경 스마트팜 (연 7기작)',
        cycleDays: 40,
        cyclesPerYear: 7,
        yieldKgPer10a: 1300,
        seedCostPer10a: 480000,
        materialCostPer10a: 1300000,
        laborCostPer10a: 1900000,
        packagingShippingPerKg: 720,
        facilityCapexPer10a: 120000000,
        depreciationYears: 12,
        commissionRatePct: 5,
        notes: '연중 균일 생산 수경 모델.',
      },
    ],
  },
  '과채류': {
    monthly: [6800, 7200, 6200, 5100, 4200, 3600, 3900, 4800, 5200, 5100, 5800, 6500],
    vol: 0.13,
    sow: [2, 8],
    harvest: [1, 2, 3, 4, 5, 6, 10, 11, 12],
    peak: [1, 2, 12],
    diff: '중급',
    soil: '과채류 표준 작형(장기 연속 수확, 시설 가온 시 동계 고단가 선점).',
    risk: '난방비 변동, 총채벌레·바이러스 방제 및 수확 노동력 관리 중요.',
    defaultUnitKg: 5,
    methods: [
      {
        key: 'heated_house',
        label: '가온 시설하우스 (연 1기작 장기)',
        cycleDays: 250,
        cyclesPerYear: 1,
        yieldKgPer10a: 5600,
        seedCostPer10a: 1200000,
        materialCostPer10a: 5400000,
        laborCostPer10a: 7800000,
        packagingShippingPerKg: 580,
        facilityCapexPer10a: 54000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '가락시장 과채류 표준 촉성·반촉성 시설 모델.',
      },
      {
        key: 'unheated_house',
        label: '무가온 하우스 (연 1.5기작)',
        cycleDays: 160,
        cyclesPerYear: 1.5,
        yieldKgPer10a: 3800,
        seedCostPer10a: 850000,
        materialCostPer10a: 2200000,
        laborCostPer10a: 4900000,
        packagingShippingPerKg: 540,
        facilityCapexPer10a: 26000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '난방비 부담을 줄인 봄~가을 출하 모델.',
      },
    ],
  },
  '근채류': {
    monthly: [3400, 3600, 3700, 3900, 3500, 3100, 3200, 3600, 3500, 3100, 2900, 3200],
    vol: 0.11,
    sow: [3, 4, 8],
    harvest: [1, 2, 6, 7, 10, 11, 12],
    peak: [3, 4, 8],
    diff: '초급',
    soil: '근채류 표준 작형(배수 양호한 심토 사양토, 저장 출하로 가격 변동 방어).',
    risk: '습해·연작장해 및 수확·세척 작업 기계화 여부가 수익성 좌우.',
    defaultUnitKg: 10,
    methods: [
      {
        key: 'open_field',
        label: '노지 표준 재배 (연 1기작)',
        cycleDays: 130,
        cyclesPerYear: 1,
        yieldKgPer10a: 2900,
        seedCostPer10a: 520000,
        materialCostPer10a: 1050000,
        laborCostPer10a: 2100000,
        packagingShippingPerKg: 380,
        facilityCapexPer10a: 3800000,
        depreciationYears: 7,
        commissionRatePct: 5,
        notes: '가락시장 근채류 표준 노지·저장 모델.',
      },
      {
        key: 'unheated_house',
        label: '조기 비닐하우스 (연 1.5기작)',
        cycleDays: 110,
        cyclesPerYear: 1.5,
        yieldKgPer10a: 3100,
        seedCostPer10a: 580000,
        materialCostPer10a: 1450000,
        laborCostPer10a: 2350000,
        packagingShippingPerKg: 400,
        facilityCapexPer10a: 23000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '단경기 조기 햇근채 출하 모델.',
      },
    ],
  },
  '양념채소': {
    monthly: [5200, 5600, 5000, 4400, 3900, 4300, 5200, 6100, 5700, 4900, 4600, 4900],
    vol: 0.14,
    sow: [3, 8, 9],
    harvest: [1, 2, 5, 6, 9, 10, 11, 12],
    peak: [1, 2, 8, 9],
    diff: '중급',
    soil: '양념채소 표준 작형(배수 양호 사질양토, 저장 또는 다기작 출하).',
    risk: '종구·모종 단가 변동 및 수급 과잉 연도 시세 급락 주의.',
    defaultUnitKg: 10,
    methods: [
      {
        key: 'open_field',
        label: '노지 표준 재배 (연 1.5기작)',
        cycleDays: 120,
        cyclesPerYear: 1.5,
        yieldKgPer10a: 2400,
        seedCostPer10a: 950000,
        materialCostPer10a: 950000,
        laborCostPer10a: 2250000,
        packagingShippingPerKg: 440,
        facilityCapexPer10a: 3800000,
        depreciationYears: 7,
        commissionRatePct: 5,
        notes: '가락시장 양념채소 표준 노지 모델.',
      },
      {
        key: 'unheated_house',
        label: '비가림 하우스 (연 2.5기작)',
        cycleDays: 85,
        cyclesPerYear: 2.5,
        yieldKgPer10a: 2200,
        seedCostPer10a: 1100000,
        materialCostPer10a: 1250000,
        laborCostPer10a: 2450000,
        packagingShippingPerKg: 460,
        facilityCapexPer10a: 25000000,
        depreciationYears: 10,
        commissionRatePct: 5,
        notes: '여름 고단가기 비가림 출하 모델.',
      },
    ],
  },
  '과실류': {
    monthly: [6400, 6600, 6200, 5800, 6800, 6200, 5800, 6400, 6900, 5800, 5600, 6100],
    vol: 0.11,
    sow: [3],
    harvest: [7, 8, 9, 10, 11],
    peak: [1, 2, 9],
    diff: '중급',
    soil: '과실류 표준 과수원 작형(성목 기준, 배수·일조량 확보가 당도 결정).',
    risk: '개화기 냉해·태풍 낙과 및 성목 조성까지 3~5년 초기 투자 회수기간 고려.',
    defaultUnitKg: 5,
    methods: [
      {
        key: 'open_field',
        label: '노지 과수원 (성목 기준)',
        cycleDays: 180,
        cyclesPerYear: 1,
        yieldKgPer10a: 2350,
        seedCostPer10a: 220000,
        materialCostPer10a: 1750000,
        laborCostPer10a: 3400000,
        packagingShippingPerKg: 650,
        facilityCapexPer10a: 13000000,
        depreciationYears: 15,
        commissionRatePct: 5,
        notes: '가락시장 과실류 표준 노지 과수원 모델.',
      },
      {
        key: 'unheated_house',
        label: '비가림 시설 과수 (성목 기준)',
        cycleDays: 185,
        cyclesPerYear: 1,
        yieldKgPer10a: 2600,
        seedCostPer10a: 260000,
        materialCostPer10a: 2350000,
        laborCostPer10a: 3700000,
        packagingShippingPerKg: 680,
        facilityCapexPer10a: 42000000,
        depreciationYears: 15,
        commissionRatePct: 5,
        notes: '열과·병해 방지 및 당도 균일화로 특품 단가 확보.',
      },
    ],
  },
  '버섯류': {
    monthly: [8400, 8600, 8100, 7800, 7600, 7900, 8400, 9100, 9400, 8700, 8300, 8700],
    vol: 0.07,
    sow: [1, 4, 7, 10],
    harvest: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    peak: [8, 9, 12],
    diff: '중급',
    soil: '버섯류 표준 실내 공조·배지 재배(기후 영향 최소화, 연 4~6회전).',
    risk: '배지 오염 관리 및 공조 전기료·초기 재배사 시설 투자비 관리.',
    defaultUnitKg: 2,
    methods: [
      {
        key: 'smart_farm',
        label: '실내 공조 배지 재배사 (연 5기작)',
        cycleDays: 65,
        cyclesPerYear: 5,
        yieldKgPer10a: 2800,
        seedCostPer10a: 4200000,
        materialCostPer10a: 2400000,
        laborCostPer10a: 4200000,
        packagingShippingPerKg: 680,
        facilityCapexPer10a: 120000000,
        depreciationYears: 15,
        commissionRatePct: 5,
        notes: '가락시장 버섯류 표준 연중 공조 모델.',
      },
    ],
  },
  '두류·곡류': {
    monthly: [5600, 5800, 5700, 6200, 6400, 5600, 5200, 5500, 5900, 5600, 5400, 5500],
    vol: 0.1,
    sow: [4, 5],
    harvest: [6, 7, 8, 9, 10],
    peak: [4, 5, 9],
    diff: '초급',
    soil: '두류·곡류 표준 노지 재배(지력 유지·윤작 효과 우수, 저투입 경영).',
    risk: '노지 기상 영향 및 꼬투리 수확 인건비 관리.',
    defaultUnitKg: 4,
    methods: [
      {
        key: 'open_field',
        label: '노지 표준 재배 (연 1.5기작)',
        cycleDays: 95,
        cyclesPerYear: 1.5,
        yieldKgPer10a: 1150,
        seedCostPer10a: 300000,
        materialCostPer10a: 620000,
        laborCostPer10a: 1650000,
        packagingShippingPerKg: 440,
        facilityCapexPer10a: 3000000,
        depreciationYears: 7,
        commissionRatePct: 5,
        notes: '가락시장 두류·곡류 표준 노지 모델.',
      },
    ],
  },
};

function makeDeterministicId(prefix: string, rawName: string): string {
  let hash = 0;
  for (let i = 0; i < rawName.length; i++) {
    hash = (hash * 31 + rawName.charCodeAt(i)) >>> 0;
  }
  const slug = rawName
    .replace(/[^0-9a-zA-Z가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${prefix}_${slug || 'item'}_${hash.toString(36)}`;
}

/**
 * Matches a Garak live item name to a curated CropProfile.
 * Uses exact match first, then alias exact match, then careful substring match
 * (avoiding false matches like "고구마순" -> "고구마" or "배추" -> "배").
 */
export function matchGarakItemToCurated(
  itemName: string,
  curatedCrops: CropProfile[]
): CropProfile | null {
  const clean = itemName.replace(/^=+/, '').replace(/\s+/g, '').toLowerCase();
  const baseName = clean.replace(/\(.*\)$/, '').replace(/국산$|수입$/, '');

  // Pass 1: exact name or exact alias
  for (const crop of curatedCrops) {
    const cName = crop.name.replace(/\s+/g, '').toLowerCase();
    const cBase = cName.replace(/\(.*\)$/, '');
    if (clean === cName || baseName === cBase) return crop;
    for (const alias of crop.aliases) {
      const aNorm = alias.replace(/\s+/g, '').toLowerCase();
      if (clean === aNorm || baseName === aNorm) return crop;
    }
  }

  // Pass 2: specific curated name/alias containment (longest first, >= 2 chars)
  const sorted = [...curatedCrops].sort((a, b) => b.name.length - a.name.length);
  for (const crop of sorted) {
    const cBase = crop.name.replace(/\(.*\)$/, '').replace(/\s+/g, '').toLowerCase();
    if (cBase.length >= 2 && clean.includes(cBase)) {
      // Prevent "고구마순" matching "고구마", "양배추" matching "배추"
      if (cBase === '고구마' && clean.includes('고구마순')) continue;
      if (cBase === '배추' && clean.includes('양배추')) continue;
      if (cBase === '토마토' && clean.includes('방울토마토')) continue;
      if (cBase === '고추' && clean.includes('고추잎')) continue;
      return crop;
    }
    for (const alias of crop.aliases) {
      const aNorm = alias.replace(/\s+/g, '').toLowerCase();
      if (aNorm.length >= 2 && clean.includes(aNorm)) {
        if (aNorm === '배추' && clean.includes('양배추')) continue;
        if (aNorm === '고구마' && clean.includes('고구마순')) continue;
        if (aNorm === '파' && clean.length > 2) continue;
        return crop;
      }
    }
  }

  return null;
}

/**
 * Picks the most representative Garak wholesale trading unit from an item's live unit list.
 */
function pickRepresentativeGarakUnit(units: string[], itemName: string, fallbackKg: number): {
  label: string;
  kg: number;
} {
  if (!units || units.length === 0) {
    return { label: `${fallbackKg}kg 상자`, kg: fallbackKg };
  }
  // Prefer realistic box/bag weights >= 1kg over tiny sample weights like .05kg
  const parsedList = units.map((u) => ({ raw: u, parsed: parseGarakUnit(u, itemName) }));
  const preferred =
    parsedList.find((x) => x.parsed.kgEquivalent >= 1 && x.parsed.kgEquivalent <= 20) ||
    parsedList[0];
  return {
    label: preferred.raw,
    kg: Math.max(0.1, preferred.parsed.kgEquivalent),
  };
}

/**
 * Synthesizes a deterministic agronomic CropProfile for a Garak Market live item
 * or Excel-uploaded item that does not have a dedicated hand-curated entry.
 */
export function synthesizeGarakCropProfile(params: {
  itemName: string;
  serverCategory?: string;
  liveUnits?: string[];
  measuredPricePerKg?: number;
  measuredUnitRaw?: string;
  sourceTier: 'archetype_inferred' | 'excel_measured';
}): CropProfile {
  const { itemName, serverCategory, liveUnits = [], measuredPricePerKg, measuredUnitRaw, sourceTier } = params;
  const cleanName = itemName.replace(/^=+/, '').trim();
  const category = resolveAgronomicCategory(cleanName, serverCategory);
  const archetype = ARCHETYPES[category];

  const unitInfo = measuredUnitRaw
    ? {
        label: measuredUnitRaw,
        kg: Math.max(0.1, parseGarakUnit(measuredUnitRaw, cleanName).kgEquivalent),
      }
    : pickRepresentativeGarakUnit(liveUnits, cleanName, archetype.defaultUnitKg);

  // Small deterministic price variation (±12%) based on item hash when using archetype baseline,
  // or directly anchored to uploaded Excel measured price when available.
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash * 37 + cleanName.charCodeAt(i)) % 1000;
  }
  const baseArchetypeAvg =
    archetype.monthly.filter((v) => v > 0).reduce((a, b) => a + b, 0) /
    Math.max(1, archetype.monthly.filter((v) => v > 0).length);

  const scaleFactor =
    measuredPricePerKg && measuredPricePerKg > 0
      ? measuredPricePerKg / Math.max(1, baseArchetypeAvg)
      : 0.9 + (hash % 23) * 0.01; // 0.90 .. 1.12

  const monthly = archetype.monthly.map((p) =>
    p > 0 ? Math.max(500, Math.round((p * scaleFactor) / 50) * 50) : 0
  ) as CropProfile['monthlyPricePerKg'];

  return {
    id: makeDeterministicId(sourceTier === 'excel_measured' ? 'xls' : 'garak', cleanName),
    name: cleanName,
    aliases: [cleanName],
    category,
    representativeVariety:
      sourceTier === 'excel_measured'
        ? `${cleanName} · 엑셀 실측`
        : `${cleanName} · 가락 등록품목`,
    standardUnitLabel: unitInfo.label,
    standardUnitKg: unitInfo.kg,
    nativeUnitType: unitInfo.label,
    nativeUnitDescription:
      liveUnits.length > 0
        ? `가락시장 실제 거래규격(${liveUnits.slice(0, 6).join(', ')}) 기반 · ${category} 표준 재배모델 교차매핑`
        : `${category} 표준 거래단위 및 재배모델 교차매핑 (엑셀 업로드·시뮬레이터 직접 조정 가능)`,
    monthlyPricePerKg: monthly,
    weeklyVolatility: archetype.vol,
    sowingMonths: [...archetype.sow],
    harvestMonths: [...archetype.harvest],
    peakPriceMonths: [...archetype.peak],
    difficulty: archetype.diff,
    soilAndClimateNote: archetype.soil,
    keyRiskNote: `${archetype.risk} (본 품목은 ${category} 표준 교차모델 기준이며, 엑셀 실측가·시뮬레이터 변수로 농가 맞춤 조정이 가능합니다.)`,
    methods: archetype.methods.map((m) => ({ ...m })),
    dataSourceTier: sourceTier,
    garakLiveUnits: liveUnits,
    inLiveGarakCatalog: liveUnits.length > 0 || sourceTier === 'archetype_inferred',
  };
}

/**
 * Builds the complete unified universe of ALL cultivable agricultural crops by merging:
 *  1) All precision curated profiles (core + extra)
 *  2) All domestically cultivable live Garak Market items (deduplicated & matched to curated where possible)
 *  3) Any additional agricultural items present in user-uploaded Garak Excel files
 */
export function buildUnifiedCropUniverse(params: {
  curatedCrops: CropProfile[];
  liveItems?: GarakLiveItem[];
  uploadedRecords?: AuctionRecord[];
}): {
  crops: CropProfile[];
  curatedCount: number;
  inferredLiveCount: number;
  excelOnlyCount: number;
  excludedNonCultivableCount: number;
  liveItemToCropId: Map<string, string>;
} {
  const { curatedCrops, liveItems = [], uploadedRecords = [] } = params;

  // Clone curated crops so we can annotate live Garak units without mutating constants
  const cropsById = new Map<string, CropProfile>();
  for (const c of curatedCrops) {
    cropsById.set(c.id, {
      ...c,
      dataSourceTier: 'curated',
      garakLiveUnits: c.garakLiveUnits ? [...c.garakLiveUnits] : [],
      inLiveGarakCatalog: false,
    });
  }

  const liveItemToCropId = new Map<string, string>();
  let inferredLiveCount = 0;
  let excludedNonCultivableCount = 0;

  // Map or synthesize EVERY cultivable live Garak item
  for (const item of liveItems) {
    if (!isCultivableDomesticItem(item.itemName, item.category)) {
      excludedNonCultivableCount += 1;
      continue;
    }

    const matchedCurated = matchGarakItemToCurated(item.itemName, curatedCrops);
    if (matchedCurated) {
      const target = cropsById.get(matchedCurated.id)!;
      target.inLiveGarakCatalog = true;
      const mergedUnits = new Set([...(target.garakLiveUnits || []), ...item.units]);
      target.garakLiveUnits = Array.from(mergedUnits);
      liveItemToCropId.set(item.itemName, target.id);
      continue;
    }

    // Check if an identical synthesized name was already added
    const cleanName = item.itemName.replace(/^=+/, '').trim();
    const existingSynth = Array.from(cropsById.values()).find(
      (c) => c.name === cleanName
    );
    if (existingSynth) {
      existingSynth.inLiveGarakCatalog = true;
      const mergedUnits = new Set([...(existingSynth.garakLiveUnits || []), ...item.units]);
      existingSynth.garakLiveUnits = Array.from(mergedUnits);
      liveItemToCropId.set(item.itemName, existingSynth.id);
      continue;
    }

    const synth = synthesizeGarakCropProfile({
      itemName: cleanName,
      serverCategory: item.category,
      liveUnits: item.units,
      sourceTier: 'archetype_inferred',
    });
    cropsById.set(synth.id, synth);
    liveItemToCropId.set(item.itemName, synth.id);
    inferredLiveCount += 1;
  }

  // Synthesize any cultivable uploaded Excel item that didn't match curated or live items
  let excelOnlyCount = 0;
  if (uploadedRecords.length > 0) {
    const currentList = Array.from(cropsById.values());
    const unmatchedAccum = new Map<
      string,
      { itemName: string; totalRev: number; totalKg: number; unitRaw: string }
    >();

    for (const rec of uploadedRecords) {
      const displayName = (rec.variety && rec.variety !== '-' ? rec.variety : rec.item).trim();
      if (!isCultivableDomesticItem(displayName) && !isCultivableDomesticItem(rec.item)) {
        continue;
      }
      const matched = matchAuctionRecordToCrop(rec, currentList);
      if (matched) continue;

      const key = displayName.toLowerCase();
      const cur = unmatchedAccum.get(key) || {
        itemName: displayName,
        totalRev: 0,
        totalKg: 0,
        unitRaw: rec.unitRaw,
      };
      cur.totalRev += rec.pricePerUnit * rec.quantity;
      cur.totalKg += rec.kgPerUnit * rec.quantity;
      unmatchedAccum.set(key, cur);
    }

    for (const entry of unmatchedAccum.values()) {
      const avgKgPrice = entry.totalKg > 0 ? Math.round(entry.totalRev / entry.totalKg) : undefined;
      const synth = synthesizeGarakCropProfile({
        itemName: entry.itemName,
        measuredPricePerKg: avgKgPrice,
        measuredUnitRaw: entry.unitRaw,
        sourceTier: 'excel_measured',
      });
      cropsById.set(synth.id, synth);
      excelOnlyCount += 1;
    }
  }

  const crops = Array.from(cropsById.values());
  return {
    crops,
    curatedCount: curatedCrops.length,
    inferredLiveCount,
    excelOnlyCount,
    excludedNonCultivableCount,
    liveItemToCropId,
  };
}

export interface CrossAnalysisRow {
  rowKey: string;
  crop: CropProfile;
  method: CultivationMethodProfile;
  sim: RoiSimulationResult;
  hasUploadedOverride: boolean;
  pricePerKg: number;
  pricePerNativeUnit: number;
}

/**
 * Computes the complete Item x Auction Price x Cultivation Method x 1-Year ROI cross-analysis matrix.
 * Supports either 1 best-performing method per crop OR expanding all crop x method combinations.
 */
export function buildCrossAnalysisMatrix(params: {
  crops: CropProfile[];
  areaPyeong: number;
  marketableRatePct: number;
  laborCostMultiplier: number;
  includeDepreciation: boolean;
  uploadedOverrides?: Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>;
  applyUploadedOverrides?: boolean;
  expandAllMethods: boolean;
}): CrossAnalysisRow[] {
  const {
    crops,
    areaPyeong,
    marketableRatePct,
    laborCostMultiplier,
    includeDepreciation,
    uploadedOverrides,
    applyUploadedOverrides = false,
    expandAllMethods,
  } = params;

  const rows: CrossAnalysisRow[] = [];

  for (const crop of crops) {
    const override = uploadedOverrides?.get(crop.id);
    const hasUploadedOverride = Boolean(
      applyUploadedOverrides && override && override.weightedAvgKgPrice > 0
    );
    const pricePerKg =
      hasUploadedOverride && override
        ? override.weightedAvgKgPrice
        : getAnnualAvgPricePerKg(crop);
    const pricePerNativeUnit = Math.round(pricePerKg * crop.standardUnitKg);

    const evaluated = crop.methods.map((method) => {
      const sim = calculateAnnualRoi({
        crop,
        methodKey: method.key,
        areaPyeong,
        pricePerKg,
        cyclesPerYear: method.cyclesPerYear,
        marketableRatePct,
        commissionRatePct: method.commissionRatePct,
        laborCostMultiplier,
        includeDepreciation,
      });
      return {
        rowKey: `${crop.id}__${method.key}`,
        crop,
        method,
        sim,
        hasUploadedOverride,
        pricePerKg,
        pricePerNativeUnit,
      };
    });

    if (expandAllMethods) {
      rows.push(...evaluated);
    } else if (evaluated.length > 0) {
      evaluated.sort((a, b) => b.sim.netProfit - a.sim.netProfit);
      rows.push(evaluated[0]);
    }
  }

  return rows;
}
