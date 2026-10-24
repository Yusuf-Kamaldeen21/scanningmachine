export interface ProductLookupResult {
  source: 'local-catalogue' | 'open-food-facts' | 'none';
  brand: string;
  productName: string;
  sizeQuantity: string;
  variant?: string;
  category?: string;
  barcode: string;
}

// Pre-seeded supermarket catalogue for instant offline matching of common FMCG products
export const SUPERMARKET_CATALOGUE: Record<string, Omit<ProductLookupResult, 'source'>> = {
  '6151100001017': {
    barcode: '6151100001017',
    brand: 'Peak',
    productName: 'Evaporated Milk',
    sizeQuantity: '170g',
    variant: 'Full Cream',
    category: 'Dairy Products',
  },
  '6151100001024': {
    barcode: '6151100001024',
    brand: 'Peak',
    productName: 'Instant Milk Powder (Refill)',
    sizeQuantity: '400g',
    variant: 'Full Cream',
    category: 'Dairy Products',
  },
  '8992388111226': {
    barcode: '8992388111226',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Onion Chicken',
    category: 'Food & Groceries',
  },
  '8992388111233': {
    barcode: '8992388111233',
    brand: 'Indomie',
    productName: 'Instant Noodles (Hungryman Size)',
    sizeQuantity: '180g',
    variant: 'Chicken Flavour',
    category: 'Food & Groceries',
  },
  '8992388111240': {
    barcode: '8992388111240',
    brand: 'Indomie',
    productName: 'Instant Noodles (Bellefull Size)',
    sizeQuantity: '280g',
    variant: 'Chicken Flavour',
    category: 'Food & Groceries',
  },
  '6151100021053': {
    barcode: '6151100021053',
    brand: 'Golden Penny',
    productName: 'Spaghetti',
    sizeQuantity: '500g',
    variant: 'Original',
    category: 'Food & Groceries',
  },
  '6151100021060': {
    barcode: '6151100021060',
    brand: 'Golden Penny',
    productName: 'Semovita',
    sizeQuantity: '1kg',
    variant: 'Premium Wheat',
    category: 'Food & Groceries',
  },
  '5000167049441': {
    barcode: '5000167049441',
    brand: 'Dettol',
    productName: 'Antiseptic Liquid',
    sizeQuantity: '250ml',
    variant: 'Original',
    category: 'Toiletries',
  },
  '5000167049458': {
    barcode: '5000167049458',
    brand: 'Dettol',
    productName: 'Antibacterial Bar Soap',
    sizeQuantity: '110g',
    variant: 'Original Fresh',
    category: 'Toiletries',
  },
  '7613035311234': {
    barcode: '7613035311234',
    brand: 'Nestle',
    productName: 'Milo Energy Food Drink',
    sizeQuantity: '500g',
    variant: 'Chocolate Malt Refill',
    category: 'Beverages',
  },
  '5449000000996': {
    barcode: '5449000000996',
    brand: 'Coca-Cola',
    productName: 'Original Taste Sparkling Soft Drink',
    sizeQuantity: '500ml',
    variant: 'Original',
    category: 'Beverages',
  },
  '5449000014535': {
    barcode: '5449000014535',
    brand: 'Sprite',
    productName: 'Lemon-Lime Flavoured Soda',
    sizeQuantity: '500ml',
    variant: 'Regular',
    category: 'Beverages',
  },
  '4005808118021': {
    barcode: '4005808118021',
    brand: 'Nivea',
    productName: 'Rich Nourishing Body Lotion',
    sizeQuantity: '400ml',
    variant: 'Deep Moisture Serum',
    category: 'Skin Care',
  },
  '8717163012345': {
    barcode: '8717163012345',
    brand: 'Vaseline',
    productName: 'Petroleum Jelly',
    sizeQuantity: '250ml',
    variant: 'Original Pure',
    category: 'Skin Care',
  },
  '6151100030017': {
    barcode: '6151100030017',
    brand: 'Ariel',
    productName: 'Automatic Washing Powder Detergent',
    sizeQuantity: '400g',
    variant: 'Original Scent',
    category: 'Household Cleaning',
  },
  '6151100030024': {
    barcode: '6151100030024',
    brand: 'Hypo',
    productName: 'Bleach Disinfectant',
    sizeQuantity: '500ml',
    variant: 'Regular White',
    category: 'Household Cleaning',
  },
  '8712566054321': {
    barcode: '8712566054321',
    brand: 'Knorr',
    productName: 'Chicken Seasoning Cubes',
    sizeQuantity: '50x10g',
    variant: 'Chicken',
    category: 'Food & Groceries',
  },
  '7613031024321': {
    barcode: '7613031024321',
    brand: 'Maggi',
    productName: 'Star Seasoning Cubes',
    sizeQuantity: '100x4g',
    variant: 'Original',
    category: 'Food & Groceries',
  },
  '8712561580123': {
    barcode: '8712561580123',
    brand: 'Close Up',
    productName: 'Triple Fresh Red Hot Gel Toothpaste',
    sizeQuantity: '140g',
    variant: 'Red Hot',
    category: 'Toiletries',
  },
  '7622210123456': {
    barcode: '7622210123456',
    brand: 'Oreo',
    productName: 'Vanilla Creme Sandwich Cookies',
    sizeQuantity: '154g',
    variant: 'Vanilla',
    category: 'Snacks & Confectionery',
  },
};

/**
 * Searches local catalogue first, then falls back to Open Food Facts API if enabled and online.
 */
export async function lookupProductByBarcode(
  barcode: string,
  enableOnlineLookup: boolean = true
): Promise<ProductLookupResult | null> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  // 1. Check local catalog
  if (SUPERMARKET_CATALOGUE[cleanBarcode]) {
    return {
      source: 'local-catalogue',
      ...SUPERMARKET_CATALOGUE[cleanBarcode],
    };
  }

  // 2. Check Open Food Facts if enabled and online
  if (enableOnlineLookup && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for snappy UI

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
            return {
              source: 'open-food-facts',
              barcode: cleanBarcode,
              brand: brand || 'Generic',
              productName: productName || 'Unknown Product',
              sizeQuantity: sizeQuantity || '',
            };
          }
        }
      }
    } catch {
      // Gracefully ignore fetch errors / timeouts in offline or network constrained situations
    }
  }

  return null;
}
