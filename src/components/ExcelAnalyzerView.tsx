import { useMemo, useRef, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AuctionRecord, CropProfile, ExcelParseResult } from '../types/garak';
import { aggregateAuctionRecords, matchAuctionRecordToCrop } from '../utils/analytics';
import {
  exportAuctionRecordsToCsv,
  parseGarakExcelBuffer,
} from '../utils/excelParser';
import { buildUploadedMultiPeriodComparison } from '../utils/supplyRisk';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';
import { SAMPLE_GARAK_AUCTION_RECORDS } from '../data/crops';
import { MULTI_PERIOD_SAMPLE_AUCTION_RECORDS } from '../data/garakMultiYearTrends';

interface ExcelAnalyzerViewProps {
  records: AuctionRecord[];
  crops: CropProfile[];
  applyUploadedOverrides: boolean;
  onReplaceRecords: (records: AuctionRecord[], metaLabel: string) => void;
  onAppendRecords: (records: AuctionRecord[], metaLabel: string) => void;
  onClearRecords: () => void;
  onToggleApplyOverrides: (val: boolean) => void;
  onInspectCropRoi: (cropId: string) => void;
  metaLabel: string;
}

export function ExcelAnalyzerView({
  records,
  crops,
  applyUploadedOverrides,
  onReplaceRecords,
  onAppendRecords,
  onClearRecords,
  onToggleApplyOverrides,
  onInspectCropRoi,
  metaLabel,
}: ExcelAnalyzerViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('append');
  const [parseFeedback, setParseFeedback] = useState<{
    warnings: string[];
    errors: string[];
    detectedFormat: ExcelParseResult['detectedFormat'];
    detectedDate: string | null;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const groupedSummary = useMemo(
    () => aggregateAuctionRecords(records),
    [records]
  );

  const multiPeriodAnalysis = useMemo(
    () => buildUploadedMultiPeriodComparison(records),
    [records]
  );

  const totalStats = useMemo(() => {
    let totalQty = 0;
    let totalKg = 0;
    let totalAmount = 0;
    for (const r of records) {
      totalQty += r.quantity;
      totalKg += r.kgPerUnit * r.quantity;
      totalAmount += r.pricePerUnit * r.quantity;
    }
    return {
      totalQty,
      totalKg: Math.round(totalKg * 10) / 10,
      totalAmount,
      avgKgPrice: totalKg > 0 ? Math.round(totalAmount / totalKg) : 0,
    };
  }, [records]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const mergedRecords: AuctionRecord[] = [];
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    let lastFormat: ExcelParseResult['detectedFormat'] = 'unknown';
    let lastDate: string | null = null;

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['xls', 'xlsx', 'csv'].includes(ext)) {
        allErrors.push(`${file.name}: 지원하지 않는 파일 형식입니다. (.xls, .xlsx, .csv만 가능)`);
        continue;
      }

      const buffer = await file.arrayBuffer();
      const parsed = parseGarakExcelBuffer(buffer, file.name);
      if (parsed.detectedFormat !== 'unknown') lastFormat = parsed.detectedFormat;
      if (parsed.detectedDate) lastDate = parsed.detectedDate;
      allWarnings.push(...parsed.warnings.map((w) => `[${file.name}] ${w}`));
      allErrors.push(...parsed.errors.map((e) => `[${file.name}] ${e}`));
      mergedRecords.push(...parsed.records);
    }

    setParseFeedback({
      warnings: allWarnings,
      errors: allErrors,
      detectedFormat: lastFormat,
      detectedDate: lastDate,
    });

    // Only overwrite/append if validation produced at least 1 valid record (Data Protection Rule)
    if (mergedRecords.length > 0) {
      const label =
        fileList.length === 1
          ? fileList[0].name
          : `${fileList[0].name} 외 ${fileList.length - 1}개 파일`;
      if (uploadMode === 'append' && records.length > 0) {
        onAppendRecords(mergedRecords, label);
      } else {
        onReplaceRecords(mergedRecords, label);
      }
    }
  };

  const handleLoadSample = () => {
    setParseFeedback({
      warnings: [
        '가락시장 경매결과(2026.11.20 동화청과 쪽파 BOX 10kg·15kg 등 10건) 샘플 데이터를 불러왔습니다.',
      ],
      errors: [],
      detectedFormat: 'auction_result',
      detectedDate: '2026-11-20',
    });
    onReplaceRecords(
      SAMPLE_GARAK_AUCTION_RECORDS,
      '가락시장 샘플 (2026.11.20 쪽파·고구마·감자)'
    );
  };

  const handleLoadMultiPeriodSample = () => {
    setParseFeedback({
      warnings: [
        '2024~2026년 다년도 비교 샘플(파·고수·마늘·고구마 16건)을 불러왔습니다. 하단 기간 비교표 및 수급 추세/지도 탭에서 연도별 물량·단가·산지 변화를 확인하세요.',
      ],
      errors: [],
      detectedFormat: 'auction_result',
      detectedDate: '2026-11-20',
    });
    onReplaceRecords(
      MULTI_PERIOD_SAMPLE_AUCTION_RECORDS,
      '다기간 비교 샘플 (2024~2026년 3개년 누적)'
    );
  };

  const handleExportCsv = () => {
    if (records.length === 0) return;
    const csv = exportAuctionRecordsToCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `garak_normalized_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            가락시장 경매결과 엑셀(.xls / .xlsx / .csv) 직접 분석
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            가락시장 OZViewer의 <strong className="text-slate-800">Save XLS</strong>로 내려받은{' '}
            <span className="font-medium text-slate-800">경매 결과(법인·품목·품종·단위·등급·수량·경락·출하지)</span> 및{' '}
            <span className="font-medium text-slate-800">품목별 가격</span> 파일을 자동 인식하여 kg당 · 고유단위당 가중평균 단가를 계산합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadMultiPeriodSample}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>다기간(2024·2025·2026) 비교 샘플</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>단일일 샘플 불러오기</span>
          </button>

          {records.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>정규화 CSV 저장</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearRecords();
                  setParseFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>초기화</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`bg-white border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragging ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xls,.xlsx,.csv"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          aria-label="가락시장 엑셀 파일 업로드"
        />
        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="mt-3 text-sm font-semibold text-slate-900">
          가락시장에서 저장한 .xls / .xlsx / .csv 파일을 끌어다 놓거나 선택하세요
        </p>
        <p className="mt-1 text-xs text-slate-500">
          여러 연도·월 파일을 누적 병합해 기간별 반입 물량과 단가·산지 변화를 자동 비교하며, 브라우저에 자동 저장됩니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setUploadMode('append')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                uploadMode === 'append'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              기존 데이터에 누적 병합
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('replace')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                uploadMode === 'replace'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              새 파일로 교체
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
          >
            파일 선택하기
          </button>
        </div>
      </div>

      {/* Parse Errors & Warnings */}
      {parseFeedback && parseFeedback.errors.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 space-y-1"
        >
          <div className="font-semibold">파일 검증 오류 (기존 데이터는 유지됩니다)</div>
          {parseFeedback.errors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      {parseFeedback && parseFeedback.warnings.length > 0 && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-700 space-y-1">
          {parseFeedback.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Active Dataset Summary */}
      {records.length > 0 ? (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">{metaLabel || '업로드 데이터'}</div>
                <div className="text-slate-500 font-num mt-0.5">
                  총 {records.length.toLocaleString('ko-KR')}건 · 수량{' '}
                  {totalStats.totalQty.toLocaleString('ko-KR')}단위 · 총중량{' '}
                  {totalStats.totalKg.toLocaleString('ko-KR')}kg · 전체 가중평균{' '}
                  <strong className="text-slate-900">{formatKrw(totalStats.avgKgPrice)}/kg</strong>
                </div>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={applyUploadedOverrides}
                onChange={(e) => onToggleApplyOverrides(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
              />
              <span>실측 가중평균 단가를 순위 · ROI 시뮬레이터에 반영</span>
            </label>
          </div>

          {/* Multi-Period Uploaded Comparison Section (shows when 2+ years or 2+ months exist) */}
          {multiPeriodAnalysis && (
            <section
              aria-label="연도·월별 누적 경매물량 및 단가 비교"
              className="bg-white border border-slate-200 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {multiPeriodAnalysis.granularity === 'year'
                      ? '연도별 누적 경매물량 · 단가 · 산지 변화 비교'
                      : '월별 누적 경매물량 · 단가 · 산지 변화 비교'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-num">
                    비교 기간 {multiPeriodAnalysis.periods.map((p) => p.periodKey).join(' → ')} ·
                    최신({multiPeriodAnalysis.latestPeriodLabel}) vs 직전({multiPeriodAnalysis.prevPeriodLabel}) 품목·산지 증감 분석
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                <div className="lg:col-span-5 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2.5 px-4 text-left font-medium">기간</th>
                        <th className="py-2.5 px-3 text-right font-medium">총 물량</th>
                        <th className="py-2.5 px-3 text-right font-medium">물량 증감</th>
                        <th className="py-2.5 px-4 text-right font-medium">평균 kg단가</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {multiPeriodAnalysis.periods.map((p) => (
                        <tr key={p.periodKey} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-num font-semibold text-slate-900 whitespace-nowrap">
                            {p.periodKey}
                            <div className="text-[11px] font-normal text-slate-500">
                              주력 {p.topItem} · {p.topOrigin}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-num text-slate-700 whitespace-nowrap">
                            {p.totalKg >= 1000
                              ? `${(p.totalKg / 1000).toFixed(2)}톤`
                              : `${p.totalKg.toLocaleString('ko-KR')}kg`}
                            <div className="text-[11px] text-slate-400">
                              {formatKrwCompact(p.totalAmountKrw)}
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-num font-semibold whitespace-nowrap ${
                              p.volumeChangePct === null
                                ? 'text-slate-400'
                                : p.volumeChangePct >= 5
                                  ? 'text-amber-700'
                                  : p.volumeChangePct <= -2.5
                                    ? 'text-emerald-700'
                                    : 'text-slate-600'
                            }`}
                          >
                            {p.volumeChangePct === null
                              ? '-'
                              : p.volumeChangePct > 0
                                ? `+${p.volumeChangePct}%`
                                : `${p.volumeChangePct}%`}
                          </td>
                          <td className="py-2.5 px-4 text-right font-num font-semibold text-slate-900 whitespace-nowrap">
                            {formatKrw(p.weightedAvgKgPrice)}
                            {p.priceChangePct !== null && (
                              <div
                                className={`text-[11px] font-medium ${
                                  p.priceChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {p.priceChangePct > 0
                                  ? `+${p.priceChangePct}%`
                                  : `${p.priceChangePct}%`}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:col-span-7 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2.5 px-4 text-left font-medium">품목</th>
                        <th className="py-2.5 px-3 text-right font-medium">물량 변화</th>
                        <th className="py-2.5 px-3 text-right font-medium">단가 변화</th>
                        <th className="py-2.5 px-4 text-left font-medium">증가 · 감소 출하지</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {multiPeriodAnalysis.itemShifts.slice(0, 10).map((it) => (
                        <tr key={it.item} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {it.item}
                            <div className="text-[11px] font-num font-normal text-slate-500">
                              {it.prevKg.toLocaleString('ko-KR')} → {it.latestKg.toLocaleString('ko-KR')}kg
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-num font-semibold whitespace-nowrap ${
                              it.volumeChangePct >= 5
                                ? 'text-amber-700'
                                : it.volumeChangePct <= -2.5
                                  ? 'text-emerald-700'
                                  : 'text-slate-700'
                            }`}
                          >
                            {it.volumeChangePct > 0
                              ? `+${it.volumeChangePct}%`
                              : `${it.volumeChangePct}%`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-num whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                it.priceChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {it.priceChangePct > 0
                                ? `+${it.priceChangePct}%`
                                : `${it.priceChangePct}%`}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              {formatKrw(it.latestAvgKgPrice)}/kg
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {it.expandingRegions.length > 0 && (
                              <div className="text-amber-800 truncate max-w-[240px]">
                                확대: {it.expandingRegions.join(', ')}
                              </div>
                            )}
                            {it.shrinkingRegions.length > 0 && (
                              <div className="text-emerald-800 truncate max-w-[240px]">
                                감소: {it.shrinkingRegions.join(', ')}
                              </div>
                            )}
                            {it.expandingRegions.length === 0 &&
                              it.shrinkingRegions.length === 0 && (
                                <span className="text-slate-400">산지 비중 보합</span>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Aggregated Group Summary */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                품목 · 품종 · 거래단위별 수량 가중평균 집계 ({groupedSummary.length}개 그룹)
              </h3>
              <span className="text-xs text-slate-500">
                가중평균 = Σ(경락가 × 수량) ÷ Σ(수량 또는 중량)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="py-2.5 px-4 text-left font-medium">품목 · 품종</th>
                    <th className="py-2.5 px-3 text-left font-medium">단위 / 등급</th>
                    <th className="py-2.5 px-3 text-right font-medium">거래건 · 수량</th>
                    <th className="py-2.5 px-3 text-right font-medium">단위 최저~최고</th>
                    <th className="py-2.5 px-3 text-right font-medium">고유단위 가중평균</th>
                    <th className="py-2.5 px-3 text-right font-medium">kg당 가중평균</th>
                    <th className="py-2.5 px-3 text-left font-medium">주요 출하지</th>
                    <th className="py-2.5 px-4 text-right font-medium">수지타산</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedSummary.map((g) => {
                    const matchedCrop = matchAuctionRecordToCrop(
                      {
                        id: g.key,
                        date: '',
                        corporation: '',
                        item: g.item,
                        variety: g.variety,
                        unitRaw: g.unitRaw,
                        kgPerUnit: g.kgPerUnit,
                        nativeUnitLabel: g.unitRaw,
                        isEstimatedKg: false,
                        grade: g.grade,
                        quantity: g.totalQuantity,
                        pricePerUnit: g.weightedAvgUnitPrice,
                        pricePerKg: g.weightedAvgKgPrice,
                        origin: '',
                        ecoType: '',
                        sourceFormat: 'auction_result',
                      },
                      crops
                    );
                    return (
                      <tr key={g.key} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{g.variety}</div>
                          <div className="text-xs text-slate-500">{g.item}</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap font-num">
                          {g.unitRaw} · {g.grade}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                          {g.recordCount}건 / {g.totalQuantity.toLocaleString('ko-KR')}단위
                        </td>
                        <td className="py-2.5 px-3 text-right font-num text-xs text-slate-600 whitespace-nowrap">
                          {formatKrw(g.minUnitPrice)} ~ {formatKrw(g.maxUnitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatKrw(g.weightedAvgUnitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-bold text-emerald-700 whitespace-nowrap">
                          {formatKrw(g.weightedAvgKgPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 truncate max-w-[180px]">
                          {g.origins.join(', ') || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {matchedCrop ? (
                            <button
                              type="button"
                              onClick={() => onInspectCropRoi(matchedCrop.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>ROI 분석</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">비재배</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Raw Normalized Rows Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                개별 경매 내역 ({records.length.toLocaleString('ko-KR')}건 중 상위 100건 표시)
              </h3>
              <span className="text-xs text-slate-500">전체 데이터는 CSV 저장으로 내보내기 가능</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 text-left font-medium">일자</th>
                    <th className="py-2 px-3 text-left font-medium">법인</th>
                    <th className="py-2 px-3 text-left font-medium">품목 · 품종</th>
                    <th className="py-2 px-3 text-left font-medium">단위</th>
                    <th className="py-2 px-3 text-left font-medium">등급</th>
                    <th className="py-2 px-3 text-right font-medium">수량</th>
                    <th className="py-2 px-3 text-right font-medium">경락가(단위)</th>
                    <th className="py-2 px-3 text-right font-medium">kg 환산가</th>
                    <th className="py-2 px-3 text-left font-medium">출하지</th>
                    <th className="py-2 px-3 text-left font-medium">구분</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.slice(0, 100).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-num text-slate-600 whitespace-nowrap">{r.date}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{r.corporation}</td>
                      <td className="py-2 px-3 text-slate-900 font-medium whitespace-nowrap">
                        {r.item} / {r.variety}
                      </td>
                      <td className="py-2 px-3 font-num text-slate-700 whitespace-nowrap">
                        {r.unitRaw}
                        {r.isEstimatedKg && (
                          <span className="text-amber-700 ml-1">(≈{r.kgPerUnit}kg)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{r.grade}</td>
                      <td className="py-2 px-3 text-right font-num text-slate-700 whitespace-nowrap">
                        {r.quantity.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2 px-3 text-right font-num font-medium text-slate-900 whitespace-nowrap">
                        {formatKrw(r.pricePerUnit)}
                      </td>
                      <td className="py-2 px-3 text-right font-num font-semibold text-emerald-700 whitespace-nowrap">
                        {formatKrw(r.pricePerKg)}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{r.origin}</td>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{r.ecoType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">
            아직 업로드된 경매결과 파일이 없습니다.
          </p>
          <p className="text-xs text-slate-500">
            가락시장 OZViewer에서 내려받은 엑셀 파일을 올리거나 상단의 &ldquo;샘플 경매결과 불러오기&rdquo;를 눌러 바로 확인해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
