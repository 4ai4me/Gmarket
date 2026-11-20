import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewView } from './components/OverviewView';
import { CatalogView } from './components/CatalogView';
import { PriceRankingView } from './components/PriceRankingView';
import { RoiSimulatorView } from './components/RoiSimulatorView';
import { ExcelAnalyzerView } from './components/ExcelAnalyzerView';
import { CROP_PROFILES } from './data/crops';
import type { AuctionRecord, GarakLiveResponse } from './types/garak';
import {
  buildCropRankings,
  buildUploadedCropPriceOverrides,
} from './utils/analytics';

function getTodayIsoKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('v0.0.1');

  // Live Garak Market Catalog State
  const [catalogDate, setCatalogDate] = useState<string>(getTodayIsoKst);
  const [catalogMode, setCatalogMode] = useState<'auction' | 'summary'>('auction');
  const [liveCatalog, setLiveCatalog] = useState<GarakLiveResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Uploaded Excel Auction Records State
  const [uploadedRecords, setUploadedRecords] = useState<AuctionRecord[]>([]);
  const [uploadedMetaLabel, setUploadedMetaLabel] = useState('');
  const [applyUploadedOverrides, setApplyUploadedOverrides] = useState(true);

  // Selected Crop for ROI Simulator
  const [selectedRoiCropId, setSelectedRoiCropId] = useState<string>('chive');

  const fetchLiveCatalog = useCallback(
    async (dateStr: string, mode: 'auction' | 'summary') => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const params = new URLSearchParams({
          date: dateStr.replace(/-/g, '.'),
          mode,
        });
        const res = await fetch(`/api/garak/items?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setLiveCatalog(data as GarakLiveResponse);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : '가락시장 실시간 품목 조회 중 오류가 발생했습니다.';
        setCatalogError(msg);
      } finally {
        setCatalogLoading(false);
      }
    },
    []
  );

  // Fetch version & initial live Garak catalog on mount
  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.version) setAppVersion(String(d.version));
      })
      .catch(() => {
        // Keep default version label if version endpoint fails
      });
  }, []);

  useEffect(() => {
    void fetchLiveCatalog(catalogDate, catalogMode);
  }, [catalogDate, catalogMode, fetchLiveCatalog]);

  const uploadedOverrides = useMemo(
    () => buildUploadedCropPriceOverrides(uploadedRecords, CROP_PROFILES),
    [uploadedRecords]
  );

  const rankingsByKg = useMemo(
    () =>
      buildCropRankings({
        crops: CROP_PROFILES,
        granularity: 'year',
        selectedMonth: 11,
        selectedWeek: 46,
        unitBasis: 'kg',
        uploadedOverrides,
        applyUploadedOverrides,
      }),
    [uploadedOverrides, applyUploadedOverrides]
  );

  const rankingsByNative = useMemo(
    () =>
      buildCropRankings({
        crops: CROP_PROFILES,
        granularity: 'year',
        selectedMonth: 11,
        selectedWeek: 46,
        unitBasis: 'native',
        uploadedOverrides,
        applyUploadedOverrides,
      }),
    [uploadedOverrides, applyUploadedOverrides]
  );

  const rankingsByProfit = useMemo(() => {
    return [...rankingsByKg].sort(
      (a, b) => b.estimatedAnnualNetProfitPer10a - a.estimatedAnnualNetProfitPer10a
    );
  }, [rankingsByKg]);

  const handleInspectCropRoi = (cropId: string) => {
    setSelectedRoiCropId(cropId);
    setActiveTab('roi');
  };

  const handleReplaceRecords = (records: AuctionRecord[], metaLabel: string) => {
    setUploadedRecords(records);
    setUploadedMetaLabel(metaLabel);
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
              uploadedCount={uploadedRecords.length}
              applyUploadedOverrides={applyUploadedOverrides}
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
              crops={CROP_PROFILES}
              onChangeDate={setCatalogDate}
              onChangeMode={setCatalogMode}
              onRefresh={() => void fetchLiveCatalog(catalogDate, catalogMode)}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'ranking' && (
            <PriceRankingView
              crops={CROP_PROFILES}
              uploadedOverrides={uploadedOverrides}
              applyUploadedOverrides={applyUploadedOverrides}
              onToggleApplyOverrides={setApplyUploadedOverrides}
              onInspectCropRoi={handleInspectCropRoi}
            />
          )}

          {activeTab === 'roi' && (
            <RoiSimulatorView
              crops={CROP_PROFILES}
              selectedCropId={selectedRoiCropId}
              onSelectCropId={setSelectedRoiCropId}
              uploadedOverrides={uploadedOverrides}
              applyUploadedOverrides={applyUploadedOverrides}
            />
          )}

          {activeTab === 'excel' && (
            <ExcelAnalyzerView
              records={uploadedRecords}
              applyUploadedOverrides={applyUploadedOverrides}
              onReplaceRecords={handleReplaceRecords}
              onClearRecords={handleClearRecords}
              onToggleApplyOverrides={setApplyUploadedOverrides}
              metaLabel={uploadedMetaLabel}
            />
          )}
        </main>
      </div>
    </div>
  );
}
