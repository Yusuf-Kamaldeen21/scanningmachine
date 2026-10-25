import React, { useState, useRef } from 'react';
import {
  ScanLine,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Zap,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { ProductForm } from '../ProductForm/ProductForm';
import type { ProductRecord, ProductCategory, AppSettings } from '../../types';
import { lookupProductByBarcode } from '../../services/productLookup';
import { recognizePackagingText, type ParsedPackagingResult } from '../../services/ocrService';
import { playScanSuccessSound, playSaveSuccessSound } from '../../utils/feedback';

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
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onUndoLastSave?: (id: string) => Promise<void>;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  categories,
  settings,
  recentProducts,
  onSaveProduct,
  onEditProduct,
  onViewExistingProduct,
  onUpdateSettings,
  onUndoLastSave,
}) => {
  // Mode: 'scanning' or 'editing'
  const [viewMode, setViewMode] = useState<'scanning' | 'editing'>('scanning');
  const [currentBarcode, setCurrentBarcode] = useState<string>('');
  const [lookupInitialProduct, setLookupInitialProduct] = useState<Partial<ProductRecord> | null>(null);
  const [lookupNotification, setLookupNotification] = useState<string | null>(null);

  // Fast Scan vs Review Mode toggle
  const [scanMode, setScanMode] = useState<'fast' | 'review'>(settings.scanMode || 'review');

  // Fast scan auto-save toast state
  const [lastAutoSaved, setLastAutoSaved] = useState<{ id?: string; name: string } | null>(null);

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; text: string }>({ percent: 0, text: '' });
  const [latestOcrResult, setLatestOcrResult] = useState<ParsedPackagingResult | null>(null);
  const packagingFileInputRef = useRef<HTMLInputElement>(null);

  // Toggle Fast Scan Mode
  const handleToggleScanMode = (mode: 'fast' | 'review') => {
    setScanMode(mode);
    if (onUpdateSettings) {
      onUpdateSettings({ scanMode: mode });
    }
  };

  // When a barcode is detected by the scanner
  const handleBarcodeDetected = async (barcode: string) => {
    setCurrentBarcode(barcode);
    setLookupNotification(null);
    setLatestOcrResult(null);

    // 1. Perform lookup against local catalogue, cache, & online API
    const lookupResult = await lookupProductByBarcode(barcode, settings.autoLookupOnline);

    if (lookupResult) {
      const candidate: Partial<ProductRecord> = {
        barcode,
        brand: lookupResult.brand,
        productName: lookupResult.productName,
        sizeQuantity: lookupResult.sizeQuantity,
        variant: lookupResult.variant || '',
        colour: lookupResult.colour || 'N/A',
        category: lookupResult.category || (settings.rememberLastCategory ? settings.lastCategory : ''),
        fieldConfidence: lookupResult.confidence,
        source: lookupResult.source === 'open-food-facts' ? 'barcode-lookup' : 'barcode-lookup',
      };

      // FAST SCAN MODE: If data is sufficiently complete and verified, auto-save!
      const isCompleteAndVerified =
        lookupResult.brand &&
        lookupResult.productName &&
        lookupResult.sizeQuantity &&
        lookupResult.category &&
        (lookupResult.source === 'local-catalogue' || lookupResult.source === 'local-db');

      if (scanMode === 'fast' && isCompleteAndVerified) {
        const productToSave: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'> = {
          barcode,
          brand: lookupResult.brand,
          productName: lookupResult.productName,
          sizeQuantity: lookupResult.sizeQuantity,
          variant: lookupResult.variant || 'Original',
          colour: lookupResult.colour || 'N/A',
          category: lookupResult.category || 'Food & Groceries',
          dateCaptured: new Date().toISOString().slice(0, 10),
          notes: '',
          fieldConfidence: lookupResult.confidence,
          source: 'barcode-lookup',
        };

        await onSaveProduct(productToSave, true);
        playSaveSuccessSound();

        setLastAutoSaved({
          name: `${lookupResult.brand} ${lookupResult.productName} (${lookupResult.sizeQuantity})`,
        });

        // Hide toast after 4s
        setTimeout(() => {
          setLastAutoSaved(null);
        }, 4000);

        // Keep scanner in 'scanning' mode!
        return;
      }

      // Review Mode (or incomplete barcode) -> display form with proposed fields
      setLookupInitialProduct(candidate);
      setLookupNotification(
        lookupResult.source === 'local-catalogue'
          ? `Auto-matched from Local Supermarket Catalogue!`
          : lookupResult.source === 'local-db'
          ? `Auto-matched from Previously Captured Inventory!`
          : `Auto-matched from Open Food Facts API!`
      );
    } else {
      // Unrecognized barcode
      setLookupInitialProduct({
        barcode,
        category: settings.rememberLastCategory ? settings.lastCategory : '',
        brand: settings.rememberBrand ? settings.lastBrand : '',
        fieldConfidence: {
          barcode: 'verified',
          brand: 'needs-review',
          productName: 'needs-review',
          sizeQuantity: 'needs-review',
          variant: 'needs-review',
          colour: 'needs-review',
          category: 'needs-review',
        },
      });
    }

    // Move to review / editing form
    setViewMode('editing');
  };

  // Manual entry clicked
  const handleManualEntry = () => {
    setCurrentBarcode('');
    setLatestOcrResult(null);
    setLookupInitialProduct({
      category: settings.rememberLastCategory ? settings.lastCategory : '',
      brand: settings.rememberBrand ? settings.lastBrand : '',
      fieldConfidence: {
        brand: 'needs-review',
        productName: 'needs-review',
        sizeQuantity: 'needs-review',
        variant: 'needs-review',
        colour: 'needs-review',
        category: 'needs-review',
      },
    });
    setLookupNotification(null);
    setViewMode('editing');
  };

  // Trigger OCR analysis from packaging image
  const handleProcessPackagingImage = async (imageFileOrBlob: Blob) => {
    if (ocrLoading) return;
    setOcrLoading(true);
    setLookupNotification(null);
    setOcrProgress({ percent: 15, text: 'Reading packaging...' });

    try {
      const parsed: ParsedPackagingResult = await recognizePackagingText(
        imageFileOrBlob,
        (percent, text) => {
          setOcrProgress({ percent, text: text || 'Reading packaging...' });
        }
      );

      playScanSuccessSound();

      // Barcode: preserve existing verified barcode or take OCR barcode
      const effectiveBarcode = currentBarcode || parsed.barcode || '';
      if (!currentBarcode && parsed.barcode) {
        setCurrentBarcode(parsed.barcode);
      }

      const mergedProduct: Partial<ProductRecord> = {
        barcode: effectiveBarcode,
        brand: parsed.brand || lookupInitialProduct?.brand || '',
        productName: parsed.productName || lookupInitialProduct?.productName || '',
        sizeQuantity: parsed.sizeQuantity || lookupInitialProduct?.sizeQuantity || '',
        packQuantity: parsed.packQuantity || lookupInitialProduct?.packQuantity,
        variant: parsed.variant || lookupInitialProduct?.variant || '',
        colour: parsed.colour || lookupInitialProduct?.colour || '',
        category: parsed.category || lookupInitialProduct?.category || '',
        fieldConfidence: parsed.confidence,
        source: 'ocr',
      };

      setLookupInitialProduct(mergedProduct);
      setLatestOcrResult(parsed);
      setViewMode('editing');

      // Requirement 6: Show "Product details extracted — review highlighted fields"
      // only after successful form population!
      setLookupNotification('Product details extracted — review highlighted fields');
    } catch (err) {
      console.error('Packaging OCR failed:', err);
      setLookupNotification(null);
      alert('Could not extract clear text from the packaging image. Please enter details manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Save product from form
  const handleFormSave = async (
    product: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>,
    saveAndScanNext: boolean
  ) => {
    await onSaveProduct(product, saveAndScanNext);
    setLatestOcrResult(null);

    if (saveAndScanNext) {
      // Instantly reset and return to scanner for continuous high-speed scanning
      setCurrentBarcode('');
      setLookupInitialProduct(null);
      setLookupNotification(null);
      setViewMode('scanning');
    } else {
      setViewMode('scanning');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-xl mx-auto">
      {/* Hidden file input for packaging photo OCR */}
      <input
        ref={packagingFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={ocrLoading}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleProcessPackagingImage(file);
          }
          if (e.target) e.target.value = '';
        }}
      />

      {/* OCR Loading Dialog */}
      {ocrLoading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Reading packaging...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {ocrProgress.text || 'Reading packaging...'}
            </p>

            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-sky-500 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fast Scan Auto-Saved Toast */}
      {lastAutoSaved && (
        <div className="fixed top-18 inset-x-4 max-w-md mx-auto z-40 bg-emerald-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/60 backdrop-blur flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2 text-xs truncate pr-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              Auto-saved: <strong>{lastAutoSaved.name}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0 text-xs">
            {onUndoLastSave && lastAutoSaved.id && (
              <button
                onClick={() => onUndoLastSave(lastAutoSaved.id!)}
                className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-white font-medium flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {viewMode === 'scanning' ? (
        <div className="space-y-4">
          {/* Scanner Header & Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ScanLine className="w-5 h-5 text-sky-500" />
                <span>Supermarket Scanner</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Point smartphone rear camera at EAN/UPC barcode or snap packaging.
              </p>
            </div>

            {/* Fast Scan vs Review Mode Selector */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs self-stretch sm:self-auto">
              <button
                onClick={() => handleToggleScanMode('fast')}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                  scanMode === 'fast'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Fast Scan Mode: Automatically saves verified barcode matches to speed up inventory capture"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Fast Scan</span>
              </button>

              <button
                onClick={() => handleToggleScanMode('review')}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                  scanMode === 'review'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Review Mode: Inspect and edit extracted details before saving each product"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Review Mode</span>
              </button>
            </div>
          </div>

          {/* Camera Scanner Component */}
          <BarcodeScanner
            onScanSuccess={handleBarcodeDetected}
            onManualEntryClick={handleManualEntry}
            onCapturePackagingClick={handleProcessPackagingImage}
          />

          {/* Mode Guidance Banner */}
          <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl flex items-start space-x-2.5 text-xs text-sky-900 dark:text-sky-300">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {scanMode === 'fast' ? (
                <span>
                  <strong>Fast Scan Active:</strong> Known FMCG products will be saved instantly upon barcode detection. Unrecognized products will automatically open the review form.
                </span>
              ) : (
                <span>
                  <strong>Review Mode Active:</strong> You can review and adjust Brand, Size, Variant, and Category before saving every item.
                </span>
              )}
            </div>
          </div>

          {/* Recently Captured Carousel / Feed in Scanner */}
          {recentProducts.length > 0 && (
            <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  <span>Recent Scans in This Session</span>
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
                      {p.variant && (
                        <span className="ml-1.5 text-sky-600 dark:text-sky-400 font-medium">
                          • {p.variant}
                        </span>
                      )}
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
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lookupNotification}</span>
            </div>
          )}

          {/* Product Entry & Review Form */}
          <ProductForm
            initialBarcode={currentBarcode}
            initialProduct={lookupInitialProduct as ProductRecord | null}
            ocrResult={latestOcrResult}
            isProcessingOcr={ocrLoading}
            categories={categories}
            rememberCategory={settings.rememberLastCategory}
            lastCategory={settings.lastCategory}
            rememberBrand={settings.rememberBrand}
            lastBrand={settings.lastBrand}
            allProducts={recentProducts}
            onSave={handleFormSave}
            onCancel={() => {
              setLookupNotification(null);
              setLatestOcrResult(null);
              setViewMode('scanning');
            }}
            onViewExisting={onViewExistingProduct}
            onSnapPackaging={() => {
              if (!ocrLoading) {
                packagingFileInputRef.current?.click();
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
