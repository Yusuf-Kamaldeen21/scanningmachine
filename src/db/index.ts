import Dexie, { type Table } from 'dexie';
import type { ProductRecord, ProductCategory, AppSettings } from '../types';

export const PREDEFINED_CATEGORIES: string[] = [
  'Food & Groceries',
  'Beverages',
  'Dairy Products',
  'Snacks & Confectionery',
  'Personal Care',
  'Hair Care',
  'Skin Care',
  'Household Cleaning',
  'Baby Products',
  'Toiletries',
  'Frozen Foods',
  'Kitchen Supplies',
  'Stationery',
  'Other',
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global-settings',
  targetCount: 1000,
  scanMode: 'review',
  rememberLastCategory: false,
  lastCategory: 'Food & Groceries',
  rememberBrand: false,
  lastBrand: '',
  soundFeedback: true,
  vibrateFeedback: true,
  autoLookupOnline: true,
  theme: 'system',
};

export class QuickStockDatabase extends Dexie {
  products!: Table<ProductRecord, string>;
  categories!: Table<ProductCategory, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('QuickStockDB');
    this.version(1).stores({
      products: '&id, barcode, category, dateCaptured, createdAt, brand, productName',
      categories: '&id, name',
      settings: '&id',
    });
    this.version(2).stores({
      products: '&id, barcode, category, dateCaptured, createdAt, brand, productName, colour',
      categories: '&id, name',
      settings: '&id',
    });
  }
}

export const db = new QuickStockDatabase();

// Seed initial default categories and settings if needed
export async function initializeDatabase(): Promise<void> {
  try {
    const categoryCount = await db.categories.count();
    if (categoryCount === 0) {
      const initialCategories: ProductCategory[] = PREDEFINED_CATEGORIES.map((cat, idx) => ({
        id: `cat-${idx + 1}`,
        name: cat,
        isDefault: true,
        createdAt: new Date().toISOString(),
      }));
      await db.categories.bulkAdd(initialCategories);
    }

    const settings = await db.settings.get(DEFAULT_SETTINGS.id);
    if (!settings) {
      await db.settings.add(DEFAULT_SETTINGS);
    } else if (!settings.scanMode) {
      await db.settings.update(DEFAULT_SETTINGS.id, { scanMode: 'review' });
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}
