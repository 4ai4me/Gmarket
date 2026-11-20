# 작업 로그 (log.md)

## [v0.0.1] 2026-11-20 — 가락시장 품목·단가·엑셀 분석 및 1년 수지타산(ROI) 플랫폼 초기 구축

### 시작 전
- Tier: 3 (신규 풀스택 웹 애플리케이션 초기 구축)
- 요청 내용:
  1. 가락시장 전체 거래 품목 및 포장단위 조회
  2. 년/월/주 기준 kg당 고단가 품목 및 작물별 고유 거래단위(상자·단·속·망·포기 등) 단가 비교
  3. 재배방법·재배주기 기반 1년 투자대비 수지타산(ROI) 분석
  4. 가락시장 OZViewer `Save XLS` 경매결과 엑셀(`법인/품목/품종/단위/등급/수량/경락/출하지/친환경구분`) 직접 업로드·파싱 지원
- 영향 범위 판단: 신규 프로젝트 구성(`server.ts`, `src/utils/*`, `src/data/crops.ts`, `src/components/*`, `VERSION`, `README.md`).
- 회귀 위험 검토: 초기 구축 단계이므로 기존 데이터 손상 위험 없음. 업로드 파싱 실패 시 기존 상태를 덮어쓰지 않도록 보호 로직 설계 필요.
- 검증 계획:
  1. `node:test` 기반 단위 테스트 (`unitParser`, `excelParser`, `analytics` 8개 케이스)
  2. TypeScript 타입 검사(`npm run lint`) 및 Vite 프로덕션 빌드(`compile_applet`)
  3. Playwright 실브라우저 검증(1440×900 데스크톱 + 390×844 모바일, 주요 4개 여정, 콘솔/네트워크 오류 점검)

### 완료 후
- 변경 파일: `VERSION`, `package.json`, `metadata.json`, `index.html`, `src/index.css`, `server.ts`, `src/types/garak.ts`, `src/utils/unitParser.ts`, `src/utils/excelParser.ts`, `src/utils/analytics.ts`, `src/utils/analytics.test.ts`, `src/data/crops.ts`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/OverviewView.tsx`, `src/components/CatalogView.tsx`, `src/components/PriceRankingView.tsx`, `src/components/RoiSimulatorView.tsx`, `src/components/ExcelAnalyzerView.tsx`, `src/App.tsx`, `README.md`, `log.md`
- 완료 기준(DoD) 확인 결과:
  - 단위 테스트 8/8 통과 (`unitParser`, `excelParser`, `analytics` 1년 ROI/가중평균/손익분기)
  - `tsc --noEmit` 및 `vite build` 무오류 통과
  - 실브라우저(1440×900 데스크톱 / 390×844 모바일) 4개 핵심 여정 및 실시간 가락시장 API(`/api/garak/items`, 266품목 826단위) 응답 확인
  - 1차 UI 검수 수정 반영: 비출하기 0원 선그래프 단절 처리, 중복 범례 제거, 모바일 12개월 작기표 4열 줄바꿈 개선, ROI KPI 보조지표 줄바꿈 정돈
- 실제로 확인한 것:
  - 실시간 가락시장 경매 품목/단위 조회 (2026.11.20 기준 266품목 · 826개 단위 조합)
  - 경매결과 엑셀(스크린샷 포맷: 쪽파 BOX 10kg/15kg 등) 가중평균 파싱 및 대시보드·ROI 반영
  - 연간/월간/주간 및 kg당/고유단위/10a 연매출 정렬 전환과 1년 수지타산 계산
- 확인하지 못한 것 / 사용자 확인 필요: 사용자가 보유한 다수 일자의 대용량 가락시장 `.xls` 실파일 직접 드래그앤드롭 업로드 테스트
- 남은 이슈: 없음

## [v0.1.0] 2026-11-20 — 가락시장 전 품목 × 재배방식 1년 수지타산 교차분석 확장 및 GitHub Pages 호스팅 대응

### 시작 전
- Tier: 2 (기능 확장 + 정적 호스팅 배포 구조 개선)
- 요청 내용:
  1. 품목 수 대비 1년 수지타산 분석 대상이 적은 문제 해결 — 가락시장 등록 전체 재배가능 품목에 대해 경매단가와 재배방법을 교차 분석
  2. GitHub Pages(`https://4ai4me.github.io/Gmarket/`) 호스팅 시 빈 페이지가 뜨는 문제 해결 및 정상 동작 지원
