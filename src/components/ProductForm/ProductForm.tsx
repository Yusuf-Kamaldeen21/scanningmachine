import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  ScanLine,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Palette,
  Camera,
  HelpCircle,
  Package,
  Loader2,
} from 'lucide-react';
import type { ProductRecord, ProductCategory, FieldConfidenceMap } from '../../types';
import type { ParsedPackagingResult } from '../../services/ocrService';
import { suggestCategory } from '../../services/categorySuggester';
import { checkForDuplicateProduct } from '../../services/duplicateService';
import { findRelatedVariants, splitSizeAndPackQuantity } from '../../services/variantDetector';
import { playSaveSuccessSound, playWarningSound } from '../../utils/feedback';

export interface ProductFormData {
  barcode: string;
  brand: string;
  productName: string;
  sizeQuantity: string;
  packQuantity?: string;
  variant: string;
  colour: string;
  category: string;
  dateCaptured: string;
  notes: string;
}

export interface ProductFormProps {
  initialBarcode?: string;
  initialProduct?: Partial<ProductRecord> | null;
  ocrResult?: ParsedPackagingResult | null;
  onOcrExtracted?: (extracted: ParsedPackagingResult) => void;
  onOcrApplied?: () => void;
  isProcessingOcr?: boolean;
  categories: ProductCategory[];
  rememberCategory?: boolean;
  lastCategory?: string;
  rememberBrand?: boolean;
  lastBrand?: string;
  allProducts?: ProductRecord[];
  onSave: (product: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>, saveAndScanNext: boolean) => Promise<void>;
  onCancel: () => void;
  onViewExisting?: (productId: string) => void;
  onSnapPackaging?: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialBarcode = '',
  initialProduct = null,
  ocrResult = null,
  onOcrExtracted,
  onOcrApplied,
  isProcessingOcr = false,
  categories,
  rememberCategory = false,
  lastCategory = 'Food & Groceries',
  rememberBrand = false,
  lastBrand = '',
  allProducts = [],
  onSave,
  onCancel,
  onViewExisting,
  onSnapPackaging,
}) => {
  // Controlled Form State
  const [formData, setFormData] = useState<ProductFormData>(() => ({
    barcode: initialProduct?.barcode || initialBarcode || '',
    brand: initialProduct?.brand || (rememberBrand ? lastBrand : ''),
    productName: initialProduct?.productName || '',
    sizeQuantity: initialProduct?.sizeQuantity || '',
    packQuantity: initialProduct?.packQuantity,
    variant: initialProduct?.variant || '',
    colour: initialProduct?.colour || '',
    category: initialProduct?.category || (rememberCategory && lastCategory ? lastCategory : ''),
    dateCaptured: initialProduct?.dateCaptured || new Date().toISOString().slice(0, 10),
    notes: initialProduct?.notes || '',
  }));

  // Confidence indicators per field
  const [fieldConfidence, setFieldConfidence] = useState<FieldConfidenceMap>(
    initialProduct?.fieldConfidence || {
      brand: initialProduct?.brand ? 'verified' : 'needs-review',
      productName: initialProduct?.productName ? 'suggested' : 'needs-review',
      sizeQuantity: initialProduct?.sizeQuantity ? 'verified' : 'needs-review',
      variant: initialProduct?.variant ? 'suggested' : 'needs-review',
      colour: initialProduct?.colour ? 'suggested' : 'needs-review',
      category: initialProduct?.category ? 'verified' : 'needs-review',
      barcode: initialBarcode || initialProduct?.barcode ? 'verified' : 'needs-review',
    }
  );

  // Validation & Duplicate State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null);

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    existingProduct?: ProductRecord;
    reason?: string;
  }>({ show: false });

  // Refs for auto-focusing first missing/uncertain field
  const brandInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);
  const variantInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Focus the first missing required or reviewable field
  const focusFirstMissingField = useCallback((currentData?: ProductFormData) => {
    const data = currentData || formData;
    setTimeout(() => {
      if (!data.barcode && barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      } else if (!data.brand && brandInputRef.current) {
        brandInputRef.current.focus();
      } else if (!data.productName && nameInputRef.current) {
        nameInputRef.current.focus();
      } else if (!data.sizeQuantity && sizeInputRef.current) {
        sizeInputRef.current.focus();
      } else if (!data.variant && variantInputRef.current) {
        variantInputRef.current.focus();
      }
    }, 150);
  }, [formData]);

  // Shared form-state update pattern: merges extracted OCR fields into active form state
  const applyExtractedData = useCallback(
    (extracted: Partial<ParsedPackagingResult | ProductRecord>) => {
      let updatedData: ProductFormData | null = null;

      setFormData((previous) => {
        const nextBarcode = previous.barcode || extracted.barcode || '';
        const nextBrand = extracted.brand || previous.brand;
        const nextProductName = extracted.productName || previous.productName;
        const nextSizeQuantity = extracted.sizeQuantity || previous.sizeQuantity;
        const nextPackQuantity = extracted.packQuantity || previous.packQuantity;
        const nextVariant = extracted.variant || previous.variant;
        const nextColour = extracted.colour || previous.colour;
        const nextCategory = extracted.category || previous.category;
        const nextDateCaptured = extracted.dateCaptured || previous.dateCaptured;
        const nextNotes = extracted.notes || previous.notes;

        updatedData = {
          ...previous,
          barcode: nextBarcode,
          brand: nextBrand,
          productName: nextProductName,
          sizeQuantity: nextSizeQuantity,
          packQuantity: nextPackQuantity,
          variant: nextVariant,
          colour: nextColour,
          category: nextCategory,
          dateCaptured: nextDateCaptured,
          notes: nextNotes,
        };

        return updatedData;
      });

      // Update field confidence: preserve verified fields, update extracted fields
      setFieldConfidence((prev) => {
        const updated = { ...prev };
        const confSource =
          ('confidence' in extracted ? extracted.confidence : undefined) ||
          ('fieldConfidence' in extracted ? extracted.fieldConfidence : undefined);
        if (confSource) {
          if (extracted.brand && confSource.brand) updated.brand = confSource.brand;
          if (extracted.productName && confSource.productName) updated.productName = confSource.productName;
          if (extracted.sizeQuantity && confSource.sizeQuantity) updated.sizeQuantity = confSource.sizeQuantity;
          if (extracted.variant && confSource.variant) updated.variant = confSource.variant;
          if (extracted.colour && confSource.colour) updated.colour = confSource.colour;
          if (extracted.category && confSource.category) updated.category = confSource.category;
          if (extracted.barcode && !prev.barcode && confSource.barcode) updated.barcode = confSource.barcode;
        } else {
          if (extracted.brand) updated.brand = 'verified';
          if (extracted.productName) updated.productName = 'suggested';
          if (extracted.sizeQuantity) updated.sizeQuantity = 'verified';
          if (extracted.variant) updated.variant = 'suggested';
          if (extracted.colour) updated.colour = 'suggested';
          if (extracted.category) updated.category = 'verified';
          if (extracted.barcode && !prev.barcode) updated.barcode = 'verified';
        }
        return updated;
      });

      // Clear validation errors for newly populated fields
      setErrors((prevErrors) => {
        const nextErrors = { ...prevErrors };
        if (extracted.brand) delete nextErrors.brand;
        if (extracted.productName) delete nextErrors.productName;
        if (extracted.sizeQuantity) delete nextErrors.sizeQuantity;
        return nextErrors;
      });

      return updatedData;
    },
    []
  );

  // Expose onOcrExtracted callback to external callers if provided
  useEffect(() => {
    if (onOcrExtracted) {
      // If parent provided onOcrExtracted callback prop, pass handler or trigger
    }
  }, [onOcrExtracted]);

  // Synchronize with external ocrResult prop whenever new OCR extraction completes
  const prevOcrResultRef = useRef<ParsedPackagingResult | null>(null);
  useEffect(() => {
    if (ocrResult && ocrResult !== prevOcrResultRef.current) {
      prevOcrResultRef.current = ocrResult;
      const nextData = applyExtractedData(ocrResult);
      onOcrApplied?.();
      focusFirstMissingField(nextData || undefined);
    }
  }, [ocrResult, applyExtractedData, onOcrApplied, focusFirstMissingField]);

  // Synchronize when initialProduct prop changes from parent
  const prevInitialProductRef = useRef<Partial<ProductRecord> | null>(initialProduct);
  useEffect(() => {
    if (initialProduct && initialProduct !== prevInitialProductRef.current) {
      prevInitialProductRef.current = initialProduct;
      applyExtractedData(initialProduct);
    }
  }, [initialProduct, applyExtractedData]);

  // Autofocus the first missing required field on initial mount
  useEffect(() => {
    focusFirstMissingField();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic Category Suggestion when Brand, Name or Variant changes
  useEffect(() => {
    if (formData.productName || formData.brand) {
      const suggestion = suggestCategory(formData.productName, formData.brand, formData.variant);
      if (suggestion && suggestion.category !== formData.category) {
        setSuggestedCat(suggestion.category);
      } else {
        setSuggestedCat(null);
      }
    } else {
      setSuggestedCat(null);
    }
  }, [formData.brand, formData.productName, formData.variant, formData.category]);

  // Related SKU variants in inventory (e.g., other sizes or flavours of same product)
  const relatedVariants = React.useMemo(() => {
    if (!formData.brand.trim() || !formData.productName.trim() || allProducts.length === 0) return [];
    return findRelatedVariants(
      { brand: formData.brand, productName: formData.productName, id: initialProduct?.id },
      allProducts
    );
  }, [formData.brand, formData.productName, initialProduct?.id, allProducts]);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand is required (e.g. Peak, Indomie, Dettol)';
    }
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required (e.g. Evaporated Milk)';
    }
    if (!formData.sizeQuantity.trim()) {
      newErrors.sizeQuantity = 'Size/Quantity is required (e.g. 170g, 500ml, 1kg)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (saveAndScanNext: boolean, forceOverride = false) => {
    if (!validate()) {
      playWarningSound();
      return;
    }

    // Check for duplicate barcodes or identical SKUs
    if (!forceOverride) {
      const dupCheck = await checkForDuplicateProduct({
        id: initialProduct?.id,
        barcode: formData.barcode,
        brand: formData.brand,
        productName: formData.productName,
        sizeQuantity: formData.sizeQuantity,
        variant: formData.variant,
      });

      if (dupCheck.isDuplicate && dupCheck.existingProduct) {
        playWarningSound();
        setDuplicateWarning({
          show: true,
          existingProduct: dupCheck.existingProduct,
          reason: dupCheck.matchReason,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Split size and packaging quantity (e.g., 500ml vs 12 pcs)
      const qtySplit = splitSizeAndPackQuantity(formData.sizeQuantity.trim());

      await onSave(
        {
          brand: formData.brand.trim(),
          productName: formData.productName.trim(),
          sizeQuantity: qtySplit.sizeQuantity,
          packQuantity: qtySplit.packQuantity || formData.packQuantity,
          variant: formData.variant.trim() || 'Original',
          colour: formData.colour.trim() || 'N/A',
          barcode: formData.barcode.trim(),
          category: formData.category.trim() || 'Food & Groceries',
          dateCaptured: formData.dateCaptured || new Date().toISOString().slice(0, 10),
          notes: formData.notes.trim(),
          fieldConfidence,
        },
        saveAndScanNext
      );
      playSaveSuccessSound();
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render confidence pill
  const renderConfidenceBadge = (field: keyof FieldConfidenceMap) => {
    const status = fieldConfidence[field];
    if (!status) return null;

    if (status === 'verified') {
      return (
        <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Verified</span>
        </span>
      );
    }
    if (status === 'suggested') {
      return (
        <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-300 dark:border-sky-800">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Suggested</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
        <HelpCircle className="w-2.5 h-2.5" />
        <span>Review</span>
      </span>
    );
  };

  return (
    <div className="relative w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialProduct?.id ? 'Edit Supermarket Record' : 'Capture Product Details'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formData.barcode ? `Barcode: ${formData.barcode}` : 'Manual entry without barcode'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {onSnapPackaging && (
            <button
              type="button"
              disabled={isProcessingOcr}
              onClick={onSnapPackaging}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
              title="Snap Packaging Photo to extract text via OCR"
            >
              {isProcessingOcr ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>{isProcessingOcr ? 'Reading...' : 'OCR Packaging'}</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Duplicate Warning Alert */}
      {duplicateWarning.show && duplicateWarning.existingProduct && (
        <div className="p-4 m-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl animate-in fade-in">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Potential Duplicate Product Detected!
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                {duplicateWarning.reason}
              </p>

              {/* Existing Product Card Preview */}
              <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {duplicateWarning.existingProduct.brand} — {duplicateWarning.existingProduct.productName}
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
                  <span>Size: {duplicateWarning.existingProduct.sizeQuantity}</span>
                  {duplicateWarning.existingProduct.variant && (
                    <span>Variant: {duplicateWarning.existingProduct.variant}</span>
                  )}
                  {duplicateWarning.existingProduct.colour && (
                    <span>Colour: {duplicateWarning.existingProduct.colour}</span>
                  )}
                  <span>Category: {duplicateWarning.existingProduct.category}</span>
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px]">
                  Captured on: {duplicateWarning.existingProduct.dateCaptured}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {onViewExisting && (
                  <button
                    type="button"
                    onClick={() => {
                      if (duplicateWarning.existingProduct) {
                        onViewExisting(duplicateWarning.existingProduct.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-medium hover:bg-slate-700 transition"
                  >
                    View / Edit Existing
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSubmit(false, true)}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-medium hover:bg-amber-500 transition"
                >
                  Override & Save Anyway
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateWarning({ show: false })}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related SKU Variants Indicator Banner */}
      {relatedVariants.length > 0 && (
        <div className="mx-5 mt-4 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-900 dark:text-indigo-200">
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>{relatedVariants.length} related SKU variant(s)</strong> already in stock ({formData.brand} {formData.productName}).
            </span>
          </div>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            Saved as distinct SKU
          </span>
        </div>
      )}

      {/* Form Fields */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="p-5 space-y-4"
      >
        {/* Barcode Field (Strict text preservation) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Barcode / EAN / UPC
            </label>
            {renderConfidenceBadge('barcode')}
          </div>
          <div className="relative">
            <input
              ref={barcodeInputRef}
              type="text"
              value={formData.barcode}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, barcode: val }));
                setFieldConfidence((prev) => ({ ...prev, barcode: 'manual' }));
              }}
              placeholder="e.g. 6150000000000"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
            {formData.barcode && (
              <span className="absolute right-3 top-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Captured</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Barcodes are stored strictly as text to preserve leading zeros.
          </span>
        </div>

        {/* Brand & Product Name Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Brand <span className="text-rose-500">*</span>
              </label>
              {renderConfidenceBadge('brand')}
            </div>
            <input
              ref={brandInputRef}
              type="text"
              value={formData.brand}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, brand: val }));
                setFieldConfidence((prev) => ({ ...prev, brand: 'manual' }));
                if (errors.brand) setErrors((prev) => ({ ...prev, brand: '' }));
              }}
              placeholder="e.g. Peak, Indomie, Dettol"
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                errors.brand ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            {errors.brand && <p className="text-xs text-rose-500 mt-1">{errors.brand}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Product Name <span className="text-rose-500">*</span>
              </label>
              {renderConfidenceBadge('productName')}
            </div>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.productName}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, productName: val }));
                setFieldConfidence((prev) => ({ ...prev, productName: 'manual' }));
                if (errors.productName) setErrors((prev) => ({ ...prev, productName: '' }));
              }}
              placeholder="e.g. Evaporated Milk, Instant Noodles"
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                errors.productName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            {errors.productName && <p className="text-xs text-rose-500 mt-1">{errors.productName}</p>}
          </div>
        </div>

        {/* Size/Quantity & Variant Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Size / Quantity <span className="text-rose-500">*</span>
              </label>
              {renderConfidenceBadge('sizeQuantity')}
            </div>
            <input
              ref={sizeInputRef}
              type="text"
              value={formData.sizeQuantity}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, sizeQuantity: val }));
                setFieldConfidence((prev) => ({ ...prev, sizeQuantity: 'manual' }));
                if (errors.sizeQuantity) setErrors((prev) => ({ ...prev, sizeQuantity: '' }));
              }}
              placeholder="e.g. 170g, 500ml, 1kg, 12 pcs"
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                errors.sizeQuantity ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            {errors.sizeQuantity && <p className="text-xs text-rose-500 mt-1">{errors.sizeQuantity}</p>}
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Tip: Supports multipliers like "12 x 170g" or pack sizes like "12 pieces".
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Variant <span className="text-slate-400 font-normal lowercase">(flavour / type)</span>
              </label>
              {renderConfidenceBadge('variant')}
            </div>
            <input
              ref={variantInputRef}
              type="text"
              value={formData.variant}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, variant: val }));
                setFieldConfidence((prev) => ({ ...prev, variant: 'manual' }));
              }}
              placeholder="e.g. Original, Chocolate, Chicken, Onion"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>
        </div>

        {/* Colour & Category Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Colour <span className="text-slate-400 font-normal lowercase">(when applicable)</span></span>
              </label>
              {renderConfidenceBadge('colour')}
            </div>
            <input
              type="text"
              value={formData.colour}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, colour: val }));
                setFieldConfidence((prev) => ({ ...prev, colour: 'manual' }));
              }}
              placeholder="e.g. Green, Brown, White, or N/A"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Leave blank or N/A if not applicable (e.g. Dettol is Green, Bournvita is Brown).
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-500" />
                <span>Category</span>
              </label>
              {renderConfidenceBadge('category')}
            </div>

            <select
              value={formData.category}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, category: val }));
                setFieldConfidence((prev) => ({ ...prev, category: 'manual' }));
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            >
              <option value="">-- Select Product Category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>

            {suggestedCat && suggestedCat !== formData.category && (
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, category: suggestedCat }));
                  setFieldConfidence((prev) => ({ ...prev, category: 'verified' }));
                }}
                className="mt-1 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition border border-amber-500/30"
              >
                <Sparkles className="w-3 h-3" />
                <span>Suggested: {suggestedCat} (Tap to apply)</span>
              </button>
            )}
          </div>
        </div>

        {/* Date & Notes Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date Captured</span>
            </label>
            <input
              type="date"
              value={formData.dateCaptured}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, dateCaptured: val }));
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Optional Notes</span>
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, notes: val }));
              }}
              placeholder="e.g. Aisle 3, Shelf B, Batch 2026A"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>
        </div>

        {/* High-Volume Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-sky-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <ScanLine className="w-4 h-4" />
            <span>Save & Scan Next (Bulk)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-2xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span>Save Product</span>
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
          >
            Cancel & Return to Scanner
          </button>
        </div>
      </form>
    </div>
  );
};
