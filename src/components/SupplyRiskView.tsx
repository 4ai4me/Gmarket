import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  FileSpreadsheet,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AuctionRecord,
  CropCategory,
  CropProfile,
  CultivationMethodKey,
} from '../types/garak';
import { PYEONG_PER_10A } from '../utils/analytics';
import {
  COBWEB_SIGNAL_META,
  evaluateCropSupplyRiskMatrix,
  type CobwebSignal,
  type SupplyRiskRow,
} from '../utils/supplyRisk';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';

interface SupplyRiskViewProps {
  crops: CropProfile[];
  uploadedRecords: AuctionRecord[];
  uploadedOverrides: Map<
    string,
    { weightedAvgKgPrice: number; recordCount: number; totalKg: number }
  >;
  applyUploadedOverrides: boolean;
  onInspectCropRoi: (cropId: string, methodKey?: CultivationMethodKey) => void;
  onInspectCropOriginMap: (itemName: string) => void;
  onOpenExcelUpload: () => void;
}

type SupplySortKey =
  | 'downside_minus20'
  | 'safety_margin'
  | 'volume_shrinking'
  | 'volume_expanding'
  | 'current_profit';

type SignalFilter = 'all' | CobwebSignal;

const SIGNAL_TABS: Array<{ id: SignalFilter; label: string }> = [
  { id: 'all', label: '전체 품목' },
  { id: 'oversupply_warning', label: '내년 하락 주의' },
  { id: 'opportunity_tight', label: '진입 유망(공급↓)' },
  { id: 'stable_high_roi', label: '하방안정 고ROI' },
  { id: 'structural_decline', label: '동반 위축 주의' },
];

const CATEGORIES: Array<'전체' | CropCategory> = [
  '전체',
  '엽채·나물류',
  '양채·허브류',
  '과채류',
  '근채류',
  '양념채소',
  '과실류',
  '버섯류',
  '두류·곡류',
];

function getSignalTextClass(signal: CobwebSignal): string {
  if (signal === 'oversupply_warning') return 'text-amber-700 font-semibold';
  if (signal === 'opportunity_tight') return 'text-emerald-700 font-semibold';
  if (signal === 'stable_high_roi') return 'text-sky-700 font-semibold';
  if (signal === 'structural_decline') return 'text-red-700 font-semibold';
  return 'text-slate-600 font-medium';
}

function getOriginSearchName(crop: CropProfile): string {
  if (crop.id === 'chive') return '파';
  if (crop.id === 'shine_muscat') return '포도';
  if (crop.id === 'citrus') return '감귤';
  return crop.name.replace(/\(.*\)/, '').trim();
}

