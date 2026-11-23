import { useState } from 'react';
import { CalendarRange, Sparkles } from 'lucide-react';
import type { KoreaProvinceId, RegionalShipmentSchedule } from '../utils/koreaOrigin';
import { formatKrw } from '../utils/unitParser';

interface RegionalTimingPanelProps {
  schedule: RegionalShipmentSchedule;
  selectedItem: string;
  selectedMonthsSet: Set<number>;
  selectedProvinceId: KoreaProvinceId | null;
  usingUploaded: boolean;
  onSelectMonthRange: (startMonth: number, endMonth: number) => void;
  onSelectProvince: (provinceId: KoreaProvinceId | null) => void;
}

function getHeatCellClass(intensity: number): string {
  if (intensity <= 0) return 'bg-slate-100 text-slate-300';
  if (intensity < 25) return 'bg-emerald-50 text-emerald-700';
  if (intensity < 55) return 'bg-emerald-200 text-emerald-900';
  if (intensity < 80) return 'bg-emerald-500 text-white';
  return 'bg-emerald-700 text-white font-semibold';
}

export function RegionalTimingPanel({
  schedule,
  selectedItem,
  selectedMonthsSet,
  selectedProvinceId,
  usingUploaded,
  onSelectMonthRange,
  onSelectProvince,
}: RegionalTimingPanelProps) {
  const [granularity, setGranularity] = useState<'province' | 'sigungu'>('province');
  const rows = granularity === 'province' ? schedule.provinceRows : schedule.sigunguRows;

  return (
    <section
      aria-label="지역별 출하 시점 비교 및 타지역 공백기 분석"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-emerald-700 shrink-0" />
            <h3 className="text-base font-semibold text-slate-900">
              지역별 1~12월 출하 시점 비교 · 타지역 공백기(틈새 수확) 패턴
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {schedule.timingDiffSummary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setGranularity('province')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                granularity === 'province'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              시·도별 ({schedule.provinceRows.length})
            </button>
            <button
              type="button"
              onClick={() => setGranularity('sigungu')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                granularity === 'sigungu'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              시·군·구별 ({schedule.sigunguRows.length})
            </button>
          </div>
        </div>
      </div>

      {/* Single-month uploaded Excel guidance */}
      {usingUploaded && !schedule.hasMultiMonthData && (
        <div className="px-5 py-3 bg-amber-50/80 border-b border-amber-200/80 text-xs text-amber-900">
          현재 업로드된 엑셀 데이터가 1개 월에 집중되어 있어 월간 출하 시차 비교가 제한적입니다. 「경매결과 엑셀 분석」 탭에서 여러 월의 엑셀을 누적 업로드하거나 상단의 <strong>전국 주산지 기준</strong>으로 전환하면 1~12월 지역별 출하 릴레이와 공백기를 바로 비교할 수 있습니다.
        </div>
      )}

      {/* Gap Window Opportunity Strip */}
      {schedule.gapWindows.length > 0 && (
        <div className="px-5 py-4 bg-emerald-50/50 border-b border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              {selectedItem === '전체' ? '전체 품목' : selectedItem} 타지역 미출하 · 저공급 틈새 수확 구간 ({schedule.gapWindows.length}개 구간 감지)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {schedule.gapWindows.map((win) => (
              <div
                key={win.label}
                className="bg-white border border-emerald-200 rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-emerald-900 font-num">
                      {win.label} 공백·단경기
                    </span>
                    <span className="text-xs font-num font-semibold text-emerald-700">
                      월 비중 {win.avgMonthlySharePct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{win.insight}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="font-num text-slate-500">
                    {win.estAvgKgPrice > 0
                      ? `추정 평균 ${formatKrw(win.estAvgKgPrice)}/kg`
                      : '경쟁 산지 출하 없음'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectMonthRange(win.startMonth, win.endMonth)}
                    className="font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 whitespace-nowrap"
                  >
                    이 기간 지도로 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12-Month Regional Shipment Heatmap Matrix */}
      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          현재 조건에서 비교할 지역 출하 이력이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium min-w-[130px]">출하 지역</th>
                <th className="py-2.5 px-3 text-left font-medium min-w-[130px]">주 출하시기</th>
                {Array.from({ length: 12 }, (_, idx) => {
                  const m = idx + 1;
                  const nw = schedule.monthlyNationwide[idx];
                  const isActiveMonth = selectedMonthsSet.has(m) && selectedMonthsSet.size < 12;
                  return (
                    <th key={m} className="py-2 px-1 text-center font-medium w-11">
                      <button
                        type="button"
                        onClick={() => onSelectMonthRange(m, m)}
                        title={`${m}월 전국 비중 ${nw.sharePct}% (클릭 시 ${m}월 지도 필터)`}
                        className={`w-full py-1 rounded transition-colors font-num ${
                          isActiveMonth
                            ? 'bg-emerald-700 text-white font-semibold'
                            : nw.isGapMonth
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 font-semibold'
                              : 'hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {m}월
                      </button>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">평균 kg단가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 18).map((row) => {
                const isSelectedProv = selectedProvinceId === row.provinceId;
                return (
                  <tr
                    key={row.key}
                    onClick={() =>
                      onSelectProvince(isSelectedProv ? null : row.provinceId)
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelectedProv ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {row.windowLabel}
                    </td>
                    {row.monthlyIntensity.map((intensity, idx) => {
                      const m = idx + 1;
                      const isColSelected = selectedMonthsSet.has(m) && selectedMonthsSet.size < 12;
                      const kg = row.monthlyKg[idx];
                      return (
                        <td key={m} className="py-1.5 px-0.5 text-center">
                          <div
                            title={`${row.label} ${m}월: 출하강도 ${intensity}% (${kg.toLocaleString('ko-KR')}kg)`}
                            className={`h-7 rounded flex items-center justify-center font-num text-[11px] ${getHeatCellClass(
                              intensity
                            )} ${isColSelected ? 'ring-2 ring-slate-900/60' : ''}`}
                          >
                            {intensity >= 65 ? '최성' : intensity >= 25 ? '출하' : intensity > 0 ? '소량' : '·'}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-num font-semibold text-emerald-700 whitespace-nowrap">
                      {formatKrw(row.weightedAvgKgPrice)}
                    </td>
                  </tr>
                );
              })}

              {/* Nationwide Total Row */}
              <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-semibold">
                <td className="py-2.5 px-4 text-slate-900 whitespace-nowrap">전국 합계 비중</td>
                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                  월 헤더 클릭 → 단일월 지도
                </td>
                {schedule.monthlyNationwide.map((nw) => (
                  <td
                    key={nw.month}
                    className={`py-2 px-0.5 text-center font-num text-[11px] ${
                      nw.isGapMonth ? 'text-amber-800 bg-amber-50' : 'text-slate-700'
                    }`}
                    title={`${nw.month}월 전국 비중 ${nw.sharePct}% · 활성 시·도 ${nw.activeProvinceCount}곳`}
                  >
                    {nw.sharePct > 0 ? `${Math.round(nw.sharePct)}%` : '0%'}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-num text-slate-500 whitespace-nowrap">
                  100%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Legend Footer */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-700 inline-block" /> 최성출하 (65%+)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> 일반출하 (25~64%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> 초기·말기 소량
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" /> 미출하(공백)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> 전국 공백·단경기 월
          </span>
        </div>
        <span>행 클릭 시 해당 시·도 드릴다운 · 월 헤더 클릭 시 해당 월 지도 즉시 필터</span>
      </div>
    </section>
  );
}
