import { ArrowRight, FileSpreadsheet, ListTree, TrendingUp } from 'lucide-react';
import type { CropRankingRow, GarakLiveResponse } from '../types/garak';
import type { NavTab } from './Sidebar';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';

interface OverviewViewProps {
  rankingsByKg: CropRankingRow[];
  rankingsByNative: CropRankingRow[];
  rankingsByProfit: CropRankingRow[];
  liveCatalog: GarakLiveResponse | null;
  analyzedCropCount: number;
  curatedCropCount: number;
  inferredLiveCount: number;
  uploadedCount: number;
  applyUploadedOverrides: boolean;
  supplyRiskSummary?: {
    oversupplyCount: number;
    opportunityCount: number;
    stableCount: number;
    topResilientName: string;
    topResilientMinus20Profit: number;
  };
  onNavigate: (tab: NavTab) => void;
  onInspectCropRoi: (cropId: string) => void;
}

export function OverviewView({
  rankingsByKg,
  rankingsByNative,
  rankingsByProfit,
  liveCatalog,
  analyzedCropCount,
  curatedCropCount,
  inferredLiveCount,
  uploadedCount,
  applyUploadedOverrides,
  supplyRiskSummary,
  onNavigate,
  onInspectCropRoi,
}: OverviewViewProps) {
  const topKg = rankingsByKg[0];
  const topNative = rankingsByNative[0];
  const topProfit = rankingsByProfit[0];

  return (
    <div className="space-y-8">
      {/* Intro & Data Provenance Line */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            가락시장 전 품목 단가 · 1년 재배 수지타산 개요
          </h2>
          <p className="text-sm text-slate-600 mt-1.5">
            가락시장에 등록된 재배가능 농산물 전체를 경매단가(kg·고유단위)와 재배방식별 1년 수지타산으로 교차 분석합니다.
          </p>
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 shrink-0">
          <span>기준 면적: 10a (약 300평)</span>
          <span aria-hidden="true">·</span>
          <span>
            {applyUploadedOverrides && uploadedCount > 0
              ? `업로드 엑셀 ${uploadedCount}건 실측 반영`
              : `교차분석 ${analyzedCropCount}품목 연동`}
          </span>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section aria-label="핵심 지표" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">1년 수지타산 교차분석 품목</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {analyzedCropCount}종
            </span>
            <span className="text-xs text-emerald-700 font-num font-medium">
              가락 전체 {liveCatalog ? `${liveCatalog.itemCount}종` : '대기'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 truncate font-num">
            정밀 기준 {curatedCropCount}종 + 가락 자동매핑 {inferredLiveCount}종
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">연평균 kg당 최고 단가</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {topKg ? formatKrw(topKg.pricePerKg) : '-'}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {topKg?.crop.name}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 truncate">
            {topKg ? `${topKg.crop.standardUnitLabel} · 성수기 ${topKg.crop.peakPriceMonths.join(',')}월` : ''}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">고유 거래단위 최고 단가</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {topNative ? formatKrw(topNative.pricePerNativeUnit) : '-'}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {topNative?.crop.name}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 truncate">
            {topNative ? `단위: ${topNative.crop.standardUnitLabel}` : ''}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">10a(300평) 연 예상 순수익 1위</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {topProfit ? formatKrwCompact(topProfit.estimatedAnnualNetProfitPer10a) : '-'}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {topProfit?.crop.name}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 truncate">
            {topProfit ? `${topProfit.bestMethod.label}` : ''}
          </div>
        </div>
      </section>

      {/* Main Comparison Grid: High kg Price vs High 1-Year Net Profit */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                kg당 연평균 단가 상위 작물
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                단가가 높아도 시설비·인건비·수확량에 따라 실제 순이익 순위는 달라집니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ranking')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              <span>전체 순위</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">순위 · 품목</th>
                  <th className="py-2.5 px-3 text-left font-medium">고유단위</th>
                  <th className="py-2.5 px-3 text-right font-medium">kg당 단가</th>
                  <th className="py-2.5 px-4 text-right font-medium">단위당 가격</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingsByKg.slice(0, 7).map((row, idx) => (
                  <tr
                    key={row.crop.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => onInspectCropRoi(row.crop.id)}
                        className="text-left hover:text-emerald-700 font-medium text-slate-900"
                      >
                        <span className="font-num text-slate-400 mr-2">{idx + 1}.</span>
                        {row.crop.name}
                      </button>
                      <span className="ml-2 text-xs text-slate-400">{row.crop.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {row.crop.standardUnitLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatKrw(row.pricePerKg)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-num text-slate-600 whitespace-nowrap">
                      {formatKrw(row.pricePerNativeUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                1년 10a(300평) 예상 순수익 상위 작물
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                연간 회전율 · 수확량 · 경영비 · 감가상각 반영 (클릭하여 상세 시뮬레이션)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('roi')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              <span>ROI 시뮬레이터</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">순위 · 품목</th>
                  <th className="py-2.5 px-3 text-left font-medium">권장 재배방식</th>
                  <th className="py-2.5 px-3 text-right font-medium">연 회전</th>
                  <th className="py-2.5 px-4 text-right font-medium">연 순수익(10a)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingsByProfit.slice(0, 7).map((row, idx) => (
                  <tr
                    key={row.crop.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => onInspectCropRoi(row.crop.id)}
                        className="text-left hover:text-emerald-700 font-medium text-slate-900"
                      >
                        <span className="font-num text-slate-400 mr-2">{idx + 1}.</span>
                        {row.crop.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 truncate max-w-[180px]">
                      {row.bestMethod.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {row.bestMethod.cyclesPerYear}기작
                    </td>
                    <td className="py-2.5 px-4 text-right font-num font-semibold text-emerald-700 whitespace-nowrap">
                      {formatKrwCompact(row.estimatedAnnualNetProfitPer10a)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Direct Workflow Actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              년간 수급 추세 · 내년 가격 경보
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {supplyRiskSummary
                ? `하락주의 ${supplyRiskSummary.oversupplyCount}종 · 유망/안정 ${supplyRiskSummary.opportunityCount + supplyRiskSummary.stableCount}종 · -20% 방어 1위 ${supplyRiskSummary.topResilientName} (${formatKrwCompact(supplyRiskSummary.topResilientMinus20Profit)})`
                : '5개년 반입량 추세와 단가 -20% 하락 시 안전마진을 점검합니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('supply_risk')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <TrendingUp className="w-4 h-4" />
            <span>수급·리스크</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              가락시장 전체 거래 품목·단위 조회
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              특정 날짜·12개월 통합 전체 경매 품목과 포장단위(10kg, 15kg, 2kg, .75kg 등)를 직접 불러옵니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ListTree className="w-4 h-4" />
            <span>품목 조회</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              경매결과 엑셀(.xls) 다기간 누적 분석
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              여러 연도·월 엑셀 파일을 누적 병합해 가중평균 단가와 산지 변화를 순위·지도·ROI에 즉시 반영합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('excel')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>엑셀 분석</span>
          </button>
        </div>
      </section>
    </div>
  );
}
