import type { Garak10YrCatalogItem, Garak10YrCatalogPayload } from '../types/garak';
import { isCultivableDomesticItem } from './cropSynthesizer';

export type TenYrFilterMode =
  | 'all'
  | 'cultivable'
  | 'all_10yr'
  | 'growing'
  | 'shrinking'
  | 'has_gap';

export function filterGarak10YrItems(
  items: Garak10YrCatalogItem[],
  opts: {
    search: string;
    category: string;
    filterMode: TenYrFilterMode;
  }
): Garak10YrCatalogItem[] {
  const q = opts.search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (opts.category !== '전체' && item.category !== opts.category) return false;
    if (opts.filterMode === 'cultivable' && !isCultivableDomesticItem(item.itemName, item.category)) {
      return false;
    }
    if (opts.filterMode === 'all_10yr' && item.activeYearsCount < 10) return false;
    if (opts.filterMode === 'growing' && item.presenceTrendDelta < 2.5) return false;
    if (opts.filterMode === 'shrinking' && item.presenceTrendDelta > -2.5) return false;
    if (opts.filterMode === 'has_gap' && (item.gapMonths.length === 0 || item.activeYearsCount < 4)) {
      return false;
    }
    if (q) {
      const hitName = item.itemName.toLowerCase().includes(q);
      const hitUnit = item.units.some((u) => u.toLowerCase().includes(q));
      const hitCat = item.category.toLowerCase().includes(q);
      return hitName || hitUnit || hitCat;
    }
    return true;
  });

  if (opts.filterMode === 'growing') {
    return [...filtered].sort(
      (a, b) => b.presenceTrendDelta - a.presenceTrendDelta || b.totalActiveMonthSlots - a.totalActiveMonthSlots
    );
  }
  if (opts.filterMode === 'shrinking') {
    return [...filtered].sort(
      (a, b) => a.presenceTrendDelta - b.presenceTrendDelta || b.totalActiveMonthSlots - a.totalActiveMonthSlots
    );
  }
  if (opts.filterMode === 'has_gap') {
    return [...filtered].sort(
      (a, b) => b.activeYearsCount - a.activeYearsCount || a.gapMonths.length - b.gapMonths.length
    );
  }
  return filtered;
}

export function formatMonthRangesKo(months: number[]): string {
  if (!months || months.length === 0) return '연중(공백 없음)';
  const sorted = Array.from(new Set(months)).filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 12) return '1~12월 전체';
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? `${start}월` : `${start}~${prev}월`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? `${start}월` : `${start}~${prev}월`);
  return ranges.join(', ');
}

export function exportGarak10YrToCsv(payload: Garak10YrCatalogPayload, items: Garak10YrCatalogItem[]): string {
  const yearsHeader = payload.years.map((y) => `${y}년(출현월)`).join(',');
  const monthsHeader = Array.from({ length: 12 }, (_, i) => `${i + 1}월(10년중)`).join(',');
  const header = `품목명,부류,최초출현연도,최근출현연도,활동연수,10년총출현월수,최근3년vs초기3년증감,주요출하월,공백월(2년이하),거래포장단위,${yearsHeader},${monthsHeader}`;

  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = items.map((item) => {
    const base = [
      item.itemName,
      item.category,
      item.firstYear,
      item.lastYear,
      item.activeYearsCount,
      item.totalActiveMonthSlots,
      item.presenceTrendDelta,
      formatMonthRangesKo(item.peakMonths),
      item.gapMonths.length > 0 ? formatMonthRangesKo(item.gapMonths) : '없음',
      item.units.join(' | '),
      ...item.yearlyActiveMonths,
      ...item.monthlyPresence10Yr,
    ];
    return base.map(esc).join(',');
  });

  return '\uFEFF' + [header, ...rows].join('\n');
}