export function SupplyRiskView({
  crops,
  uploadedRecords,
  uploadedOverrides,
  applyUploadedOverrides,
  onInspectCropRoi,
  onInspectCropOriginMap,
  onOpenExcelUpload,
}: SupplyRiskViewProps) {
  const [areaPyeong, setAreaPyeong] = useState<number>(PYEONG_PER_10A);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'전체' | CropCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SupplySortKey>('downside_minus20');
  const [onlyCuratedFiveYear, setOnlyCuratedFiveYear] = useState<boolean>(false);

  const matrixRows = useMemo(
    () =>
      evaluateCropSupplyRiskMatrix({
        crops,
        uploadedRecords,
        uploadedOverrides,
        applyUploadedOverrides,
        areaPyeong,
        marketableRatePct: 88,
        laborCostMultiplier: 1.0,
        includeDepreciation: true,
      }),
    [crops, uploadedRecords, uploadedOverrides, applyUploadedOverrides, areaPyeong]
  );

  const multiYearExcelCount = useMemo(
    () => matrixRows.filter((r) => r.sourceKind === 'excel_multiyear').length,
    [matrixRows]
  );

  const signalCounts = useMemo(() => {
    const counts: Record<SignalFilter, number> = {
      all: matrixRows.length,
      oversupply_warning: 0,
      opportunity_tight: 0,
      stable_high_roi: 0,
      structural_decline: 0,
      neutral: 0,
    };
    for (const r of matrixRows) {
      counts[r.cobwebSignal] += 1;
    }
    return counts;
  }, [matrixRows]);

  const kpiSummary = useMemo(() => {
    let totalAnnualTons = 0;
    let topWarningRow: SupplyRiskRow | null = null;
    let topOpportunityRow: SupplyRiskRow | null = null;

    for (const r of matrixRows) {
      totalAnnualTons += r.latestVolumeTons;
      if (
        r.cobwebSignal === 'oversupply_warning' &&
        (!topWarningRow || r.volumeYoYPct > topWarningRow.volumeYoYPct)
      ) {
        topWarningRow = r;
      }
      if (
        r.cobwebSignal === 'opportunity_tight' &&
        (!topOpportunityRow ||
          r.downsideMinus20NetProfit > topOpportunityRow.downsideMinus20NetProfit)
      ) {
        topOpportunityRow = r;
      }
    }

    const topResilient = [...matrixRows].sort(
      (a, b) => b.downsideMinus20NetProfit - a.downsideMinus20NetProfit
    )[0];

    return {
      totalAnnualTons: Math.round(totalAnnualTons),
      topWarningRow,
      topOpportunityRow,
      topResilient,
    };
  }, [matrixRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = matrixRows.filter((r) => {
      if (onlyCuratedFiveYear && r.sourceKind === 'category_baseline') return false;
      if (signalFilter !== 'all' && r.cobwebSignal !== signalFilter) return false;
      if (categoryFilter !== '전체' && r.crop.category !== categoryFilter) return false;
      if (q) {
        const hay = `${r.crop.name} ${r.crop.category} ${r.expandingOrigins.join(' ')} ${r.shrinkingOrigins.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'downside_minus20') {
        return b.downsideMinus20NetProfit - a.downsideMinus20NetProfit;
      }
      if (sortBy === 'safety_margin') {
        return b.safetyMarginPct - a.safetyMarginPct;
      }
      if (sortBy === 'volume_shrinking') {
        return a.volumeYoYPct - b.volumeYoYPct;
      }
      if (sortBy === 'volume_expanding') {
        return b.volumeYoYPct - a.volumeYoYPct;
      }
      return b.currentNetProfit - a.currentNetProfit;
    });

    return list;
  }, [matrixRows, onlyCuratedFiveYear, signalFilter, categoryFilter, searchQuery, sortBy]);

  const [selectedCropId, setSelectedCropId] = useState<string>('chive');

  useEffect(() => {
    if (filteredRows.length === 0) return;
    if (!filteredRows.some((r) => r.crop.id === selectedCropId)) {
      setSelectedCropId(filteredRows[0].crop.id);
    }
  }, [filteredRows, selectedCropId]);

  const selectedRow = useMemo(
    () =>
      filteredRows.find((r) => r.crop.id === selectedCropId) ||
      matrixRows.find((r) => r.crop.id === selectedCropId) ||
      filteredRows[0] ||
      matrixRows[0] ||
      null,
    [filteredRows, matrixRows, selectedCropId]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            년간 가락시장 경매 물량 추세 · 내년 단가 리스크 선행 경보
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            올해 고단가에 쏠려 내년 공급과잉으로 단가가 꺾이는 &lsquo;거미집 파동&rsquo;을 피하기 위해{' '}
            <strong className="text-slate-800">5개년 물량·단가 추이</strong>와{' '}
            <strong className="text-slate-800">단가 -20% 하락 시나리오 순수익(안전마진)</strong>을 동시 점검합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {[300, 600, 1000].map((py) => (
              <button
                key={py}
                type="button"
                onClick={() => setAreaPyeong(py)}
                className={`px-2.5 py-1.5 text-xs font-num font-medium rounded-md transition-colors whitespace-nowrap ${
                  areaPyeong === py
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {py === 300 ? '300평(10a)' : `${py.toLocaleString('ko-KR')}평`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenExcelUpload}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>다년도 엑셀(.xls) 누적 반영</span>
          </button>
        </div>
      </div>

      {/* Data Provenance Notice */}
      <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/80 border border-slate-200 rounded-lg">
        <span>
          {multiYearExcelCount > 0 ? (
            <>
              <strong className="text-emerald-800">
                업로드 다년도 엑셀 실측({multiYearExcelCount}개 품목)
              </strong>
              과 가락시장 5개년(2022~2026) 수급 벤치마크를 통합 분석 중입니다.
            </>
          ) : (
            <>
              현재 <strong className="text-slate-900">가락시장 5개년(2022~2026) 주요 32품목 수급 기준 데이터</strong> +
              부류 연동 모델을 표시 중입니다. 여러 연도의 <code className="font-mono text-slate-800">.xls</code>{' '}
              경매결과를 누적 업로드하면 실측 시계열로 자동 전환됩니다.
            </>
          )}
        </span>
        <span className="font-num text-slate-500 whitespace-nowrap">
          추적 {matrixRows.length}개 작목 · 정밀 5개년 32종
        </span>
      </div>

      {/* 4-Column KPI Strip */}
      <section aria-label="수급 및 하방 리스크 요약 지표" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">년간 추적 경매 물량 합계</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {(kpiSummary.totalAnnualTons / 10000).toFixed(1)}만 톤
            </span>
            <span className="text-xs font-num text-slate-500">
              ({kpiSummary.totalAnnualTons.toLocaleString('ko-KR')}t)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            가락시장 연간 반입 물량 · 5년 추세 추적
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>내년 하락 주의 (공급↑·고점)</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-amber-700">
              {signalCounts.oversupply_warning}종
            </span>
            {kpiSummary.topWarningRow && (
              <span className="text-xs font-num text-amber-700 truncate">
                {kpiSummary.topWarningRow.crop.name} (+{kpiSummary.topWarningRow.volumeYoYPct}%)
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            물량 급증 또는 3년 평균 대비 단가 과열
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>공급감소 유망 · 하방안정 품목</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-emerald-700">
              {signalCounts.opportunity_tight + signalCounts.stable_high_roi}종
            </span>
            <span className="text-xs font-num text-slate-500">
              유망 {signalCounts.opportunity_tight} · 안정 {signalCounts.stable_high_roi}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            {kpiSummary.topOpportunityRow
              ? `유망 예시: ${kpiSummary.topOpportunityRow.crop.name} (물량 ${kpiSummary.topOpportunityRow.volumeYoYPct}%)`
              : '단가 -20% 하락 방어 가능'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">
            -20% 하락 방어 순수익 1위 ({areaPyeong === PYEONG_PER_10A ? '10a·300평' : `${areaPyeong}평`})
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {kpiSummary.topResilient
                ? formatKrwCompact(kpiSummary.topResilient.downsideMinus20NetProfit)
                : '-'}
            </span>
            <span className="text-xs font-semibold text-emerald-700 truncate">
              {kpiSummary.topResilient?.crop.name}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-num truncate">
            {kpiSummary.topResilient
              ? `안전마진 ${kpiSummary.topResilient.safetyMarginPct}% · ${kpiSummary.topResilient.bestMethod.label}`
              : ''}
          </div>
        </div>
      </section>

      {/* Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {SIGNAL_TABS.map((tab) => {
              const active = signalFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSignalFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label} ({signalCounts[tab.id]})
                </button>
              );
            })}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyCuratedFiveYear}
              onChange={(e) => setOnlyCuratedFiveYear(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>주요 5개년 기준(32종) + 엑셀 실측만 보기</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="supply-search" className="sr-only">
              작목 또는 주산지 검색
            </label>
            <input
              id="supply-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="작목명 또는 확대/감소 산지 검색 (예: 마늘, 보성, 양평)"
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="supply-category" className="sr-only">
              부류 필터
            </label>
            <select
              id="supply-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as '전체' | CropCategory)}
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  부류: {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="supply-sort" className="sr-only">
              정렬 기준
            </label>
            <select
              id="supply-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SupplySortKey)}
              className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="downside_minus20">정렬: 단가 -20% 하락 방어 순수익 순</option>
              <option value="safety_margin">정렬: 손익분기 가격 안전마진(%) 높은 순</option>
              <option value="volume_shrinking">정렬: 반입 물량 감소폭(%) 큰 순</option>
              <option value="volume_expanding">정렬: 반입 물량 증가폭(%) 큰 순 (공급과잉 경보)</option>
              <option value="current_profit">정렬: 올해 기준 예상 순수익 순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Split: Left Matrix Table (7 cols) / Right 5-Year Chart & Cobweb Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Matrix Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                품목별 년간 반입량 · 수급 변화 · 하방방어 ROI 매트릭스
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-num">
                표시 {filteredRows.length}개 품목 · 행 클릭 시 우측 5개년 물량×단가 차트 상세 분석
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-3 text-left font-medium">품목</th>
                  <th className="py-2.5 px-2 text-right font-medium">년간 물량</th>
                  <th className="py-2.5 px-2 text-right font-medium">물량 YoY</th>
                  <th className="py-2.5 px-2 text-right font-medium">3년 대비 단가</th>
                  <th className="py-2.5 px-2 text-right font-medium">-20% 순수익</th>
                  <th className="py-2.5 px-2 text-right font-medium">안전마진</th>
                  <th className="py-2.5 px-3 text-left font-medium">수급 신호</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center text-slate-500">
                      선택한 필터 조건에 해당하는 품목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isSelected = selectedRow?.crop.id === row.crop.id;
                    return (
                      <tr
                        key={row.crop.id}
                        onClick={() => setSelectedCropId(row.crop.id)}
                        aria-selected={isSelected}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{row.crop.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {row.crop.category}
                            {row.sourceKind === 'excel_multiyear' && (
                              <span className="text-emerald-700 font-medium"> · 엑셀다년</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-num text-slate-700 whitespace-nowrap">
                          {row.latestVolumeTons >= 1000
                            ? `${Math.round(row.latestVolumeTons).toLocaleString('ko-KR')}t`
                            : `${row.latestVolumeTons}t`}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-num font-semibold whitespace-nowrap ${
                            row.volumeYoYPct >= 5
                              ? 'text-amber-700'
                              : row.volumeYoYPct <= -2.5
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                          }`}
                        >
                          {row.volumeYoYPct > 0 ? `+${row.volumeYoYPct}%` : `${row.volumeYoYPct}%`}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-num whitespace-nowrap ${
                            row.priceVs3YrAvgPct >= 10
                              ? 'text-amber-700 font-semibold'
                              : row.priceVs3YrAvgPct <= -5
                                ? 'text-red-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {row.priceVs3YrAvgPct > 0
                            ? `+${row.priceVs3YrAvgPct}%`
                            : `${row.priceVs3YrAvgPct}%`}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-num font-semibold whitespace-nowrap ${
                            row.downsideMinus20NetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {formatKrwCompact(row.downsideMinus20NetProfit)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-num text-slate-700 whitespace-nowrap">
                          {row.safetyMarginPct}% ({row.downsideResilienceGrade})
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={getSignalTextClass(row.cobwebSignal)}>
                            {row.cobwebSignalLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: Selected Crop 5-Year Chart & Regional/Downside Breakdown */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          {selectedRow ? (
            <>
              <div className="space-y-1.5 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    {selectedRow.crop.category} · {selectedRow.bestMethod.label}
                  </span>
                  <span className={getSignalTextClass(selectedRow.cobwebSignal)}>
                    {COBWEB_SIGNAL_META[selectedRow.cobwebSignal].label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedRow.crop.name} 5개년 물량·단가 추이
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedRow.cobwebReason}. {selectedRow.earlyWarningNote}
                </p>
              </div>

              {/* 5-Year Recharts ComposedChart: Annual Volume (Tons) vs Avg Price (KRW/kg) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    연간 반입량(톤) × 평균 경매단가(원/kg)
                  </span>
                  <span className="font-num">
                    3년 물량 연평균{' '}
                    {selectedRow.volume3YrCagrPct > 0
                      ? `+${selectedRow.volume3YrCagrPct}%`
                      : `${selectedRow.volume3YrCagrPct}%`}
                  </span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={selectedRow.history}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) =>
                          Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}kt` : `${v}t`
                        }
                        width={46}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#047857' }}
                        tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}천`}
                        width={46}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          const num = Number(value);
                          return name === '연간 반입량(톤)'
                            ? `${num.toLocaleString('ko-KR')} 톤`
                            : `${num.toLocaleString('ko-KR')} 원/kg`;
                        }}
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '8px',
                          borderColor: '#cbd5e1',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="annualVolumeTons"
                        name="연간 반입량(톤)"
                        fill="#cbd5e1"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="annualAvgKgPrice"
                        name="평균 단가(원/kg)"
                        stroke="#047857"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: '#047857' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Regional Expansion / Contraction Readout */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">주산지 지형 변화 · 편중도</span>
                  <span className="font-num text-slate-600">
                    상위 2개 도 집중도{' '}
                    <strong className="text-slate-900">
                      {selectedRow.concentrationShareTop2Pct}%
                    </strong>
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-700">
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">확대 산지:</strong>{' '}
                    {selectedRow.expandingOrigins.join(' · ')}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-700">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">감소·전환 산지:</strong>{' '}
                    {selectedRow.shrinkingOrigins.join(' · ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                  {selectedRow.dominantOriginNote}
                </div>
              </div>

              {/* 3-Scenario Price Stress Test */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    내년 단가 하락 스트레스 테스트 ({areaPyeong === PYEONG_PER_10A ? '10a·300평' : `${areaPyeong}평`} 기준)
                  </span>
                  <span className="font-num text-slate-500">
                    손익분기 {formatKrw(selectedRow.breakEvenPricePerKg)}/kg
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-slate-500">올해 단가</div>
                    <div className="mt-1 font-bold font-num text-slate-900">
                      {formatKrwCompact(selectedRow.currentNetProfit)}
                    </div>
                    <div className="text-[11px] font-num text-slate-500">
                      {formatKrw(selectedRow.latestPricePerKg)}/kg
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-slate-500">3년 평균가</div>
                    <div className="mt-1 font-bold font-num text-slate-900">
                      {formatKrwCompact(selectedRow.threeYearAvgNetProfit)}
                    </div>
                    <div className="text-[11px] font-num text-slate-500">
                      {formatKrw(selectedRow.threeYearAvgPricePerKg)}/kg
                    </div>
                  </div>
                  <div
                    className={`rounded-lg p-2.5 ${
                      selectedRow.downsideMinus20NetProfit >= 0 ? 'bg-emerald-50/70' : 'bg-red-50'
                    }`}
                  >
                    <div className="text-slate-600">-20% 하락 시</div>
                    <div
                      className={`mt-1 font-bold font-num ${
                        selectedRow.downsideMinus20NetProfit >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatKrwCompact(selectedRow.downsideMinus20NetProfit)}
                    </div>
                    <div className="text-[11px] font-num text-slate-600">
                      안전마진 {selectedRow.safetyMarginPct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    onInspectCropRoi(selectedRow.crop.id, selectedRow.bestMethod.key)
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>1년 수지타산 시뮬레이터</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInspectCropOriginMap(getOriginSearchName(selectedRow.crop))}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>출하지 지도에서 보기</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              표에서 작물을 선택하면 5개년 수급 및 하락 리스크 상세 분석이 표시됩니다.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
