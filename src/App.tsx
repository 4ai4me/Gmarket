import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewView } from './components/OverviewView';
import { CatalogView } from './components/CatalogView';
import { PriceRankingView } from './components/PriceRankingView';
import { SupplyRiskView } from './components/SupplyRiskView';
import { RoiSimulatorView } from './components/RoiSimulatorView';
import { OriginMapView } from './components/OriginMapView';
import { ExcelAnalyzerView } from './components/ExcelAnalyzerView';
import { CROP_PROFILES } from './data/crops';
import { EXTRA_CURATED_CROPS } from './data/extraCrops';
import {
  GARAK_SNAPSHOT_ALL_YEAR,
  GARAK_SNAPSHOT_AUCTION,
  GARAK_SNAPSHOT_SUMMARY,
} from './data/garakSnapshot';
import type { AuctionRecord, CultivationMethodKey, GarakLiveResponse } from './types/garak';
import {
  buildCropRankings,
  buildUploadedCropPriceOverrides,
} from './utils/analytics';
import { buildUnifiedCropUniverse } from './utils/cropSynthesizer';
import { evaluateCropSupplyRiskMatrix } from './utils/supplyRisk';

const ALL_CURATED_CROPS = [...CROP_PROFILES, ...EXTRA_CURATED_CROPS];
const STORAGE_RECORDS_KEY = 'garak_uploaded_records_v1';
const STORAGE_META_KEY = 'garak_uploaded_meta_v1';

function loadPersistedRecords(): AuctionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is AuctionRecord =>
        r &&
        typeof r === 'object' &&
        typeof r.item === 'string' &&
        typeof r.quantity === 'number' &&
        Number.isFinite(r.quantity) &&
        typeof r.pricePerUnit === 'number' &&
        Number.isFinite(r.pricePerUnit)
    );
  } catch {
    return [];
  }
}

function loadPersistedMeta(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_META_KEY) || '';
  } catch {
    return '';
  }
}

function getTodayIsoKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function isStaticGitHubPages(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('v0.4.0');

  // Live Garak Market Catalog State (defaults to 12-month combined all_year so seasonal & summary-only items like 고수 are always included)
  const [catalogDate, setCatalogDate] = useState<string>(getTodayIsoKst);
  const [catalogMode, setCatalogMode] = useState<'all_year' | 'auction' | 'summary'>('all_year');
  const [liveCatalog, setLiveCatalog] = useState<GarakLiveResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Uploaded Excel Auction Records State (persisted locally across sessions for multi-period comparison)
  const [uploadedRecords, setUploadedRecords] = useState<AuctionRecord[]>(loadPersistedRecords);
  const [uploadedMetaLabel, setUploadedMetaLabel] = useState<string>(loadPersistedMeta);
  const [applyUploadedOverrides, setApplyUploadedOverrides] = useState(true);

  // Selected Crop & optional method for ROI Simulator / Origin Map deep link
  const [selectedRoiCropId, setSelectedRoiCropId] = useState<string>('chive');
  const [selectedRoiMethodKey, setSelectedRoiMethodKey] = useState<CultivationMethodKey | undefined>(
    undefined
  );
  const [originMapItemFilter, setOriginMapItemFilter] = useState<string | undefined>(undefined);

  const fetchLiveCatalog = useCallback(
    async (dateStr: string, mode: 'all_year' | 'auction' | 'summary') => {
      setCatalogLoading(true);
      setCatalogError(null);
      const fallbackSnapshot =
        mode === 'all_year'
          ? GARAK_SNAPSHOT_ALL_YEAR
          : mode === 'summary'
            ? GARAK_SNAPSHOT_SUMMARY
            : GARAK_SNAPSHOT_AUCTION;

      if (isStaticGitHubPages()) {
        setLiveCatalog(fallbackSnapshot);
        setCatalogLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          date: dateStr.replace(/-/g, '.'),
          mode,
        });
        const res = await fetch(`./api/garak/items?${params.toString()}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          // Static hosting returns HTML 404 for /api/* -> use verified Garak snapshot cleanly
          setLiveCatalog(fallbackSnapshot);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setLiveCatalog(data as GarakLiveResponse);
      } catch (err) {
        // Fall back to real Garak snapshot while informing the user transparently if a server error occurred
        setLiveCatalog((prev) => prev || fallbackSnapshot);
        const msg =
          err instanceof Error
            ? err.message
            : '가락시장 실시간 품목 조회 중 오류가 발생했습니다.';
        if (!/Failed to fetch|NetworkError/i.test(msg)) {
          setCatalogError(msg);
        }
      } finally {
        setCatalogLoading(false);
      }
    },
    []
  );

  // Fetch version & initial live Garak catalog on mount
  useEffect(() => {
    if (isStaticGitHubPages()) return;
    fetch('./api/version')
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((d) => {
        if (d?.version) setAppVersion(String(d.version));
      })
      .catch(() => {
        // Keep bundled version label on static hosting (GitHub Pages)
      });
  }, []);

  useEffect(() => {
    void fetchLiveCatalog(catalogDate, catalogMode);
  }, [catalogDate, catalogMode, fetchLiveCatalog]);

  // Unified Crop Universe: merges ALL curated profiles + ALL cultivable live Garak items + Excel-only items
  const cropUniverse = useMemo(
    () =>
      buildUnifiedCropUniverse({
        curatedCrops: ALL_CURATED_CROPS,
        liveItems: liveCatalog?.items || [],
        uploadedRecords,
      }),
    [liveCatalog, uploadedRecords]
  );

  const unifiedCrops = cropUniverse.crops;

  const uploadedOverrides = useMemo(
    () => buildUploadedCropPriceOverrides(uploadedRecords, unifiedCrops),
    [uploadedRecords, unifiedCrops]
  );

  const rankingsByKg = useMemo(
    () =>
      buildCropRankings({
        crops: unifiedCrops,
        granularity: 'year',
        selectedMonth: 11,
        selectedWeek: 46,
        unitBasis: 'kg',
        uploadedOverrides,
        applyUploadedOverrides,
      }),
    [unifiedCrops, uploadedOverrides, applyUploadedOverrides]
  );

  const rankingsByNative = useMemo(
    () =>
      buildCropRankings({
        crops: unifiedCrops,
        granularity: 'year',
        selectedMonth: 11,
        selectedWeek: 46,
        unitBasis: 'native',
        uploadedOverrides,
        applyUploadedOverrides,
      }),
    [unifiedCrops, uploadedOverrides, applyUploadedOverrides]
  );

  const rankingsByProfit = useMemo(() => {
    return [...rankingsByKg].sort(
      (a, b) => b.estimatedAnnualNetProfitPer10a - a.estimatedAnnualNetProfitPer10a
    );
  }, [rankingsByKg]);

  const supplyRiskSummary = useMemo(() => {
    const rows = evaluateCropSupplyRiskMatrix({
      crops: unifiedCrops,
      uploadedRecords,
      uploadedOverrides,
      applyUploadedOverrides,
    });
    let oversupplyCount = 0;
    let opportunityCount = 0;
    let stableCount = 0;
    for (const r of rows) {
      if (r.cobwebSignal === 'oversupply_warning') oversupplyCount += 1;
      else if (r.cobwebSignal === 'opportunity_tight') opportunityCount += 1;
      else if (r.cobwebSignal === 'stable_high_roi') stableCount += 1;
    }
    const top = rows[0];
    return {
      oversupplyCount,
      opportunityCount,
      stableCount,
      topResilientName: top ? top.crop.name : '-',
      topResilientMinus20Profit: top ? top.downsideMinus20NetProfit : 0,
    };
  }, [unifiedCrops, uploadedRecords, uploadedOverrides, applyUploadedOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (uploadedRecords.length === 0) {
        window.localStorage.removeItem(STORAGE_RECORDS_KEY);
        window.localStorage.removeItem(STORAGE_META_KEY);
      } else {
        window.localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(uploadedRecords));
        window.localStorage.setItem(STORAGE_META_KEY, uploadedMetaLabel);
      }
    } catch {
      // Ignore quota exceeded errors without crashing UI
    }
  }, [uploadedRecords, uploadedMetaLabel]);

  const handleInspectCropRoi = (cropId: string, methodKey?: CultivationMethodKey) => {
    setSelectedRoiCropId(cropId);
    setSelectedRoiMethodKey(methodKey);
    setActiveTab('roi');
  };

  const handleInspectCropOriginMap = (itemName: string) => {
    setOriginMapItemFilter(itemName);
    setActiveTab('origin_map');
  };

  const handleReplaceRecords = (records: AuctionRecord[], metaLabel: string) => {
    setUploadedRecords(records);
    setUploadedMetaLabel(metaLabel);
    setApplyUploadedOverrides(true);
  };

  const handleAppendRecords = (newRecords: AuctionRecord[], addedLabel: string) => {
    setUploadedRecords((prev) => {
      const seen = new Set(
        prev.map(
          (r) =>
            `${r.date}|${r.corporation}|${r.item}|${r.variety}|${r.unitRaw}|${r.grade}|${r.quantity}|${r.pricePerUnit}|${r.origin}`
        )
      );
      const uniqueAdded = newRecords.filter((r) => {
        const key = `${r.date}|${r.corporation}|${r.item}|${r.variety}|${r.unitRaw}|${r.grade}|${r.quantity}|${r.pricePerUnit}|${r.origin}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...prev, ...uniqueAdded];
    });
    setUploadedMetaLabel((prev) =>
      prev ? `${prev} + ${addedLabel}` : addedLabel
    );
    setApplyUploadedOverrides(true);
  };

  const handleClearRecords = () => {
    setUploadedRecords([]);
    setUploadedMetaLabel('');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        uploadedCount={uploadedRecords.length}
        liveItemCount={liveCatalog ? liveCatalog.itemCount : null}
        appVersion={appVersion}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenExcelUpload={() => setActiveTab('excel')}
          uploadedActive={applyUploadedOverrides && uploadedRecords.length > 0}
        />

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              rankingsByKg={rankingsByKg}
              rankingsByNative={rankingsByNative}
              rankingsByProfit={rankingsByProfit}
              liveCatalog={liveCatalog}
              analyzedCropCount={unifiedCrops.length}
              curatedCropCount={cropUniverse.curatedCount}
              inferredLiveCount={cropUniverse.inferredLiveCount}
              uploadedCount={uploadedRecords.length}
              applyUploadedOverrides={applyUploadedOverrides}
              supplyRiskSummary={supplyRiskSummary}
              onNavigate={setActiveTab}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogView
              liveCatalog={liveCatalog}
              loading={catalogLoading}
              error={catalogError}
              queryDate={catalogDate}
              queryMode={catalogMode}
              crops={unifiedCrops}
              liveItemToCropId={cropUniverse.liveItemToCropId}
              onChangeDate={setCatalogDate}
              onChangeMode={setCatalogMode}
              onRefresh={() => void fetchLiveCatalog(catalogDate, catalogMode)}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'ranking' && (
            <PriceRankingView
              crops={unifiedCrops}
              uploadedOverrides={uploadedOverrides}
              applyUploadedOverrides={applyUploadedOverrides}
              onToggleApplyOverrides={setApplyUploadedOverrides}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'supply_risk' && (
            <SupplyRiskView
              crops={unifiedCrops}
              uploadedRecords={uploadedRecords}
              uploadedOverrides={uploadedOverrides}
              applyUploadedOverrides={applyUploadedOverrides}
              onInspectCropRoi={handleInspectCropRoi}
              onInspectCropOriginMap={handleInspectCropOriginMap}
              onOpenExcelUpload={() => setActiveTab('excel')}
            />
          )}

          {activeTab === 'roi' && (
            <RoiSimulatorView
              crops={unifiedCrops}
              curatedCount={cropUniverse.curatedCount}
              inferredLiveCount={cropUniverse.inferredLiveCount}
              excelOnlyCount={cropUniverse.excelOnlyCount}
              selectedCropId={selectedRoiCropId}
              requestedMethodKey={selectedRoiMethodKey}
              onSelectCropId={(id, methodKey) => {
                setSelectedRoiCropId(id);
                setSelectedRoiMethodKey(methodKey);
              }}
              uploadedOverrides={uploadedOverrides}
              applyUploadedOverrides={applyUploadedOverrides}
            />
          )}

          {activeTab === 'origin_map' && (
            <OriginMapView
              uploadedRecords={uploadedRecords}
              uploadedMetaLabel={uploadedMetaLabel}
              crops={unifiedCrops}
              initialItemFilter={originMapItemFilter}
              onOpenExcelUpload={() => setActiveTab('excel')}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'excel' && (
            <ExcelAnalyzerView
              records={uploadedRecords}
              crops={unifiedCrops}
              applyUploadedOverrides={applyUploadedOverrides}
              onReplaceRecords={handleReplaceRecords}
              onAppendRecords={handleAppendRecords}
              onClearRecords={handleClearRecords}
              onToggleApplyOverrides={setApplyUploadedOverrides}
              onInspectCropRoi={handleInspectCropRoi}
              metaLabel={uploadedMetaLabel}
            />
          )}
        </main>
      </div>
    </div>
  );
}
