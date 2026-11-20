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
