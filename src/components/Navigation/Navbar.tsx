import React from 'react';
import {
  Scan,
  Wifi,
  WifiOff,
  Settings,
  Sun,
  Moon,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import type { AppSettings } from '../../types';

interface NavbarProps {
  settings: AppSettings;
  isOnline: boolean;
  totalProducts: number;
  targetCount: number;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  totalProducts,
  targetCount,
  onOpenSettings,
  onOpenExport,
  onToggleTheme,
  isDarkMode,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-5xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-600/20">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                QuickStock
              </h1>
              <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Scanner
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
              Supermarket Inventory Capture
            </p>
          </div>
        </div>

        {/* Right Status Badges & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Target Progress Pill */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Target className="w-3.5 h-3.5 text-sky-500" />
            <span className="font-mono">
              {totalProducts}/{targetCount}
            </span>
          </div>

          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            }`}
            title={isOnline ? 'Online (Lookup & Cloud Active)' : 'Offline (IndexedDB Local Storage Active)'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-500" />
                <span className="hidden xs:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Export Quick Button */}
          <button
            onClick={onOpenExport}
            className="p-2 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Export Records (Excel/CSV)"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