- 영향 범위 판단: `vite.config.ts`, `server.ts`, `src/types/garak.ts`, `src/data/extraCrops.ts`, `src/data/garakSnapshot.ts`, `src/utils/cropSynthesizer.ts`, `src/utils/analytics.ts`, `src/App.tsx`, 뷰 컴포넌트(`OverviewView`, `CatalogView`, `PriceRankingView`, `RoiSimulatorView`, `ExcelAnalyzerView`), `.github/workflows/deploy-pages.yml`, `public/.nojekyll`.
- 회귀 위험 검토: 기존 25개 핵심 작목 ID/데이터 및 엑셀 파싱·가중평균 로직은 유지하되, 단일 글자 작물명(`배`, `무`, `밤`, `갓`) 오매칭과 수산물/수입과일의 농산물 오분류를 차단해야 함. 또한 `base: './'` 적용 후 로컬 Express 서버(`/`)와 서브패스(`/Gmarket/`) 모두에서 정상 로드되는지 확인 필요.
- 검증 계획:
  1. 확장 단위 테스트 (`analytics.test.ts` 11개 케이스: 전 품목 매핑, 수산·수입 제외, 엑셀 신규 품목 합성, 교차분석 매트릭스)
  2. `tsc --noEmit` 및 `vite build` + 생성된 `dist/index.html` 상대경로 확인
  3. 실브라우저 검증: `http://localhost:3000` (Express 실시간 모드) 및 빌드된 `dist/`를 `/Gmarket/` 서브패스로 정적 서빙하여 GitHub Pages 환경 동일 재현 검증

### 완료 후
- 변경 파일: `VERSION`, `vite.config.ts`, `server.ts`, `src/types/garak.ts`, `src/data/extraCrops.ts`, `src/data/garakSnapshot.ts`, `src/utils/cropSynthesizer.ts`, `src/utils/analytics.ts`, `src/utils/analytics.test.ts`, `src/App.tsx`, `src/components/OverviewView.tsx`, `src/components/CatalogView.tsx`, `src/components/PriceRankingView.tsx`, `src/components/RoiSimulatorView.tsx`, `src/components/ExcelAnalyzerView.tsx`, `.github/workflows/deploy-pages.yml`, `public/.nojekyll`, `README.md`, `log.md`
- 완료 기준(DoD) 확인 결과:
  - 단위 테스트 11/11 통과, `tsc --noEmit` 오류 0건, `vite build` 성공(`dist/index.html` 상대경로 `./assets/...` 확인)
  - 로컬 서버(`http://localhost:3000`, 콘솔 오류 0건) 및 `/Gmarket/` 서브패스 정적 서빙 렌더링 정상 확인
- 실제로 확인한 것: 단위 테스트 11건, 정적 빌드, 로컬 Express 서버 및 `/Gmarket/` 서브패스 렌더링
- 확인하지 못한 것 / 사용자 확인 필요: 실제 `4ai4me/Gmarket` 원격 GitHub 저장소 푸시 및 Settings → Pages → GitHub Actions 전환
- 남은 이슈: 단일일 `auction` 조회만 수행해 `고수` 등 품목별 가격 등록·계절 품목이 누락되는 문제 → `v0.2.0`에서 해결

## [v0.2.0] 2026-11-20 — 가락시장 12개월 통합 전 품목 크롤링 및 고수·허브 독립 정밀 분석 확장

