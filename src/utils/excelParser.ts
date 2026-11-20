import * as XLSX from 'xlsx';
import type { AuctionRecord, ExcelParseResult } from '../types/garak';
import { parseGarakUnit } from './unitParser';

function cleanNumericValue(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : NaN;
  }
  if (raw === null || raw === undefined) return NaN;
  const str = String(raw).replace(/,/g, '').replace(/원/g, '').trim();
  if (!str) return NaN;
  const num = Number(str);
  return Number.isFinite(num) ? num : NaN;
}

function extractDateFromText(text: string): string | null {
  const match = text.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Parses 2D sheet rows (from SheetJS sheet_to_json({ header: 1 })) exported by Garak Market OZViewer.
 * Supports:
 *  - Format A (`경매 결과 (가락시장)`): 법인 | 품목 | 품종 | 단위 | 등급 | 수량 | 경락 | 출하지 | 친환경구분
 *  - Format B (`품목별 가격 [ 가락시장 ]`): 날짜 | 품목 | 등급 | 거래단위 | 최저가 | 최고가 | 평균가
 */
export function parseGarakSheetRows(rows: unknown[][], fallbackDate?: string): ExcelParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const records: AuctionRecord[] = [];
  let skippedRows = 0;

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      records: [],
      skippedRows: 0,
      detectedFormat: 'unknown',
      detectedDate: null,
      warnings,
      errors: ['시트에 데이터가 없습니다. 가락시장에서 내려받은 .xls/.xlsx/.csv 파일을 선택해 주세요.'],
    };
  }

  let detectedDate: string | null = fallbackDate ? extractDateFromText(fallbackDate) : null;
  let detectedFormat: 'auction_result' | 'item_summary' | 'unknown' = 'unknown';
  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};

  // Scan top 25 rows for date banner and header row
  const scanLimit = Math.min(rows.length, 25);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] || [];
    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (!detectedDate) {
      const found = extractDateFromText(rowText);
      if (found) detectedDate = found;
    }

    const normalized = row.map(normalizeHeader);

    // Check Format A: 경매 결과 (법인, 품목, 단위, 경락)
    const idxCorp = normalized.findIndex((h) => h.includes('법인'));
    const idxItem = normalized.findIndex((h) => h === '품목' || h === '품목명');
    const idxUnit = normalized.findIndex((h) => h === '단위' || h === '거래단위' || h === '규격');
    const idxPrice = normalized.findIndex((h) => h.includes('경락'));

    if (idxItem !== -1 && idxUnit !== -1 && idxPrice !== -1) {
      detectedFormat = 'auction_result';
      headerRowIdx = r;
      colMap = {
        corporation: idxCorp,
        item: idxItem,
        variety: normalized.findIndex((h) => h.includes('품종')),
        unit: idxUnit,
        grade: normalized.findIndex((h) => h.includes('등급')),
        quantity: normalized.findIndex((h) => h.includes('수량') || h.includes('물량')),
        price: idxPrice,
        origin: normalized.findIndex((h) => h.includes('출하지') || h.includes('산지')),
        ecoType: normalized.findIndex((h) => h.includes('친환경')),
        date: normalized.findIndex((h) => h.includes('일자') || h.includes('날짜')),
      };
      break;
    }

    // Check Format B: 품목별 가격 (날짜, 품목, 등급, 거래단위, 평균가)
    const idxDateB = normalized.findIndex((h) => h === '날짜' || h === '일자');
    const idxAvgB = normalized.findIndex((h) => h.includes('평균가'));
    if (idxItem !== -1 && idxUnit !== -1 && idxAvgB !== -1) {
      detectedFormat = 'item_summary';
      headerRowIdx = r;
      colMap = {
        date: idxDateB,
        item: idxItem,
        grade: normalized.findIndex((h) => h.includes('등급')),
        unit: idxUnit,
        minPrice: normalized.findIndex((h) => h.includes('최저가')),
        maxPrice: normalized.findIndex((h) => h.includes('최고가')),
        avgPrice: idxAvgB,
      };
      break;
    }
  }

  if (headerRowIdx === -1 || detectedFormat === 'unknown') {
    return {
      records: [],
      skippedRows: rows.length,
      detectedFormat: 'unknown',
      detectedDate,
      warnings,
      errors: [
        '가락시장 경매결과 또는 품목별 가격 헤더를 찾을 수 없습니다. (필수 컬럼: 품목, 단위/거래단위, 경락/평균가)',
      ],
    };
  }

  const effectiveFallbackDate =
    detectedDate || new Date().toISOString().slice(0, 10);

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every((cell) => String(cell ?? '').trim() === '')) {
      continue;
    }

    // Detect repeated OZViewer page banners / repeated headers across pages (e.g. "경매 결과", "1/22", "법인")
    const joined = row.map((c) => String(c ?? '').trim()).join(' ');
    if (
      /경매\s*결과|품목별\s*가격|서울시농수산식품공사|근거•증빙자료|본\s*자료는/.test(joined)
    ) {
      const updatedDate = extractDateFromText(joined);
      if (updatedDate) detectedDate = updatedDate;
      skippedRows += 1;
      continue;
    }

    const itemCell = String(row[colMap.item] ?? '').trim();
    if (!itemCell || itemCell === '품목' || itemCell === '품목명' || itemCell === '합계' || itemCell === '소계') {
      skippedRows += 1;
      continue;
    }

    if (detectedFormat === 'auction_result') {
      const unitRaw = String(row[colMap.unit] ?? '').trim();
      const pricePerUnit = cleanNumericValue(row[colMap.price]);
      const qtyRaw = colMap.quantity >= 0 ? cleanNumericValue(row[colMap.quantity]) : 1;
      const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;

      if (!unitRaw || !Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
        skippedRows += 1;
        continue;
      }

      const variety =
        colMap.variety >= 0 ? String(row[colMap.variety] ?? '').trim() || itemCell : itemCell;
      const parsedUnit = parseGarakUnit(unitRaw, `${itemCell} ${variety}`);
      const pricePerKg = Math.round(pricePerUnit / parsedUnit.kgEquivalent);
      const rowDate =
        colMap.date >= 0
          ? extractDateFromText(String(row[colMap.date] ?? '')) || effectiveFallbackDate
          : detectedDate || effectiveFallbackDate;

      records.push({
        id: `xls-${r}-${records.length + 1}`,
        date: rowDate,
        corporation:
          colMap.corporation >= 0 ? String(row[colMap.corporation] ?? '').trim() || '가락시장' : '가락시장',
        item: itemCell,
        variety,
        unitRaw: parsedUnit.rawUnit,
        kgPerUnit: parsedUnit.kgEquivalent,
        nativeUnitLabel: parsedUnit.nativeUnitLabel,
        isEstimatedKg: parsedUnit.isEstimatedKg,
        grade: colMap.grade >= 0 ? String(row[colMap.grade] ?? '').trim() || '보통' : '보통',
        quantity,
        pricePerUnit,
        pricePerKg,
        origin: colMap.origin >= 0 ? String(row[colMap.origin] ?? '').trim() || '-' : '-',
        ecoType: colMap.ecoType >= 0 ? String(row[colMap.ecoType] ?? '').trim() || '일반' : '일반',
        sourceFormat: 'auction_result',
      });
    } else {
      // Format B: 품목별 가격
      const unitRaw = String(row[colMap.unit] ?? '').trim();
      const avgPrice = cleanNumericValue(row[colMap.avgPrice]);
      if (!unitRaw || !Number.isFinite(avgPrice) || avgPrice <= 0) {
        skippedRows += 1;
        continue;
      }

      const parsedUnit = parseGarakUnit(unitRaw, itemCell);
      const pricePerKg = Math.round(avgPrice / parsedUnit.kgEquivalent);
      const rowDate =
        colMap.date >= 0
          ? extractDateFromText(String(row[colMap.date] ?? '')) || effectiveFallbackDate
          : detectedDate || effectiveFallbackDate;

      records.push({
        id: `xls-${r}-${records.length + 1}`,
        date: rowDate,
        corporation: '가락시장 평균',
        item: itemCell,
        variety: itemCell,
        unitRaw: parsedUnit.rawUnit,
        kgPerUnit: parsedUnit.kgEquivalent,
        nativeUnitLabel: parsedUnit.nativeUnitLabel,
        isEstimatedKg: parsedUnit.isEstimatedKg,
        grade: colMap.grade >= 0 ? String(row[colMap.grade] ?? '').trim() || '보통' : '보통',
        quantity: 1,
        pricePerUnit: avgPrice,
        pricePerKg,
        origin: '전체',
        ecoType: '일반',
        sourceFormat: 'item_summary',
      });
    }
  }

  if (records.length === 0) {
    errors.push('유효한 경매 데이터 행을 추출하지 못했습니다. 경락가/단위 컬럼 값이 비어 있거나 숫자가 아닌지 확인해 주세요.');
  } else if (skippedRows > 0) {
    warnings.push(`페이지 구분 행 또는 공백·비유효 행 ${skippedRows}건을 자동으로 제외했습니다.`);
  }

  return {
    records,
    skippedRows,
    detectedFormat,
    detectedDate: detectedDate || effectiveFallbackDate,
    warnings,
    errors,
  };
}

