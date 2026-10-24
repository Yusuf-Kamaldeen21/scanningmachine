import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  Filter,
  Download,
  AlertCircle,
  Database,
} from 'lucide-react';
import type { ProductRecord, ProductCategory, ExportOptions } from '../../types';
import { exportToCSV, exportToExcel, exportToJSON, filterProductsForExport } from '../../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRecord[];
  categories: ProductCategory[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
}) => {
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');

  // Selected Fields
  const [fields, setFields] = useState<ExportOptions['fields']>({
    brand: true,
    productName: true,
    sizeQuantity: true,
    variant: true,
    barcode: true,
    category: true,
    dateCaptured: true,
    notes: true,
    id: false,
  });

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [filterIncompleteOnly, setFilterIncompleteOnly] = useState<boolean>(false);

  // Status message
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Options object
  const currentOptions: ExportOptions = {
    format,
    fields,
    filterCategory,
    filterDate,
    filterIncompleteOnly,
  };

  // Preview count of records matching current criteria
  const previewProducts = filterProductsForExport(products, currentOptions);

  const toggleField = (key: keyof ExportOptions['fields']) => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    setExportSuccess(null);
    setExportError(null);

    try {
      if (format === 'xlsx') {
        const result = exportToExcel(products, currentOptions);
        setExportSuccess(`Successfully generated ${result.filename} with ${result.count} product records.`);
      } else if (format === 'csv') {
        const result = exportToCSV(products, currentOptions);
        setExportSuccess(`Successfully generated ${result.filename} with ${result.count} product records.`);
      } else {
        const result = exportToJSON(products);
        setExportSuccess(`Exported JSON backup with ${result.count} product records.`);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  // Unique capture dates in products
  const captureDates = Array.from(new Set(products.map((p) => p.dateCaptured))).filter(Boolean).sort().reverse();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export Supermarket Records
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate clean, Excel-compatible sheets formatted for Moniebook.
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

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* 1. Format Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              1. Choose Export File Format
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition ${
                  format === 'xlsx'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-xs">Excel (.xlsx)</span>
                <span className="text-[10px] text-slate-400">Recommended</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition ${
                  format === 'csv'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span className="font-bold text-xs">CSV (.csv)</span>
                <span className="text-[10px] text-slate-400">Text Spreadsheet</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition ${
                  format === 'json'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Database className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-xs">Full JSON</span>
                <span className="text-[10px] text-slate-400">System Backup</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              💡 In both Excel and CSV, barcodes are strictly preserved as text so leading zeroes (e.g. 012345) are never lost.
            </p>
          </div>

          {/* 2. Choose Fields */}
          {format !== 'json' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  2. Select Columns to Include
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'brand', label: 'Brand (Required)' },
                  { key: 'productName', label: 'Product Name (Required)' },
                  { key: 'sizeQuantity', label: 'Size / Quantity' },
                  { key: 'variant', label: 'Variant' },
                  { key: 'barcode', label: 'Barcode' },
                  { key: 'category', label: 'Category' },
                  { key: 'dateCaptured', label: 'Date Captured' },
                  { key: 'notes', label: 'Notes' },
                  { key: 'id', label: 'Internal Record ID' },
                ].map(({ key, label }) => {
                  const fieldKey = key as keyof ExportOptions['fields'];
                  const isChecked = fields[fieldKey];
                  return (
                    <label
                      key={key}
                      className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer select-none transition ${
                        isChecked
                          ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleField(fieldKey)}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <span className="font-medium truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Filter Records */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-sky-500" />
              <span>3. Filter Export Records</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">
                  Category Filter
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Categories ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">
                  Date Captured Filter
                </label>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Dates</option>
                  {captureDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="mt-2.5 flex items-center space-x-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterIncompleteOnly}
                onChange={(e) => setFilterIncompleteOnly(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
              <span>Export only incomplete records (missing notes, variant, or category)</span>
            </label>
          </div>

          {/* Feedback banners */}
          {exportSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {exportError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{exportError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Exporting <strong className="text-slate-800 dark:text-slate-200">{previewProducts.length}</strong> of{' '}
            {products.length} products
          </div>

          <button
            onClick={handleExport}
            disabled={previewProducts.length === 0}
            className="flex items-center space-x-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition"
          >
            <Download className="w-4 h-4" />
            <span>Generate & Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
