import type { AuctionRecord } from '../types/garak';
import { parseGarakUnit } from '../utils/unitParser';

interface RawOriginRow {
  date: string;
  corporation: string;
  item: string;
  variety: string;
  unitRaw: string;
  grade: string;
  quantity: number;
  pricePerUnit: number;
  origin: string;
  ecoType?: string;
  /** Optional YoY percentage change (-35 ~ +35) reflecting regional expansion or contraction */
  yoyPct?: number;
}

const RAW_BASELINE_ROWS: RawOriginRow[] = [
  // 파 (쪽파 · 대파 — 가락시장 스크린샷 실측 포맷 포함)
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 30, pricePerUnit: 42000, origin: '경기도 양평군', yoyPct: -6.2 },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 24, pricePerUnit: 26000, origin: '경기도 포천시', yoyPct: -8.5 },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 40, pricePerUnit: 25000, origin: '전남광주통합시 보성군', yoyPct: -5.4 },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 105, pricePerUnit: 60000, origin: '전남광주통합시 보성군', yoyPct: -4.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '15kg', grade: '특(1등)', quantity: 13, pricePerUnit: 38000, origin: '전남광주통합시 보성군', yoyPct: -6.0 },
  { date: '2026-11-20', corporation: '서울청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 82, pricePerUnit: 49000, origin: '충청남도 예산군', yoyPct: 7.9 },
  { date: '2026-11-20', corporation: '한국청과', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '특(1등)', quantity: 140, pricePerUnit: 24500, origin: '전라남도 신안군', yoyPct: -3.2 },
  { date: '2026-11-20', corporation: '중앙청과', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '상(2등)', quantity: 115, pricePerUnit: 21500, origin: '전라남도 진도군', yoyPct: -2.1 },
  { date: '2026-11-20', corporation: '농협가락', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '특(1등)', quantity: 65, pricePerUnit: 26000, origin: '강원특별자치도 평창군', yoyPct: 5.2 },

  // 고수 (향채 — 경기·충남·경남 주산지)
  { date: '2026-11-20', corporation: '서울청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 52, pricePerUnit: 36000, origin: '경기도 남양주시', yoyPct: 8.4 },
  { date: '2026-11-20', corporation: '동화청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 38, pricePerUnit: 38500, origin: '경기도 이천시', yoyPct: 6.2 },
  { date: '2026-11-20', corporation: '중앙청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '상(2등)', quantity: 29, pricePerUnit: 31000, origin: '충청남도 논산시', yoyPct: 4.5 },
  { date: '2026-11-20', corporation: '한국청과', item: '고수', variety: '고수(소포장)', unitRaw: '1kg', grade: '특(1등)', quantity: 64, pricePerUnit: 11200, origin: '경상남도 김해시', ecoType: '친환경', yoyPct: -9.5 },
  { date: '2026-11-20', corporation: '서울청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 22, pricePerUnit: 34500, origin: '전북특별자치도 완주군', yoyPct: -4.2 },

  // 딸기 (설향 · 금실 · 킹스베리)
  { date: '2026-11-20', corporation: '서울청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 210, pricePerUnit: 36500, origin: '충청남도 논산시', yoyPct: -2.4 },
  { date: '2026-11-20', corporation: '중앙청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '상(2등)', quantity: 145, pricePerUnit: 31000, origin: '충청남도 부여군', yoyPct: -1.8 },
  { date: '2026-11-20', corporation: '한국청과', item: '딸기', variety: '금실', unitRaw: '2kg', grade: '특(1등)', quantity: 165, pricePerUnit: 41000, origin: '경상남도 산청군', yoyPct: 6.5 },
  { date: '2026-11-20', corporation: '동화청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 130, pricePerUnit: 35800, origin: '경상남도 진주시', yoyPct: 5.8 },
  { date: '2026-11-20', corporation: '농협가락', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 118, pricePerUnit: 37200, origin: '전라남도 담양군', yoyPct: 3.1 },
  { date: '2026-11-20', corporation: '서울청과', item: '딸기', variety: '킹스베리', unitRaw: '2kg', grade: '특(1등)', quantity: 44, pricePerUnit: 48000, origin: '전북특별자치도 완주군', yoyPct: 11.2 },

  // 사과 (부사 · 시나노골드)
  { date: '2026-11-20', corporation: '농협가락', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 185, pricePerUnit: 56000, origin: '경상북도 청송군', yoyPct: 9.2 },
  { date: '2026-11-20', corporation: '서울청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 160, pricePerUnit: 52500, origin: '경상북도 안동시', yoyPct: 8.4 },
  { date: '2026-11-20', corporation: '중앙청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '상(2등)', quantity: 120, pricePerUnit: 46000, origin: '경상북도 영주시', yoyPct: 7.1 },
  { date: '2026-11-20', corporation: '한국청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 95, pricePerUnit: 51000, origin: '충청북도 충주시', yoyPct: 6.4 },
  { date: '2026-11-20', corporation: '동화청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 78, pricePerUnit: 53000, origin: '전북특별자치도 장수군', yoyPct: 14.5 },
  { date: '2026-11-20', corporation: '농협가락', item: '사과', variety: '시나노골드', unitRaw: '10kg', grade: '특(1등)', quantity: 62, pricePerUnit: 58000, origin: '경상남도 거창군', yoyPct: 12.1 },

  // 감귤 · 만감류 (제주)
  { date: '2026-11-20', corporation: '농협가락', item: '감귤', variety: '온주밀감(노지)', unitRaw: '5kg', grade: '특(1등)', quantity: 340, pricePerUnit: 16500, origin: '제주특별자치도 서귀포시', yoyPct: -4.8 },
  { date: '2026-11-20', corporation: '서울청과', item: '감귤', variety: '온주밀감(노지)', unitRaw: '5kg', grade: '상(2등)', quantity: 260, pricePerUnit: 13800, origin: '제주특별자치도 제주시', yoyPct: -6.1 },
  { date: '2026-11-20', corporation: '중앙청과', item: '감귤', variety: '황금향', unitRaw: '3kg', grade: '특(1등)', quantity: 125, pricePerUnit: 21000, origin: '제주특별자치도 서귀포시', yoyPct: 5.5 },

  // 배추 (김장철 해남·괴산·평창)
  { date: '2026-11-20', corporation: '한국청과', item: '배추', variety: '김장배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 320, pricePerUnit: 11200, origin: '전라남도 해남군', yoyPct: 12.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '배추', variety: '김장배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 195, pricePerUnit: 11800, origin: '충청북도 괴산군', yoyPct: 9.4 },
  { date: '2026-11-20', corporation: '서울청과', item: '배추', variety: '고랭지배추', unitRaw: '10kg', grade: '특(1등)', quantity: 110, pricePerUnit: 13500, origin: '강원특별자치도 평창군', yoyPct: -7.5 },
  { date: '2026-11-20', corporation: '중앙청과', item: '배추', variety: '김장배추(망)', unitRaw: '10kg', grade: '상(2등)', quantity: 140, pricePerUnit: 9800, origin: '전라남도 진도군', yoyPct: 11.2 },
  { date: '2026-11-20', corporation: '농협가락', item: '배추', variety: '김장배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 90, pricePerUnit: 10900, origin: '경상북도 영양군', yoyPct: 4.1 },

  // 고구마 (호풍미 · 꿀고구마)
  { date: '2026-11-20', corporation: '서울청과', item: '고구마', variety: '꿀고구마(베니하루카)', unitRaw: '10kg', grade: '특(1등)', quantity: 180, pricePerUnit: 34500, origin: '전라남도 해남군', yoyPct: 11.4 },
  { date: '2026-11-20', corporation: '동화청과', item: '고구마', variety: '꿀고구마(베니하루카)', unitRaw: '10kg', grade: '특(1등)', quantity: 145, pricePerUnit: 37200, origin: '경기도 여주시', yoyPct: -3.5 },
  { date: '2026-11-20', corporation: '중앙청과', item: '고구마', variety: '호풍미', unitRaw: '10kg', grade: '특(1등)', quantity: 110, pricePerUnit: 32000, origin: '전북특별자치도 고창군', yoyPct: 8.7 },
  { date: '2026-11-20', corporation: '한국청과', item: '고구마', variety: '밤고구마', unitRaw: '10kg', grade: '상(2등)', quantity: 92, pricePerUnit: 29500, origin: '충청남도 논산시', yoyPct: 2.3 },

  // 마늘 · 양파 (양념채소 주산지)
  { date: '2026-11-20', corporation: '농협가락', item: '마늘', variety: '깐마늘(대서)', unitRaw: '20kg', grade: '특(1등)', quantity: 95, pricePerUnit: 158000, origin: '경상남도 창녕군', yoyPct: 14.2 },
  { date: '2026-11-20', corporation: '중앙청과', item: '마늘', variety: '한지형마늘', unitRaw: '20kg', grade: '특(1등)', quantity: 68, pricePerUnit: 174000, origin: '경상북도 의성군', yoyPct: 6.4 },
  { date: '2026-11-20', corporation: '한국청과', item: '마늘', variety: '남도마늘', unitRaw: '20kg', grade: '상(2등)', quantity: 75, pricePerUnit: 146000, origin: '전라남도 고흥군', yoyPct: -4.9 },
  { date: '2026-11-20', corporation: '서울청과', item: '양파', variety: '저장양파', unitRaw: '15kg', grade: '특(1등)', quantity: 230, pricePerUnit: 22800, origin: '전라남도 무안군', yoyPct: 9.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '양파', variety: '저장양파', unitRaw: '15kg', grade: '특(1등)', quantity: 190, pricePerUnit: 23500, origin: '경상남도 창녕군', yoyPct: 11.6 },
  { date: '2026-11-20', corporation: '농협가락', item: '양파', variety: '저장양파', unitRaw: '15kg', grade: '상(2등)', quantity: 110, pricePerUnit: 21000, origin: '경상남도 합천군', yoyPct: 7.4 },

  // 토마토 · 방울토마토 · 오이 · 파프리카 (과채류)
  { date: '2026-11-20', corporation: '서울청과', item: '방울토마토', variety: '대추방울토마토', unitRaw: '3kg', grade: '특(1등)', quantity: 155, pricePerUnit: 19200, origin: '충청남도 부여군', yoyPct: 3.4 },
  { date: '2026-11-20', corporation: '한국청과', item: '방울토마토', variety: '대추방울토마토', unitRaw: '3kg', grade: '특(1등)', quantity: 110, pricePerUnit: 18600, origin: '경기도 광주시', yoyPct: -3.8 },
  { date: '2026-11-20', corporation: '중앙청과', item: '토마토', variety: '완숙토마토', unitRaw: '5kg', grade: '특(1등)', quantity: 130, pricePerUnit: 21500, origin: '부산광역시 강서구', yoyPct: 2.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '토마토', variety: '완숙토마토', unitRaw: '5kg', grade: '특(1등)', quantity: 96, pricePerUnit: 22400, origin: '광주광역시 광산구', yoyPct: -6.5 },
  { date: '2026-11-20', corporation: '서울청과', item: '오이', variety: '백다다기오이', unitRaw: '10kg', grade: '특(1등)', quantity: 145, pricePerUnit: 42000, origin: '충청남도 천안시', yoyPct: 1.9 },
  { date: '2026-11-20', corporation: '한국청과', item: '오이', variety: '취청오이', unitRaw: '10kg', grade: '특(1등)', quantity: 120, pricePerUnit: 39500, origin: '전라남도 순천시', yoyPct: -6.8 },
  { date: '2026-11-20', corporation: '농협가락', item: '파프리카', variety: '빨강 파프리카', unitRaw: '5kg', grade: '특(1등)', quantity: 88, pricePerUnit: 28500, origin: '강원특별자치도 철원군', yoyPct: 3.2 },
  { date: '2026-11-20', corporation: '중앙청과', item: '파프리카', variety: '노랑 파프리카', unitRaw: '5kg', grade: '특(1등)', quantity: 76, pricePerUnit: 27800, origin: '전북특별자치도 김제시', yoyPct: -4.1 },

  // 깻잎 · 상추 · 풋고추 · 감자 · 표고버섯 · 포도 · 배
  { date: '2026-11-20', corporation: '서울청과', item: '깻잎', variety: '잎들깨(100속)', unitRaw: '100속', grade: '특(1등)', quantity: 135, pricePerUnit: 29500, origin: '충청남도 금산군', ecoType: '친환경', yoyPct: 2.1 },
  { date: '2026-11-20', corporation: '동화청과', item: '깻잎', variety: '잎들깨(100속)', unitRaw: '100속', grade: '특(1등)', quantity: 118, pricePerUnit: 28000, origin: '경상남도 밀양시', yoyPct: -6.9 },
  { date: '2026-11-20', corporation: '한국청과', item: '상추', variety: '적상추', unitRaw: '4kg', grade: '특(1등)', quantity: 125, pricePerUnit: 21000, origin: '경기도 이천시', yoyPct: 7.4 },
  { date: '2026-11-20', corporation: '중앙청과', item: '상추', variety: '청상추', unitRaw: '4kg', grade: '상(2등)', quantity: 94, pricePerUnit: 18500, origin: '충청북도 음성군', yoyPct: 4.8 },
  { date: '2026-11-20', corporation: '농협가락', item: '고추', variety: '청양고추', unitRaw: '10kg', grade: '특(1등)', quantity: 102, pricePerUnit: 56000, origin: '경상남도 밀양시', yoyPct: -5.2 },
  { date: '2026-11-20', corporation: '서울청과', item: '고추', variety: '청양고추', unitRaw: '10kg', grade: '특(1등)', quantity: 84, pricePerUnit: 54500, origin: '경상남도 진주시', yoyPct: 1.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '감자', variety: '수미감자', unitRaw: '20kg', grade: '특(1등)', quantity: 160, pricePerUnit: 38500, origin: '강원특별자치도 홍천군', yoyPct: 6.9 },
  { date: '2026-11-20', corporation: '한국청과', item: '감자', variety: '수미감자', unitRaw: '20kg', grade: '상(2등)', quantity: 112, pricePerUnit: 35000, origin: '전북특별자치도 부안군', yoyPct: 8.2 },
  { date: '2026-11-20', corporation: '농협가락', item: '표고버섯', variety: '생표고(특)', unitRaw: '4kg', grade: '특(1등)', quantity: 72, pricePerUnit: 48000, origin: '충청남도 청양군', ecoType: '친환경', yoyPct: 3.8 },
  { date: '2026-11-20', corporation: '서울청과', item: '표고버섯', variety: '생표고(특)', unitRaw: '4kg', grade: '특(1등)', quantity: 58, pricePerUnit: 46500, origin: '전라남도 장흥군', yoyPct: -6.4 },
  { date: '2026-11-20', corporation: '중앙청과', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '특(1등)', quantity: 145, pricePerUnit: 22500, origin: '경상북도 상주시', yoyPct: 11.8 },
  { date: '2026-11-20', corporation: '농협가락', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '특(1등)', quantity: 130, pricePerUnit: 23200, origin: '경상북도 김천시', yoyPct: 9.6 },
  { date: '2026-11-20', corporation: '한국청과', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '상(2등)', quantity: 82, pricePerUnit: 19800, origin: '충청북도 영동군', yoyPct: 6.2 },
  { date: '2026-11-20', corporation: '동화청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 120, pricePerUnit: 58000, origin: '전라남도 나주시', yoyPct: 5.1 },
  { date: '2026-11-20', corporation: '서울청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 94, pricePerUnit: 61000, origin: '경기도 안성시', yoyPct: 3.4 },
  { date: '2026-11-20', corporation: '농협가락', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 76, pricePerUnit: 57000, origin: '울산광역시 울주군', yoyPct: -4.2 },
  { date: '2026-11-20', corporation: '중앙청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 64, pricePerUnit: 59000, origin: '세종특별자치시 조치원읍', yoyPct: 1.5 },
  { date: '2026-11-20', corporation: '한국청과', item: '브로콜리', variety: '브로콜리(국산)', unitRaw: '8kg', grade: '특(1등)', quantity: 85, pricePerUnit: 31000, origin: '제주특별자치도 제주시', yoyPct: -5.6 },
  { date: '2026-11-20', corporation: '동화청과', item: '당근', variety: '구좌당근', unitRaw: '20kg', grade: '특(1등)', quantity: 140, pricePerUnit: 42000, origin: '제주특별자치도 제주시', yoyPct: 6.8 },
  { date: '2026-11-20', corporation: '서울청과', item: '토마토', variety: '대저토마토', unitRaw: '2.5kg', grade: '특(1등)', quantity: 62, pricePerUnit: 19500, origin: '부산광역시 강서구', yoyPct: 4.5 },
  { date: '2026-11-20', corporation: '농협가락', item: '미나리', variety: '한재미나리', unitRaw: '4kg', grade: '특(1등)', quantity: 54, pricePerUnit: 34000, origin: '경상북도 청도군', yoyPct: 3.2 },
  { date: '2026-11-20', corporation: '한국청과', item: '포도', variety: '캠벨얼리', unitRaw: '3kg', grade: '특(1등)', quantity: 58, pricePerUnit: 21000, origin: '대전광역시 동구', yoyPct: -4.1 },
  { date: '2026-11-20', corporation: '중앙청과', item: '연근', variety: '백연근', unitRaw: '10kg', grade: '특(1등)', quantity: 72, pricePerUnit: 38000, origin: '대구광역시 동구', yoyPct: -2.8 },
  { date: '2026-11-20', corporation: '동화청과', item: '순무', variety: '강화순무', unitRaw: '10kg', grade: '특(1등)', quantity: 48, pricePerUnit: 26000, origin: '인천광역시 강화군', yoyPct: 2.4 },
  { date: '2026-11-20', corporation: '서울청과', item: '열무', variety: '열무(하우스)', unitRaw: '4kg', grade: '특(1등)', quantity: 65, pricePerUnit: 12800, origin: '서울특별시 강동구', yoyPct: -3.5 },
];

export const NATIONWIDE_ORIGIN_BASELINE_RECORDS: AuctionRecord[] = RAW_BASELINE_ROWS.map(
  (row, idx) => {
    const parsedUnit = parseGarakUnit(row.unitRaw, row.item);
    const kgPerUnit = parsedUnit.kgEquivalent;
    const totalKg = kgPerUnit * row.quantity;
    const yoyFactor = 1 + (row.yoyPct ?? 0) / 100;
    const prevYearKg = Math.round((totalKg / Math.max(0.2, yoyFactor)) * 10) / 10;
    return {
      id: `origin-base-${idx + 1}`,
      date: row.date,
      corporation: row.corporation,
      item: row.item,
      variety: row.variety,
      unitRaw: row.unitRaw,
      kgPerUnit,
      nativeUnitLabel: parsedUnit.nativeUnitLabel,
      isEstimatedKg: parsedUnit.isEstimatedKg,
      grade: row.grade,
      quantity: row.quantity,
      pricePerUnit: row.pricePerUnit,
      pricePerKg: kgPerUnit > 0 ? Math.round(row.pricePerUnit / kgPerUnit) : row.pricePerUnit,
      origin: row.origin,
      ecoType: row.ecoType || '일반',
      sourceFormat: 'auction_result',
      prevYearKg,
    };
  }
);
