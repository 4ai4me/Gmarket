import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Download,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { AuctionRecord, CropProfile } from '../types/garak';
import { NATIONWIDE_ORIGIN_BASELINE_RECORDS } from '../data/originAuctionBaseline';
import {
  aggregateAuctionByRegion,
  type KoreaProvinceId,
} from '../utils/koreaOrigin';
import { matchAuctionRecordToCrop } from '../utils/analytics';
import { exportAuctionRecordsToCsv } from '../utils/excelParser';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';
import { KoreaOriginMapSvg, type MapMetricKey } from './KoreaOriginMapSvg';

interface OriginMapViewProps {
  uploadedRecords: AuctionRecord[];
  uploadedMetaLabel: string;
  crops: CropProfile[];
  initialItemFilter?: string;
  onOpenExcelUpload: () => void;
  onInspectCropRoi: (cropId: string) => void;
}

type TableSortKey = 'amount' | 'kg' | 'quantity' | 'kgPrice' | 'unitPrice';

export function OriginMapView({
  uploadedRecords,
  uploadedMetaLabel,
  crops,
  initialItemFilter,
  onOpenExcelUpload,
  onInspectCropRoi,
}: OriginMapViewProps) {
  const hasUploaded = uploadedRecords.length > 0;
  const [dataSourceMode, setDataSourceMode] = useState<'auto' | 'uploaded' | 'baseline'>('auto');

  const usingUploaded =
    dataSourceMode === 'uploaded'
      ? hasUploaded
      : dataSourceMode === 'baseline'
        ? false
        : hasUploaded;

  const activeRecords = usingUploaded ? uploadedRecords : NATIONWIDE_ORIGIN_BASELINE_RECORDS;

  // Filters
  const [selectedItem, setSelectedItem] = useState<string>('전체');
  const [selectedVariety, setSelectedVariety] = useState<string>('전체');
  const [selectedGrade, setSelectedGrade] = useState<string>('전체');
  const [selectedUnit, setSelectedUnit] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mapMetric, setMapMetric] = useState<MapMetricKey>('totalKg');
  const [selectedProvinceId, setSelectedProvinceId] = useState<KoreaProvinceId | null>(null);
  const [sortBy, setSortBy] = useState<TableSortKey>('amount');

  useEffect(() => {
    if (!initialItemFilter) return;
    const exactExists = activeRecords.some((r) => r.item === initialItemFilter);
    setSelectedVariety('전체');
    setSelectedGrade('전체');
    setSelectedUnit('전체');
    setSelectedProvinceId(null);
    if (exactExists) {
      setSelectedItem(initialItemFilter);
      setSearchQuery('');
    } else {
      setSelectedItem('전체');
      setSearchQuery(initialItemFilter);
    }
  }, [initialItemFilter, activeRecords]);

  const agg = useMemo(
    () =>
      aggregateAuctionByRegion(activeRecords, {
        item: selectedItem,
        variety: selectedVariety,
        grade: selectedGrade,
        unitRaw: selectedUnit,
        search: searchQuery,
      }),
    [activeRecords, selectedItem, selectedVariety, selectedGrade, selectedUnit, searchQuery]
  );

  const rankedProvinces = useMemo(() => {
    return agg.provinces
      .filter((p) => p.recordCount > 0)
      .sort((a, b) => {
        if (mapMetric === 'yoyVolumeChangePct') {
          return (b.yoyVolumeChangePct ?? -999) - (a.yoyVolumeChangePct ?? -999);
        }
        return b[mapMetric] - a[mapMetric];
      });
  }, [agg.provinces, mapMetric]);

  const topProvince = rankedProvinces[0] || null;
  const topKgProvince = useMemo(() => {
    return (
      agg.provinces
        .filter((p) => p.recordCount > 0)
        .sort((a, b) => b.totalKg - a.totalKg)[0] || null
    );
  }, [agg.provinces]);
  const selectedProvince = selectedProvinceId ? agg.provinceMap.get(selectedProvinceId) || null : null;

  const tableRecords = useMemo(() => {
    const list = selectedProvinceId
      ? agg.filteredRecords.filter((r) => r.provinceId === selectedProvinceId)
      : agg.filteredRecords;

    return [...list].sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmountKrw - a.totalAmountKrw;
      if (sortBy === 'kg') return b.totalKg - a.totalKg;
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      if (sortBy === 'kgPrice') return b.pricePerKg - a.pricePerKg;
      return b.pricePerUnit - a.pricePerUnit;
    });
  }, [agg.filteredRecords, selectedProvinceId, sortBy]);

  const handleResetFilters = () => {
    setSelectedItem('전체');
    setSelectedVariety('전체');
    setSelectedGrade('전체');
    setSelectedUnit('전체');
    setSearchQuery('');
    setSelectedProvinceId(null);
  };

  const handleDownloadCsv = () => {
    if (tableRecords.length === 0) return;
    const csv = exportAuctionRecordsToCsv(tableRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garak_origin_${selectedItem === '전체' ? 'all' : selectedItem}_${
      selectedProvince ? selectedProvince.provinceName : 'korea'
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFiltered =
    selectedItem !== '전체' ||
    selectedVariety !== '전체' ||
    selectedGrade !== '전체' ||
    selectedUnit !== '전체' ||
    Boolean(searchQuery.trim()) ||
    selectedProvinceId !== null;

  return (
    <div className="space-y-6">
      {/* Page Header & Data Source Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            대한민국 출하지별 경매 현황 지도
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            품목·품종·단위·등급별로 어느 지역(시·도 / 시·군·구) 상품이 얼마나 경매되고 단가가 형성되는지 지도에서 교차 확인합니다.
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDataSourceMode('baseline');
                handleResetFilters();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !usingUploaded
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전국 주산지 기준 ({NATIONWIDE_ORIGIN_BASELINE_RECORDS.length}건)
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasUploaded) {
                  setDataSourceMode('uploaded');
                  handleResetFilters();
                } else {
                  onOpenExcelUpload();
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                usingUploaded
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {hasUploaded
                ? `업로드 엑셀 실측 (${uploadedRecords.length}건)`
                : '내 엑셀(.xls) 올리기'}
            </button>
          </div>
        </div>
      </div>

      {/* Transparent Data Provenance Notice */}
      <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/80 border border-slate-200 rounded-lg">
        <span>
          {usingUploaded ? (
            <>
              현재 <strong className="text-emerald-800">업로드 실측 경매결과({uploadedMetaLabel || '사용자 엑셀'})</strong>의 출하지 데이터를 지도와 표에 실시간 반영 중입니다.
            </>
          ) : (
            <>
              현재 <strong className="text-slate-900">전국 주산지 기준 경매 샘플({NATIONWIDE_ORIGIN_BASELINE_RECORDS.length}건 · 17개 시·도 주산지)</strong>을 표시 중입니다. 가락시장 OZViewer에서 내려받은 <code className="font-mono text-slate-800">.xls</code> 파일을 올리면 실제 경매 출하지 데이터로 즉시 전환됩니다.
            </>
          )}
        </span>
        {agg.totals.otherRegionRecordCount > 0 && (
          <span className="font-num text-slate-500 whitespace-nowrap">
            수입·미상 출하지 {agg.totals.otherRegionRecordCount}건 (하단 표 포함)
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="origin-filter-item" className="block text-xs font-medium text-slate-500 mb-1">
              품목
            </label>
            <select
              id="origin-filter-item"
              value={selectedItem}
              onChange={(e) => {
                setSelectedItem(e.target.value);
                setSelectedVariety('전체');
                setSelectedGrade('전체');
                setSelectedUnit('전체');
              }}
              className="w-full h-9 px-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="전체">전체 품목 ({agg.filterOptions.items.length})</option>
              {agg.filterOptions.items.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="origin-filter-variety" className="block text-xs font-medium text-slate-500 mb-1">
              품종
            </label>
            <select
              id="origin-filter-variety"
              value={selectedVariety}
              onChange={(e) => setSelectedVariety(e.target.value)}
              className="w-full h-9 px-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="전체">전체 품종 ({agg.filterOptions.varieties.length})</option>
              {agg.filterOptions.varieties.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="origin-filter-grade" className="block text-xs font-medium text-slate-500 mb-1">
              등급
            </label>
            <select
              id="origin-filter-grade"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full h-9 px-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="전체">전체 등급</option>
              {agg.filterOptions.grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="origin-filter-unit" className="block text-xs font-medium text-slate-500 mb-1">
              거래단위
            </label>
            <select
              id="origin-filter-unit"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full h-9 px-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="전체">전체 단위</option>
              {agg.filterOptions.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="origin-filter-search" className="block text-xs font-medium text-slate-500 mb-1">
              출하지 · 법인 검색
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="origin-filter-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="예: 보성, 양평, 고수, 논산"
                className="w-full h-9 pl-8 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Map Metric Switcher & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">지도 색상 기준</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  ['totalKg', '출하 중량(kg)'],
                  ['totalQuantity', '경매 수량'],
                  ['totalAmountKrw', '총 경매액'],
                  ['weightedAvgKgPrice', '평균 kg단가'],
                  ['yoyVolumeChangePct', '전년대비 산지 증감(%)'],
                ] as Array<[MapMetricKey, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMapMetric(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mapMetric === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-num">
              출하 시·도 <strong className="text-slate-900">{agg.totals.activeProvinceCount}개</strong> · 시·군·구{' '}
              <strong className="text-slate-900">{agg.totals.activeSigunguCount}곳</strong>
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>필터 초기화</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section aria-label="출하지 경매 핵심 지표" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">총 경매 출하량</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-num text-slate-900">
              {agg.totals.totalKg >= 1000
                ? `${(agg.totals.totalKg / 1000).toFixed(2)}톤`
                : `${agg.totals.totalKg.toLocaleString('ko-KR')}kg`}
            </span>
            {agg.totals.overallYoYPct !== null ? (
              <span
                className={`text-xs font-num font-semibold whitespace-nowrap ${
                  agg.totals.overallYoYPct >= 4
                    ? 'text-amber-700'
                    : agg.totals.overallYoYPct <= -2
                      ? 'text-emerald-700'
                      : 'text-slate-600'
                }`}
              >
                전년비 {agg.totals.overallYoYPct > 0 ? `+${agg.totals.overallYoYPct}%` : `${agg.totals.overallYoYPct}%`}
              </span>
            ) : (
              <span className="text-xs font-num text-slate-500">
                {agg.totals.totalQuantity.toLocaleString('ko-KR')}단위
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-num">
            {agg.totals.totalKg.toLocaleString('ko-KR')}kg · 경매 {agg.totals.recordCount}건
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">총 경매 거래금액</div>
          <div className="mt-1.5 text-2xl font-bold font-num text-slate-900">
            {formatKrwCompact(agg.totals.totalAmountKrw)}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-num">
            {formatKrw(agg.totals.totalAmountKrw)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">가중평균 kg당 단가</div>
          <div className="mt-1.5 text-2xl font-bold font-num text-emerald-700">
            {formatKrw(agg.totals.overallWeightedAvgKgPrice)}
            <span className="text-xs font-normal text-slate-500 ml-0.5">/kg</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-num">
            범위 {formatKrw(agg.totals.minKgPrice)} ~ {formatKrw(agg.totals.maxKgPrice)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">최다 출하 · 주산지 편중도</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 truncate">
              {topKgProvince ? topKgProvince.provinceName : '-'}
            </span>
            {topKgProvince && (
              <span className="text-xs font-num font-semibold text-emerald-700 whitespace-nowrap">
                상위2도 {agg.totals.top2ProvinceSharePct}%
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            {topKgProvince && topKgProvince.topOrigins[0]
              ? `1위 ${topKgProvince.shareOfTotalKgPct}% · 대표 ${topKgProvince.topOrigins[0].sigungu}`
              : '해당 조건 출하 지역 없음'}
          </div>
        </div>
      </section>

      {/* Main 2-Column Split: Korea Map + Regional Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Interactive South Korea Choropleth Map */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                대한민국 시·도별 출하 분포 지도
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedItem === '전체' ? '전체 품목 기준' : `${selectedItem} 기준`} · 지역 클릭 시 시·군·구 상세 조회
              </p>
            </div>
            {selectedProvince && (
              <button
                type="button"
                onClick={() => setSelectedProvinceId(null)}
                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
              >
                {selectedProvince.provinceName} 선택 해제
              </button>
            )}
          </div>

          <div className="flex-1 min-h-[430px]">
            <KoreaOriginMapSvg
              provinceMap={agg.provinceMap}
              selectedProvinceId={selectedProvinceId}
              metric={mapMetric}
              onSelectProvince={setSelectedProvinceId}
            />
          </div>
        </div>

        {/* Right: Province Rankings OR Selected Province Drill-Down */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          {selectedProvince ? (
            <div className="space-y-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-xs text-emerald-700 font-medium">선택 지역 상세 현황</div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedProvince.fullName}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5 font-num">
                    전국 출하 중량 비중 {selectedProvince.shareOfTotalKgPct}% · 거래{' '}
                    {selectedProvince.recordCount}건 · {selectedProvince.topOrigins.length}개 시·군·구
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProvinceId(null)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap"
                >
                  전국 순위로 돌아가기
                </button>
              </div>

              {selectedProvince.recordCount === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-sm text-slate-500">
                  <p>현재 필터 조건에서 {selectedProvince.fullName}의 경매 출하 내역이 없습니다.</p>
                  <button
                    type="button"
                    onClick={() => setSelectedProvinceId(null)}
                    className="mt-3 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    전체 지역 보기
                  </button>
                </div>
              ) : (
                <>
                  {/* Selected Province Mini Metrics */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500">총 출하 중량</div>
                      <div className="mt-1 text-base font-bold font-num text-slate-900">
                        {selectedProvince.totalKg.toLocaleString('ko-KR')}kg
                      </div>
                      <div className="text-slate-500 font-num">
                        {selectedProvince.totalQuantity.toLocaleString('ko-KR')}단위
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500">가중평균 kg단가</div>
                      <div className="mt-1 text-base font-bold font-num text-emerald-700">
                        {formatKrw(selectedProvince.weightedAvgKgPrice)}
                      </div>
                      <div className="text-slate-500 font-num">
                        단위평균 {formatKrw(selectedProvince.weightedAvgUnitPrice)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500">총 경매금액</div>
                      <div className="mt-1 text-base font-bold font-num text-slate-900">
                        {formatKrwCompact(selectedProvince.totalAmountKrw)}
                      </div>
                      <div className="text-slate-500 font-num">
                        비중 {selectedProvince.shareOfTotalAmountPct}%
                      </div>
                    </div>
                  </div>

                  {/* Sigungu breakdown within selected province */}
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">
                      시·군·구별 출하 물량 및 평균 단가
                    </h4>
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {selectedProvince.topOrigins.map((origin) => {
                        const pct =
                          selectedProvince.totalKg > 0
                            ? Math.round((origin.totalKg / selectedProvince.totalKg) * 1000) / 10
                            : 0;
                        return (
                          <div key={origin.key} className="py-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900">
                                  {origin.sigungu}
                                </span>
                                <span className="text-slate-400 mx-1.5">·</span>
                                <span className="text-slate-600">
                                  주력 {origin.topItem} ({origin.topGrade})
                                </span>
                                {origin.yoyVolumeChangePct !== null && (
                                  <span
                                    className={`font-num ml-1.5 font-semibold ${
                                      origin.yoyVolumeChangePct >= 5
                                        ? 'text-amber-700'
                                        : origin.yoyVolumeChangePct <= -2.5
                                          ? 'text-emerald-700'
                                          : 'text-slate-500'
                                    }`}
                                  >
                                    {origin.yoyVolumeChangePct > 0
                                      ? `+${origin.yoyVolumeChangePct}%`
                                      : `${origin.yoyVolumeChangePct}%`}
                                  </span>
                                )}
                              </div>
                              <div className="font-num text-right whitespace-nowrap">
                                <strong className="text-slate-900">
                                  {origin.totalKg.toLocaleString('ko-KR')}kg
                                </strong>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="text-emerald-700 font-semibold">
                                  {formatKrw(origin.weightedAvgKgPrice)}/kg
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grade & Top Items summary line */}
                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      등급 분포:{' '}
                      {selectedProvince.gradeBreakdown
                        .map((g) => `${g.grade} ${g.sharePct}%`)
                        .join(' · ')}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    시·도별 출하 순위 (클릭하여 상세 보기)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    각 지역 행을 클릭하면 해당 시·도의 시·군·구별 출하 내역으로 드릴다운합니다.
                  </p>
                </div>
              </div>

              {rankedProvinces.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-sm text-slate-500">
                  <p>검색/필터 조건에 해당하는 출하 데이터가 없습니다.</p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-2 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    필터 초기화
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-2 text-left font-medium">순위 · 시·도</th>
                          <th className="py-2 px-2 text-left font-medium">대표 산지</th>
                          <th className="py-2 px-2 text-right font-medium">출하량(kg)</th>
                          <th className="py-2 px-2 text-right font-medium">전년비</th>
                          <th className="py-2 px-2 text-right font-medium">비중</th>
                          <th className="py-2 pl-2 text-right font-medium">평균 kg단가</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rankedProvinces.slice(0, 10).map((prov, idx) => (
                          <tr
                            key={prov.provinceId}
                            onClick={() => setSelectedProvinceId(prov.provinceId)}
                            className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 pr-2 font-medium text-slate-900 whitespace-nowrap">
                              <span className="font-num text-slate-400 mr-1.5">{idx + 1}.</span>
                              {prov.provinceName}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 truncate max-w-[130px]">
                              {prov.topOrigins
                                .slice(0, 2)
                                .map((o) => o.sigungu)
                                .join(', ')}
                            </td>
                            <td className="py-2.5 px-2 text-right font-num font-semibold text-slate-900 whitespace-nowrap">
                              {prov.totalKg.toLocaleString('ko-KR')}kg
                            </td>
                            <td
                              className={`py-2.5 px-2 text-right font-num font-semibold whitespace-nowrap ${
                                prov.yoyVolumeChangePct === null
                                  ? 'text-slate-400'
                                  : prov.yoyVolumeChangePct >= 5
                                    ? 'text-amber-700'
                                    : prov.yoyVolumeChangePct <= -2.5
                                      ? 'text-emerald-700'
                                      : 'text-slate-600'
                              }`}
                            >
                              {prov.yoyVolumeChangePct === null
                                ? '-'
                                : prov.yoyVolumeChangePct > 0
                                  ? `+${prov.yoyVolumeChangePct}%`
                                  : `${prov.yoyVolumeChangePct}%`}
                            </td>
                            <td className="py-2.5 px-2 text-right font-num text-slate-600 whitespace-nowrap">
                              {prov.shareOfTotalKgPct}%
                            </td>
                            <td className="py-2.5 pl-2 text-right font-num font-semibold text-emerald-700 whitespace-nowrap">
                              {formatKrw(prov.weightedAvgKgPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Top 6 Sigungu summary footer */}
                  {agg.sigunguList.length > 0 && (
                    <div className="pt-3 mt-auto border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        전국 시·군·구 출하량 상위 산지
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {agg.sigunguList.slice(0, 6).map((sg) => (
                          <button
                            key={sg.key}
                            type="button"
                            onClick={() => setSelectedProvinceId(sg.provinceId)}
                            className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 hover:bg-emerald-50/70 rounded-lg text-left text-xs transition-colors"
                          >
                            <span className="truncate text-slate-800 font-medium">
                              {sg.provinceName} {sg.sigungu}
                              <span className="text-slate-400 font-normal ml-1">
                                ({sg.topItem})
                              </span>
                            </span>
                            <span className="font-num text-slate-700 font-semibold whitespace-nowrap">
                              {sg.totalKg.toLocaleString('ko-KR')}kg
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Auction Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {selectedProvince
                ? `${selectedProvince.fullName} 경매 상세 내역`
                : '전국 출하지별 경매 상세 내역'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-num">
              표시 {tableRecords.length}건 · 품목 · 품종 · 단위 · 등급 · 수량 · 출하지 · 경락가(단위당/kg당)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="origin-table-sort" className="sr-only">
              정렬 기준
            </label>
            <select
              id="origin-table-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TableSortKey)}
              className="h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="amount">총 경매액 높은 순</option>
              <option value="kg">출하 중량(kg) 많은 순</option>
              <option value="quantity">거래 수량 많은 순</option>
              <option value="kgPrice">kg당 단가 높은 순</option>
              <option value="unitPrice">단위당 경락가 높은 순</option>
            </select>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={tableRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 저장</span>
            </button>
          </div>
        </div>

        {tableRecords.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            선택한 조건에 해당하는 경매 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-3 text-left font-medium">출하지</th>
                  <th className="py-2.5 px-3 text-left font-medium">품목 · 품종</th>
                  <th className="py-2.5 px-3 text-left font-medium">단위</th>
                  <th className="py-2.5 px-3 text-left font-medium">등급</th>
                  <th className="py-2.5 px-3 text-right font-medium">수량</th>
                  <th className="py-2.5 px-3 text-right font-medium">총 중량</th>
                  <th className="py-2.5 px-3 text-right font-medium">단위 경락가</th>
                  <th className="py-2.5 px-3 text-right font-medium">kg당 환산가</th>
                  <th className="py-2.5 px-3 text-right font-medium">총 경매액</th>
                  <th className="py-2.5 px-3 text-left font-medium">법인 · 일자</th>
                  <th className="py-2.5 px-3 text-right font-medium">수지타산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRecords.slice(0, 120).map((rec) => {
                  const matchedCrop = matchAuctionRecordToCrop(rec, crops);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{rec.provinceName}</span>
                        <span className="text-slate-600 ml-1.5">{rec.sigungu}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{rec.item}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-600">{rec.variety}</span>
                      </td>
                      <td className="py-2.5 px-3 font-num text-slate-700 whitespace-nowrap">
                        {rec.unitRaw}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {rec.grade}
                      </td>
                      <td className="py-2.5 px-3 text-right font-num text-slate-900 whitespace-nowrap">
                        {rec.quantity.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-num text-slate-700 whitespace-nowrap">
                        {rec.totalKg.toLocaleString('ko-KR')}kg
                      </td>
                      <td className="py-2.5 px-3 text-right font-num font-medium text-slate-900 whitespace-nowrap">
                        {formatKrw(rec.pricePerUnit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-num font-semibold text-emerald-700 whitespace-nowrap">
                        {formatKrw(rec.pricePerKg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-num text-slate-700 whitespace-nowrap">
                        {formatKrwCompact(rec.totalAmountKrw)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-num">
                        {rec.corporation} · {rec.date}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {matchedCrop ? (
                          <button
                            type="button"
                            onClick={() => onInspectCropRoi(matchedCrop.id)}
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
          </div>
        )}
      </div>
    </div>
  );
}
