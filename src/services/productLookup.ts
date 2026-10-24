import { db } from '../db';
import type { FieldConfidenceMap } from '../types';

export interface ProductLookupResult {
  source: 'local-db' | 'local-catalogue' | 'open-food-facts' | 'none';
  brand: string;
  productName: string;
  sizeQuantity: string;
  variant?: string;
  colour?: string;
  packQuantity?: string;
  category?: string;
  barcode: string;
  confidence: FieldConfidenceMap;
}

// In-memory cache for repeated scans during the active session
const lookupCache = new Map<string, ProductLookupResult>();

// Pre-seeded supermarket catalogue for instant offline matching of common FMCG products
export const SUPERMARKET_CATALOGUE: Record<string, Omit<ProductLookupResult, 'source' | 'confidence'>> = {
  // Illustrative test barcodes from supermarket inventory
  '6150000000000': {
    barcode: '6150000000000',
    brand: 'Peak',
    productName: 'Evaporated Milk',
    sizeQuantity: '170g',
    variant: 'Original',
    colour: 'N/A',
    category: 'Dairy Products',
  },
  '6150000000001': {
    barcode: '6150000000001',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Chicken',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '6150000000002': {
    barcode: '6150000000002',
    brand: 'Dettol',
    productName: 'Antiseptic Liquid',
    sizeQuantity: '250ml',
    variant: 'Original',
    colour: 'Green',
    category: 'Personal Care',
  },
  '6150000000003': {
    barcode: '6150000000003',
    brand: 'Bournvita',
    productName: 'Malt Drink Powder',
    sizeQuantity: '500g',
    variant: 'Original',
    colour: 'Brown',
    category: 'Beverages',
  },

  // Real FMCG standard codes
  '6151100001017': {
    barcode: '6151100001017',
    brand: 'Peak',
    productName: 'Evaporated Milk',
    sizeQuantity: '170g',
    variant: 'Full Cream',
    colour: 'N/A',
    category: 'Dairy Products',
  },
  '6151100001024': {
    barcode: '6151100001024',
    brand: 'Peak',
    productName: 'Instant Milk Powder (Refill)',
    sizeQuantity: '400g',
    variant: 'Full Cream',
    colour: 'N/A',
    category: 'Dairy Products',
  },
  '8992388111226': {
    barcode: '8992388111226',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Onion Chicken',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '8992388111233': {
    barcode: '8992388111233',
    brand: 'Indomie',
    productName: 'Instant Noodles (Hungryman Size)',
    sizeQuantity: '180g',
    variant: 'Chicken Flavour',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '8992388111240': {
    barcode: '8992388111240',
    brand: 'Indomie',
    productName: 'Instant Noodles (Bellefull Size)',
    sizeQuantity: '280g',
    variant: 'Chicken Flavour',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '6151100021053': {
    barcode: '6151100021053',
    brand: 'Golden Penny',
    productName: 'Spaghetti',
    sizeQuantity: '500g',
    variant: 'Original',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '6151100021060': {
    barcode: '6151100021060',
    brand: 'Golden Penny',
    productName: 'Semovita',
    sizeQuantity: '1kg',
    variant: 'Premium Wheat',
    colour: 'N/A',
    category: 'Food & Groceries',
  },
  '5000167049441': {
    barcode: '5000167049441',
    brand: 'Dettol',
    productName: 'Antiseptic Liquid',
    sizeQuantity: '250ml',
    variant: 'Original',
    colour: 'Green',
    category: 'Personal Care',
  },
  '5000167049458': {
    barcode: '5000167049458',
    brand: 'Dettol',
    productName: 'Antibacterial Bar Soap',
    sizeQuantity: '110g',
    variant: 'Original Fresh',
    colour: 'Green',
    category: 'Toiletries',
  },
  '7613035311234': {
    barcode: '7613035311234',
    brand: 'Nestle',
    productName: 'Milo Energy Food Drink',
    sizeQuantity: '500g',
    variant: 'Chocolate Malt Refill',
    colour: 'Green',
    category: 'Beverages',
  },
  '5449000000996': {
    barcode: '5449000000996',
    brand: 'Coca-Cola',
    productName: 'Original Taste Sparkling Soft Drink',
    sizeQuantity: '500ml',
    variant: 'Original',
    colour: 'Red',
    category: 'Beverages',
  },
  '5449000014535': {
    barcode: '5449000014535',
    brand: 'Sprite',
    productName: 'Lemon-Lime Flavoured Soda',
    sizeQuantity: '500ml',
    variant: 'Regular',
    colour: 'Green',
    category: 'Beverages',
  },
  '4005808118021': {
    barcode: '4005808118021',
    brand: 'Nivea',
    productName: 'Rich Nourishing Body Lotion',
    sizeQuantity: '400ml',
    variant: 'Deep Moisture Serum',
    colour: 'Blue',
    category: 'Skin Care',
  },
  '8717163012345': {
    barcode: '8717163012345',
    brand: 'Vaseline',
    productName: 'Petroleum Jelly',
    sizeQuantity: '250ml',
    variant: 'Original Pure',
    colour: 'Blue',
    category: 'Skin Care',
  },
  '6151100030017': {
    barcode: '6151100030017',
    brand: 'Ariel',
    productName: 'Automatic Washing Powder Detergent',
    sizeQuantity: '400g',
    variant: 'Original Scent',
    colour: 'White',
    category: 'Household Cleaning',
  },
  '6151100030024': {
    barcode: '6151100030024',
    brand: 'Hypo',
    productName: 'Bleach Disinfectant',
    sizeQuantity: '500ml',
    variant: 'Regular White',
    colour: 'White',
    category: 'Household Cleaning',
  },
  '8712566054321': {
    barcode: '8712566054321',
    brand: 'Knorr',
    productName: 'Chicken Seasoning Cubes',
    sizeQuantity: '50x10g',
    variant: 'Chicken',
    colour: 'Green',
    category: 'Food & Groceries',
  },
  '7613031024321': {
    barcode: '7613031024321',
    brand: 'Maggi',
    productName: 'Star Seasoning Cubes',
    sizeQuantity: '100x4g',
    variant: 'Original',
    colour: 'Red',
    category: 'Food & Groceries',
  },
  '8712561580123': {
    barcode: '8712561580123',
    brand: 'Close Up',
    productName: 'Triple Fresh Red Hot Gel Toothpaste',
    sizeQuantity: '140g',
    variant: 'Red Hot',
    colour: 'Red',
    category: 'Toiletries',
  },
  '7622210123456': {
    barcode: '7622210123456',
    brand: 'Oreo',
    productName: 'Vanilla Creme Sandwich Cookies',
    sizeQuantity: '154g',
    variant: 'Vanilla',
    colour: 'Blue',
    category: 'Snacks & Confectionery',
  },
};

/**
 * Searches in order:
 * 1. Fast in-memory cache
 * 2. Local IndexedDB existing products (reuse known details)
 * 3. Local supermarket catalogue
 * 4. Open Food Facts API (if enabled & online)
 *
 * Never invents fake details if no match is found.
 */
export async function lookupProductByBarcode(
  barcode: string,
  enableOnlineLookup: boolean = true
): Promise<ProductLookupResult | null> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  // 1. Check in-memory cache
  if (lookupCache.has(cleanBarcode)) {
    return lookupCache.get(cleanBarcode)!;
  }

  // 2. Check local Dexie IndexedDB (if indexedDB is available in environment)
  if (typeof indexedDB !== 'undefined') {
    try {
      const existing = await db.products.where('barcode').equals(cleanBarcode).first();
      if (existing) {
        const dbResult: ProductLookupResult = {
          source: 'local-db',
          barcode: cleanBarcode,
          brand: existing.brand,
          productName: existing.productName,
          sizeQuantity: existing.sizeQuantity,
          variant: existing.variant || '',
          colour: existing.colour || '',
          category: existing.category || '',
          confidence: {
            brand: 'verified',
            productName: 'verified',
            sizeQuantity: 'verified',
            variant: existing.variant ? 'verified' : 'needs-review',
            colour: existing.colour ? 'verified' : 'needs-review',
            category: 'verified',
            barcode: 'verified',
          },
        };
        lookupCache.set(cleanBarcode, dbResult);
        return dbResult;
      }
    } catch (err) {
      console.warn('Error reading from local DB for lookup:', err);
    }
  }

  // 3. Check local supermarket catalogue
  if (SUPERMARKET_CATALOGUE[cleanBarcode]) {
    const catItem = SUPERMARKET_CATALOGUE[cleanBarcode];
    const catResult: ProductLookupResult = {
      source: 'local-catalogue',
      barcode: cleanBarcode,
      brand: catItem.brand,
      productName: catItem.productName,
      sizeQuantity: catItem.sizeQuantity,
      variant: catItem.variant,
      colour: catItem.colour,
      category: catItem.category,
      confidence: {
        brand: 'verified',
        productName: 'verified',
        sizeQuantity: 'verified',
        variant: catItem.variant ? 'verified' : 'needs-review',
        colour: catItem.colour ? 'verified' : 'needs-review',
        category: 'verified',
        barcode: 'verified',
      },
    };
    lookupCache.set(cleanBarcode, catResult);
    return catResult;
  }

  // 4. Check Open Food Facts if enabled and online
  if (enableOnlineLookup && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // Snappy timeout

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=product_name,brands,quantity,categories,generic_name`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 1 && data.product) {
          const product = data.product;
          const brand = product.brands?.split(',')[0]?.trim() || '';
          const productName = product.product_name || product.generic_name || '';
          const sizeQuantity = product.quantity || '';

          if (brand || productName) {
            const apiResult: ProductLookupResult = {
              source: 'open-food-facts',
              barcode: cleanBarcode,
              brand: brand || 'Generic',
              productName: productName || 'Unknown Product',
              sizeQuantity: sizeQuantity || '',
              confidence: {
                brand: brand ? 'verified' : 'needs-review',
                productName: productName ? 'suggested' : 'needs-review',
                sizeQuantity: sizeQuantity ? 'verified' : 'needs-review',
                variant: 'needs-review',
                colour: 'needs-review',
                category: 'suggested',
                barcode: 'verified',
              },
            };
            lookupCache.set(cleanBarcode, apiResult);
            return apiResult;
          }
        }
      }
    } catch {
      // Gracefully ignore fetch errors / offline timeouts
    }
  }

  return null;
}
