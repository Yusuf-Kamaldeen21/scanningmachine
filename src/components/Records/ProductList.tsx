import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Edit3,
  Calendar,
  Layers,
  ArrowUpDown,
  Barcode,
  CheckSquare,
  Square,
  FileSpreadsheet,
  AlertTriangle,
  Copy,
  Target,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  ClipboardCopy,
  X,
} from 'lucide-react';
import type { ProductRecord, ProductCategory } from '../../types';
import { generateTSV, copyTextToClipboard } from '../../services/exportService';
import { identifyDuplicateBarcodes } from '../../services/duplicateService';

interface ProductListProps {
  products: ProductRecord[];
  categories: ProductCategory[];
  targetCount?: number;
  onEdit: (product: ProductRecord) => void;
  onDelete: (product: ProductRecord) => void;
  onBatchDelete: (ids: string[]) => void;
  onOpenExport: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  targetCount = 1000,
  onEdit,
  onDelete,
  onBatchDelete,
  onOpenExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [barcodeFilter, setBarcodeFilter] = useState<'all' | 'with-barcode' | 'without-barcode'>('all');
  const [completenessFilter, setCompletenessFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [duplicateFilter, setDuplicateFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'brand-asc' | 'name-asc'>('date-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Copy & Clipboard Status
  const [copySuccessToast, setCopySuccessToast] = useState<string | null>(null);
  const [clipboardFallbackText, setClipboardFallbackText] = useState<string | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);

  // Auditing Metrics
  const duplicatesMap = useMemo(() => identifyDuplicateBarcodes(products), [products]);
  const duplicateBarcodesSet = useMemo(() => new Set(duplicatesMap.keys()), [duplicatesMap]);

  const auditStats = useMemo(() => {
    let completeCount = 0;
    let incompleteCount = 0;

    for (const p of products) {
      const isComplete =
        Boolean(p.brand?.trim()) &&
        Boolean(p.productName?.trim()) &&
        Boolean(p.sizeQuantity?.trim()) &&
        Boolean(p.variant?.trim()) &&
        Boolean(p.category?.trim());

      if (isComplete) completeCount++;
      else incompleteCount++;
    }

    let dupRecordCount = 0;
    duplicatesMap.forEach((group) => {
      dupRecordCount += group.length;
    });

    return {
      total: products.length,
      complete: completeCount,
      incomplete: incompleteCount,
      duplicates: dupRecordCount,
    };
  }, [products, duplicatesMap]);

  // Target progress
  const progressPercent = Math.min(100, Math.round((products.length / targetCount) * 100));

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search term matching
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matches =
            p.brand.toLowerCase().includes(term) ||
            p.productName.toLowerCase().includes(term) ||
            (p.variant || '').toLowerCase().includes(term) ||
            (p.colour || '').toLowerCase().includes(term) ||
            (p.barcode || '').toLowerCase().includes(term) ||
            (p.notes || '').toLowerCase().includes(term);
          if (!matches) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && p.category !== selectedCategory) {
          return false;
        }

        // Barcode filter
        if (barcodeFilter === 'with-barcode' && (!p.barcode || p.barcode.trim() === '')) {
          return false;
        }
        if (barcodeFilter === 'without-barcode' && p.barcode && p.barcode.trim() !== '') {
          return false;
        }

        // Completeness filter
        if (completenessFilter === 'complete') {
          const isComplete =
            Boolean(p.brand?.trim()) &&
            Boolean(p.productName?.trim()) &&
            Boolean(p.sizeQuantity?.trim()) &&
            Boolean(p.variant?.trim()) &&
            Boolean(p.category?.trim());
          if (!isComplete) return false;
        }
        if (completenessFilter === 'incomplete') {
          const isComplete =
            Boolean(p.brand?.trim()) &&
            Boolean(p.productName?.trim()) &&
            Boolean(p.sizeQuantity?.trim()) &&
            Boolean(p.variant?.trim()) &&
            Boolean(p.category?.trim());
          if (isComplete) return false;
        }

        // Duplicate filter
        if (duplicateFilter) {
          if (!p.barcode || !duplicateBarcodesSet.has(p.barcode.trim())) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'brand-asc') {
          return a.brand.localeCompare(b.brand);
        }
        if (sortBy === 'name-asc') {
          return a.productName.localeCompare(b.productName);
        }
        return 0;
      });
  }, [products, searchTerm, selectedCategory, barcodeFilter, completenessFilter, duplicateFilter, duplicateBarcodesSet, sortBy]);

  // Paginated records
  const paginatedProducts = useMemo(() => {
    if (pageSize >= filteredProducts.length) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;

  // Handle Select All
  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  // Toggle Single Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Batch delete confirm
  const handleConfirmBatchDelete = () => {
    onBatchDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirmModal(false);
  };

  // TSV Clipboard Copy Action
  const handleExecuteCopy = async (
    targetItems: ProductRecord[],
    options: { includeHeader?: boolean; namesOnly?: boolean } = { includeHeader: true, namesOnly: false },
    label = 'products'
  ) => {
    setShowCopyMenu(false);
    if (targetItems.length === 0) {
      alert('No product records available to copy.');
      return;
    }

    const tsvContent = generateTSV(targetItems, options);
    const success = await copyTextToClipboard(tsvContent);

    if (success) {
      setCopySuccessToast(`${targetItems.length} ${label} copied to clipboard (TSV format). Ready to paste into Excel or Sheets.`);
      setTimeout(() => setCopySuccessToast(null), 4000);
    } else {
      // Browser blocked clipboard: show fallback modal with textarea
      setClipboardFallbackText(tsvContent);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Clipboard Success Toast */}
      {copySuccessToast && (
        <div className="fixed top-18 inset-x-4 max-w-md mx-auto z-50 bg-emerald-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/60 backdrop-blur flex items-center space-x-2 text-xs animate-in slide-in-from-top">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copySuccessToast}</span>
        </div>
      )}

      {/* Clipboard Permission Fallback Modal */}
      {clipboardFallbackText && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ClipboardCopy className="w-4 h-4 text-sky-500" />
                <span>Manual Copy Required</span>
              </h4>
              <button
                onClick={() => setClipboardFallbackText(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Browser permissions prevented automatic clipboard access. Click below to copy:
            </p>
            <textarea
              readOnly
              value={clipboardFallbackText}
              onFocus={(e) => e.target.select()}
              className="w-full h-44 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(clipboardFallbackText);
                  setClipboardFallbackText(null);
                  setCopySuccessToast('Copied to clipboard!');
                  setTimeout(() => setCopySuccessToast(null), 3000);
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition"
              >
                Select & Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Progress & Quick Stats Card */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Bulk Supermarket Registration Progress
              </span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {products.length.toLocaleString()} / {targetCount.toLocaleString()} products registered ({progressPercent}%)
              </div>
            </div>
          </div>

          {/* Prominent COPY ALL PRODUCTS (TSV) Button */}
          <div className="relative flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => handleExecuteCopy(products, { includeHeader: true }, 'products')}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition hover:scale-[1.02] active:scale-[0.98]"
              title="Copy all products as clean Tab-Separated Values (TSV) ready to paste into Excel or Google Sheets"
            >
              <Copy className="w-4 h-4" />
              <span>Copy All Products (TSV)</span>
            </button>

            {/* Additional Copy Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCopyMenu(!showCopyMenu)}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition"
                title="More copy options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showCopyMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-1.5 z-30 text-xs animate-in fade-in zoom-in-95">
                  <button
                    onClick={() =>
                      handleExecuteCopy(
                        selectedIds.size > 0
                          ? products.filter((p) => selectedIds.has(p.id))
                          : filteredProducts,
                        { includeHeader: true },
                        selectedIds.size > 0 ? 'selected products' : 'filtered products'
                      )
                    }
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  >
                    {selectedIds.size > 0
                      ? `Copy Selected (${selectedIds.size} items)`
                      : `Copy Filtered (${filteredProducts.length} items)`}
                  </button>

                  <button
                    onClick={() => handleExecuteCopy(filteredProducts, { includeHeader: false }, 'records')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  >
                    Copy Without Header
                  </button>

                  <button
                    onClick={() => handleExecuteCopy(filteredProducts, { namesOnly: true }, 'names')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  >
                    Copy Product Names Only
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                  <button
                    onClick={() => {
                      setShowCopyMenu(false);
                      onOpenExport();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sky-600 dark:text-sky-400 flex items-center space-x-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download Excel / CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Audit Metric Badges */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Total</span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">{auditStats.total}</div>
          </div>

          <div
            onClick={() => setCompletenessFilter(completenessFilter === 'complete' ? 'all' : 'complete')}
            className={`p-2 rounded-xl border cursor-pointer transition ${
              completenessFilter === 'complete'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Complete</span>
            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{auditStats.complete}</div>
          </div>

          <div
            onClick={() => setCompletenessFilter(completenessFilter === 'incomplete' ? 'all' : 'incomplete')}
            className={`p-2 rounded-xl border cursor-pointer transition ${
              completenessFilter === 'incomplete'
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Incomplete</span>
            <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{auditStats.incomplete}</div>
          </div>

          <div
            onClick={() => setDuplicateFilter(!duplicateFilter)}
            className={`p-2 rounded-xl border cursor-pointer transition ${
              duplicateFilter
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Duplicates</span>
            <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{auditStats.duplicates}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by brand, name, variant, colour, barcode..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Export Modal Trigger */}
          <button
            onClick={onOpenExport}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-semibold hover:bg-sky-100 dark:hover:bg-sky-900/40 transition shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export ({filteredProducts.length})</span>
          </button>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Barcode Filter */}
          <div className="flex items-center space-x-1.5">
            <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={barcodeFilter}
              onChange={(e) => {
                setBarcodeFilter(e.target.value as 'all' | 'with-barcode' | 'without-barcode');
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Barcodes</option>
              <option value="with-barcode">With Barcode</option>
              <option value="without-barcode">Manual / None</option>
            </select>
          </div>

          {/* Completeness Filter */}
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={completenessFilter}
              onChange={(e) => {
                setCompletenessFilter(e.target.value as 'all' | 'complete' | 'incomplete');
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Status</option>
              <option value="complete">Complete Records</option>
              <option value="incomplete">Needs Review</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'date-asc' | 'brand-asc' | 'name-asc')}
              className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="brand-asc">Brand (A - Z)</option>
              <option value="name-asc">Product Name (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Selection Bar */}
        {selectedIds.size > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs animate-in fade-in">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {selectedIds.size} of {filteredProducts.length} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() =>
                  handleExecuteCopy(
                    products.filter((p) => selectedIds.has(p.id)),
                    { includeHeader: true },
                    'selected products'
                  )
                }
                className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Selected (TSV)</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Items: Desktop Responsive Table & Mobile Cards */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Barcode className="w-12 h-12 mx-auto stroke-[1.2] text-slate-400 dark:text-slate-600 mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No product records match your criteria</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {searchTerm || selectedCategory !== 'all' || barcodeFilter !== 'all' || duplicateFilter
              ? 'Try adjusting search keywords or resetting filters.'
              : 'Scan barcodes or snap packaging photos to begin collecting supermarket stock.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Table Header Controls */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition"
            >
              {selectedIds.size === filteredProducts.length ? (
                <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select All ({filteredProducts.length} items)</span>
            </button>

            {/* Page Size Selector */}
            <div className="flex items-center space-x-2 text-xs">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={10000}>All</option>
              </select>
            </div>
          </div>

          {/* DESKTOP TABLE VIEW (Visible on sm+ screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100/70 dark:bg-slate-800/80 uppercase font-bold text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">No.</th>
                  <th className="py-3 px-2 w-8"></th>
                  <th className="py-3 px-3">Brand</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">Size/Qty</th>
                  <th className="py-3 px-3">Variant</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3 font-mono">Barcode</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedProducts.map((p, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isSelected = selectedIds.has(p.id);
                  const isDuplicate = p.barcode && duplicateBarcodesSet.has(p.barcode.trim());

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                        isSelected ? 'bg-sky-50/60 dark:bg-sky-950/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                        {rowNumber}
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => toggleSelect(p.id)}
                          className="text-slate-400 hover:text-sky-500"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {p.brand}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {p.productName}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {p.sizeQuantity || <span className="text-amber-500 font-normal italic">Missing</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {p.variant ? (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-medium">
                            {p.variant}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {p.colour && p.colour !== 'N/A' ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
                            {p.colour}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {p.barcode ? (
                          <span className={isDuplicate ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                            {p.barcode}
                          </span>
                        ) : (
                          <span className="text-amber-500 italic">Manual</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {p.dateCaptured}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW (Visible on <md screens) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedProducts.map((p, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              const isSelected = selectedIds.has(p.id);
              const isDuplicate = p.barcode && duplicateBarcodesSet.has(p.barcode.trim());

              return (
                <div
                  key={p.id}
                  className={`p-4 flex items-start justify-between transition ${
                    isSelected ? 'bg-sky-50/60 dark:bg-sky-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0 pr-2">
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className="mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 mb-0.5">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          #{rowNumber}
                        </span>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {p.brand}
                        </span>
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
                          {p.productName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {p.sizeQuantity || 'No Size'}
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

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono text-[11px]">
                          {p.barcode ? (
                            <span className={isDuplicate ? 'text-rose-500 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                              {p.barcode}
                            </span>
                          ) : (
                            <span className="text-amber-500">No Barcode</span>
                          )}
                        </span>
                        <span className="flex items-center space-x-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{p.category}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{p.dateCaptured}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => onEdit(p)}
                      className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} items
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-900 dark:text-slate-100 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal for Batch Deletion */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Delete {selectedIds.size} Records?
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to permanently delete {selectedIds.size} selected supermarket product records? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmBatchDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
              >
                Yes, Delete Records
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
