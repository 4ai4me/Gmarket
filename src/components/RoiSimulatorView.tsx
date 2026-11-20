import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RotateCcw } from 'lucide-react';
import type { CropProfile, CultivationMethodKey } from '../types/garak';
import {
  calculateAnnualRoi,
  getAnnualAvgPricePerKg,
  PYEONG_PER_10A,
} from '../utils/analytics';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';

interface RoiSimulatorViewProps {
  crops: CropProfile[];
  selectedCropId: string;
  onSelectCropId: (id: string) => void;
  uploadedOverrides: Map<string, { weightedAvgKgPrice: number; recordCount: number; totalKg: number }>;
  applyUploadedOverrides: boolean;
}

export function RoiSimulatorView({
  crops,
  selectedCropId,
  onSelectCropId,
  uploadedOverrides,
  applyUploadedOverrides,
}: RoiSimulatorViewProps) {
  const crop = useMemo(
    () => crops.find((c) => c.id === selectedCropId) || crops[0],
    [crops, selectedCropId]
  );

  const [methodKey, setMethodKey] = useState<CultivationMethodKey>(crop.methods[0].key);
  const [areaPyeong, setAreaPyeong] = useState<number>(300);
  const [pricePerKg, setPricePerKg] = useState<number>(() => getAnnualAvgPricePerKg(crop));
  const [cyclesPerYear, setCyclesPerYear] = useState<number>(crop.methods[0].cyclesPerYear);
  const [marketableRatePct, setMarketableRatePct] = useState<number>(88);
  const [commissionRatePct, setCommissionRatePct] = useState<number>(
    crop.methods[0].commissionRatePct
  );
  const [laborCostMultiplier, setLaborCostMultiplier] = useState<number>(1.0);
  const [includeDepreciation, setIncludeDepreciation] = useState<boolean>(true);
  const [priceInputMode, setPriceInputMode] = useState<'kg' | 'native'>('kg');

  // Sync defaults cleanly when user selects a different crop
  useEffect(() => {
    const firstMethod = crop.methods[0];
    setMethodKey(firstMethod.key);
    setCyclesPerYear(firstMethod.cyclesPerYear);
    setCommissionRatePct(firstMethod.commissionRatePct);

    const override = uploadedOverrides.get(crop.id);
    if (applyUploadedOverrides && override && override.weightedAvgKgPrice > 0) {
      setPricePerKg(override.weightedAvgKgPrice);
    } else {
      setPricePerKg(getAnnualAvgPricePerKg(crop));
    }
  }, [crop, uploadedOverrides, applyUploadedOverrides]);

  const activeMethod = useMemo(
    () => crop.methods.find((m) => m.key === methodKey) || crop.methods[0],
    [crop, methodKey]
  );

  const handleMethodChange = (nextKey: CultivationMethodKey) => {
    setMethodKey(nextKey);
    const next = crop.methods.find((m) => m.key === nextKey);
    if (next) {
      setCyclesPerYear(next.cyclesPerYear);
      setCommissionRatePct(next.commissionRatePct);
    }
  };

  const handleResetParams = () => {
    const firstMethod = crop.methods[0];
    setMethodKey(firstMethod.key);
    setAreaPyeong(300);
    setPricePerKg(getAnnualAvgPricePerKg(crop));
    setCyclesPerYear(firstMethod.cyclesPerYear);
    setMarketableRatePct(88);
    setCommissionRatePct(firstMethod.commissionRatePct);
    setLaborCostMultiplier(1.0);
    setIncludeDepreciation(true);
  };

  const result = useMemo(
    () =>
      calculateAnnualRoi({
        crop,
        methodKey: activeMethod.key,
        areaPyeong,
        pricePerKg,
        cyclesPerYear,
        marketableRatePct,
        commissionRatePct,
        laborCostMultiplier,
        includeDepreciation,
      }),
    [
      crop,
      activeMethod.key,
      areaPyeong,
      pricePerKg,
      cyclesPerYear,
      marketableRatePct,
      commissionRatePct,
      laborCostMultiplier,
      includeDepreciation,
    ]
  );

  // All crops comparison table at the user's current areaPyeong
  const allCropBenchmark = useMemo(() => {
    return crops
      .map((c) => {
        const m = c.methods[0];
        const override = uploadedOverrides.get(c.id);
        const p =
          applyUploadedOverrides && override
            ? override.weightedAvgKgPrice
            : getAnnualAvgPricePerKg(c);
        const sim = calculateAnnualRoi({
          crop: c,
          methodKey: m.key,
          areaPyeong,
          pricePerKg: p,
          cyclesPerYear: m.cyclesPerYear,
          marketableRatePct,
          commissionRatePct: m.commissionRatePct,
          laborCostMultiplier,
          includeDepreciation,
        });
        return { crop: c, method: m, sim };
      })
      .sort((a, b) => b.sim.netProfit - a.sim.netProfit);
  }, [
    crops,
    areaPyeong,
    marketableRatePct,
    laborCostMultiplier,
    includeDepreciation,
    uploadedOverrides,
    applyUploadedOverrides,
  ]);

  const displayedPriceValue =
    priceInputMode === 'native'
      ? Math.round(pricePerKg * crop.standardUnitKg)
      : pricePerKg;

  const handlePriceInputChange = (rawVal: number) => {
    if (!Number.isFinite(rawVal) || rawVal < 0) return;
    if (priceInputMode === 'native') {
      setPricePerKg(Math.round(rawVal / Math.max(0.01, crop.standardUnitKg)));
    } else {
      setPricePerKg(Math.round(rawVal));
    }
  };

  const isProfitable = result.netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Header + Crop Selector */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">
            작물별 재배방법 · 재배주기 · 1년 수지타산(ROI) 시뮬레이터
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            재배방식, 면적, 연간 회전수, 판매단가(kg 또는 고유 거래단위)를 조정해 1년 기준 실제 수지타산과 손익분기점을 검증합니다.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <label htmlFor="roi-crop-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            분석 작물
          </label>
          <select
            id="roi-crop-select"
            value={crop.id}
            onChange={(e) => onSelectCropId(e.target.value)}
            className="h-9 px-3 text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 max-w-full"
          >
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.category} · {c.standardUnitLabel})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleResetParams}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>
        </div>
      </div>

      {/* Cultivation Profile & 12-Month Crop Calendar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{crop.category}</span>
              <span aria-hidden="true">·</span>
              <span>대표 품종: {crop.representativeVariety}</span>
              <span aria-hidden="true">·</span>
              <span>고유 거래단위: {crop.standardUnitLabel}</span>
              <span aria-hidden="true">·</span>
              <span>재배 난이도: {crop.difficulty}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">{crop.name} 재배 특성 및 작기표</h3>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              {crop.soilAndClimateNote} <span className="text-amber-700 font-medium">주의:</span>{' '}
              {crop.keyRiskNote}
            </p>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 shrink-0 space-y-1">
            <div className="font-medium text-slate-800">표준 거래단위 안내</div>
            <div className="text-slate-600 max-w-xs">{crop.nativeUnitDescription}</div>
          </div>
        </div>

        {/* 12-Month Calendar Grid */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800">12개월 재배주기 · 가락시장 고단가 성수기</span>
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <span>파종/정식</span>
              <span className="text-emerald-700 font-medium">수확/출하</span>
              <span className="text-amber-700 font-medium">고단가 성수기</span>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
            {Array.from({ length: 12 }, (_, idx) => {
              const month = idx + 1;
              const isSow = crop.sowingMonths.includes(month);
              const isHarvest = crop.harvestMonths.includes(month);
              const isPeak = crop.peakPriceMonths.includes(month);
              const mPrice = crop.monthlyPricePerKg[idx];
              return (
                <div
                  key={month}
                  className={`border rounded-md p-2 text-center ${
                    isPeak
                      ? 'border-amber-300 bg-amber-50/70'
                      : isHarvest
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-800 font-num whitespace-nowrap">
                    {month}월
                  </div>
                  <div className="text-[11px] font-num text-slate-600 mt-0.5 whitespace-nowrap">
                    {mPrice > 0 ? `${(mPrice / 1000).toFixed(1)}천` : '-'}
                  </div>
                  <div className="mt-1.5 text-[10px] leading-tight space-y-0.5">
                    {isSow && <div className="text-slate-700 whitespace-nowrap">파종</div>}
                    {isHarvest && (
                      <div className="text-emerald-700 font-semibold whitespace-nowrap">수확</div>
                    )}
                    {isPeak && (
                      <div className="text-amber-700 font-semibold whitespace-nowrap">성수기</div>
                    )}
                    {!isSow && !isHarvest && !isPeak && (
                      <div className="text-slate-300 whitespace-nowrap">휴작</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive Simulator Split: Left Inputs / Right Financial Results */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Controls (5 cols) */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">재배 조건 · 경영 변수 설정</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              농가 환경에 맞게 값을 수정하면 오른쪽 1년 손익계산이 실시간 갱신됩니다.
            </p>
          </div>

          {/* Cultivation Method Selector */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700">재배 방식 선택</span>
            <div className="space-y-2">
              {crop.methods.map((m) => {
                const selected = m.key === activeMethod.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleMethodChange(m.key)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected
                        ? 'border-emerald-700 bg-emerald-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{m.label}</span>
                      <span className="text-xs font-num text-slate-600">
                        재배기간 {m.cycleDays}일 · 10a당 {m.yieldKgPer10a.toLocaleString('ko-KR')}kg
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{m.notes}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Area Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="sim-area-pyeong" className="font-medium text-slate-700">
                재배 면적 (평)
              </label>
              <span className="font-num text-slate-500">
                {areaPyeong.toLocaleString('ko-KR')}평 ({(areaPyeong / PYEONG_PER_10A).toFixed(2)} × 10a)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="sim-area-pyeong"
                type="number"
                min={30}
                max={50000}
                step={50}
                value={areaPyeong}
                onChange={(e) => setAreaPyeong(Math.max(1, Number(e.target.value) || 0))}
                className="w-32 h-9 px-3 text-sm font-num border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="flex flex-wrap gap-1.5">
                {[300, 600, 1000, 3000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAreaPyeong(preset)}
                    className={`px-2.5 py-1.5 text-xs font-num rounded-md border ${
                      areaPyeong === preset
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}평
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selling Price Input (kg OR crop native unit) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="sim-price" className="font-medium text-slate-700">
                목표 평균 경락가
              </label>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setPriceInputMode('kg')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    priceInputMode === 'kg' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  원 / kg
                </button>
                <button
                  type="button"
                  onClick={() => setPriceInputMode('native')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    priceInputMode === 'native'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  원 / {crop.standardUnitLabel}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="sim-price"
                type="number"
                min={100}
                step={priceInputMode === 'native' ? 1000 : 100}
                value={displayedPriceValue}
                onChange={(e) => handlePriceInputChange(Number(e.target.value))}
                className="w-40 h-9 px-3 text-sm font-num border border-slate-300 rounded-lg text-slate-900"
              />
              <span className="text-xs text-slate-500 font-num">
                {priceInputMode === 'kg'
                  ? `고유단위 환산: ${formatKrw(result.effectivePricePerNativeUnit)} / ${crop.standardUnitLabel}`
                  : `kg 환산: ${formatKrw(result.effectivePricePerKg)} / kg`}
              </span>
            </div>
          </div>

          {/* Cycles, Marketable Rate, Commission, Labor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="sim-cycles" className="block text-xs font-medium text-slate-700">
                연간 재배 회전수 (기작)
              </label>
              <input
                id="sim-cycles"
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={cyclesPerYear}
                onChange={(e) => setCyclesPerYear(Math.max(0.5, Number(e.target.value) || 1))}
                className="w-full h-9 px-3 text-sm font-num border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="sim-marketable" className="block text-xs font-medium text-slate-700">
                상품화율 (출하 가능 %)
              </label>
              <input
                id="sim-marketable"
                type="number"
                min={40}
                max={100}
                step={1}
                value={marketableRatePct}
                onChange={(e) =>
                  setMarketableRatePct(Math.min(100, Math.max(10, Number(e.target.value) || 85)))
                }
                className="w-full h-9 px-3 text-sm font-num border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="sim-commission" className="block text-xs font-medium text-slate-700">
                도매시장 상장수수료 (%)
              </label>
              <input
                id="sim-commission"
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={commissionRatePct}
                onChange={(e) =>
                  setCommissionRatePct(Math.min(15, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-full h-9 px-3 text-sm font-num border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="sim-labor" className="block text-xs font-medium text-slate-700">
                인건비 계수 (자가노동 조정)
              </label>
              <select
                id="sim-labor"
                value={laborCostMultiplier}
                onChange={(e) => setLaborCostMultiplier(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value={0.5}>0.5배 (가족노동 중심)</option>
                <option value={0.8}>0.8배 (부분 고용)</option>
                <option value={1}>1.0배 (표준 경영비)</option>
                <option value={1.3}>1.3배 (전면 고용/인건비 상승)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={includeDepreciation}
              onChange={(e) => setIncludeDepreciation(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>
              초기 시설투자비 감가상각 반영 (총 {formatKrwCompact(result.totalCapex)} /{' '}
              {activeMethod.depreciationYears}년 분할)
            </span>
          </label>
        </section>

        {/* Right: 1-Year Financial Summary & Cashflow (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          {/* Top 4 ROI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">1년 예상 총매출</div>
              <div className="mt-1.5 text-lg font-bold font-num text-slate-900 whitespace-nowrap">
                {formatKrwCompact(result.grossRevenue)}
              </div>
              <div className="mt-1.5 text-[11px] font-num text-slate-500 space-y-0.5">
                <div className="whitespace-nowrap">출하 {result.marketableYieldKg.toLocaleString('ko-KR')}kg</div>
                <div className="whitespace-nowrap">{result.marketableNativeUnits.toLocaleString('ko-KR')}단위</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">1년 총 투입비용</div>
              <div className="mt-1.5 text-lg font-bold font-num text-slate-900 whitespace-nowrap">
                {formatKrwCompact(result.totalCostWithCapex)}
              </div>
              <div className="mt-1.5 text-[11px] font-num text-slate-500 space-y-0.5">
                <div className="whitespace-nowrap">직접비 {formatKrwCompact(result.totalOperatingCost)}</div>
                <div className="whitespace-nowrap">감가상각 {formatKrwCompact(result.annualDepreciation)}</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">1년 예상 순수익</div>
              <div
                className={`mt-1.5 text-lg font-bold font-num whitespace-nowrap ${
                  isProfitable ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isProfitable ? '+' : ''}
                {formatKrwCompact(result.netProfit)}
              </div>
              <div className="mt-1.5 text-[11px] font-num text-slate-500 space-y-0.5">
                <div className="whitespace-nowrap">평당 {formatKrw(result.netProfitPerPyeong)}</div>
                <div className="whitespace-nowrap">순이익률 {result.profitMarginPct}%</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">손익분기 단가</div>
              <div className="mt-1.5 text-lg font-bold font-num text-slate-900 whitespace-nowrap">
                {formatKrw(result.breakEvenPricePerKg)}
                <span className="text-xs font-normal text-slate-500">/kg</span>
              </div>
              <div className="mt-1.5 text-[11px] font-num text-slate-500 space-y-0.5">
                <div className="whitespace-nowrap">단위당 {formatKrw(result.breakEvenPricePerNativeUnit)}</div>
                <div className="whitespace-nowrap">
                  투자회수 {result.paybackYears !== null ? `${result.paybackYears}년` : '적자'}
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                1년 손익 상세 내역 ({areaPyeong.toLocaleString('ko-KR')}평 · {cyclesPerYear}기작 기준)
              </h3>
              <span
                className={`text-xs font-semibold ${
                  isProfitable ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isProfitable
                  ? `흑자 (경영비 대비 ROI ${result.roiOnOperatingCostPct}%)`
                  : '적자 (단가·회전수 또는 비용 개선 필요)'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-5 font-medium text-slate-800">총 출하 매출 (조수입)</td>
                    <td className="py-2.5 px-4 text-slate-500 font-num">
                      {result.marketableYieldKg.toLocaleString('ko-KR')}kg × {formatKrw(result.effectivePricePerKg)}
                    </td>
                    <td className="py-2.5 px-5 text-right font-num font-semibold text-slate-900">
                      {formatKrw(result.grossRevenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">도매시장 상장수수료 ({commissionRatePct}%)</td>
                    <td className="py-2.5 px-4 text-slate-500">가락시장 법인 위탁수수료</td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.commissionCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">포장재 · 선별 · 운송비</td>
                    <td className="py-2.5 px-4 text-slate-500 font-num">
                      {formatKrw(activeMethod.packagingShippingPerKg)}/kg 기준
                    </td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.packagingShippingCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">종자 · 모종 · 배지비</td>
                    <td className="py-2.5 px-4 text-slate-500 font-num">{cyclesPerYear}기작 투입</td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.seedCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">비료 · 농약 · 자재 · 광열(난방)비</td>
                    <td className="py-2.5 px-4 text-slate-500 font-num">{activeMethod.label}</td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.materialCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">인건비 (계수 {laborCostMultiplier}x)</td>
                    <td className="py-2.5 px-4 text-slate-500">파종 · 관리 · 수확 · 선별</td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.laborCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-5 text-slate-600">시설 감가상각비 (연간)</td>
                    <td className="py-2.5 px-4 text-slate-500 font-num">
                      {includeDepreciation
                        ? `총 CAPEX ${formatKrwCompact(result.totalCapex)} ÷ ${activeMethod.depreciationYears}년`
                        : '미반영 (현금흐름 기준)'}
                    </td>
                    <td className="py-2.5 px-5 text-right font-num text-slate-700">
                      -{formatKrw(result.annualDepreciation)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-3 px-5 font-bold text-slate-900">1년 최종 순수익</td>
                    <td className="py-3 px-4 text-slate-600 font-num">
                      손익분기: {formatKrw(result.breakEvenPricePerKg)}/kg ({formatKrw(result.breakEvenPricePerNativeUnit)}/{crop.standardUnitLabel})
                    </td>
                    <td
                      className={`py-3 px-5 text-right font-num font-bold text-sm ${
                        isProfitable ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatKrw(result.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 12-Month Cashflow Chart */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                12개월 투입비용 대비 출하매출 현금흐름
              </h3>
              <span className="text-xs text-slate-500">단위: 원</span>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.monthlyCashflow}
                  margin={{ top: 8, right: 8, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`}
                    width={54}
                  />
                  <Tooltip
                    formatter={(value) => `${Number(value).toLocaleString('ko-KR')}원`}
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      borderColor: '#cbd5e1',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="revenue" name="월 출하매출" fill="#15803d" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cost" name="월 투입비용" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      {/* All-Crop 1-Year Profitability Comparison Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              동일 면적 ({areaPyeong.toLocaleString('ko-KR')}평) 전 작물 1년 수지타산 비교
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 작물의 대표 재배방식 기준. 행을 클릭하면 상단 시뮬레이터에 즉시 불러옵니다.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-num">
            상품화율 {marketableRatePct}% · 인건비 {laborCostMultiplier}x · 감가상각{' '}
            {includeDepreciation ? '포함' : '제외'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium">순위 · 품목</th>
                <th className="py-2.5 px-3 text-left font-medium">대표 재배방식</th>
                <th className="py-2.5 px-3 text-right font-medium">연 회전</th>
                <th className="py-2.5 px-3 text-right font-medium">초기 시설비</th>
                <th className="py-2.5 px-3 text-right font-medium">1년 매출</th>
                <th className="py-2.5 px-3 text-right font-medium">1년 순수익</th>
                <th className="py-2.5 px-3 text-right font-medium">손익분기/kg</th>
                <th className="py-2.5 px-4 text-right font-medium">회수기간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allCropBenchmark.map((row, idx) => {
                const isSelected = row.crop.id === crop.id;
                return (
                  <tr
                    key={row.crop.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectCropId(row.crop.id)}
                        className="text-left font-medium text-slate-900 hover:text-emerald-700"
                      >
                        <span className="font-num text-slate-400 mr-2">{idx + 1}.</span>
                        {row.crop.name}
                      </button>
                      <span className="ml-2 text-xs text-slate-400">{row.crop.difficulty}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 truncate max-w-[200px]">
                      {row.method.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {row.method.cyclesPerYear}기작
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {formatKrwCompact(row.sim.totalCapex)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-slate-700 whitespace-nowrap">
                      {formatKrwCompact(row.sim.grossRevenue)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-num font-semibold whitespace-nowrap ${
                        row.sim.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatKrwCompact(row.sim.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {formatKrw(row.sim.breakEvenPricePerKg)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                      {row.sim.paybackYears !== null ? `${row.sim.paybackYears}년` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