### 시작 전
- Tier: 2 (크롤링 범위 확장 + 독립 작목 추가 + 분류·단위 파싱 버그 수정)
- 요청 내용: 가락시장 전체 품목 크롤링 누락 점검("고수"가 안 보이는 문제) 및 단계적 해결
- 영향 범위 판단: `server.ts`, `src/types/garak.ts`, `src/data/garakSnapshot.ts`, `src/data/extraCrops.ts`, `src/utils/cropSynthesizer.ts`, `src/utils/unitParser.ts`, `src/App.tsx`, `src/components/CatalogView.tsx`, `src/utils/analytics.test.ts`, `VERSION`, `README.md`, `log.md`
- 회귀 위험 검토: 기존 `herbs_basil_rucola` ID를 유지하면서 `고수`(`cilantro`), `바질`(`basil`), `딜`(`dill`), `파슬리`(`parsley`)를 분리해야 하며, `국산` 접미사 수산물(`게국산`·`김국산` 등)과 `블랙망고수박`의 오분류 및 `.75kg` 소수점 단위 오파싱을 함께 방지해야 함.
- 검증 계획:
  1. 단위 테스트 12건 (`analytics.test.ts`: 12개월 통합 660종 스냅샷, `고수` 독립 매핑, 국산 수산물 제외, `.75kg` 파싱, `블랙망고수박` 분류)
  2. `tsc --noEmit` + `vite build`
  3. Playwright 실브라우저 검증 (`http://localhost:3000`에서 12개월 통합 664종 로드, `고수` 검색 → `고수 정밀 ROI` 연동 확인, 콘솔 오류 0건)

### 완료 후
- 변경 파일: `VERSION`, `server.ts`, `src/types/garak.ts`, `src/data/garakSnapshot.ts`, `src/data/extraCrops.ts`, `src/utils/cropSynthesizer.ts`, `src/utils/unitParser.ts`, `src/App.tsx`, `src/components/CatalogView.tsx`, `src/utils/analytics.test.ts`, `README.md`, `log.md`
- 완료 기준(DoD) 확인 결과:
  - 단위 테스트 12/12 통과 (`analytics.test.ts`)
  - `tsc --noEmit` 및 `vite build` 무오류 통과
  - 실브라우저(`http://localhost:3000`)에서 12개월 통합 664품목 실시간 로드, 교차분석 133품목(정밀 기준 81종 + 가락 자동매핑 52종), `고수` 검색 → `고수 정밀 ROI` 시뮬레이터 연동 및 콘솔 오류 0건 확인
  - 검수 중 발견한 버그 2건 즉시 수정 및 회귀 테스트 추가: `.75kg` 소수점 단위 75kg 오파싱 수정, `블랙망고수박`의 `고수` 부분일치 오분류 수정
- 실제로 확인한 것: 실시간 12개월 가락 API(`mode=all_year`), `고수` 독립 카탈로그·ROI 연동, 정적 스냅샷 660종 갱신, 단위 테스트 12건, 빌드/타입 검사
- 확인하지 못한 것 / 사용자 확인 필요: 실제 `4ai4me/Gmarket` 원격 GitHub 저장소 푸시 및 다음 단계(대한민국 지도 출하지별 경매 현황 대시보드) 착수 여부
- 남은 이슈: 없음 (다음 단계 작업: 대한민국 지도 기반 출하지별 경매 현황 대시보드)

## [v0.3.0] 2026-11-20 — 대한민국 지도 기반 출하지별 경매 현황 대시보드 구축 (2단계)

### 시작 전
- Tier: 2 (신규 지도 분석 대시보드 + 출하지 정규화·지역 집계 엔진 + 전국 17개 시·도 기준 데이터)
- 요청 내용: 대한민국 지도 기준으로 각 품목별로 어느 지역(시·도 / 시·군·구) 상품이 얼마나 경매되고 있는지(품목, 품종, 단위, 등급, 수량, 출하지, 가격 등) 확인하는 대시보드 구축.
- 영향 범위 판단: 신규 모듈 `src/utils/koreaOrigin.ts`, `src/data/originAuctionBaseline.ts`, `src/components/KoreaOriginMapSvg.tsx`, `src/components/OriginMapView.tsx` 및 네비게이션 연결(`src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`), 테스트(`src/utils/analytics.test.ts`), `VERSION`, `README.md`, `log.md`.
- 회귀 위험 검토: 기존 5개 탭(`대시보드 요약`, `전체 품목·단위`, `기간별 단가 순위`, `재배·1년 수지타산`, `경매결과 엑셀 분석`)과 엑셀 업로드 상태·ROI 연동은 그대로 유지해야 하며, 가락시장 특유의 출하지 표기(`전남광주통합시 보성군`, `강원특별자치도 평창군`, `전북특별자치도 완주군`, `논산시` 등 시·도 생략 표기)와 수입·미상 출하지를 안전하게 분류해야 함.
- 검증 계획:
  1. 단위 테스트 14건 (`analytics.test.ts`: 기존 12건 회귀 + `parseOriginToRegion` 6종 표기 패턴 + `aggregateAuctionByRegion` 전국 17개 시·도 집계 및 `고수`/`파` 필터 정합성)
  2. `tsc --noEmit` 및 `vite build`
  3. Playwright 실브라우저 검증 (`http://localhost:3000`, 1440×900): `출하지 현황 지도` 탭 진입, 17개 시·도·77건 전국 현황, `고수` 품목 필터링 + `경기도` 드릴다운(`남양주시`/`이천시`), 하단 경매 상세 내역 테이블, 콘솔 오류 0건 확인

