import { useMemo, useState } from 'react';
import { Calculator, RefreshCw, Search } from 'lucide-react';
import type { CropProfile, GarakLiveItem, GarakLiveResponse } from '../types/garak';

interface CatalogViewProps {
  liveCatalog: GarakLiveResponse | null;
  loading: boolean;
  error: string | null;
  queryDate: string;
  queryMode: 'auction' | 'summary';
  crops: CropProfile[];
  onChangeDate: (date: string) => void;
  onChangeMode: (mode: 'auction' | 'summary') => void;
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
  onChangeDate,
  onChangeMode,
  onRefresh,
  onInspectCropRoi,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [unitFilter, setUnitFilter] = useState<'all' | 'multi' | 'gram_or_other'>('all');

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
      if (unitFilter === 'multi' && item.units.length < 3) return false;
      if (unitFilter === 'gram_or_other' && !item.units.some((u) => /g$/i.test(u) && !/kg$/i.test(u) || item.hasNonWeightUnit)) {
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

  const findMatchingCrop = (item: GarakLiveItem): CropProfile | undefined => {
    const clean = item.itemName.replace(/\s+/g, '').toLowerCase();
    return crops.find((c) => {
      if (clean === c.name.toLowerCase() || clean.includes(c.name.toLowerCase())) return true;
      return c.aliases.some((a) => clean.includes(a.replace(/\s+/g, '').toLowerCase()));
    });
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
            가락시장 서버(`selectAutoCompleteAjax.do`)에서 지정 일자에 실제 경매된 품목과 포장단위 조합을 직접 조회합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="garak-catalog-date">
            조회 날짜
          </label>
          <input
            id="garak-catalog-date"
            type="date"
            value={queryDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="h-9 px-3 text-sm font-num bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />

          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeMode('auction')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                queryMode === 'auction'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              경매결과 (품목+단위)
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
              품목별 가격 (청과 품종)
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
              placeholder="품목명 또는 단위 검색 (예: 쪽파, 고구마, 10kg, 300g)"
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {queryMode === 'auction' && (
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUnitFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                    unitFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  전체 단위
                </button>
                <button
                  type="button"
                  onClick={() => setUnitFilter('multi')}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                    unitFilter === 'multi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
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
                  소포장(g)·특수단위
                </button>
              </div>
            )}
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
            {search && (
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
                    {queryMode === 'auction' ? '실제 거래 포장단위 (가락시장)' : '조회 기준'}
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">수지타산 분석</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const matched = findMatchingCrop(item);
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
                          <span className="text-slate-400">품종 기준 (품목별 가격 탭)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {matched ? (
                          <button
                            type="button"
                            onClick={() => onInspectCropRoi(matched.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>{matched.name} ROI</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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
