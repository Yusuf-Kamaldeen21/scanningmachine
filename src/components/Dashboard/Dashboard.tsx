import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Package,
  CalendarCheck,
  AlertCircle,
  Barcode,
  Layers,
  ArrowRight,
  PlusCircle,
  ScanLine,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Clock,
  Sparkles,
  Target,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import type { ProductRecord } from '../../types';
import { generateTSV, copyTextToClipboard } from '../../services/exportService';

interface DashboardProps {
  products: ProductRecord[];
  targetCount: number;
  onStartScanning: () => void;
  onManualEntry: () => void;
  onOpenExport: () => void;
  onEditProduct: (product: ProductRecord) => void;
  onDeleteProduct: (product: ProductRecord) => void;
  onViewAllRecords: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  targetCount,
  onStartScanning,
  onManualEntry,
  onOpenExport,
  onEditProduct,
  onDeleteProduct,
  onViewAllRecords,
}) => {
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Compute metrics
  const totalProducts = products.length;
  const productsToday = products.filter((p) => p.dateCaptured === todayStr).length;

  // Products awaiting review (missing size, variant, or category)
  const awaitingCompletion = products.filter(
    (p) => !p.brand || !p.productName || !p.sizeQuantity || !p.category || !p.variant
  ).length;

  // Products without barcodes
  const withoutBarcodes = products.filter((p) => !p.barcode || p.barcode.trim() === '').length;

  // Duplicate barcodes count
  const barcodeMap = new Map<string, number>();
  products.forEach((p) => {
    if (p.barcode && p.barcode.trim()) {
      const code = p.barcode.trim();
      barcodeMap.set(code, (barcodeMap.get(code) || 0) + 1);
    }
  });
  let duplicateCount = 0;
  barcodeMap.forEach((count) => {
    if (count > 1) duplicateCount += count;
  });

  // Target progress
  const progressPercent = Math.min(100, Math.round((totalProducts / targetCount) * 100));

  // Trigger confetti if target reached
  const triggerCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Quick Copy All Products (TSV)
  const handleQuickCopyAll = async () => {
    if (products.length === 0) {
      alert('No products captured yet.');
      return;
    }
    const tsv = generateTSV(products, { includeHeader: true });
    const success = await copyTextToClipboard(tsv);
    if (success) {
      setCopiedToast(`${products.length} products copied to clipboard (TSV format).`);
      setTimeout(() => setCopiedToast(null), 3500);
    } else {
      onOpenExport();
    }
  };

  // Recent 6 products
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {copiedToast && (
        <div className="fixed top-18 inset-x-4 max-w-md mx-auto z-50 bg-emerald-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/60 backdrop-blur flex items-center space-x-2 text-xs animate-in slide-in-from-top">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* Hero / Quick Action Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>High-Speed Inventory Scanning & Bulk Capture</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            QuickStock Supermarket Capture
          </h2>
          <p className="mt-2 text-sm sm:text-base text-sky-100 leading-relaxed">
            Scan barcodes, recognize packaging text via OCR, organize variants & categories, and copy clean TSV sheets for spreadsheets.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              onClick={onStartScanning}
              className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-sky-700 font-bold text-sm shadow-md hover:bg-sky-50 active:scale-95 transition"
            >
              <ScanLine className="w-4 h-4 text-sky-600" />
              <span>Launch Camera Scanner</span>
            </button>

            <button
              onClick={handleQuickCopyAll}
              className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-md shadow-emerald-700/30 active:scale-95 transition"
              title="Copy all captured records directly into clipboard (TSV)"
            >
              <Copy className="w-4 h-4" />
              <span>Copy All (TSV)</span>
            </button>

            <button
              onClick={onManualEntry}
              className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Manual Entry</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Sheets</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
      </div>

      {/* Target Progress Bar */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Target className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Capture Progress Target
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
            {totalProducts.toLocaleString()} / {targetCount.toLocaleString()} products ({progressPercent}%)
          </span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-500 relative"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{Math.max(0, targetCount - totalProducts).toLocaleString()} items remaining</span>
          {progressPercent >= 100 && (
            <button
              onClick={triggerCelebration}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>🎉 Target Achieved! Celebrate</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {totalProducts}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Captured
            </div>
          </div>
        </div>

        {/* Captured Today */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {productsToday}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Captured Today
            </div>
          </div>
        </div>

        {/* Without Barcodes */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {withoutBarcodes}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No Barcodes
            </div>
          </div>
        </div>

        {/* Duplicate / Incomplete Warnings */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {duplicateCount > 0 ? duplicateCount : awaitingCompletion}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {duplicateCount > 0 ? 'Duplicate Codes' : 'Needs Review'}
            </div>
          </div>
        </div>
      </div>

      {/* Recently Captured Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Recently Captured Products
            </h3>
          </div>

          <button
            onClick={onViewAllRecords}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center space-x-1"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500">
            <Package className="w-12 h-12 mx-auto stroke-[1.2] mb-2 opacity-50" />
            <p className="text-sm font-medium">No products captured yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Tap "Launch Camera Scanner" to begin collecting supermarket stock.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentProducts.map((p) => (
              <div
                key={p.id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {p.brand} {p.productName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {p.sizeQuantity}
                    </span>
                    {p.variant && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                        {p.variant}
                      </span>
                    )}
                    {p.colour && p.colour !== 'N/A' && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                        {p.colour}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                      {p.barcode || 'No Barcode'}
                    </span>
                    <span className="flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>{p.category || 'General'}</span>
                    </span>
                    <span>{p.dateCaptured}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onEditProduct(p)}
                    className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Edit Record"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteProduct(p)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
