import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase, DEFAULT_SETTINGS, PREDEFINED_CATEGORIES } from './db';
import type { ProductRecord, ProductCategory, AppSettings } from './types';
import { Navbar } from './components/Navigation/Navbar';
import { BottomNav, type ActiveTab } from './components/Navigation/BottomNav';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ScannerView } from './components/Scanner/ScannerView';
import { ProductList } from './components/Records/ProductList';
import { CategoryManager } from './components/Categories/CategoryManager';
import { ExportModal } from './components/Export/ExportModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { EditProductModal } from './components/Records/EditProductModal';
import { DeleteProductModal } from './components/Records/DeleteProductModal';

export const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRecord | null>(null);

  // Network Online Status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Initialize DB on mount
  useEffect(() => {
    initializeDatabase();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live queries from Dexie IndexedDB
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const settingsRecord = useLiveQuery(() => db.settings.get('global-settings'), []);
  const settings: AppSettings = settingsRecord || DEFAULT_SETTINGS;

  // Dark Mode Management
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      setIsDarkMode(true);
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        setIsDarkMode(true);
      } else {
        root.classList.remove('dark');
        setIsDarkMode(false);
      }
    }
  }, [settings.theme]);

  // Toggle Theme
  const handleToggleTheme = async () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    await db.settings.update(settings.id, { theme: nextTheme });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setActiveTab('scan');
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setActiveTab('records');
      } else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save new product record
  const handleSaveProduct = async (
    productData: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>,
    _saveAndScanNext: boolean
  ) => {
    const now = new Date().toISOString();
    const newRecord: ProductRecord = {
      ...productData,
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    await db.products.add(newRecord);

    // Update settings with last category/brand if remember settings are enabled
    const updates: Partial<AppSettings> = {};
    if (settings.rememberLastCategory && productData.category) {
      updates.lastCategory = productData.category;
    }
    if (settings.rememberBrand && productData.brand) {
      updates.lastBrand = productData.brand;
    }
    if (Object.keys(updates).length > 0) {
      await db.settings.update(settings.id, updates);
    }
  };

  // Update existing product record
  const handleUpdateProduct = async (
    productData: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!editingProduct) return;
    const now = new Date().toISOString();
    await db.products.update(editingProduct.id, {
      ...productData,
      updatedAt: now,
    });
    setEditingProduct(null);
  };

  // Delete product
  const handleDeleteProduct = async (product: ProductRecord) => {
    await db.products.delete(product.id);
    setDeletingProduct(null);
  };

  // Batch delete products
  const handleBatchDelete = async (ids: string[]) => {
    await db.products.bulkDelete(ids);
  };

  // Category Actions
  const handleAddCategory = async (name: string) => {
    const newCat: ProductCategory = {
      id: `cat-${Date.now()}`,
      name,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await db.categories.add(newCat);
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const cat = await db.categories.where('name').equals(oldName).first();
    if (cat) {
      await db.categories.update(cat.id, { name: newName });
    }
    // Update all existing products tagged with the old category name!
    const matchingProducts = await db.products.where('category').equals(oldName).toArray();
    for (const p of matchingProducts) {
      await db.products.update(p.id, { category: newName, updatedAt: new Date().toISOString() });
    }
  };

  const handleDeleteCategory = async (cat: ProductCategory) => {
    await db.categories.delete(cat.id);
    // Reassign affected products to 'Other'
    const matching = await db.products.where('category').equals(cat.name).toArray();
    for (const p of matching) {
      await db.products.update(p.id, { category: 'Other', updatedAt: new Date().toISOString() });
    }
  };

  const handleResetDefaultCategories = async () => {
    await db.categories.clear();
    const defaults: ProductCategory[] = PREDEFINED_CATEGORIES.map((cat, idx) => ({
      id: `cat-${idx + 1}`,
      name: cat,
      isDefault: true,
      createdAt: new Date().toISOString(),
    }));
    await db.categories.bulkAdd(defaults);
  };

  // Settings Actions
  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    await db.settings.update(settings.id, newSettings);
  };

  const handleLoadDemoData = async (demoProducts: ProductRecord[]) => {
    await db.products.bulkAdd(demoProducts);
  };

  const handleClearAllData = async () => {
    await db.products.clear();
  };

  const handleRestoreBackup = async (restoredProducts: ProductRecord[]) => {
    await db.products.bulkPut(restoredProducts);
  };

  // Find product by id to view/edit from duplicate alert
  const handleViewExistingProduct = useCallback(
    async (productId: string) => {
      const prod = await db.products.get(productId);
      if (prod) {
        setEditingProduct(prod);
      }
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        isOnline={isOnline}
        totalProducts={products.length}
        targetCount={settings.targetCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onToggleTheme={handleToggleTheme}
        isDarkMode={isDarkMode}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 pb-24">
        {activeTab === 'dashboard' && (
          <Dashboard
            products={products}
            targetCount={settings.targetCount}
            onStartScanning={() => setActiveTab('scan')}
            onManualEntry={() => setActiveTab('scan')}
            onOpenExport={() => setIsExportOpen(true)}
            onEditProduct={(p) => setEditingProduct(p)}
            onDeleteProduct={(p) => setDeletingProduct(p)}
            onViewAllRecords={() => setActiveTab('records')}
          />
        )}

        {activeTab === 'scan' && (
          <ScannerView
            categories={categories}
            settings={settings}
            recentProducts={products}
            onSaveProduct={handleSaveProduct}
            onEditProduct={(p) => setEditingProduct(p)}
            onViewExistingProduct={handleViewExistingProduct}
          />
        )}

        {activeTab === 'records' && (
          <ProductList
            products={products}
            categories={categories}
            onEdit={(p) => setEditingProduct(p)}
            onDelete={(p) => setDeletingProduct(p)}
            onBatchDelete={handleBatchDelete}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'categories' && (
          <CategoryManager
            categories={categories}
            products={products}
            onAddCategory={handleAddCategory}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onResetDefaults={handleResetDefaultCategories}
          />
        )}
      </main>

      {/* Bottom Navigation for Mobile Devices */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenExport={() => setIsExportOpen(true)}
        productCount={products.length}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        products={products}
        categories={categories}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onLoadDemoData={handleLoadDemoData}
        onClearAllData={handleClearAllData}
        onRestoreBackup={handleRestoreBackup}
        currentProducts={products}
      />

      {/* Edit Record Modal */}
      <EditProductModal
        product={editingProduct}
        categories={categories}
        onSave={handleUpdateProduct}
        onClose={() => setEditingProduct(null)}
      />

      {/* Delete Record Confirmation Modal */}
      <DeleteProductModal
        product={deletingProduct}
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
};

export default App;
