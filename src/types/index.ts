export interface ProductRecord {
  id: string; // Unique internal record ID (UUID)
  brand: string; // Required (e.g. Peak, Indomie)
  productName: string; // Required (e.g. Evaporated Milk)
  sizeQuantity: string; // Required (e.g. 170g, 500ml, 1kg)
  variant: string; // Optional (e.g. Chocolate, Chicken)
  barcode: string; // Barcode as string to preserve leading zeros
  category: string; // Product category
  dateCaptured: string; // YYYY-MM-DD
  notes: string; // Optional notes
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  synced?: boolean; // Offline/online sync status flag
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
  format: 'csv' | 'xlsx' | 'json';
  fields: {
    brand: boolean;
    productName: boolean;
    sizeQuantity: boolean;
    variant: boolean;
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
