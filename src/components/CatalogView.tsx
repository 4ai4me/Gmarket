import { useMemo, useState } from 'react';
import { Calculator, RefreshCw, Search } from 'lucide-react';
import type { CropProfile, GarakLiveItem, GarakLiveResponse } from '../types/garak';
import { isCultivableDomesticItem } from '../utils/cropSynthesizer';

interface CatalogViewProps {
  liveCatalog: GarakLiveResponse | null;
  loading: boolean;
  error: string | null;
  queryDate: string;
  queryMode: 'all_year' | 'auction' | 'summary';
  crops: CropProfile[];
  liveItemToCropId: Map<string, string>;
  onChangeDate: (date: string) => void;
  onChangeMode: (mode: 'all_year' | 'auction' | 'summary') => void;
  onRefresh: () => void;
  onInspectCropRoi: (cropId: string) => void;
}

export function CatalogView({
  liveCatalog,
  loading,
  error,
  queryDate,
  queryMode,
  crops,
  liveItemToCropId,
  onChangeDate,
  onChangeMode,
  onRefresh,
  onInspectCropRoi,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [unitFilter, setUnitFilter] = useState<'all' | 'cultivable' | 'multi' | 'gram_or_other'>('all');

  const cropsById = useMemo(() => new Map(crops.map((c) => [c.id, c])), [crops]);

  const cultivableCount = useMemo(() => {
    const items = liveCatalog?.items || [];
    return items.filter((item) => isCultivableDomesticItem(item.itemName, item.category)).length;
  }, [liveCatalog]);

  const categories = useMemo(() => {
    const items = liveCatalog?.items || [];
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
  }, [liveCatalog]);

  const filteredItems = useMemo(() => {
    const items = liveCatalog?.items || [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== '전체' && item.category !== selectedCategory) return false;
      if (unitFilter === 'cultivable' && !isCultivableDomesticItem(item.itemName, item.category)) {
        return false;
      }
      if (unitFilter === 'multi' && item.units.length < 3) return false;
      if (
        unitFilter === 'gram_or_other' &&
        !item.units.some((u) => (/g$/i.test(u) && !/kg$/i.test(u)) || item.hasNonWeightUnit)
      ) {
        return false;
      }
      if (q) {
        const hitName = item.itemName.toLowerCase().includes(q);
        const hitUnit = item.units.some((u) => u.toLowerCase().includes(q));
        return hitName || hitUnit;
      }
      return true;
    });
  }, [liveCatalog, search, selectedCategory, unitFilter]);

  const findLinkedCrop = (item: GarakLiveItem): CropProfile | undefined => {
    const mappedId = liveItemToCropId.get(item.itemName);
    if (mappedId) return cropsById.get(mappedId);
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            가락시장 전체 품목 · 거래단위 실시간 목록
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {queryMode === 'all_year'
              ? `최근 12개월 경매결과(상위품목+포장단위)와 품목별 가격(고수·허브 등 세부품종)을 통합 조회합니다. 국내 재배가능 농산물(${cultivableCount}종)은 모두 1년 수지타산과 연동됩니다.`
              : `지정 일자 가락시장 등록 품목을 조회하며, 국내 재배가능 농산물(${cultivableCount}종)은 모두 1년 수지타산 분석과 즉시 교차 연동됩니다.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="garak-catalog-date">
            조회 기준 날짜
          </label>
          <input
            id="garak-catalog-date"
            type="date"
            value={queryDate}
            onChange={(e) => onChangeDate(e.target.value)}
            title={queryMode === 'all_year' ? '기준일로부터 최근 12개월 통합 조회' : '지정 일자 단건 조회'}
            className="h-9 px-3 text-sm font-num bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />

          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeMode('all_year')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                queryMode === 'all_year'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              연간 통합 (전 품목)
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('auction')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                queryMode === 'auction'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              일간 경매 (단위)
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                queryMode === 'summary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              일간 품종 (청과)
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>실시간 조회</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-semibold underline underline-offset-2 whitespace-nowrap"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Static Hosting Snapshot Notice (GitHub Pages) */}
      {!error && liveCatalog?.source === 'snapshot' && (
        <div className="bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            정적 웹 호스팅(GitHub Pages) 환경에서는 내장된 가락시장 실제 경매 품목 스냅샷({liveCatalog.date} 기준 {liveCatalog.itemCount}종)을 표시합니다. 엑셀(.xls) 업로드 분석과 전 품목 1년 수지타산 시뮬레이션은 브라우저에서 그대로 동작합니다.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="catalog-search" className="sr-only">
              품목명 또는 단위 검색
            </label>
            <input
              id="catalog-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="품목명 또는 단위 검색 (예: 고수, 쪽파, 브로콜리, 10kg)"
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setUnitFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  unitFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                전체 품목
              </button>
              <button
                type="button"
                onClick={() => setUnitFilter('cultivable')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  unitFilter === 'cultivable'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                재배가능 농산물 ({cultivableCount})
              </button>
              {queryMode !== 'summary' && (
                <>
                  <button
                    type="button"
                    onClick={() => setUnitFilter('multi')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                      unitFilter === 'multi'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    다규격 (3종+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitFilter('gram_or_other')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                      unitFilter === 'gram_or_other'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    소포장(g)·특수
                  </button>
                </>
              )}
            </div>
            <span className="font-num whitespace-nowrap">
              표시 <strong className="text-slate-900">{filteredItems.length}</strong> /{' '}
              {liveCatalog?.itemCount ?? 0}품목
            </span>
          </div>
        </div>

        {/* Category Tabs */}
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
              {cat.name}{' '}
              <span className="font-num opacity-75">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse">
                <div className="h-4 w-36 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-4 w-64 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              {liveCatalog && liveCatalog.itemCount === 0
                ? '선택한 날짜에는 가락시장 경매 기록이 없습니다 (일요일·휴장일일 수 있습니다).'
                : '검색 조건에 맞는 품목이 없습니다.'}
            </p>
            <p className="text-xs text-slate-500">
              평일 경매일자를 선택하거나 검색어를 초기화해 주세요.
            </p>
            {(search || selectedCategory !== '전체' || unitFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('전체');
                  setUnitFilter('all');
                }}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium w-14">번호</th>
                  <th className="py-2.5 px-4 text-left font-medium">품목명</th>
                  <th className="py-2.5 px-4 text-left font-medium">부류</th>
                  <th className="py-2.5 px-4 text-left font-medium">
                    {queryMode === 'summary' ? '조회 기준' : '실제 거래 포장단위 · 출처 (가락시장)'}
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">1년 수지타산 연동</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const linked = findLinkedCrop(item);
                  const isMarine = item.category === '수산·건해';
                  const isImported =
                    item.category === '수입품목' ||
                    item.category === '수입과일' ||
                    /수입/.test(item.itemName);
                  return (
                    <tr key={`${item.itemName}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-num text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {item.itemName}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {item.category}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 font-num">
                        {item.units.length > 0 ? (
                          <span>
                            {item.units.slice(0, 10).join(' · ')}
                            {item.units.length > 10 && (
                              <span className="text-slate-400">
                                {' '}
                                외 {item.units.length - 10}개
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            청과 세부품종 (품목별 가격 등록)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {linked ? (
                          <button
                            type="button"
                            onClick={() => onInspectCropRoi(linked.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>
                              {linked.dataSourceTier === 'curated'
                                ? `${linked.name} 정밀 ROI`
                                : '교차모델 ROI'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {isMarine ? '비재배(수산)' : isImported ? '수입품목' : '비재배'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
