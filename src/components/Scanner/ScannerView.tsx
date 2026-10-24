import React, { useState } from 'react';
import {
  ScanLine,
  Keyboard,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { ProductForm } from '../ProductForm/ProductForm';
import type { ProductRecord, ProductCategory, AppSettings } from '../../types';
import { lookupProductByBarcode } from '../../services/productLookup';

interface ScannerViewProps {
  categories: ProductCategory[];
  settings: AppSettings;
  recentProducts: ProductRecord[];
  onSaveProduct: (
    product: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>,
    saveAndScanNext: boolean
  ) => Promise<void>;
  onEditProduct: (product: ProductRecord) => void;
  onViewExistingProduct?: (productId: string) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  categories,
  settings,
  recentProducts,
  onSaveProduct,
  onEditProduct,
  onViewExistingProduct,
}) => {
  // Mode: 'scanning' or 'editing'
  const [mode, setMode] = useState<'scanning' | 'editing'>('scanning');
  const [currentBarcode, setCurrentBarcode] = useState<string>('');
  const [lookupInitialProduct, setLookupInitialProduct] = useState<Partial<ProductRecord> | null>(null);
  const [lookupNotification, setLookupNotification] = useState<string | null>(null);

  // When a barcode is detected by the camera
  const handleBarcodeDetected = async (barcode: string) => {
    setCurrentBarcode(barcode);
    setLookupNotification(null);

    // Perform lookup against local catalogue & online API
    const lookupResult = await lookupProductByBarcode(barcode, settings.autoLookupOnline);

    if (lookupResult) {
      setLookupInitialProduct({
        barcode,
        brand: lookupResult.brand,
        productName: lookupResult.productName,
        sizeQuantity: lookupResult.sizeQuantity,
        variant: lookupResult.variant || '',
        category: lookupResult.category || (settings.rememberLastCategory ? settings.lastCategory : ''),
      });
      setLookupNotification(
        lookupResult.source === 'local-catalogue'
          ? `Auto-matched from Local Supermarket Catalogue!`
          : `Auto-matched from Open Food Facts API!`
      );
    } else {
      setLookupInitialProduct({
        barcode,
        category: settings.rememberLastCategory ? settings.lastCategory : '',
        brand: settings.rememberBrand ? settings.lastBrand : '',
      });
    }

    // Move to form
    setMode('editing');
  };

  // Manual entry clicked
  const handleManualEntry = () => {
    setCurrentBarcode('');
    setLookupInitialProduct({
      category: settings.rememberLastCategory ? settings.lastCategory : '',
      brand: settings.rememberBrand ? settings.lastBrand : '',
    });
    setLookupNotification(null);
    setMode('editing');
  };

  // Save product from form
  const handleFormSave = async (
    product: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>,
    saveAndScanNext: boolean
  ) => {
    await onSaveProduct(product, saveAndScanNext);

    if (saveAndScanNext) {
      // Instantly reset and return to scanner for continuous high-speed scanning
      setCurrentBarcode('');
      setLookupInitialProduct(null);
      setLookupNotification(null);
      setMode('scanning');
    } else {
      // Return to scanner
      setMode('scanning');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-xl mx-auto">
      {mode === 'scanning' ? (
        <div className="space-y-4">
          {/* Scanner Header Guidance */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ScanLine className="w-5 h-5 text-sky-500" />
                <span>Barcode Scanner</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Point smartphone rear camera at EAN/UPC product barcode.
              </p>
            </div>

            <button
              onClick={handleManualEntry}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <Keyboard className="w-3.5 h-3.5 text-sky-500" />
              <span>Manual Entry</span>
            </button>
          </div>

          {/* Camera Scanner Component */}
          <BarcodeScanner
            onScanSuccess={handleBarcodeDetected}
            onManualEntryClick={handleManualEntry}
          />

          {/* Bulk Workflow Tips Banner */}
          <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-sky-800 dark:text-sky-300">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold">High-Volume Tip:</strong> Use the{' '}
              <strong className="underline">Save & Scan Next</strong> button after verifying details to immediately jump back to the camera without extra clicks.
            </div>
          </div>

          {/* Recently Captured Carousel / Feed in Scanner */}
          {recentProducts.length > 0 && (
            <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  <span>Recent Scans During This Session</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {recentProducts.length} items
                </span>
              </div>

              <div className="space-y-2">
                {recentProducts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onEditProduct(p)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {p.brand} {p.productName}
                      </span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">
                        ({p.sizeQuantity})
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-mono text-[10px] text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {p.barcode ? p.barcode.slice(-6) : 'Manual'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lookup Match Notification */}
          {lookupNotification && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lookupNotification}</span>
            </div>
          )}

          {/* Product Entry Form */}
          <ProductForm
            initialBarcode={currentBarcode}
            initialProduct={lookupInitialProduct as ProductRecord | null}
            categories={categories}
            rememberCategory={settings.rememberLastCategory}
            lastCategory={settings.lastCategory}
            rememberBrand={settings.rememberBrand}
            lastBrand={settings.lastBrand}
            onSave={handleFormSave}
            onCancel={() => setMode('scanning')}
            onViewExisting={onViewExistingProduct}
          />
        </div>
      )}
    </div>
  );
};
