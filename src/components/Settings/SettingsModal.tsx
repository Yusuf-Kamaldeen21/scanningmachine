import React, { useRef, useState } from 'react';
import {
  Settings,
  X,
  Volume2,
  VolumeX,
  Vibrate,
  Moon,
  Sun,
  Laptop,
  Target,
  Sparkles,
  Trash2,
  CheckCircle2,
  Upload,
  Download,
  ShieldAlert,
} from 'lucide-react';
import type { AppSettings, ProductRecord } from '../../types';
import { SUPERMARKET_CATALOGUE } from '../../services/productLookup';
import { exportToJSON } from '../../services/exportService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onLoadDemoData: (demoProducts: ProductRecord[]) => Promise<void>;
  onClearAllData: () => Promise<void>;
  onRestoreBackup: (products: ProductRecord[]) => Promise<void>;
  currentProducts: ProductRecord[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onLoadDemoData,
  onClearAllData,
  onRestoreBackup,
  currentProducts,
}) => {
  const [targetInput, setTargetInput] = useState(settings.targetCount.toString());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveTarget = async () => {
    const val = parseInt(targetInput, 10);
    if (!isNaN(val) && val > 0) {
      await onUpdateSettings({ targetCount: val });
      setStatusMsg('Target quota updated!');
      setTimeout(() => setStatusMsg(null), 2000);
    }
  };

  const handleGenerateSampleData = async () => {
    const demoItems: ProductRecord[] = Object.values(SUPERMARKET_CATALOGUE).map((item, idx) => ({
      id: `demo-${idx + 1}-${Date.now()}`,
      brand: item.brand,
      productName: item.productName,
      sizeQuantity: item.sizeQuantity,
      variant: item.variant || '',
      barcode: item.barcode,
      category: item.category || 'Food & Groceries',
      dateCaptured: new Date().toISOString().slice(0, 10),
      notes: 'Demo item for testing',
      createdAt: new Date(Date.now() - idx * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await onLoadDemoData(demoItems);
    setStatusMsg(`Loaded ${demoItems.length} demo supermarket items!`);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleBackup = () => {
    exportToJSON(currentProducts);
    setStatusMsg('Database backup downloaded.');
    setTimeout(() => setStatusMsg(null), 2000);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.products && Array.isArray(json.products)) {
          await onRestoreBackup(json.products);
          setStatusMsg(`Restored ${json.products.length} products from backup!`);
          setTimeout(() => setStatusMsg(null), 2500);
        } else {
          alert('Invalid backup file format. Expected a QuickStock JSON export.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Application Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure scanning hardware feedback, preferences & local storage.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {/* Status Alert */}
          {statusMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* 1. Appearance / Theme */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Appearance Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 text-xs font-semibold transition ${
                  settings.theme === 'light'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 text-xs font-semibold transition ${
                  settings.theme === 'dark'
                    ? 'border-sky-500 bg-sky-950 text-sky-400 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'system' })}
                className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 text-xs font-semibold transition ${
                  settings.theme === 'system'
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* 2. Scanner Feedback */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Hardware Scanner Feedback
            </label>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div className="flex items-center space-x-2.5">
                  {settings.soundFeedback ? (
                    <Volume2 className="w-4 h-4 text-sky-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      Sound Feedback (Retail POS Beep)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Plays audio chime on successful scan & error tones on duplicates
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundFeedback}
                  onChange={(e) => onUpdateSettings({ soundFeedback: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div className="flex items-center space-x-2.5">
                  <Vibrate className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      Haptic Vibration
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Vibrates mobile device on barcode detection
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.vibrateFeedback}
                  onChange={(e) => onUpdateSettings({ vibrateFeedback: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* 3. Bulk Scanning Autofill Options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Bulk Capture Workflow Preferences
            </label>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    Remember Last Selected Category
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Automatically pre-selects previous category for subsequent scans
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.rememberLastCategory}
                  onChange={(e) => onUpdateSettings({ rememberLastCategory: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    Remember Brand for Same-Brand Batches
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Keeps the brand filled when capturing multiple flavours of same brand
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.rememberBrand}
                  onChange={(e) => onUpdateSettings({ rememberBrand: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* 4. Daily Target Quota */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-sky-500" />
              <span>Target Capture Goal</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="1000"
                min="1"
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleSaveTarget}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition"
              >
                Update Goal
              </button>
            </div>
          </div>

          {/* 5. Demo Data & Database Management */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Database Maintenance & Backup
            </label>

            <div className="space-y-2">
              {/* Load Demo Data */}
              <button
                type="button"
                onClick={handleGenerateSampleData}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition text-sky-800 dark:text-sky-300 text-xs font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  <span>Load Sample Supermarket Data (15 items)</span>
                </div>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-full">
                  Instant Test
                </span>
              </button>

              {/* JSON Backup & Restore */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBackup}
                  className="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5 text-sky-500" />
                  <span>Backup JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Restore Backup</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
              />

              {/* Clear All Records */}
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Product Records</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl max-w-xs w-full text-center border border-rose-300 dark:border-rose-800">
              <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Delete All Products?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
                This will wipe all {currentProducts.length} local product records from IndexedDB. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await onClearAllData();
                    setShowClearConfirm(false);
                    setStatusMsg('All records erased.');
                  }}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-500"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>QuickStock Scanner v1.0.0</span>
          <span>IndexedDB Persistent Storage</span>
        </div>
      </div>
    </div>
  );
};
