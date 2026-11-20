import { FileSpreadsheet, Menu } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenExcelUpload: () => void;
  uploadedActive: boolean;
}

const BREADCRUMBS: Record<NavTab, { section: string; title: string }> = {
  overview: { section: '가락시장 분석', title: '대시보드 요약' },
  catalog: { section: '품목 탐색', title: '전체 품목 · 거래단위' },
  ranking: { section: '시세 분석', title: '년·월·주 단가 순위' },
  roi: { section: '수익성 분석', title: '재배주기 · 1년 수지타산' },
  excel: { section: '데이터 연동', title: '경매결과 엑셀 분석' },
};

export function TopBar({
  activeTab,
  onOpenMobileMenu,
  onOpenExcelUpload,
  uploadedActive,
}: TopBarProps) {
  const crumb = BREADCRUMBS[activeTab];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="메뉴 열기"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
            {crumb.section}
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-semibold text-slate-900 truncate">{crumb.title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {uploadedActive && (
          <span className="hidden md:inline text-xs text-emerald-700 font-medium whitespace-nowrap">
            엑셀 실측 단가 반영 중
          </span>
        )}
        <button
          type="button"
          onClick={onOpenExcelUpload}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>엑셀(.xls) 불러오기</span>
        </button>
      </div>
    </header>
  );
}
