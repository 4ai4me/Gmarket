import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calculator, Search } from 'lucide-react';
import type {
  CropCategory,
  CropProfile,
  CropRankingRow,
  PeriodGranularity,
  UnitBasis,
} from '../types/garak';
import { buildCropRankings, getWeeklyPriceSeries } from '../utils/analytics';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';

interface PriceRankingViewProps {
  crops: CropProfile[];
  uploadedOverrides: Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>;
  applyUploadedOverrides: boolean;
  onToggleApplyOverrides: (val: boolean) => void;
  onInspectCropRoi: (cropId: string) => void;
}

const CHART_COLORS = ['#15803d', '#0f766e', '#b45309', '#4338ca'];

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

export function PriceRankingView({
  crops,
  uploadedOverrides,
  applyUploadedOverrides,
  onToggleApplyOverrides,
  onInspectCropRoi,
}: PriceRankingViewProps) {
  const [granularity, setGranularity] = useState<PeriodGranularity>('year');
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedWeek, setSelectedWeek] = useState<number>(46);
  const [unitBasis, setUnitBasis] = useState<UnitBasis>('kg');
  const [category, setCategory] = useState<'전체' | CropCategory>('전체');
  const [sourceScope, setSourceScope] = useState<'all' | 'curated' | 'live'>('all');
  const [search, setSearch] = useState('');
  const [comparedCropIds, setComparedCropIds] = useState<string[]>([
    'strawberry',
    'perilla',
    'chive',
    'sweet_potato',
  ]);

  const rankings = useMemo(() => {
    const all = buildCropRankings({
      crops,
      granularity,
      selectedMonth,
      selectedWeek,
      unitBasis,
      uploadedOverrides,
      applyUploadedOverrides,
    });
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (category !== '전체' && r.crop.category !== category) return false;
      if (sourceScope === 'curated' && r.crop.dataSourceTier !== 'curated') return false;
      if (sourceScope === 'live' && !r.crop.inLiveGarakCatalog) return false;
      if (q) {
        const hit =
          r.crop.name.toLowerCase().includes(q) ||
          r.crop.standardUnitLabel.toLowerCase().includes(q) ||
          r.crop.representativeVariety.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    crops,
    granularity,
    selectedMonth,
    selectedWeek,
    unitBasis,
    uploadedOverrides,
    applyUploadedOverrides,
    category,
    sourceScope,
    search,
  ]);

  const comparedCrops = useMemo(
    () =>
      comparedCropIds
        .map((id) => crops.find((c) => c.id === id))
        .filter((c): c is CropProfile => Boolean(c)),
    [comparedCropIds, crops]
  );

  const chartData = useMemo(() => {
    if (granularity === 'week') {
      const seriesMap = new Map(
        comparedCrops.map((c) => [c.id, getWeeklyPriceSeries(c)])
      );
      return Array.from({ length: 52 }, (_, idx) => {
        const week = idx + 1;
        const point: Record<string, string | number | null> = {
          label: `${week}주`,
        };
        for (const c of comparedCrops) {
          const item = seriesMap.get(c.id)?.[idx];
          const val =
            unitBasis === 'native'
              ? item?.pricePerNativeUnit ?? 0
              : item?.pricePerKg ?? 0;
          point[c.id] = val > 0 ? val : null;
        }
        return point;
      });
    }

    return Array.from({ length: 12 }, (_, mIdx) => {
      const point: Record<string, string | number | null> = {
        label: `${mIdx + 1}월`,
      };
      for (const c of comparedCrops) {
        const kgPrice = c.monthlyPricePerKg[mIdx];
        point[c.id] =
          kgPrice > 0
            ? unitBasis === 'native'
              ? Math.round(kgPrice * c.standardUnitKg)
              : kgPrice
            : null;
      }
      return point;
    });
  }, [comparedCrops, granularity, unitBasis]);

  const toggleCompareCrop = (cropId: string) => {
    setComparedCropIds((prev) => {
      if (prev.includes(cropId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== cropId);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), cropId];
      }
      return [...prev, cropId];
    });
  };

  const getPrimaryMetricHeader = () => {
    if (unitBasis === 'kg') return 'kg당 단가';
    if (unitBasis === 'native') return '고유 거래단위 단가';
    return '10a 연 예상매출';
  };

  const renderPrimaryMetric = (row: CropRankingRow) => {
    if (row.pricePerKg === 0 && unitBasis !== 'revenue_10a') {
      return <span className="text-slate-400">비출하기</span>;
    }
    if (unitBasis === 'kg') return formatKrw(row.pricePerKg);
    if (unitBasis === 'native') return formatKrw(row.pricePerNativeUnit);
    return formatKrwCompact(row.estimatedAnnualRevenuePer10a);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            년 · 월 · 주 기준 고단가 품목 순위 및 단위 비교
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            kg당 환산 단가와 상자·단·속·망 등 작물별 고유 거래단위 단가, 그리고 10a당 연간 매출 기준으로 순위를 교차 비교합니다.
          </p>
        </div>

        {uploadedOverrides.size > 0 && (
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyUploadedOverrides}
              onChange={(e) => onToggleApplyOverrides(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>
              업로드 엑셀 실측가 반영 ({uploadedOverrides.size}개 품목)
            </span>
          </label>
        )}
      </div>

      {/* Control Strip: Granularity + Sub-period + Unit Basis */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Period Granularity */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">기간 기준</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { key: 'year', label: '연간 (1년)' },
                  { key: 'month', label: '월간 (월별)' },
                  { key: 'week', label: '주간 (52주)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setGranularity(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    granularity === opt.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {granularity === 'month' && (
              <div className="flex items-center gap-2">
                <label htmlFor="ranking-month-select" className="sr-only">
                  기준 월 선택
                </label>
                <select
                  id="ranking-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-8 px-2.5 text-xs font-num bg-white border border-slate-300 rounded-md text-slate-900"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월 기준
                    </option>
                  ))}
                </select>
              </div>
            )}

            {granularity === 'week' && (
              <div className="flex items-center gap-2">
                <label htmlFor="ranking-week-select" className="sr-only">
                  기준 주차 선택
                </label>
                <select
                  id="ranking-week-select"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="h-8 px-2.5 text-xs font-num bg-white border border-slate-300 rounded-md text-slate-900"
                >
                  {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      {w}주차 ({Math.min(12, Math.floor(((w - 1) / 52) * 12) + 1)}월)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Unit Basis Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">정렬 단위</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { key: 'kg', label: 'kg당 단가 (원/kg)' },
                  { key: 'native', label: '고유 거래단위 (상자·단·속·망)' },
                  { key: 'revenue_10a', label: '10a당 연매출' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setUnitBasis(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    unitBasis === opt.key
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  category === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md text-xs">
              {(
                [
                  { key: 'all', label: '전체' },
                  { key: 'curated', label: '정밀 기준' },
                  { key: 'live', label: '가락 실시간' },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSourceScope(s.key)}
                  className={`px-2 py-1 rounded font-medium whitespace-nowrap ${
                    sourceScope === s.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="ranking-search" className="sr-only">
                작물 검색
              </label>
              <input
                id="ranking-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="품목 · 단위 검색"
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Seasonal Trend Chart */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {granularity === 'week' ? '52주간' : '12개월'} 시세 추이 비교 (
              {unitBasis === 'native' ? '작물 고유 거래단위 기준' : 'kg당 단가 기준'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              아래 표에서 비교할 작물을 최대 4개까지 선택해 계절별 고단가 구간을 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {comparedCrops.map((c, idx) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-0.5 inline-block"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  aria-hidden="true"
                />
                <span>
                  {c.name}
                  {unitBasis === 'native' ? ` (${c.standardUnitLabel})` : ''}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={granularity === 'week' ? 3 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `${Number(v).toLocaleString('ko-KR')}`}
                width={68}
              />
              <Tooltip
                formatter={(value, name) => [
                  value === null || value === undefined
                    ? '비출하기'
                    : `${Number(value).toLocaleString('ko-KR')}원`,
                  String(name),
                ]}
                contentStyle={{
                  fontSize: '12px',
                  borderRadius: '8px',
                  borderColor: '#cbd5e1',
                }}
              />
              {comparedCrops.map((c, idx) => (
                <Line
                  key={c.id}
                  type="monotone"
                  dataKey={c.id}
                  name={c.name}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={granularity !== 'week'}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* High-Density Ranking Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            총 <strong className="font-num text-slate-900">{rankings.length}</strong>개 분석 작물 · 정렬:{' '}
            <strong className="text-slate-800">{getPrimaryMetricHeader()} 높은 순</strong>
          </span>
          <span>차트 체크박스로 최대 4개 작물 비교</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <th className="py-2.5 px-3 text-center font-medium w-12">비교</th>
                <th className="py-2.5 px-3 text-left font-medium w-12">순위</th>
                <th className="py-2.5 px-3 text-left font-medium">품목 · 대표품종</th>
                <th className="py-2.5 px-3 text-left font-medium">고유 거래단위</th>
                <th className="py-2.5 px-3 text-right font-medium">kg당 단가</th>
                <th className="py-2.5 px-3 text-right font-medium">고유단위 가격</th>
                <th className="py-2.5 px-3 text-right font-medium">연간 등락배수</th>
                <th className="py-2.5 px-3 text-left font-medium">고단가 성수기</th>
                <th className="py-2.5 px-3 text-right font-medium">10a 연매출</th>
                <th className="py-2.5 px-4 text-right font-medium">수지타산</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankings.map((row, idx) => {
                const isChecked = comparedCropIds.includes(row.crop.id);
                return (
                  <tr key={row.crop.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompareCrop(row.crop.id)}
                        aria-label={`${row.crop.name} 차트 비교 선택`}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-num text-xs text-slate-500 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {row.crop.name}
                        {row.hasUploadedOverride && (
                          <span className="ml-1.5 text-xs font-normal text-emerald-700">
                            · 실측
                          </span>
                        )}
                        {!row.hasUploadedOverride && row.crop.dataSourceTier === 'archetype_inferred' && (
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                            · 교차모델
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.crop.category} · {row.crop.representativeVariety}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                      <div>{row.crop.standardUnitLabel}</div>
                      <div className="text-slate-400 font-num">
                        환산 {row.crop.standardUnitKg}kg
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-num whitespace-nowrap ${
                        unitBasis === 'kg'
                          ? 'font-bold text-slate-900'
                          : 'text-slate-700'
                      }`}
                    >
                      {row.pricePerKg > 0 ? formatKrw(row.pricePerKg) : '비출하기'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-num whitespace-nowrap ${
                        unitBasis === 'native'
                          ? 'font-bold text-emerald-800'
                          : 'text-slate-700'
                      }`}
                    >
                      {row.pricePerNativeUnit > 0
                        ? formatKrw(row.pricePerNativeUnit)
                        : '비출하기'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {row.priceSpreadRatio.toFixed(2)}배
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap font-num">
                      {row.crop.peakPriceMonths.map((m) => `${m}월`).join(', ')}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-num whitespace-nowrap ${
                        unitBasis === 'revenue_10a'
                          ? 'font-bold text-emerald-800'
                          : 'text-slate-700'
                      }`}
                    >
                      {formatKrwCompact(row.estimatedAnnualRevenuePer10a)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectCropRoi(row.crop.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>분석</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Highlight mobile primary metric summary helper */}
        <div className="sr-only">
          {rankings[0] ? `1위: ${rankings[0].crop.name} ${renderPrimaryMetric(rankings[0])}` : ''}
        </div>
      </section>
    </div>
  );
}
