import { useState } from 'react';
import type { KoreaProvinceId, ProvinceAuctionSummary } from '../utils/koreaOrigin';
import { formatKrw, formatKrwCompact } from '../utils/unitParser';

export type MapMetricKey =
  | 'totalKg'
  | 'totalQuantity'
  | 'totalAmountKrw'
  | 'weightedAvgKgPrice'
  | 'yoyVolumeChangePct';

interface KoreaOriginMapSvgProps {
  provinceMap: Map<KoreaProvinceId, ProvinceAuctionSummary>;
  selectedProvinceId: KoreaProvinceId | null;
  metric: MapMetricKey;
  onSelectProvince: (id: KoreaProvinceId | null) => void;
}

interface ProvinceShape {
  id: KoreaProvinceId;
  shortName: string;
  path: string;
  labelX: number;
  labelY: number;
  isMetro?: boolean;
  calloutLine?: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Clean, geographically recognizable 17-province South Korea choropleth map paths (viewBox 0 0 420 510).
 * Provinces share crisp administrative boundaries; metropolitan cities render clearly on top.
 */
const PROVINCE_SHAPES: ProvinceShape[] = [
  // 강원특별자치도
  {
    id: 'gangwon',
    shortName: '강원',
    path: 'M 176 48 L 238 30 L 274 52 L 306 105 L 336 164 L 318 190 L 278 190 L 246 184 L 214 176 L 194 152 L 180 120 L 170 86 Z',
    labelX: 256,
    labelY: 120,
  },
  // 경기도
  {
    id: 'gyeonggi',
    shortName: '경기',
    path: 'M 118 68 L 154 50 L 176 48 L 170 86 L 180 120 L 194 152 L 186 184 L 160 198 L 122 192 L 106 164 L 104 132 L 112 96 Z',
    labelX: 158,
    labelY: 168,
  },
  // 충청북도
  {
    id: 'chungbuk',
    shortName: '충북',
    path: 'M 186 184 L 194 152 L 214 176 L 246 184 L 254 202 L 230 230 L 222 268 L 204 282 L 184 268 L 178 232 L 160 198 Z',
    labelX: 205,
    labelY: 224,
  },
  // 충청남도
  {
    id: 'chungnam',
    shortName: '충남',
    path: 'M 72 214 L 104 188 L 122 192 L 160 198 L 178 232 L 184 268 L 164 286 L 122 288 L 90 278 L 76 248 Z',
    labelX: 118,
    labelY: 244,
  },
  // 경상북도
  {
    id: 'gyeongbuk',
    shortName: '경북',
    path: 'M 246 184 L 278 190 L 318 190 L 336 164 L 348 212 L 346 266 L 352 308 L 332 326 L 296 318 L 266 324 L 234 316 L 222 268 L 230 230 L 254 202 Z',
    labelX: 294,
    labelY: 252,
  },
  // 전북특별자치도
  {
    id: 'jeonbuk',
    shortName: '전북',
    path: 'M 90 278 L 122 288 L 164 286 L 184 268 L 204 282 L 214 318 L 194 352 L 146 356 L 102 350 L 88 320 Z',
    labelX: 146,
    labelY: 320,
  },
  // 경상남도
  {
    id: 'gyeongnam',
    shortName: '경남',
    path: 'M 214 318 L 234 316 L 266 324 L 296 318 L 332 326 L 326 364 L 308 392 L 268 408 L 226 410 L 198 392 L 194 352 Z',
    labelX: 256,
    labelY: 368,
  },
  // 전라남도
  {
    id: 'jeonnam',
    shortName: '전남',
    path: 'M 80 356 L 102 350 L 146 356 L 194 352 L 198 392 L 186 426 L 144 446 L 96 452 L 66 432 L 64 390 Z',
    labelX: 132,
    labelY: 416,
  },
  // 인천광역시 (서부 해안)
  {
    id: 'incheon',
    shortName: '인천',
    path: 'M 86 114 L 110 108 L 116 138 L 102 152 L 82 142 Z',
    labelX: 54,
    labelY: 130,
    isMetro: true,
    calloutLine: { x1: 72, y1: 130, x2: 96, y2: 130 },
  },
  // 서울특별시
  {
    id: 'seoul',
    shortName: '서울',
    path: 'M 124 114 L 148 112 L 154 132 L 140 144 L 120 136 Z',
    labelX: 137,
    labelY: 129,
    isMetro: true,
  },
  // 세종특별자치시
  {
    id: 'sejong',
    shortName: '세종',
    path: 'M 152 222 L 168 222 L 170 242 L 154 244 Z',
    labelX: 161,
    labelY: 235,
    isMetro: true,
  },
  // 대전광역시
  {
    id: 'daejeon',
    shortName: '대전',
    path: 'M 162 250 L 180 250 L 182 268 L 164 270 Z',
    labelX: 172,
    labelY: 262,
    isMetro: true,
  },
  // 대구광역시
  {
    id: 'daegu',
    shortName: '대구',
    path: 'M 272 288 L 298 286 L 302 310 L 274 312 Z',
    labelX: 287,
    labelY: 301,
    isMetro: true,
  },
  // 광주광역시
  {
    id: 'gwangju',
    shortName: '광주',
    path: 'M 118 370 L 144 370 L 146 390 L 118 390 Z',
    labelX: 132,
    labelY: 382,
    isMetro: true,
  },
  // 울산광역시
  {
    id: 'ulsan',
    shortName: '울산',
    path: 'M 326 326 L 352 322 L 354 352 L 328 354 Z',
    labelX: 376,
    labelY: 340,
    isMetro: true,
    calloutLine: { x1: 350, y1: 340, x2: 362, y2: 340 },
  },
  // 부산광역시
  {
    id: 'busan',
    shortName: '부산',
    path: 'M 310 364 L 344 358 L 348 386 L 312 392 Z',
    labelX: 372,
    labelY: 378,
    isMetro: true,
    calloutLine: { x1: 344, y1: 376, x2: 358, y2: 376 },
  },
  // 제주특별자치도 (하단 좌측 표준 위치)
  {
    id: 'jeju',
    shortName: '제주',
    path: 'M 72 478 Q 108 462 146 472 Q 154 486 138 494 Q 100 500 72 490 Z',
    labelX: 110,
    labelY: 484,
  },
];

function getMetricValue(summary: ProvinceAuctionSummary | undefined, metric: MapMetricKey): number {
  if (!summary || summary.recordCount === 0) return 0;
  if (metric === 'yoyVolumeChangePct') {
    return summary.yoyVolumeChangePct ?? 0;
  }
  return summary[metric];
}

function formatMetricShort(
  value: number,
  metric: MapMetricKey,
  yoyRaw?: number | null
): string {
  if (metric === 'yoyVolumeChangePct') {
    if (yoyRaw === null || yoyRaw === undefined) return 'N/A';
    return `${yoyRaw > 0 ? '+' : ''}${yoyRaw.toFixed(1)}%`;
  }
  if (value <= 0) return '';
  if (metric === 'totalKg') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}t` : `${Math.round(value)}kg`;
  }
  if (metric === 'totalQuantity') {
    return `${value.toLocaleString('ko-KR')}`;
  }
  if (metric === 'totalAmountKrw') {
    return formatKrwCompact(value);
  }
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function getChoroplethFill(
  ratio: number,
  hasData: boolean,
  metric: MapMetricKey,
  yoyVal: number | null
): string {
  if (!hasData) return '#f1f5f9'; // slate-100
  if (metric === 'yoyVolumeChangePct') {
    if (yoyVal === null) return '#f1f5f9';
    if (yoyVal >= 7) return '#d97706'; // amber-600 (rapid expansion)
    if (yoyVal >= 2) return '#fde68a'; // amber-200 (mild expansion)
    if (yoyVal > -2) return '#e2e8f0'; // slate-200 (flat)
    if (yoyVal > -6) return '#6ee7b7'; // emerald-300 (mild contraction)
    return '#047857'; // emerald-700 (sharp contraction)
  }
  if (ratio <= 0) return '#f1f5f9';
  if (ratio < 0.2) return '#d1fae5'; // emerald-100
  if (ratio < 0.45) return '#6ee7b7'; // emerald-300
  if (ratio < 0.72) return '#10b981'; // emerald-500
  return '#047857'; // emerald-700
}

function getLabelTextFill(
  ratio: number,
  hasData: boolean,
  metric: MapMetricKey,
  yoyVal: number | null
): string {
  if (!hasData) return '#0f172a';
  if (metric === 'yoyVolumeChangePct') {
    if (yoyVal !== null && (yoyVal >= 7 || yoyVal <= -6)) return '#ffffff';
    return '#0f172a';
  }
  if (ratio < 0.45) return '#0f172a';
  return '#ffffff';
}

const METRIC_LABELS: Record<MapMetricKey, string> = {
  totalKg: '출하 중량(kg)',
  totalQuantity: '경매 수량(단위)',
  totalAmountKrw: '총 경매금액',
  weightedAvgKgPrice: '가중평균 kg당 단가',
  yoyVolumeChangePct: '전년대비 산지 물량 증감(%)',
};

export function KoreaOriginMapSvg({
  provinceMap,
  selectedProvinceId,
  metric,
  onSelectProvince,
}: KoreaOriginMapSvgProps) {
  const [hoveredId, setHoveredId] = useState<KoreaProvinceId | null>(null);

  let maxMetricValue = 0;
  for (const shape of PROVINCE_SHAPES) {
    const val = getMetricValue(provinceMap.get(shape.id), metric);
    if (val > maxMetricValue) maxMetricValue = val;
  }

  const hoveredSummary = hoveredId ? provinceMap.get(hoveredId) : null;

  return (
    <div className="relative flex flex-col h-full">
      {/* Legend Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs text-slate-600">
        <span>지표: <strong className="text-slate-900">{METRIC_LABELS[metric]}</strong></span>
        {metric === 'yoyVolumeChangePct' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-700 font-medium">감소</span>
            <span className="w-4 h-2.5 rounded-xs bg-emerald-700 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-emerald-300 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-slate-200 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-amber-200 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-amber-600 inline-block" />
            <span className="text-amber-700 font-medium">증가(공급↑)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">없음</span>
            <span className="w-4 h-2.5 rounded-xs bg-slate-100 border border-slate-200 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-emerald-100 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-emerald-300 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span className="w-4 h-2.5 rounded-xs bg-emerald-700 inline-block" />
            <span className="text-slate-500 font-medium">높음</span>
          </div>
        )}
      </div>

      {/* Interactive South Korea SVG */}
      <div className="relative flex-1 flex items-center justify-center py-2 select-none">
        <svg
          viewBox="0 0 420 512"
          className="w-full max-w-[400px] h-auto"
          role="img"
          aria-label="대한민국 시·도별 가락시장 경매 출하 현황 지도"
        >
          {/* Subtle Jeju inset frame */}
          <rect
            x="48"
            y="456"
            width="124"
            height="50"
            rx="6"
            fill="#f8fafc"
            stroke="#e2e8f0"
            strokeDasharray="3 3"
          />

          {/* Ulleungdo / Dokdo subtle markers */}
          <g aria-hidden="true">
            <circle cx="384" cy="184" r="3.5" fill="#cbd5e1" />
            <circle cx="400" cy="192" r="2" fill="#cbd5e1" />
            <text x="384" y="176" textAnchor="middle" fontSize="9" fill="#94a3b8">
              울릉·독도
            </text>
          </g>

          {/* Province polygons */}
          {PROVINCE_SHAPES.map((shape) => {
            const summary = provinceMap.get(shape.id);
            const hasData = Boolean(summary && summary.recordCount > 0);
            const val = getMetricValue(summary, metric);
            const yoyVal = summary?.yoyVolumeChangePct ?? null;
            const ratio = maxMetricValue > 0 ? val / maxMetricValue : 0;
            const fill = getChoroplethFill(ratio, hasData, metric, yoyVal);
            const isSelected = selectedProvinceId === shape.id;
            const isHovered = hoveredId === shape.id;

            return (
              <g
                key={shape.id}
                data-province={shape.id}
                role="button"
                tabIndex={0}
                aria-label={`${summary?.fullName ?? shape.shortName} (${shape.shortName}): ${
                  hasData && summary
                    ? `${summary.totalKg.toLocaleString('ko-KR')}kg, ${summary.totalQuantity.toLocaleString('ko-KR')}개, 평균 ${formatKrw(summary.weightedAvgKgPrice)}/kg${
                        summary.yoyVolumeChangePct !== null
                          ? `, 전년비 ${summary.yoyVolumeChangePct > 0 ? '+' : ''}${summary.yoyVolumeChangePct}%`
                          : ''
                      }`
                    : '경매 데이터 없음'
                }`}
                onClick={() => onSelectProvince(isSelected ? null : shape.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProvince(isSelected ? null : shape.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(shape.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === shape.id ? null : prev))}
                className="cursor-pointer focus:outline-none"
              >
                <path
                  d={shape.path}
                  fill={fill}
                  stroke={isSelected ? '#0f172a' : isHovered ? '#065f46' : '#ffffff'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.2}
                  strokeLinejoin="round"
                  className="transition-colors duration-150"
                />

                {shape.calloutLine && (
                  <line
                    x1={shape.calloutLine.x1}
                    y1={shape.calloutLine.y1}
                    x2={shape.calloutLine.x2}
                    y2={shape.calloutLine.y2}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                )}

                <text
                  x={shape.labelX}
                  y={hasData && !shape.isMetro ? shape.labelY - 3 : shape.labelY + 3}
                  textAnchor="middle"
                  fontSize={shape.isMetro ? '10' : '11.5'}
                  fontWeight={isSelected || hasData ? '700' : '500'}
                  fill={
                    shape.calloutLine
                      ? '#334155'
                      : getLabelTextFill(ratio, hasData, metric, yoyVal)
                  }
                  className="pointer-events-none"
                >
                  {shape.shortName}
                </text>

                {hasData && !shape.isMetro && (
                  <text
                    x={shape.labelX}
                    y={shape.labelY + 11}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill={getLabelTextFill(ratio, hasData, metric, yoyVal)}
                    className="pointer-events-none font-num"
                  >
                    {formatMetricShort(val, metric, yoyVal)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Clean non-intrusive hover readout bar below map canvas */}
      <div className="mt-2 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        {hoveredSummary && hoveredSummary.recordCount > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-700 w-full justify-between">
            <span className="font-semibold text-slate-900">{hoveredSummary.fullName}</span>
            <span className="font-num">
              출하 <strong>{hoveredSummary.totalKg.toLocaleString('ko-KR')}kg</strong>
              {hoveredSummary.yoyVolumeChangePct !== null && (
                <>
                  {' '}
                  (
                  <strong
                    className={
                      hoveredSummary.yoyVolumeChangePct >= 5
                        ? 'text-amber-700'
                        : hoveredSummary.yoyVolumeChangePct <= -2.5
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                    }
                  >
                    {hoveredSummary.yoyVolumeChangePct > 0 ? '+' : ''}
                    {hoveredSummary.yoyVolumeChangePct}%
                  </strong>
                  )
                </>
              )}{' '}
              · 평균{' '}
              <strong className="text-emerald-700">
                {formatKrw(hoveredSummary.weightedAvgKgPrice)}/kg
              </strong>
            </span>
          </div>
        ) : hoveredSummary ? (
          <div className="flex items-center justify-between w-full text-slate-500">
            <span className="font-medium text-slate-700">{hoveredSummary.fullName}</span>
            <span>현재 필터 조건에 해당하는 출하 기록이 없습니다.</span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-slate-500">
            <span>시·도를 클릭하면 해당 지역의 시·군·구 출하 상세 내역을 필터링합니다.</span>
            {selectedProvinceId && (
              <button
                type="button"
                onClick={() => onSelectProvince(null)}
                className="text-emerald-700 font-semibold hover:underline whitespace-nowrap ml-2"
              >
                전국 보기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