### 완료 후
- 변경 파일: `VERSION`, `src/utils/koreaOrigin.ts`, `src/data/originAuctionBaseline.ts`, `src/components/KoreaOriginMapSvg.tsx`, `src/components/OriginMapView.tsx`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`, `src/utils/analytics.test.ts`, `README.md`, `log.md`
- 완료 기준(DoD) 확인 결과:
  - 단위 테스트 14/14 통과 (`npx tsx --test src/utils/analytics.test.ts`)
  - `tsc --noEmit` 오류 0건 및 `vite build` 프로덕션 빌드 성공
  - Playwright 실브라우저(`1440×900`) 검증 완료:
    - `출하지 현황 지도` 탭에서 17개 시·도 / 60개 시·군·구 / 77건 전국 주산지 현황 및 4개 KPI 정상 렌더링 확인
    - `고수` 품목 선택 시 4개 출하 시·도(경기·충남·전북·경남)로 지도 즉시 전환, `경기도` 선택 시 `남양주시(208kg, 9,000원/kg)`·`이천시(152kg, 9,625원/kg)` 시·군·구 드릴다운 및 하단 `경기도 경매 상세 내역` 테이블 동기화 확인
    - 브라우저 콘솔 오류 0건, 경고 0건
  - 1차 UI 검수 개선 반영: `서울특별시 강동구` 열무 행 추가로 전국 17개 시·도 100% 커버리지 일치, 지도 하단 안내/호버 바를 제주 인셋 아래 정적 영역으로 이동해 겹침 차단, 헤더 중복 엑셀 버튼 정리
- 실제로 확인한 것: 단위 테스트 14건, `tsc --noEmit`, `vite build`, `http://localhost:3000` 실브라우저 지도 렌더링·품목 필터·시·도 드릴다운·상세 내역 테이블
- 확인하지 못한 것 / 사용자 확인 필요: 사용자가 보유한 실제 가락시장 OZViewer `.xls` 파일을 `내 엑셀(.xls) 올리기`로 업로드했을 때의 실측 출하지 매핑 확인 및 `4ai4me/Gmarket` 원격 저장소 푸시
- 남은 이슈: 없음

## [v0.4.0] 2026-11-20 — 년간 경매 물량·5개년 수급 추세 · 내년 가격 리스크 경보 · 산지 YoY 증감 · 다기간 엑셀 누적 비교

