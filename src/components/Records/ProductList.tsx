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
} from 'lucide-react';
import type { ProductRecord, ProductCategory } from '../../types';

interface ProductListProps {
  products: ProductRecord[];
  categories: ProductCategory[];
  onEdit: (product: ProductRecord) => void;
  onDelete: (product: ProductRecord) => void;
  onBatchDelete: (ids: string[]) => void;
  onOpenExport: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  onEdit,
  onDelete,
  onBatchDelete,
  onOpenExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [barcodeFilter, setBarcodeFilter] = useState<'all' | 'with-barcode' | 'without-barcode'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'brand-asc' | 'name-asc'>('date-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

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
  }, [products, searchTerm, selectedCategory, barcodeFilter, sortBy]);

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

  return (
    <div className="space-y-4 pb-16">
      {/* Search and Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by brand, product name, variant, or barcode..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Export Shortcut */}
          <button
            onClick={onOpenExport}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-semibold hover:bg-sky-100 dark:hover:bg-sky-900/40 transition shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export ({filteredProducts.length})</span>
          </button>
        </div>

        {/* Filter Pills Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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
              onChange={(e) => setBarcodeFilter(e.target.value as 'all' | 'with-barcode' | 'without-barcode')}
              className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Barcodes</option>
              <option value="with-barcode">With Barcode Only</option>
              <option value="without-barcode">Manual / No Barcode</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="col-span-2 sm:col-span-1 flex items-center space-x-1.5">
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
            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* Product Items: Desktop Table & Mobile Cards */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Barcode className="w-12 h-12 mx-auto stroke-[1.2] text-slate-400 dark:text-slate-600 mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No product records found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {searchTerm || selectedCategory !== 'all' || barcodeFilter !== 'all'
              ? 'Try adjusting your search query or filters.'
              : 'Start scanning or add products manually to populate this list.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Select all header */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
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
          </div>

          {/* List items (Mobile card layout on small screens, row layout on desktop) */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredProducts.map((p) => {
              const isSelected = selectedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`p-4 flex items-start sm:items-center justify-between transition ${
                    isSelected ? 'bg-sky-50/50 dark:bg-sky-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0 pr-3">
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className="mt-0.5 sm:mt-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {p.brand}
                        </span>
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                          {p.productName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {p.sizeQuantity}
                        </span>
                        {p.variant && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                            {p.variant}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono text-[11px] text-slate-800 dark:text-slate-300 font-medium">
                          {p.barcode ? `Barcode: ${p.barcode}` : '⚠️ No Barcode'}
                        </span>
                        <span className="flex items-center space-x-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{p.category}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{p.dateCaptured}</span>
                        </span>
                        {p.notes && (
                          <span className="italic text-slate-400 text-[11px]">
                            "{p.notes}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => onEdit(p)}
                      className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Batch Deletion */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Delete {selectedIds.size} Records?
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete {selectedIds.size} selected supermarket product records? This action cannot be undone.
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
