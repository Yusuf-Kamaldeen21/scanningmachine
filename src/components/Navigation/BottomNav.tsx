import React from 'react';
import {
  LayoutDashboard,
  ScanLine,
  Package,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'scan' | 'records' | 'categories';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenExport: () => void;
  productCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenExport,
  productCount,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-lg transition-colors">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around relative">
        {/* Dashboard Tab */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center w-14 h-full transition ${
            activeTab === 'dashboard'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        {/* Records Tab */}
        <button
          onClick={() => onTabChange('records')}
          className={`relative flex flex-col items-center justify-center w-14 h-full transition ${
            activeTab === 'records'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Package className="w-5 h-5 mb-1" />
            {productCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[9px] font-bold">
                {productCount > 99 ? '99+' : productCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Records</span>
        </button>

        {/* Center Elevated Scan Button */}
        <div className="relative -top-5 flex justify-center">
          <button
            onClick={() => onTabChange('scan')}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-sky-600/30 transition-all transform active:scale-95 ${
              activeTab === 'scan'
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 ring-4 ring-sky-200 dark:ring-sky-900 scale-105'
                : 'bg-gradient-to-tr from-sky-600 to-indigo-700 hover:scale-105'
            }`}
            title="Scan Product Barcode"
          >
            <ScanLine className="w-7 h-7" />
          </button>
        </div>

        {/* Categories Tab */}
        <button
          onClick={() => onTabChange('categories')}
          className={`flex flex-col items-center justify-center w-14 h-full transition ${
            activeTab === 'categories'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Categories</span>
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex flex-col items-center justify-center w-14 h-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <FileSpreadsheet className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Export</span>
        </button>
      </div>
    </nav>
  );
};