/**
 * Parses an ArrayBuffer from an uploaded .xls, .xlsx, or .csv file using SheetJS.
 */
export function parseGarakExcelBuffer(buffer: ArrayBuffer, fileName = ''): ExcelParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (!workbook.SheetNames.length) {
      return {
        records: [],
        skippedRows: 0,
        detectedFormat: 'unknown',
        detectedDate: null,
        warnings: [],
        errors: ['엑셀 파일에 시트가 존재하지 않습니다.'],
      };
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    return parseGarakSheetRows(rows, fileName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 파싱 오류';
    return {
      records: [],
      skippedRows: 0,
      detectedFormat: 'unknown',
      detectedDate: null,
      warnings: [],
      errors: [`파일을 읽는 중 오류가 발생했습니다 (${msg}). 손상되지 않은 .xls, .xlsx, .csv 파일인지 확인해 주세요.`],
    };
  }
}

export function exportAuctionRecordsToCsv(records: AuctionRecord[]): string {
  const headers = [
    '일자',
    '법인',
    '품목',
    '품종',
    '거래단위',
    '환산중량(kg)',
    '등급',
    '수량',
    '단위당경락가(원)',
    'kg당환산가(원)',
    '출하지',
    '친환경구분',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(','),
    ...records.map((r) =>
      [
        r.date,
        r.corporation,
        r.item,
        r.variety,
        r.unitRaw,
        r.kgPerUnit,
        r.grade,
        r.quantity,
        r.pricePerUnit,
        r.pricePerKg,
        r.origin,
        r.ecoType,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  // Include UTF-8 BOM so Korean characters open cleanly in Microsoft Excel
  return '\uFEFF' + lines.join('\r\n');
}
