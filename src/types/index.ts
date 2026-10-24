export type FieldConfidence = 'verified' | 'suggested' | 'needs-review' | 'manual';

export interface FieldConfidenceMap {
  brand?: FieldConfidence;
  productName?: FieldConfidence;
  sizeQuantity?: FieldConfidence;
  variant?: FieldConfidence;
  colour?: FieldConfidence;
  category?: FieldConfidence;
  barcode?: FieldConfidence;
}

export interface ProductRecord {
  id: string; // Unique internal record ID (UUID)
  brand: string; // Required (e.g. Peak, Indomie)
  productName: string; // Required (e.g. Evaporated Milk)
  sizeQuantity: string; // Required (e.g. 170g, 500ml, 1kg)
  variant: string; // Optional (e.g. Chocolate, Chicken)
  colour?: string; // Optional (e.g. Green, Brown, White, N/A)
  packQuantity?: string; // Optional distinct packaging quantity (e.g. 12 pieces, 24 sachets)
  barcode: string; // Barcode as string to preserve leading zeros
  category: string; // Product category
  dateCaptured: string; // YYYY-MM-DD
  notes: string; // Optional notes
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  synced?: boolean; // Offline/online sync status flag
  fieldConfidence?: FieldConfidenceMap; // Status per extracted field
  source?: 'barcode-lookup' | 'ocr' | 'manual' | 'import';
}

export interface ProductCategory {
  id: string;
  name: string;
  isDefault?: boolean;
  description?: string;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  targetCount: number;
  scanMode: 'fast' | 'review'; // Fast Scan Mode auto-saves verified barcodes; Review Mode shows form
  rememberLastCategory: boolean;
  lastCategory: string;
  rememberBrand: boolean;
  lastBrand: string;
  soundFeedback: boolean;
  vibrateFeedback: boolean;
  autoLookupOnline: boolean;
  theme: 'system' | 'light' | 'dark';
  preferredCameraId?: string;
}

export interface ExportOptions {
  format: 'xlsx' | 'csv' | 'json' | 'tsv';
  fields: {
    brand: boolean;
    productName: boolean;
    sizeQuantity: boolean;
    variant: boolean;
    colour: boolean;
    barcode: boolean;
    category: boolean;
    dateCaptured: boolean;
    notes: boolean;
    id: boolean;
  };
  filterCategory: string; // 'all' or category name
  filterDate: string; // 'all' or specific date
  filterIncompleteOnly: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProduct?: ProductRecord;
  matchType: 'barcode' | 'fuzzy' | 'none';
  matchReason?: string;
}