### 시작 전
- Tier: 2 (신규 수급·거미집 리스크 분석 탭 + 지도 YoY 산지 증감·편중도 + ROI 하방 스트레스 테스트 + 다기간 엑셀 누적 저장/비교)
- 요청 내용: 년간 가락시장 경매 물량 파악, 지역별 증가/감소 작물 검토, 올해 고단가→내년 단가 하락(거미집 파동)에 선제 대응할 수 있는 데이터 기반 보완 사항 검토 및 기능 개선.
- 영향 범위 판단: 신규 모듈 `src/data/garakMultiYearTrends.ts`, `src/utils/supplyRisk.ts`, `src/components/SupplyRiskView.tsx`, 기존 모듈 확장(`src/types/garak.ts`, `src/data/originAuctionBaseline.ts`, `src/utils/koreaOrigin.ts`, `src/components/KoreaOriginMapSvg.tsx`, `src/components/OriginMapView.tsx`, `src/components/RoiSimulatorView.tsx`, `src/components/ExcelAnalyzerView.tsx`, `src/components/OverviewView.tsx`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`, `src/utils/analytics.test.ts`, `VERSION`, `README.md`, `log.md`).
- 회귀 위험 검토: 기존 6개 탭과 단일일 엑셀 업로드, 전국 17개 시·도 지도 필터링, 12개월 통합 품목 조회(`all_year`) 및 1년 수지타산 계산을 유지하면서, 음수/null이 포함되는 `yoyVolumeChangePct` 지도 지표와 `localStorage` 파싱 예외를 안전하게 처리해야 함.
- 검증 계획:
  1. 단위 테스트 17건 (`analytics.test.ts`: 기존 14건 회귀 + `classifyCobwebSignal`, `evaluateCropSupplyRiskMatrix` 5개년/다년도 엑셀 오버라이드, `buildUploadedMultiPeriodComparison` 및 지역 YoY 집계)
  2. `tsc --noEmit` 및 `vite build`
  3. Playwright 실브라우저 검증 (`1440×900`): `대시보드 요약(v0.4.0)`, `수급 추세 · 리스크` 탭(5개년 복합차트·신호 필터·하방방어 ROI), `출하지 현황 지도`(`전년대비 산지 증감(%)`·상위 2도 편중도·시군구 YoY), `재배 · 1년 수지타산`(-20% 방어가 프리셋·스트레스 테스트), `경매결과 엑셀 분석`(다기간 2024·2025·2026 비교 샘플 및 기간별 물량·단가·산지 변화) 검증 및 결함 수정

### 완료 후
- 변경 파일: `VERSION`, `src/types/garak.ts`, `src/data/garakMultiYearTrends.ts`, `src/data/originAuctionBaseline.ts`, `src/utils/supplyRisk.ts`, `src/utils/koreaOrigin.ts`, `src/components/SupplyRiskView.tsx`, `src/components/KoreaOriginMapSvg.tsx`, `src/components/OriginMapView.tsx`, `src/components/RoiSimulatorView.tsx`, `src/components/ExcelAnalyzerView.tsx`, `src/components/OverviewView.tsx`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`, `src/utils/analytics.test.ts`, `README.md`, `log.md`
- 완료 기준(DoD) 확인 결과:
  - 단위 테스트 17/17 통과 (`npx tsx --test src/utils/analytics.test.ts`)
  - `tsc --noEmit` 오류 0건 및 `vite build` 프로덕션 빌드 성공
  - Playwright 실브라우저(`1440×900`) 전 기능 검증 및 1차 UI 결함 4건 수정 완료:
    - `OriginMapView`: `전년대비 산지 증감(%)` 전환 시에도 4번 KPI 카드(`최다 출하 · 주산지 편중도`)가 항상 중량 1위 지역과 상위 2도 비중을 일관 표시하도록 분리
    - `RoiSimulatorView`: `손익분기 안전마진` 카드 텍스트(`-7.7%까지 흑자`) 1줄 고정으로 줄바꿈 깨짐 해소
    - `SupplyRiskView`: 기본 10a 면적 표기(`302.5평` → `10a·300평`) 통일 및 `10a(300평)` 버튼 초기 활성 상태 정렬
    - 브라우저 콘솔 오류 0건, 경고 0건
- 실제로 확인한 것: 단위 테스트 17건, `tsc --noEmit`, `vite build`, `http://localhost:3000` 실브라우저 5개 주요 화면(`Overview`, `SupplyRiskView`, `OriginMapView YoY`, `RoiSimulatorView Stress Test`, `ExcelAnalyzerView Multi-Period`) 인터랙션 및 렌더링
- 확인하지 못한 것 / 사용자 확인 필요: 사용자가 보유한 실제 다년도 가락시장 OZViewer `.xls` 파일 누적 업로드 테스트 및 `4ai4me/Gmarket` 원격 GitHub 저장소 푸시
- 남은 이슈: 없음


