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
  /** 12-month relative regional shipment weights (Jan=0 .. Dec=11, 0 = off-season / no shipment) */
  monthlyWeights: [
    number, number, number, number, number, number,
    number, number, number, number, number, number
  ];
  /** Concise Korean label describing this region's primary shipping season */
  windowLabel: string;
}

const RAW_BASELINE_ROWS: RawOriginRow[] = [
  // 파 (쪽파 · 대파 — 남부 월동 vs 중부 시설 vs 강원 고랭지 릴레이)
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 30, pricePerUnit: 42000, origin: '경기도 양평군', yoyPct: -6.2, monthlyWeights: [0, 0, 10, 45, 70, 55, 20, 10, 45, 85, 75, 15], windowLabel: '봄·가을 4~6·9~11월' },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 24, pricePerUnit: 26000, origin: '경기도 포천시', yoyPct: -8.5, monthlyWeights: [0, 0, 15, 50, 75, 60, 25, 15, 50, 80, 65, 10], windowLabel: '봄·가을 4~6·9~11월' },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 40, pricePerUnit: 25000, origin: '전남광주통합시 보성군', yoyPct: -5.4, monthlyWeights: [75, 65, 45, 15, 0, 0, 0, 0, 15, 70, 95, 90], windowLabel: '가을·월동 10~3월' },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 105, pricePerUnit: 60000, origin: '전남광주통합시 보성군', yoyPct: -4.8, monthlyWeights: [80, 70, 40, 10, 0, 0, 0, 0, 20, 75, 100, 90], windowLabel: '가을·월동 10~3월' },
  { date: '2026-11-20', corporation: '동화청과', item: '파', variety: '쪽파(BOX)', unitRaw: '15kg', grade: '특(1등)', quantity: 13, pricePerUnit: 38000, origin: '전남광주통합시 보성군', yoyPct: -6.0, monthlyWeights: [70, 60, 35, 10, 0, 0, 0, 0, 15, 65, 95, 85], windowLabel: '가을·월동 10~3월' },
  { date: '2026-11-20', corporation: '서울청과', item: '파', variety: '쪽파(BOX)', unitRaw: '10kg', grade: '특(1등)', quantity: 82, pricePerUnit: 49000, origin: '충청남도 예산군', yoyPct: 7.9, monthlyWeights: [20, 25, 55, 85, 90, 50, 15, 10, 55, 90, 70, 30], windowLabel: '시설 봄·가을 3~6·9~11월' },
  { date: '2026-11-20', corporation: '한국청과', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '특(1등)', quantity: 140, pricePerUnit: 24500, origin: '전라남도 신안군', yoyPct: -3.2, monthlyWeights: [95, 90, 80, 55, 15, 0, 0, 0, 0, 20, 65, 90], windowLabel: '겨울 대파 11~4월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '상(2등)', quantity: 115, pricePerUnit: 21500, origin: '전라남도 진도군', yoyPct: -2.1, monthlyWeights: [95, 95, 85, 60, 10, 0, 0, 0, 0, 15, 60, 90], windowLabel: '겨울 대파 11~4월' },
  { date: '2026-11-20', corporation: '농협가락', item: '파', variety: '대파(일반)', unitRaw: '10kg', grade: '특(1등)', quantity: 65, pricePerUnit: 26000, origin: '강원특별자치도 평창군', yoyPct: 5.2, monthlyWeights: [0, 0, 0, 0, 0, 25, 85, 100, 80, 35, 10, 0], windowLabel: '고랭지 여름 7~9월' },

  // 고수 (향채 — 경기 시설 봄~가을 vs 경남 겨울·봄 vs 충남/전북)
  { date: '2026-11-20', corporation: '서울청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 52, pricePerUnit: 36000, origin: '경기도 남양주시', yoyPct: 8.4, monthlyWeights: [15, 20, 55, 85, 95, 75, 30, 25, 75, 95, 70, 25], windowLabel: '중부 시설 3~6·9~11월' },
  { date: '2026-11-20', corporation: '동화청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 38, pricePerUnit: 38500, origin: '경기도 이천시', yoyPct: 6.2, monthlyWeights: [10, 15, 50, 80, 90, 70, 35, 30, 70, 90, 65, 20], windowLabel: '중부 시설 3~6·9~11월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '상(2등)', quantity: 29, pricePerUnit: 31000, origin: '충청남도 논산시', yoyPct: 4.5, monthlyWeights: [25, 35, 65, 90, 85, 45, 10, 10, 55, 85, 75, 40], windowLabel: '충남 시설 3~5·9~12월' },
  { date: '2026-11-20', corporation: '한국청과', item: '고수', variety: '고수(소포장)', unitRaw: '1kg', grade: '특(1등)', quantity: 64, pricePerUnit: 11200, origin: '경상남도 김해시', ecoType: '친환경', yoyPct: -9.5, monthlyWeights: [85, 90, 95, 80, 45, 10, 0, 0, 15, 50, 80, 90], windowLabel: '남부 겨울·봄 11~4월' },
  { date: '2026-11-20', corporation: '서울청과', item: '고수', variety: '고수(일반)', unitRaw: '4kg', grade: '특(1등)', quantity: 22, pricePerUnit: 34500, origin: '전북특별자치도 완주군', yoyPct: -4.2, monthlyWeights: [20, 30, 60, 85, 80, 50, 15, 10, 60, 80, 60, 25], windowLabel: '호남 봄·가을 3~6·9~11월' },

  // 딸기 (남부·충청 11~5월 집중 vs 강원 고랭지 6~10월 여름딸기)
  { date: '2026-11-20', corporation: '서울청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 210, pricePerUnit: 36500, origin: '충청남도 논산시', yoyPct: -2.4, monthlyWeights: [95, 100, 95, 75, 35, 0, 0, 0, 0, 0, 35, 85], windowLabel: '겨울·봄 11~5월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '상(2등)', quantity: 145, pricePerUnit: 31000, origin: '충청남도 부여군', yoyPct: -1.8, monthlyWeights: [90, 95, 95, 80, 40, 0, 0, 0, 0, 0, 30, 80], windowLabel: '겨울·봄 11~5월' },
  { date: '2026-11-20', corporation: '한국청과', item: '딸기', variety: '금실', unitRaw: '2kg', grade: '특(1등)', quantity: 165, pricePerUnit: 41000, origin: '경상남도 산청군', yoyPct: 6.5, monthlyWeights: [100, 95, 85, 65, 25, 0, 0, 0, 0, 5, 50, 95], windowLabel: '조기촉성 11~4월' },
  { date: '2026-11-20', corporation: '동화청과', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 130, pricePerUnit: 35800, origin: '경상남도 진주시', yoyPct: 5.8, monthlyWeights: [95, 95, 90, 70, 30, 0, 0, 0, 0, 5, 45, 90], windowLabel: '조기촉성 11~4월' },
  { date: '2026-11-20', corporation: '농협가락', item: '딸기', variety: '설향', unitRaw: '2kg', grade: '특(1등)', quantity: 118, pricePerUnit: 37200, origin: '전라남도 담양군', yoyPct: 3.1, monthlyWeights: [95, 100, 90, 65, 25, 0, 0, 0, 0, 0, 40, 85], windowLabel: '겨울·봄 11~4월' },
  { date: '2026-11-20', corporation: '서울청과', item: '딸기', variety: '킹스베리', unitRaw: '2kg', grade: '특(1등)', quantity: 44, pricePerUnit: 48000, origin: '전북특별자치도 완주군', yoyPct: 11.2, monthlyWeights: [90, 95, 85, 60, 20, 0, 0, 0, 0, 0, 35, 85], windowLabel: '겨울·봄 12~4월' },
  { date: '2026-11-20', corporation: '동화청과', item: '딸기', variety: '고슬(여름딸기)', unitRaw: '1kg', grade: '특(1등)', quantity: 36, pricePerUnit: 29500, origin: '강원특별자치도 평창군', yoyPct: 9.4, monthlyWeights: [0, 0, 0, 0, 10, 55, 90, 100, 80, 45, 0, 0], windowLabel: '고랭지 여름 6~10월' },

  // 사과 (조생 홍로 장수/거창 8~9월 → 중만생 부사 청송/안동/영주/충주 10~4월)
  { date: '2026-11-20', corporation: '농협가락', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 185, pricePerUnit: 56000, origin: '경상북도 청송군', yoyPct: 9.2, monthlyWeights: [75, 65, 50, 35, 20, 5, 0, 0, 15, 65, 100, 90], windowLabel: '만생·저장 10~4월' },
  { date: '2026-11-20', corporation: '서울청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 160, pricePerUnit: 52500, origin: '경상북도 안동시', yoyPct: 8.4, monthlyWeights: [70, 60, 45, 30, 15, 5, 0, 10, 25, 70, 100, 85], windowLabel: '만생·저장 10~3월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '상(2등)', quantity: 120, pricePerUnit: 46000, origin: '경상북도 영주시', yoyPct: 7.1, monthlyWeights: [65, 55, 45, 30, 15, 0, 0, 10, 20, 65, 95, 80], windowLabel: '만생·저장 10~3월' },
  { date: '2026-11-20', corporation: '한국청과', item: '사과', variety: '부사(후지)', unitRaw: '10kg', grade: '특(1등)', quantity: 95, pricePerUnit: 51000, origin: '충청북도 충주시', yoyPct: 6.4, monthlyWeights: [55, 45, 30, 15, 5, 0, 0, 25, 60, 85, 95, 70], windowLabel: '중만생 9~2월' },
  { date: '2026-11-20', corporation: '동화청과', item: '사과', variety: '홍로·부사', unitRaw: '10kg', grade: '특(1등)', quantity: 78, pricePerUnit: 53000, origin: '전북특별자치도 장수군', yoyPct: 14.5, monthlyWeights: [30, 20, 10, 0, 0, 0, 0, 55, 100, 80, 60, 40], windowLabel: '고랭 조중생 8~11월' },
  { date: '2026-11-20', corporation: '농협가락', item: '사과', variety: '시나노골드', unitRaw: '10kg', grade: '특(1등)', quantity: 62, pricePerUnit: 58000, origin: '경상남도 거창군', yoyPct: 12.1, monthlyWeights: [25, 15, 5, 0, 0, 0, 0, 35, 75, 100, 80, 45], windowLabel: '중생종 9~12월' },

  // 감귤 · 만감류 (제주 노지 10~2월 vs 황금향/만감류 9~4월)
  { date: '2026-11-20', corporation: '농협가락', item: '감귤', variety: '온주밀감(노지)', unitRaw: '5kg', grade: '특(1등)', quantity: 340, pricePerUnit: 16500, origin: '제주특별자치도 서귀포시', yoyPct: -4.8, monthlyWeights: [85, 45, 15, 0, 0, 0, 0, 0, 10, 55, 100, 100], windowLabel: '노지감귤 10~2월' },
  { date: '2026-11-20', corporation: '서울청과', item: '감귤', variety: '온주밀감(노지)', unitRaw: '5kg', grade: '상(2등)', quantity: 260, pricePerUnit: 13800, origin: '제주특별자치도 제주시', yoyPct: -6.1, monthlyWeights: [80, 40, 10, 0, 0, 0, 0, 0, 5, 50, 100, 95], windowLabel: '노지감귤 10~2월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '감귤', variety: '황금향·하우스감귤', unitRaw: '3kg', grade: '특(1등)', quantity: 125, pricePerUnit: 21000, origin: '제주특별자치도 서귀포시', yoyPct: 5.5, monthlyWeights: [65, 50, 35, 25, 30, 45, 55, 60, 75, 85, 95, 85], windowLabel: '시설·만감 연중' },

  // 배추 (전남 월동 11~4월 ↔ 충북 봄·가을 5~6·10~11월 ↔ 강원 고랭지 7~9월 ↔ 경북 준고랭 8~10월)
  { date: '2026-11-20', corporation: '한국청과', item: '배추', variety: '김장·월동배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 320, pricePerUnit: 11200, origin: '전라남도 해남군', yoyPct: 12.8, monthlyWeights: [95, 90, 75, 40, 10, 0, 0, 0, 0, 20, 100, 100], windowLabel: '월동·김장 11~4월' },
  { date: '2026-11-20', corporation: '동화청과', item: '배추', variety: '김장·봄배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 195, pricePerUnit: 11800, origin: '충청북도 괴산군', yoyPct: 9.4, monthlyWeights: [0, 0, 0, 15, 65, 70, 15, 0, 20, 85, 100, 30], windowLabel: '봄·가을 5~6·10~11월' },
  { date: '2026-11-20', corporation: '서울청과', item: '배추', variety: '고랭지배추', unitRaw: '10kg', grade: '특(1등)', quantity: 110, pricePerUnit: 13500, origin: '강원특별자치도 평창군', yoyPct: -7.5, monthlyWeights: [0, 0, 0, 0, 0, 15, 85, 100, 95, 35, 0, 0], windowLabel: '고랭지 여름 7~9월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '배추', variety: '월동배추(망)', unitRaw: '10kg', grade: '상(2등)', quantity: 140, pricePerUnit: 9800, origin: '전라남도 진도군', yoyPct: 11.2, monthlyWeights: [95, 95, 80, 45, 5, 0, 0, 0, 0, 10, 85, 95], windowLabel: '월동배추 11~4월' },
  { date: '2026-11-20', corporation: '농협가락', item: '배추', variety: '준고랭지배추(망)', unitRaw: '10kg', grade: '특(1등)', quantity: 90, pricePerUnit: 10900, origin: '경상북도 영양군', yoyPct: 4.1, monthlyWeights: [0, 0, 0, 0, 10, 35, 55, 80, 90, 95, 45, 0], windowLabel: '준고랭 7~10월' },

  // 고구마 (조기 햇고구마 해남/고창 7~10월 vs 여주/논산 가을·저장 9~5월)
  { date: '2026-11-20', corporation: '서울청과', item: '고구마', variety: '꿀고구마(베니하루카)', unitRaw: '10kg', grade: '특(1등)', quantity: 180, pricePerUnit: 34500, origin: '전라남도 해남군', yoyPct: 11.4, monthlyWeights: [75, 70, 60, 50, 35, 15, 35, 75, 95, 100, 95, 85], windowLabel: '조기+저장 7~4월' },
  { date: '2026-11-20', corporation: '동화청과', item: '고구마', variety: '꿀고구마(베니하루카)', unitRaw: '10kg', grade: '특(1등)', quantity: 145, pricePerUnit: 37200, origin: '경기도 여주시', yoyPct: -3.5, monthlyWeights: [75, 70, 65, 55, 40, 15, 0, 15, 75, 100, 95, 85], windowLabel: '가을·저장 9~5월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '고구마', variety: '호풍미', unitRaw: '10kg', grade: '특(1등)', quantity: 110, pricePerUnit: 32000, origin: '전북특별자치도 고창군', yoyPct: 8.7, monthlyWeights: [65, 55, 45, 35, 20, 10, 25, 70, 95, 100, 90, 75], windowLabel: '조기+저장 8~3월' },
  { date: '2026-11-20', corporation: '한국청과', item: '고구마', variety: '밤고구마', unitRaw: '10kg', grade: '상(2등)', quantity: 92, pricePerUnit: 29500, origin: '충청남도 논산시', yoyPct: 2.3, monthlyWeights: [60, 50, 40, 25, 15, 0, 0, 20, 80, 100, 90, 70], windowLabel: '가을·저장 9~3월' },

  // 마늘 · 양파 (조생 고흥/무안 5~7월 vs 대서 창녕 6~3월 vs 한지 의성 7~4월)
  { date: '2026-11-20', corporation: '농협가락', item: '마늘', variety: '깐마늘(대서)', unitRaw: '20kg', grade: '특(1등)', quantity: 95, pricePerUnit: 158000, origin: '경상남도 창녕군', yoyPct: 14.2, monthlyWeights: [70, 65, 60, 50, 65, 100, 95, 85, 80, 75, 75, 70], windowLabel: '난지 대서 6~3월(연중저장)' },
  { date: '2026-11-20', corporation: '중앙청과', item: '마늘', variety: '한지형마늘', unitRaw: '20kg', grade: '특(1등)', quantity: 68, pricePerUnit: 174000, origin: '경상북도 의성군', yoyPct: 6.4, monthlyWeights: [55, 45, 35, 20, 0, 35, 100, 95, 85, 75, 70, 65], windowLabel: '한지형 7~2월' },
  { date: '2026-11-20', corporation: '한국청과', item: '마늘', variety: '남도마늘', unitRaw: '20kg', grade: '상(2등)', quantity: 75, pricePerUnit: 146000, origin: '전라남도 고흥군', yoyPct: -4.9, monthlyWeights: [40, 30, 15, 25, 95, 100, 80, 65, 55, 50, 45, 40], windowLabel: '조기 남도 5~8월' },
  { date: '2026-11-20', corporation: '서울청과', item: '양파', variety: '조생·저장양파', unitRaw: '15kg', grade: '특(1등)', quantity: 230, pricePerUnit: 22800, origin: '전라남도 무안군', yoyPct: 9.8, monthlyWeights: [65, 55, 45, 70, 95, 100, 90, 80, 75, 75, 70, 70], windowLabel: '조생 4~6월 + 저장' },
  { date: '2026-11-20', corporation: '동화청과', item: '양파', variety: '저장양파', unitRaw: '15kg', grade: '특(1등)', quantity: 190, pricePerUnit: 23500, origin: '경상남도 창녕군', yoyPct: 11.6, monthlyWeights: [75, 65, 50, 20, 45, 100, 95, 85, 80, 80, 80, 80], windowLabel: '중만생·저장 6~2월' },
  { date: '2026-11-20', corporation: '농협가락', item: '양파', variety: '저장양파', unitRaw: '15kg', grade: '상(2등)', quantity: 110, pricePerUnit: 21000, origin: '경상남도 합천군', yoyPct: 7.4, monthlyWeights: [70, 60, 45, 15, 40, 100, 90, 85, 80, 75, 75, 75], windowLabel: '중만생·저장 6~2월' },

  // 토마토 · 방울토마토 · 오이 · 파프리카 (남부 겨울·봄 vs 중부 봄·가을 vs 강원 여름 고랭지!)
  { date: '2026-11-20', corporation: '서울청과', item: '방울토마토', variety: '대추방울토마토', unitRaw: '3kg', grade: '특(1등)', quantity: 155, pricePerUnit: 19200, origin: '충청남도 부여군', yoyPct: 3.4, monthlyWeights: [55, 65, 85, 100, 95, 70, 25, 15, 45, 75, 70, 60], windowLabel: '봄·가을 시설 3~6·10~12월' },
  { date: '2026-11-20', corporation: '한국청과', item: '방울토마토', variety: '대추방울토마토', unitRaw: '3kg', grade: '특(1등)', quantity: 110, pricePerUnit: 18600, origin: '경기도 광주시', yoyPct: -3.8, monthlyWeights: [15, 20, 50, 85, 100, 95, 65, 45, 65, 75, 45, 20], windowLabel: '중부 시설 4~9월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '토마토', variety: '완숙토마토', unitRaw: '5kg', grade: '특(1등)', quantity: 130, pricePerUnit: 21500, origin: '부산광역시 강서구', yoyPct: 2.8, monthlyWeights: [85, 95, 100, 95, 75, 30, 0, 0, 0, 20, 55, 80], windowLabel: '남부 겨울·봄 11~5월' },
  { date: '2026-11-20', corporation: '동화청과', item: '토마토', variety: '완숙토마토', unitRaw: '5kg', grade: '특(1등)', quantity: 96, pricePerUnit: 22400, origin: '광주광역시 광산구', yoyPct: -6.5, monthlyWeights: [75, 85, 95, 90, 75, 35, 10, 0, 10, 35, 65, 75], windowLabel: '호남 겨울·봄 11~5월' },
  { date: '2026-11-20', corporation: '서울청과', item: '오이', variety: '백다다기오이', unitRaw: '10kg', grade: '특(1등)', quantity: 145, pricePerUnit: 42000, origin: '충청남도 천안시', yoyPct: 1.9, monthlyWeights: [30, 45, 75, 95, 100, 85, 40, 25, 65, 85, 60, 35], windowLabel: '중부 봄·가을 3~6·9~11월' },
  { date: '2026-11-20', corporation: '한국청과', item: '오이', variety: '취청오이', unitRaw: '10kg', grade: '특(1등)', quantity: 120, pricePerUnit: 39500, origin: '전라남도 순천시', yoyPct: -6.8, monthlyWeights: [95, 100, 90, 75, 45, 15, 0, 0, 15, 50, 80, 95], windowLabel: '남부 겨울촉성 11~4월' },
  { date: '2026-11-20', corporation: '농협가락', item: '파프리카', variety: '빨강 파프리카', unitRaw: '5kg', grade: '특(1등)', quantity: 88, pricePerUnit: 28500, origin: '강원특별자치도 철원군', yoyPct: 3.2, monthlyWeights: [0, 0, 0, 15, 55, 90, 100, 95, 85, 70, 35, 0], windowLabel: '강원 여름작형 6~10월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '파프리카', variety: '노랑 파프리카', unitRaw: '5kg', grade: '특(1등)', quantity: 76, pricePerUnit: 27800, origin: '전북특별자치도 김제시', yoyPct: -4.1, monthlyWeights: [90, 95, 95, 85, 65, 25, 0, 0, 10, 45, 80, 95], windowLabel: '남부 겨울작형 11~5월' },

  // 깻잎 · 상추 · 고추 · 감자 · 표고버섯 · 포도 · 배
  { date: '2026-11-20', corporation: '서울청과', item: '깻잎', variety: '잎들깨(100속)', unitRaw: '100속', grade: '특(1등)', quantity: 135, pricePerUnit: 29500, origin: '충청남도 금산군', ecoType: '친환경', yoyPct: 2.1, monthlyWeights: [55, 60, 75, 90, 95, 100, 90, 85, 90, 85, 70, 60], windowLabel: '연중(여름 최성)' },
  { date: '2026-11-20', corporation: '동화청과', item: '깻잎', variety: '잎들깨(100속)', unitRaw: '100속', grade: '특(1등)', quantity: 118, pricePerUnit: 28000, origin: '경상남도 밀양시', yoyPct: -6.9, monthlyWeights: [95, 100, 95, 85, 60, 30, 15, 15, 45, 75, 90, 95], windowLabel: '남부 겨울·봄 11~4월' },
  { date: '2026-11-20', corporation: '한국청과', item: '상추', variety: '적상추', unitRaw: '4kg', grade: '특(1등)', quantity: 125, pricePerUnit: 21000, origin: '경기도 이천시', yoyPct: 7.4, monthlyWeights: [40, 50, 80, 95, 100, 75, 35, 30, 80, 95, 70, 45], windowLabel: '봄·가을 시설(7~8월 감소)' },
  { date: '2026-11-20', corporation: '중앙청과', item: '상추', variety: '청상추', unitRaw: '4kg', grade: '상(2등)', quantity: 94, pricePerUnit: 18500, origin: '충청북도 음성군', yoyPct: 4.8, monthlyWeights: [35, 45, 75, 95, 100, 70, 30, 25, 75, 90, 65, 40], windowLabel: '봄·가을 시설(7~8월 감소)' },
  { date: '2026-11-20', corporation: '농협가락', item: '고추', variety: '청양고추', unitRaw: '10kg', grade: '특(1등)', quantity: 102, pricePerUnit: 56000, origin: '경상남도 밀양시', yoyPct: -5.2, monthlyWeights: [95, 100, 95, 85, 65, 30, 10, 10, 25, 55, 85, 95], windowLabel: '겨울 시설 11~5월' },
  { date: '2026-11-20', corporation: '서울청과', item: '고추', variety: '청양고추', unitRaw: '10kg', grade: '특(1등)', quantity: 84, pricePerUnit: 54500, origin: '경상남도 진주시', yoyPct: 1.8, monthlyWeights: [90, 95, 90, 80, 60, 35, 15, 15, 30, 60, 85, 90], windowLabel: '겨울 시설 11~5월' },
  { date: '2026-11-20', corporation: '동화청과', item: '감자', variety: '수미감자(고랭지)', unitRaw: '20kg', grade: '특(1등)', quantity: 160, pricePerUnit: 38500, origin: '강원특별자치도 홍천군', yoyPct: 6.9, monthlyWeights: [25, 15, 0, 0, 0, 20, 70, 100, 95, 85, 55, 35], windowLabel: '고랭지·저장 7~11월' },
  { date: '2026-11-20', corporation: '한국청과', item: '감자', variety: '수미감자(시설봄)', unitRaw: '20kg', grade: '상(2등)', quantity: 112, pricePerUnit: 35000, origin: '전북특별자치도 부안군', yoyPct: 8.2, monthlyWeights: [0, 0, 35, 95, 100, 85, 30, 0, 0, 0, 0, 0], windowLabel: '시설 봄감자 3~6월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '감자', variety: '대지감자(월동)', unitRaw: '20kg', grade: '특(1등)', quantity: 96, pricePerUnit: 44000, origin: '제주특별자치도 서귀포시', yoyPct: -3.4, monthlyWeights: [100, 95, 75, 25, 0, 0, 0, 0, 0, 0, 45, 90], windowLabel: '제주 월동 11~3월' },
  { date: '2026-11-20', corporation: '농협가락', item: '표고버섯', variety: '생표고(특)', unitRaw: '4kg', grade: '특(1등)', quantity: 72, pricePerUnit: 48000, origin: '충청남도 청양군', ecoType: '친환경', yoyPct: 3.8, monthlyWeights: [75, 80, 90, 95, 85, 65, 55, 55, 95, 100, 90, 80], windowLabel: '연중(봄·가을 성출하)' },
  { date: '2026-11-20', corporation: '서울청과', item: '표고버섯', variety: '생표고(특)', unitRaw: '4kg', grade: '특(1등)', quantity: 58, pricePerUnit: 46500, origin: '전라남도 장흥군', yoyPct: -6.4, monthlyWeights: [70, 75, 95, 100, 85, 55, 40, 45, 90, 95, 85, 75], windowLabel: '연중(7~8월 감소)' },
  { date: '2026-11-20', corporation: '중앙청과', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '특(1등)', quantity: 145, pricePerUnit: 22500, origin: '경상북도 상주시', yoyPct: 11.8, monthlyWeights: [40, 20, 0, 0, 0, 0, 10, 45, 95, 100, 85, 65], windowLabel: '가을·저장 9~1월' },
  { date: '2026-11-20', corporation: '농협가락', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '특(1등)', quantity: 130, pricePerUnit: 23200, origin: '경상북도 김천시', yoyPct: 9.6, monthlyWeights: [30, 15, 0, 0, 0, 10, 35, 75, 100, 95, 70, 45], windowLabel: '시설조기+가을 7~12월' },
  { date: '2026-11-20', corporation: '한국청과', item: '포도', variety: '샤인머스켓', unitRaw: '2kg', grade: '상(2등)', quantity: 82, pricePerUnit: 19800, origin: '충청북도 영동군', yoyPct: 6.2, monthlyWeights: [25, 10, 0, 0, 0, 0, 15, 60, 100, 95, 75, 45], windowLabel: '가을 8~12월' },
  { date: '2026-11-20', corporation: '동화청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 120, pricePerUnit: 58000, origin: '전라남도 나주시', yoyPct: 5.1, monthlyWeights: [75, 60, 40, 25, 10, 0, 0, 25, 85, 100, 90, 80], windowLabel: '가을·저장 9~3월' },
  { date: '2026-11-20', corporation: '서울청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 94, pricePerUnit: 61000, origin: '경기도 안성시', yoyPct: 3.4, monthlyWeights: [65, 55, 35, 20, 5, 0, 0, 10, 70, 100, 95, 80], windowLabel: '가을·저장 9~2월' },
  { date: '2026-11-20', corporation: '농협가락', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 76, pricePerUnit: 57000, origin: '울산광역시 울주군', yoyPct: -4.2, monthlyWeights: [60, 45, 25, 10, 0, 0, 0, 20, 80, 100, 85, 70], windowLabel: '가을·저장 9~2월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '배', variety: '신고배', unitRaw: '15kg', grade: '특(1등)', quantity: 64, pricePerUnit: 59000, origin: '세종특별자치시 조치원읍', yoyPct: 1.5, monthlyWeights: [55, 40, 20, 10, 0, 0, 0, 15, 75, 100, 85, 65], windowLabel: '가을·저장 9~2월' },
  { date: '2026-11-20', corporation: '한국청과', item: '브로콜리', variety: '브로콜리(국산)', unitRaw: '8kg', grade: '특(1등)', quantity: 85, pricePerUnit: 31000, origin: '제주특별자치도 제주시', yoyPct: -5.6, monthlyWeights: [100, 95, 80, 45, 10, 0, 0, 0, 0, 10, 60, 95], windowLabel: '제주 월동 11~4월' },
  { date: '2026-11-20', corporation: '서울청과', item: '브로콜리', variety: '고랭지브로콜리', unitRaw: '8kg', grade: '특(1등)', quantity: 58, pricePerUnit: 35500, origin: '강원특별자치도 평창군', yoyPct: 4.9, monthlyWeights: [0, 0, 0, 0, 0, 45, 95, 100, 85, 40, 0, 0], windowLabel: '강원 여름 6~10월' },
  { date: '2026-11-20', corporation: '동화청과', item: '당근', variety: '구좌당근', unitRaw: '20kg', grade: '특(1등)', quantity: 140, pricePerUnit: 42000, origin: '제주특별자치도 제주시', yoyPct: 6.8, monthlyWeights: [100, 95, 85, 55, 15, 0, 0, 0, 0, 0, 45, 95], windowLabel: '제주 월동 11~4월' },
  { date: '2026-11-20', corporation: '서울청과', item: '토마토', variety: '대저토마토', unitRaw: '2.5kg', grade: '특(1등)', quantity: 62, pricePerUnit: 19500, origin: '부산광역시 강서구', yoyPct: 4.5, monthlyWeights: [40, 80, 100, 95, 55, 0, 0, 0, 0, 0, 0, 15], windowLabel: '대저 봄 2~5월' },
  { date: '2026-11-20', corporation: '농협가락', item: '미나리', variety: '한재미나리', unitRaw: '4kg', grade: '특(1등)', quantity: 54, pricePerUnit: 34000, origin: '경상북도 청도군', yoyPct: 3.2, monthlyWeights: [55, 95, 100, 90, 45, 0, 0, 0, 0, 15, 35, 45], windowLabel: '청도 봄 2~5월' },
  { date: '2026-11-20', corporation: '한국청과', item: '포도', variety: '캠벨얼리', unitRaw: '3kg', grade: '특(1등)', quantity: 58, pricePerUnit: 21000, origin: '대전광역시 동구', yoyPct: -4.1, monthlyWeights: [0, 0, 0, 0, 0, 15, 65, 100, 90, 35, 0, 0], windowLabel: '여름·초가을 7~9월' },
  { date: '2026-11-20', corporation: '중앙청과', item: '연근', variety: '백연근', unitRaw: '10kg', grade: '특(1등)', quantity: 72, pricePerUnit: 38000, origin: '대구광역시 동구', yoyPct: -2.8, monthlyWeights: [85, 80, 70, 50, 20, 0, 0, 35, 85, 95, 100, 95], windowLabel: '가을·겨울 9~3월' },
  { date: '2026-11-20', corporation: '동화청과', item: '순무', variety: '강화순무', unitRaw: '10kg', grade: '특(1등)', quantity: 48, pricePerUnit: 26000, origin: '인천광역시 강화군', yoyPct: 2.4, monthlyWeights: [45, 30, 15, 25, 60, 50, 10, 0, 45, 95, 100, 70], windowLabel: '봄·김장 5~6·10~12월' },
  { date: '2026-11-20', corporation: '서울청과', item: '열무', variety: '열무(하우스)', unitRaw: '4kg', grade: '특(1등)', quantity: 65, pricePerUnit: 12800, origin: '서울특별시 강동구', yoyPct: -3.5, monthlyWeights: [25, 35, 65, 90, 100, 95, 85, 80, 85, 70, 45, 30], windowLabel: '봄·여름 4~9월' },
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
      monthlyVolumeWeights: [...row.monthlyWeights],
      shipmentWindowLabel: row.windowLabel,
    };
  }
);
