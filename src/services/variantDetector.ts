import type { ProductRecord, FieldConfidence } from '../types';

export interface VariantDetectionResult {
  variant: string;
  confidence: FieldConfidence;
  matchedKeyword?: string;
  isPackConfig?: boolean;
}

export interface ColourDetectionResult {
  colour: string;
  confidence: FieldConfidence;
  matchedKeyword?: string;
}

export interface QuantitySplitResult {
  sizeQuantity: string;
  packQuantity?: string;
}

// Comprehensive variants across FMCG Supermarket goods
const KNOWN_VARIANTS_ORDERED: string[] = [
  // Compound FMCG Variants (checked first to prevent partial match)
  'Onion Chicken',
  'Pepper Chicken',
  'Original Fresh',
  'Fragrance Free',
  'Zero Sugar',
  'Full Cream',
  'Low Fat',
  'Deep Moisture',
  'Rich Nourishing',
  'Red Hot',
  'Cool Mint',
  'Fresh Mint',
  'Aloe Vera',
  'Tea Tree',
  'Cocoa Butter',
  'Shea Butter',
  'Sweet & Sour',
  'Hot & Spicy',
  'Extra Spicy',
  'Ocean Fresh',
  'Spring Fresh',
  'Pine Fresh',
  'Family Pack',
  'Twin Pack',
  'Jumbo Pack',
  'Hungryman Size',
  'Bellefull Size',

  // Core Flavours & Scents
  'Original',
  'Classic',
  'Regular',
  'Unscented',
  'Chocolate',
  'Vanilla',
  'Strawberry',
  'Chicken',
  'Onion',
  'Beef',
  'Suya',
  'Seafood',
  'Shrimp',
  'Fish',
  'Tomato',
  'Lemon',
  'Lime',
  'Apple',
  'Orange',
  'Pineapple',
  'Mango',
  'Banana',
  'Peach',
  'Grape',
  'Watermelon',
  'Malt',
  'Ginger',
  'Garlic',
  'Chili',
  'Cheese',
  'Butter',
  'Caramel',
  'Hazelnut',
  'Mocha',
  'Coconut',
  'Honey',
  'Lavender',
  'Rose',
  'Jasmine',
  'Citrus',
  'Pine',
  'Eucalyptus',
  'Charcoal',
  'Herbal',
  'Sensitive',

  // Pack Configurations
  'Refill',
  'Sachet',
  'Pouch',
  'Tin',
  'Can',
  'Bottle',
  'Bar',
  'Roll',
];

// Physical Colours (distinct from flavours)
const KNOWN_COLOURS: string[] = [
  'Green',
  'Red',
  'Blue',
  'Yellow',
  'White',
  'Black',
  'Brown',
  'Pink',
  'Purple',
  'Gold',
  'Silver',
  'Grey',
  'Amber',
];

/**
 * Detects variant from text (packaging OCR, product name, or description).
 * Does not confuse colour with flavour.
 */
export function detectVariant(
  text: string,
  context?: { brand?: string; category?: string }
): VariantDetectionResult {
  const clean = text.trim();
  if (!clean) {
    return { variant: '', confidence: 'needs-review' };
  }

  const lowerText = clean.toLowerCase();

  // Search through known variants (ordered by specificity)
  for (const variant of KNOWN_VARIANTS_ORDERED) {
    const lowerVariant = variant.toLowerCase();
    const regex = new RegExp(`\\b${escapeRegExp(lowerVariant)}\\b`, 'i');
    if (regex.test(lowerText)) {
      return {
        variant,
        confidence: 'suggested',
        matchedKeyword: variant,
      };
    }
  }

  // Check if explicit "Original" applies for basic standard FMCG staples
  if (/\b(standard|plain|pure|regular)\b/i.test(lowerText)) {
    return {
      variant: 'Original',
      confidence: 'suggested',
      matchedKeyword: 'Original',
    };
  }

  // If beverage or dairy and mentions "cream" or "evaporated" without other flavour
  if (context?.category === 'Dairy Products' && /\b(evaporated|condensed)\b/i.test(lowerText)) {
    return {
      variant: 'Original',
      confidence: 'suggested',
      matchedKeyword: 'Original',
    };
  }

  return {
    variant: '',
    confidence: 'needs-review',
  };
}

