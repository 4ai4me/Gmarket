import { useEffect, useMemo, useState } from 'react';
import { Calculator, Download, FileJson, Search } from 'lucide-react';
import type { CropProfile, Garak10YrCatalogPayload } from '../types/garak';
import {
  exportGarak10YrToCsv,
  filterGarak10YrItems,
  formatMonthRangesKo,
  type TenYrFilterMode,
} from '../utils/garak10yr';
import { isCultivableDomesticItem } from '../utils/cropSynthesizer';

interface TenYearCatalogPanelProps {
  crops: CropProfile[];
  liveItemToCropId: Map<string, string>;
  onInspectCropRoi: (cropId: string) => void;
}

function getMonthPresenceCellClass(yearsPresent: number): string {
  if (yearsPresent === 0) return 'bg-slate-100 text-slate-300';
  if (yearsPresent <= 2) return 'bg-amber-100 text-amber-800';
  if (yearsPresent <= 6) return 'bg-emerald-200 text-emerald-900';
  return 'bg-emerald-700 text-white';
}

export function TenYearCatalogPanel({
  crops,
  liveItemToCropId,
  onInspectCropRoi,
}: TenYearCatalogPanelProps) {
  const [payload, setPayload] = useState<Garak10YrCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [filterMode, setFilterMode] = useState<TenYrFilterMode>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch('./data/garak-10yr-catalog.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Garak10YrCatalogPayload) => {
        if (active) setPayload(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? `10년치 크롤링 데이터를 불러오지 못했습니다: ${err.message}`
              : '10년치 크롤링 데이터를 불러오지 못했습니다.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cropsById = useMemo(() => new Map(crops.map((c) => [c.id, c])), [crops]);

  const categories = useMemo(() => {
    const items = payload?.items || [];
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return [
      { name: '전체', count: items.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    ];
  }, [payload]);

  const stats = useMemo(() => {
    const items = payload?.items || [];
    const cultivable = items.filter((i) => isCultivableDomesticItem(i.itemName, i.category));
    const growing = items.filter((i) => i.presenceTrendDelta >= 2.5);
    const shrinking = items.filter((i) => i.presenceTrendDelta <= -2.5);
    const withGap = items.filter((i) => i.gapMonths.length > 0 && i.activeYearsCount >= 4);
    return {
      cultivableCount: cultivable.length,
      growingCount: growing.length,
      shrinkingCount: shrinking.length,
      withGapCount: withGap.length,
    };
  }, [payload]);

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    return filterGarak10YrItems(payload.items, {
      search,
      category: selectedCategory,
      filterMode,
    });
  }, [payload, search, selectedCategory, filterMode]);

  const handleDownloadCsv = () => {
    if (!payload || filteredItems.length === 0) return;
    const csv = exportGarak10YrToCsv(payload, filteredItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garak_10yr_catalog_${payload.periodStart}_${payload.periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garak_10yr_catalog_${payload.periodStart}_${payload.periodEnd}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        가락시장 10년치(2017~2026) 실측 크롤링 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div
        role="alert"
        className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"
      >
        {error || '10년치 크롤링 데이터를 찾을 수 없습니다.'}
      </div>
    );
  }

  const maxYearItems = Math.max(...payload.yearlySummary.map((y) => y.uniqueItemCount), 1);

  return (
    <div className="space-y-5">
      {/* Transparent Crawl Provenance Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-slate-700 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-emerald-950">
            실측 크롤링 완료: {payload.periodStart} ~ {payload.periodEnd} ({payload.totalSampledMonths}개 활성 경매월 · 누적 {payload.totalUniqueItems.toLocaleString('ko-KR')}개 품목 · 출처: {payload.source})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-medium rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 다운로드 ({filteredItems.length}종)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-md transition-colors whitespace-nowrap"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>원본 JSON</span>
            </button>
          </div>
        </div>
        <p className="text-slate-600">
          가락시장 공개 엔드포인트에서 최근 10년치 <strong>전 품목·세부품종·거래포장단위·1~12월 실측 출현빈도(공백월)·연도별 거래 확대/축소 추세</strong>를 실측 수집했습니다. (참고: 일별 경락단가·반입톤수·출하지 원시 내역은 가락시장 웹 인증 뷰어 또는 공공데이터포털 OpenAPI/OZViewer 엑셀 다기간 업로드를 통해 반영됩니다.)
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">10년 누적 거래 품목</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {payload.totalUniqueItems.toLocaleString('ko-KR')}종
            </span>
            <span className="text-xs font-num text-emerald-700 font-medium">
              재배가능 {stats.cultivableCount}종
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-num">
            {payload.periodStart}~{payload.periodEnd} · {payload.totalSampledMonths}개월 실측
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">최근 3년 신규·확대 품목</div>
          <div className="mt-1.5 text-2xl font-bold font-num text-emerald-700">
            {stats.growingCount}종
          </div>
          <div className="mt-1 text-xs text-slate-500">
            2024~26년 평균 출현월이 2017~19년 대비 +2.5개월 이상 증가
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">최근 3년 축소·소멸 품목</div>
          <div className="mt-1.5 text-2xl font-bold font-num text-amber-700">
            {stats.shrinkingCount}종
          </div>
          <div className="mt-1 text-xs text-slate-500">
            품종 교체(예: 장희딸기·로얄부사) 또는 출하 축소 감지
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">뚜렷한 계절 공백기 보유</div>
          <div className="mt-1.5 text-2xl font-bold font-num text-slate-900">
            {stats.withGapCount}종
          </div>
          <div className="mt-1 text-xs text-slate-500">
            10년 중 0~2년만 출하된 단경기/공백월이 존재하는 작목
          </div>
        </div>
      </div>

      {/* 10-Year Annual Unique Item Count Mini Bar Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold text-slate-700">
            연도별 가락시장 실측 거래 품목 수 (2017~2026)
          </h3>
          <span className="text-[11px] font-num text-slate-500">
            총 누적 원시 옵션{' '}
            {payload.yearlySummary
              .reduce((a, y) => a + y.totalRawOptions, 0)
              .toLocaleString('ko-KR')}
            건 수집
          </span>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 items-end h-24 pt-2">
          {payload.yearlySummary.map((ys) => {
            const pct = Math.max(18, Math.round((ys.uniqueItemCount / maxYearItems) * 100));
            return (
              <div key={ys.year} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[11px] font-num font-semibold text-slate-700">
                  {ys.uniqueItemCount}
                </span>
                <div className="w-full max-w-[36px] bg-slate-100 rounded-t h-12 flex items-end overflow-hidden">
                  <div
                    className="w-full bg-emerald-600 rounded-t transition-all"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] font-num text-slate-500">{ys.year}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="catalog-10yr-search" className="sr-only">
              10년치 품목명 또는 단위 검색
            </label>
            <input
              id="catalog-10yr-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="10년치 품목·단위 검색 (예: 달래, 두릅, 고수, 딸기, 10kg)"
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex flex-wrap items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  ['all', `전체 (${payload.totalUniqueItems})`],
                  ['cultivable', `재배가능 (${stats.cultivableCount})`],
                  ['has_gap', `공백월 보유 (${stats.withGapCount})`],
                  ['growing', `최근 확대·신규 (${stats.growingCount})`],
                  ['shrinking', `최근 축소·소멸 (${stats.shrinkingCount})`],
                  ['all_10yr', '10년 연속 출하'],
                ] as Array<[TenYrFilterMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    filterMode === mode
                      ? mode === 'growing'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : mode === 'shrinking'
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="font-num text-slate-500 whitespace-nowrap">
              표시 <strong className="text-slate-900">{filteredItems.length}</strong>종
            </span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedCategory === cat.name
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat.name} <span className="font-num opacity-75">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 10-Year Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            검색 조건에 해당하는 10년치 품목이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-3 text-left font-medium w-10">No</th>
                  <th className="py-2.5 px-3 text-left font-medium">품목명 · 부류</th>
                  <th className="py-2.5 px-3 text-left font-medium">10년 활동 · 추세</th>
                  <th className="py-2.5 px-3 text-left font-medium min-w-[270px]">
                    1~12월 실측 출현빈도 (10년 중 출하 연수)
                  </th>
                  <th className="py-2.5 px-3 text-left font-medium">공백월(2년 이하)</th>
                  <th className="py-2.5 px-3 text-left font-medium">10년 관측 거래단위</th>
                  <th className="py-2.5 px-3 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.slice(0, 150).map((item, idx) => {
                  const mappedId = liveItemToCropId.get(item.itemName);
                  const linked = mappedId ? cropsById.get(mappedId) : undefined;
                  return (
                    <tr key={`${item.itemName}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-num text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.itemName}</div>
                        <div className="text-[11px] text-slate-500">{item.category}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-num">
                        <div className="text-slate-800">
                          {item.firstYear}~{item.lastYear} ({item.activeYearsCount}년)
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            item.presenceTrendDelta >= 2.5
                              ? 'text-emerald-700'
                              : item.presenceTrendDelta <= -2.5
                                ? 'text-amber-700'
                                : 'text-slate-400'
                          }`}
                        >
                          {item.presenceTrendDelta > 0
                            ? `+${item.presenceTrendDelta}개월↑`
                            : item.presenceTrendDelta < 0
                              ? `${item.presenceTrendDelta}개월↓`
                              : '안정 유지'}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="grid grid-cols-12 gap-0.5">
                          {item.monthlyPresence10Yr.map((cnt, mIdx) => (
                            <div
                              key={mIdx}
                              title={`${item.itemName} ${mIdx + 1}월: 최근 10년 중 ${cnt}년 거래`}
                              className={`h-6 rounded-xs flex items-center justify-center font-num text-[10px] ${getMonthPresenceCellClass(
                                cnt
                              )}`}
                            >
                              {cnt}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-12 gap-0.5 mt-0.5 text-[9px] text-slate-400 text-center font-num">
                          {Array.from({ length: 12 }, (_, mIdx) => (
                            <span key={mIdx}>{mIdx + 1}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.gapMonths.length > 0 ? (
                          <span className="font-medium text-amber-800">
                            {formatMonthRangesKo(item.gapMonths)}
                          </span>
                        ) : (
                          <span className="text-slate-400">연중 출하</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-num max-w-[200px] truncate">
                        {item.units.length > 0 ? (
                          <span title={item.units.join(', ')}>
                            {item.units.slice(0, 6).join(' · ')}
                            {item.units.length > 6 ? ` 외 ${item.units.length - 6}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">세부품종 등록</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {linked ? (
                          <button
                            type="button"
                            onClick={() => onInspectCropRoi(linked.id)}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>ROI</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length > 150 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
                상위 150종을 표시 중입니다 (전체 {filteredItems.length}종은 검색 또는 상단 CSV 다운로드로 모두 확인 가능).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
