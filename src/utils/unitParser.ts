import type { ParsedUnit } from '../types/garak';

/**
 * Standard agricultural kg conversion table for non-weight Korean wholesale units.
 * Used only when the auction unit string has no explicit kg/g weight (e.g. "1단", "3포기망", "100속").
 */
const CROP_UNIT_KG_DEFAULTS: Array<{
  itemPattern: RegExp;
  unitPattern: RegExp;
  kgPerCount: number;
  label: string;
}> = [
  { itemPattern: /배추|양배추/, unitPattern: /포기/, kgPerCount: 3.0, label: '포기' },
  { itemPattern: /배추/, unitPattern: /망/, kgPerCount: 10.0, label: '망(3포기)' },
  { itemPattern: /무|열무|알타리/, unitPattern: /단/, kgPerCount: 2.0, label: '단' },
  { itemPattern: /대파|파|쪽파|부추|미나리|시금치/, unitPattern: /단/, kgPerCount: 1.0, label: '단' },
  { itemPattern: /깻잎/, unitPattern: /속/, kgPerCount: 0.02, label: '속' },
  { itemPattern: /마늘|양파|감/, unitPattern: /접/, kgPerCount: 3.5, label: '접(100개)' },
  { itemPattern: /오이|애호박|가지/, unitPattern: /개/, kgPerCount: 0.25, label: '개' },
  { itemPattern: /수박/, unitPattern: /통|개/, kgPerCount: 7.5, label: '통' },
  { itemPattern: /메론|멜론/, unitPattern: /통|수/, kgPerCount: 1.8, label: '통' },
  { itemPattern: /사과|배|복숭아|단감/, unitPattern: /과/, kgPerCount: 0.32, label: '과' },
];

const GENERIC_NON_WEIGHT_UNITS: Array<{
  pattern: RegExp;
  kgPerCount: number;
  label: string;
}> = [
  { pattern: /관/, kgPerCount: 3.75, label: '관' },
  { pattern: /가마/, kgPerCount: 80.0, label: '가마' },
  { pattern: /말/, kgPerCount: 16.0, label: '말' },
  { pattern: /되/, kgPerCount: 1.6, label: '되' },
  { pattern: /접/, kgPerCount: 3.5, label: '접' },
  { pattern: /속/, kgPerCount: 0.02, label: '속' },
  { pattern: /포기/, kgPerCount: 2.5, label: '포기' },
  { pattern: /단/, kgPerCount: 1.0, label: '단' },
  { pattern: /망/, kgPerCount: 10.0, label: '망' },
  { pattern: /상자|박스|box/i, kgPerCount: 10.0, label: '상자' },
  { pattern: /팩|봉|봉지/, kgPerCount: 0.5, label: '팩/봉' },
  { pattern: /송이/, kgPerCount: 0.6, label: '송이' },
  { pattern: /통/, kgPerCount: 5.0, label: '통' },
  { pattern: /개|수/, kgPerCount: 0.3, label: '개' },
];

/**
 * Parses a Garak Market wholesale unit string (e.g., "10kg", "10kg상자", "15kg", "300g", "3포기망", "1단", "100속")
 * into exact or standard-estimated kg equivalent plus native unit metadata.
 */
export function parseGarakUnit(unitRaw: string, itemName = ''): ParsedUnit {
  const cleaned = (unitRaw || '').trim();
  if (!cleaned) {
    return {
      rawUnit: '1kg',
      kgEquivalent: 1,
      nativeUnitLabel: '1kg',
      nativeUnitCount: 1,
      isEstimatedKg: true,
      unitCategory: 'weight',
    };
  }

  // 1. Explicit kg pattern (e.g., "10kg", "10kg상자", "2.5kg(특)", ".75kg", ".5kg")
  const kgMatch = cleaned.match(/((?:\d+(?:\.\d+)?|\.\d+))\s*kg/i);
  if (kgMatch) {
    const kg = parseFloat(kgMatch[1]);
    if (kg > 0 && Number.isFinite(kg)) {
      return {
        rawUnit: cleaned,
        kgEquivalent: kg,
        nativeUnitLabel: cleaned,
        nativeUnitCount: 1,
        isEstimatedKg: false,
        unitCategory: 'weight',
      };
    }
  }

  // 2. Explicit gram pattern (e.g., "300g", "1500g", "500g팩", ".5g")
  const gMatch = cleaned.match(/((?:\d+(?:\.\d+)?|\.\d+))\s*g(?![a-z])/i);
  if (gMatch) {
    const grams = parseFloat(gMatch[1]);
    if (grams > 0 && Number.isFinite(grams)) {
      return {
        rawUnit: cleaned,
        kgEquivalent: Math.round((grams / 1000) * 10000) / 10000,
        nativeUnitLabel: cleaned,
        nativeUnitCount: 1,
        isEstimatedKg: false,
        unitCategory: 'weight',
      };
    }
  }

  // 3. Explicit numeric count + non-weight unit (e.g., "3포기망", "100속", "1단", "2접")
  const countMatch = cleaned.match(/((?:\d+(?:\.\d+)?|\.\d+))/);
  const count = countMatch ? Math.max(0.1, parseFloat(countMatch[1])) : 1;

  for (const rule of CROP_UNIT_KG_DEFAULTS) {
    if (rule.itemPattern.test(itemName) && rule.unitPattern.test(cleaned)) {
      const kgEst = Math.round(count * rule.kgPerCount * 1000) / 1000;
      return {
        rawUnit: cleaned,
        kgEquivalent: Math.max(0.01, kgEst),
        nativeUnitLabel: cleaned,
        nativeUnitCount: count,
        isEstimatedKg: true,
        unitCategory: 'count_bundle',
      };
    }
  }

  for (const generic of GENERIC_NON_WEIGHT_UNITS) {
    if (generic.pattern.test(cleaned)) {
      const kgEst = Math.round(count * generic.kgPerCount * 1000) / 1000;
      return {
        rawUnit: cleaned,
        kgEquivalent: Math.max(0.01, kgEst),
        nativeUnitLabel: cleaned,
        nativeUnitCount: count,
        isEstimatedKg: true,
        unitCategory: 'count_bundle',
      };
    }
  }

  return {
    rawUnit: cleaned,
    kgEquivalent: 1,
    nativeUnitLabel: cleaned,
    nativeUnitCount: count,
    isEstimatedKg: true,
    unitCategory: 'count_bundle',
  };
}

export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

export function formatKrwCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(2)}억원`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 10_000).toLocaleString('ko-KR')}만원`;
  }
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
}