/**
 * Detects physical packaging or liquid colour when explicitly applicable.
 * E.g. Dettol Liquid (Green / Amber), Close Up Red Hot (Red), Toothbrushes (Blue, Red, White).
 * Avoids misidentifying fruit flavours like Orange/Apple as a colour unless colour context is clear.
 */
export function detectColour(text: string): ColourDetectionResult | null {
  const clean = text.trim();
  if (!clean) return null;

  // Explicit colour annotations like "Color: Green", "Green Liquid", "Blue Cap"
  for (const colour of KNOWN_COLOURS) {
    const lowerColour = colour.toLowerCase();

    // 1. Explicit pattern: "Color: Green" or "Colour: Green"
    const explicitRegex = new RegExp(`\\bcolou?r\\s*[:\\-]?\\s*${lowerColour}\\b`, 'i');
    if (explicitRegex.test(clean)) {
      return { colour, confidence: 'verified', matchedKeyword: colour };
    }

    // 2. Direct colour mention with physical qualifiers: "Green bottle", "Red box", "White cap"
    const qualifierRegex = new RegExp(
      `\\b${lowerColour}\\s+(liquid|gel|bottle|tube|bar|soap|cap|label|box|pack)\\b`,
      'i'
    );
    if (qualifierRegex.test(clean)) {
      return { colour, confidence: 'verified', matchedKeyword: colour };
    }
  }

  // 3. Fallback: check if standalone colour word appears in personal care / cleaning context
  // (Avoid confusing "Orange" flavour with colour)
  for (const colour of KNOWN_COLOURS) {
    if (colour.toLowerCase() === 'orange') continue; // Always treat Orange as flavour by default
    const lowerColour = colour.toLowerCase();
    const wordRegex = new RegExp(`\\b${lowerColour}\\b`, 'i');
    if (wordRegex.test(clean)) {
      return { colour, confidence: 'suggested', matchedKeyword: colour };
    }
  }

  return null;
}

/**
 * Distinguishes product unit size (e.g. 170g, 500ml) from packaging quantity (e.g. 12 pieces, 24 sachets).
 */
export function splitSizeAndPackQuantity(input: string): QuantitySplitResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { sizeQuantity: '' };
  }

  // Pattern A: "12 x 170g" or "24x500ml" or "40 x 70g"
  const multiplierMatch = trimmed.match(
    /^(\d+)\s*(?:x|\*)\s*(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|l|oz|fl\s*oz|ltr))\b/i
  );
  if (multiplierMatch) {
    const packCount = multiplierMatch[1];
    const unitSize = multiplierMatch[2];
    return {
      sizeQuantity: unitSize,
      packQuantity: `${packCount} pieces`,
    };
  }

  // Pattern B: "170g (12 pcs)" or "500ml, pack of 6"
  const comboMatch = trimmed.match(
    /^(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|l|oz|fl\s*oz|ltr))\s*[[(),]?\s*(?:pack of\s*)?(\d+)\s*(?:pcs|pieces|sachets|packs|pk|bottles|cans|bars)?[\])]?$/i
  );
  if (comboMatch) {
    return {
      sizeQuantity: comboMatch[1],
      packQuantity: `${comboMatch[2]} pieces`,
    };
  }

  // Pattern C: Pure pack quantity like "12 pieces" or "24 sachets"
  const packOnlyMatch = trimmed.match(/^(\d+)\s*(pcs|pieces|sachets|packs|pk|rolls|bars|tablets)$/i);
  if (packOnlyMatch) {
    return {
      sizeQuantity: trimmed,
      packQuantity: trimmed,
    };
  }

  return {
    sizeQuantity: trimmed,
  };
}

/**
 * Finds all related products with the same Brand and Product Name in the collection.
 * Products with different sizes or flavours are distinct SKUs, but related.
 */
export function findRelatedVariants(
  target: { brand: string; productName: string; id?: string },
  allProducts: ProductRecord[]
): ProductRecord[] {
  const targetBrand = target.brand.trim().toLowerCase();
  const targetName = target.productName.trim().toLowerCase();

  if (!targetBrand || !targetName) return [];

  return allProducts.filter((p) => {
    if (target.id && p.id === target.id) return false;
    const pBrand = p.brand.trim().toLowerCase();
    const pName = p.productName.trim().toLowerCase();
    return pBrand === targetBrand && pName === targetName;
  });
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
