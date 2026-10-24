import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Package,
  RotateCcw,
} from 'lucide-react';
import type { ProductCategory, ProductRecord } from '../../types';

interface CategoryManagerProps {
  categories: ProductCategory[];
  products: ProductRecord[];
  onAddCategory: (name: string) => Promise<void>;
  onRenameCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (category: ProductCategory) => Promise<void>;
  onResetDefaults: () => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  products,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onResetDefaults,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Compute product count per category
  const productCountMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category || 'Other';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [products]);

  // Handle Add Category
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = newCatName.trim();
    if (!clean) {
      setError('Category name cannot be empty.');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      setError('This category already exists.');
      return;
    }

    try {
      await onAddCategory(clean);
      setNewCatName('');
    } catch (err) {
      console.error(err);
      setError('Failed to add category.');
    }
  };

  // Start Rename
  const startRename = (cat: ProductCategory) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
    setError(null);
  };

  // Save Rename
  const saveRename = async (oldName: string) => {
    const clean = editingName.trim();
    if (!clean) {
      setError('Category name cannot be empty.');
      return;
    }
    if (clean === oldName) {
      setEditingCatId(null);
      return;
    }
    if (
      categories.some(
        (c) => c.name.toLowerCase() === clean.toLowerCase() && c.name !== oldName
      )
    ) {
      setError('A category with this name already exists.');
      return;
    }

    try {
      await onRenameCategory(oldName, clean);
      setEditingCatId(null);
      setEditingName('');
    } catch (err) {
      console.error(err);
      setError('Failed to rename category.');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header and Taxonomy Guidance */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2.5 mb-2">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Standardized Product Categories
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Maintaining consistent categories prevents database fragmentation and simplifies Moniebook imports.
            </p>
          </div>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAdd} className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Add new category (e.g. Pet Care, Bakery)..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
          <button
            type="submit"
            className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </form>

        {error && (
          <div className="mt-2.5 text-xs text-rose-500 flex items-center space-x-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Category List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
          <span>Registered Categories ({categories.length})</span>
          <button
            onClick={onResetDefaults}
            className="text-xs font-medium text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center space-x-1 lowercase first-letter:uppercase"
            title="Restore default category taxonomy"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restore Defaults</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {categories.map((cat) => {
            const count = productCountMap[cat.name] || 0;
            const isEditing = editingCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center space-x-2 mr-3">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-1 bg-white dark:bg-slate-800 border border-sky-500 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => saveRename(cat.name)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {cat.name}
                    </div>
                    {cat.isDefault && (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Predefined
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      count > 0
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <Package className="w-3 h-3" />
                    <span>{count} products</span>
                  </span>

                  {!isEditing && (
                    <div className="flex items-center space-x-0.5">
                      <button
                        onClick={() => startRename(cat)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Rename Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteCategory(cat)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
