import {
  BarChart3,
  Calculator,
  FileSpreadsheet,
  LayoutDashboard,
  ListTree,
  MapPin,
  TrendingUp,
  X,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'catalog'
  | 'ranking'
  | 'supply_risk'
  | 'roi'
  | 'origin_map'
  | 'excel';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  uploadedCount: number;
  liveItemCount: number | null;
  appVersion: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: 'overview',
    label: '대시보드 요약',
    description: '핵심 단가 · 수익성 비교',
    icon: LayoutDashboard,
  },
  {
    id: 'catalog',
    label: '전체 품목 · 단위',
    description: '가락시장 실시간 품목 조회',
    icon: ListTree,
  },
  {
    id: 'ranking',
    label: '기간별 단가 순위',
    description: '년·월·주 / kg·고유단위',
    icon: BarChart3,
  },
  {
    id: 'supply_risk',
    label: '수급 추세 · 리스크',
    description: '년간 물량 · 내년 가격 경보',
    icon: TrendingUp,
  },
  {
    id: 'roi',
    label: '재배 · 1년 수지타산',
    description: '재배주기 · ROI 시뮬레이터',
    icon: Calculator,
  },
  {
    id: 'origin_map',
    label: '출하지 현황 지도',
    description: '대한민국 지역별 경매 분포',
    icon: MapPin,
  },
  {
    id: 'excel',
    label: '경매결과 엑셀 분석',
    description: 'XLS 업로드 · 실측 반영',
    icon: FileSpreadsheet,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  uploadedCount,
  liveItemCount,
  appVersion,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectTab('overview');
            onCloseMobile();
          }}
          className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 rounded"
        >
          <span className="block text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            가락시장 수익분석
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="메뉴 닫기"
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="주 메뉴" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  isActive ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 truncate">{item.label}</span>
                <span className="block text-xs text-slate-500 font-normal truncate mt-0.5">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center justify-between">
          <span>실시간 품목</span>
          <span className="font-num text-slate-700 font-medium">
            {liveItemCount !== null ? `${liveItemCount}개` : '대기'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>업로드 경매건수</span>
          <span className="font-num text-slate-700 font-medium">
            {uploadedCount.toLocaleString('ko-KR')}건
          </span>
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400">
          <span>가락시장 분석기</span>
          <span className="font-num">{appVersion}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{navContent}</div>
        </div>
      )}
    </>
  );
}
