import { createWorker } from 'tesseract.js';
import type { FieldConfidenceMap, ProductRecord } from '../types';
import { suggestCategory } from './categorySuggester';
import { detectVariant, detectColour, splitSizeAndPackQuantity } from './variantDetector';
import { SUPERMARKET_CATALOGUE } from './productLookup';

export interface ParsedPackagingResult {
  rawText: string;
  brand?: string; // Optional for compatibility; Brand is excluded from user forms
  productName: string;
  sizeQuantity: string;
  packQuantity?: string;
  variant: string;
  colour: string;
  category: string;
  barcode?: string;
  dateCaptured?: string;
  confidence: FieldConfidenceMap;
  notes?: string;
}

export interface ParsePackagingContext {
  scannedBarcode?: string;
  existingProducts?: ProductRecord[];
}

// Known supermarket FMCG Brands & Manufacturers used to identify and strip brand names from product names
export const KNOWN_BRANDS: string[] = [
  'Peak',
  'Indomie',
  'Golden Penny',
  'Dettol',
  'Nestle',
  'Nestlé',
  'Milo',
  'Coca-Cola',
  'Sprite',
  'Fanta',
  'Pepsi',
  'Nivea',
  'Vaseline',
  'Ariel',
  'Omo',
  'Hypo',
  'Knorr',
  'Maggi',
  'Close Up',
  'Colgate',
  'Oral-B',
  'Oreo',
  'Pampers',
  'Molfix',
  'Huggies',
  'Chivita',
  'Chi Exotic',
  'Lucozade',
  'Ribena',
  'Mamador',
  'Power Oil',
  'Kings',
  'Gino',
  'Sonia',
  'Dangote',
  'St. Louis',
  'Hollandia',
  'Cowbell',
  'Dano',
  'Cadbury',
  'Bournvita',
  'Ovaltine',
  'Pringles',
  'Beloxxi',
  'Oxford',
  'Dove',
  'Rexona',
  'Axe',
  'Gillette',
  'Sunlight',
  'So Klin',
  'Morning Fresh',
  'Fairy',
  'Harpic',
  'Air Wick',
  'Glade',
  'Raid',
  'Baygon',
  'Cerelac',
  'SMA Gold',
  'Nutribom',
  'Custard',
  'Lipton',
  'Nescafe',
  'Quaker Oats',
  'Kellogg\'s',
  'Heinz',
  'Bic',
  'Unilever',
  'P&G',
  'Procter & Gamble',
  'Reckitt',
  'Danone',
  'Kraft',
  'Mondelez',
  'Johnson & Johnson',
];

// Supermarket product noun descriptors (ordered longest first to prioritize full phrases)
const PRODUCT_NOUN_PATTERNS: string[] = [
  'automatic washing powder detergent',
  'automatic washing powder',
  'washing powder detergent',
  'washing powder',
  'laundry detergent',
  'dishwashing liquid',
  'antiseptic liquid',
  'disinfectant liquid',
  'bleach disinfectant',
  'liquid bleach',
  'evaporated milk',
  'condensed milk',
  'powdered milk',
  'instant milk powder',
  'instant milk',
  'full cream milk',
  'instant noodles',
  'sandwich cookies',
  'gel toothpaste',
  'herbal toothpaste',
  'malt drink powder',
  'energy food drink',
  'sparkling soft drink',
  'soft drink',
  'body lotion',
  'body cream',
  'petroleum jelly',
  'pure petroleum jelly',
  'antibacterial bar soap',
  'antibacterial soap',
  'toilet soap',
  'bar soap',
  'liquid soap',
  'body wash',
  'shower gel',
  'seasoning cubes',
  'chicken seasoning cubes',
  'star seasoning cubes',
  'stock cubes',
  'tomato paste',
  'tomato ketchup',
  'vegetable oil',
  'pure vegetable oil',
  'palm oil',
  'sunflower oil',
  'olive oil',
  'baby dry diapers',
  'baby diapers',
  'baby wipes',
  'toilet cleaner',
  'air freshener',
  'custard powder',
  'corn flakes',
  'cornflakes',
  'instant oats',
  'whole wheat loaf',
  'white bread',
  'ballpoint pen',
  'milk',
  'noodles',
  'spaghetti',
  'macaroni',
  'pasta',
  'semovita',
  'detergent',
  'bleach',
  'disinfectant',
  'antiseptic',
  'toothpaste',
  'soap',
  'lotion',
  'cream',
  'jelly',
  'cookies',
  'biscuits',
  'crackers',
  'shortbread',
  'wafers',
  'chips',
  'crisps',
  'juice',
  'drink',
  'soda',
  'diapers',
  'ketchup',
  'mayonnaise',
  'cubes',
  'seasoning',
  'flour',
  'sugar',
  'salt',
  'cereal',
  'oats',
  'shampoo',
  'conditioner',
  'deodorant',
  'insecticide',
  'matches',
];

// Patterns for lines that are marketing slogans, promotional text, or product claims
const MARKETING_SLOGAN_PATTERNS = [
  /\bkills?\s+(?:99(?:\.\d+)?%|almost\s+all|all)?\s*(?:of\s*)?(?:germs?|bacteria|viruses?)\b/i,
  /\b(?:rich\s*&\s*creamy|rich\s+and\s+creamy|delicious(?:\s*&\s*tasty)?|authentic\s+taste|great\s+taste|original\s+taste|fresh\s+taste)\b/i,
  /\b(?:new\s*(&|and)?\s*improved|new\s+look|new\s+formula|improved\s+formula|improved\s+taste|special\s+taste)\b/i,
  /\b(?:deep\s+moisture(?:\s+serum)?|24h(?:\s+moisture|\s+freshness)?|48h(?:\s+protection)?|hours?\s+fresh)\b/i,
  /\b(?:triple\s+action|maximum\s+protection|100%\s+protection|total\s+care|complete\s+care)\b/i,
  /\b(?:best\s+stain\s+removal(?:\s+in\s+1\s+wash)?|stain\s+removal|removes?\s+tough\s+stains?)\b/i,
  /\b(?:up\s+to\s+\d+\s+hours?|long\s+lasting|all\s+day\s+freshness)\b/i,
  /\b(?:clinically\s+proven|dermatologically\s+tested|doctor\s+recommended|dentist\s+recommended|pediatrician\s+approved)\b/i,
  /\b(?:twist\s*,?\s*lick\s*,?\s*dunk|with\s+\d+\s+essential\s+vitamins|fortified\s+with)\b/i,
  /\b(?:buy\s+\d+\s+get\s+\d+|extra\s+\d+%|free\s+inside|save\s+\d+|special\s+offer|promo\s+pack|economy\s+pack|value\s+pack)\b/i,
  /\b(?:100%\s*(?:natural|pure|recycled|whole\s*grain|organic)|no\s+added\s+sugar|zero\s+sugar|fat\s+free)\b/i,
  /\b(?:satisfaction\s+guaranteed|premium\s+quality|quality\s+guaranteed|proudly\s+(?:made|produced))\b/i,
  /\b\d+(\.\d+)?%\s*(?:of\s*)?(?:germs?|clean|less|more|free|protection|natural|effective)\b/i,
];

// Patterns for lines containing regulatory, manufacturing, expiry, batch, and date information
const REGULATORY_AND_DATE_PATTERNS = [
  /\b(?:nafdac(?:\s*reg(?:\s*no)?)?|fda(?:\s*no)?|iso\s*\d+|halal|kosher|ce\s*mark)\b/i,
  /\b(?:batch(?:\s*no)?|lot(?:\s*no)?|b\.?n\.?|b\/no)\s*[:#-]?\s*[a-zA-Z0-9]+/i,
  /\b(?:mfg|mfd|exp|expiry|exp\.|best\s+before|use\s+by|bb)\s*[:#-]?\s*\d+/i,
  /\b(?:best\s+before|expiry\s+date|date\s+of\s+manufacture|manufacturing\s+date)\b/i,
];

// Patterns for lines containing instructions, warnings, storage, and serving suggestions
const INSTRUCTIONS_AND_USAGE_PATTERNS = [
  /\b(?:directions?\s*(?:for\s*use)?|instructions?|how\s+to\s+use|how\s+to\s+prepare|cooking\s+instructions)\b/i,
  /\b(?:for\s+external\s+use\s+only|keep\s+out\s+of\s+reach\s*(?:of\s*children)?|avoid\s+contact\s+with\s+eyes|do\s+not\s+swallow)\b/i,
  /\b(?:shake\s+well(?:\s+before\s+use)?|apply\s+evenly|lather\s+and\s+rinse|wash\s+thoroughly)\b/i,
  /\b(?:store\s+in\s+a\s+cool|keep\s+dry|keep\s+frozen|refrigerate\s+after\s+opening|protect\s+from\s+sunlight)\b/i,
  /\b(?:serving\s+suggestion|serve\s+chilled|ready\s+to\s+eat|cook\s+thoroughly)\b/i,
];

// Patterns for lines containing contact info, addresses, websites, legal, and barcode labels
const CONTACT_AND_LEGAL_PATTERNS = [
  /\b(?:customer\s+care|consumer\s+care|consumer\s+helpline|helpline|careline|call\s*us)\b/i,
  /\b(?:manufactured\s+by|produced\s+by|distributed\s+by|packed\s+by|made\s+in|product\s+of)\b/i,
  /\b(?:tel\b|phone|email|po\s*box|p\.o\.\s*box|www\.|https?:\/\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i,
  /\b(?:registered\s+trademark|all\s+rights\s+reserved|ltd\.?|plc\.?|inc\.?|corp\.?|llc\.?)\b/i,
  /\b(?:barcode|ean|upc)\s*[:#-]?\s*\d+\b/i,
];

// Patterns for nutritional facts and ingredient lists
const NUTRITION_AND_INGREDIENT_PATTERNS = [
  /\b(?:ingredients?|contains?|may\s+contain|allergen(?:\s*advice)?)\b/i,
  /\b(?:nutrition(?:\s*facts|\s*information)?|energy|calories|protein|carbohydrates?|fat\b|saturated\s+fat|sodium|dietary\s+fiber)\b/i,
  /\bper\s+(?:100g|100ml|serving|portion|pack)\b/i,
];

// Measurement pattern: check if line is purely or predominantly a size / weight
const PURE_MEASUREMENT_PATTERN = /^(?:net\s*(?:wt\.?|weight|vol\.?|volume)?\s*)?(?:[e\u212e]\s*)?(?:\d+\s*(?:x|\*|×)\s*)?\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|cl|ltr|l|oz|fl\s*oz|litres?|grams?|pieces|pcs|sachets|packs)\b/i;

// Single worker instance cached across calls to avoid re-initializing
let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

/**
 * Preprocesses and downsamples an image via Canvas to optimize OCR speed and memory usage.
 */
export async function preprocessImage(imageSource: CanvasImageSource | Blob | File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleLoad = () => {
      const maxDim = 1280;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img.src);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl);
    };

    img.onerror = (e) => reject(new Error('Failed to load image for packaging OCR: ' + e));

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    } else if ('getContext' in imageSource) {
      resolve((imageSource as HTMLCanvasElement).toDataURL('image/jpeg', 0.85));
      return;
    } else {
      resolve('');
    }

    if (img.complete && img.naturalWidth > 0) {
      handleLoad();
    } else {
      img.onload = handleLoad;
    }
  });
}

/**
 * Performs OCR recognition on a packaging image and extracts structured product details.
 */
export async function recognizePackagingText(
  imageSource: CanvasImageSource | Blob | File | string,
  onProgress?: (progress: number, status: string) => void,
  context?: ParsePackagingContext
): Promise<ParsedPackagingResult> {
  onProgress?.(10, 'Preprocessing image...');
  const optimizedImageData = await preprocessImage(imageSource);

  onProgress?.(30, 'Initializing OCR engine...');
  const worker = await getOcrWorker();

  onProgress?.(60, 'Scanning packaging text...');
  const ret = await worker.recognize(optimizedImageData);
  const rawText = ret.data.text || '';

  onProgress?.(90, 'Extracting supermarket fields...');
  const parsed = parseProductText(rawText, context);
  onProgress?.(100, 'Complete');

  return parsed;
}

/**
 * Converts text into clean Title Case while preserving acronyms and lowercase conjunctions.
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  const lowerWords = new Set(['and', '&', 'of', 'in', 'with', 'for', 'to', 'at', 'on', 'a', 'an', 'the']);
  return str
    .split(/\s+/)
    .map((word, idx) => {
      if (!word) return '';
      // Preserve standard unit acronyms
      if (/^(?:fmcg|sku|ean|upc|ml|cl|g|kg|l|oz)$/i.test(word)) {
        return word.toUpperCase();
      }
      const lower = word.toLowerCase();
      if (idx > 0 && lowerWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .trim();
}

/**
 * Checks whether an OCR line represents a marketing slogan, date, instruction, or noise.
 */
export function isSloganOrNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return true;

  for (const pattern of MARKETING_SLOGAN_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  for (const pattern of REGULATORY_AND_DATE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  for (const pattern of INSTRUCTIONS_AND_USAGE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  for (const pattern of CONTACT_AND_LEGAL_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  for (const pattern of NUTRITION_AND_INGREDIENT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  if (PURE_MEASUREMENT_PATTERN.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Parses raw text extracted from packaging OCR into structured product fields.
 * Follows the required identification priority:
 * 1. Scanned barcode lookup against local DB / catalogue.
 * 2. OCR contextual extraction for product name, size, variant, colour, and category.
 * 3. Flagging uncertain fields for manual review rather than inventing names.
 */
export function parseProductText(
  text: string,
  context?: ParsePackagingContext
): ParsedPackagingResult {
  const rawLines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const confidence: FieldConfidenceMap = {
    productName: 'needs-review',
    sizeQuantity: 'needs-review',
    variant: 'needs-review',
    colour: 'needs-review',
    category: 'needs-review',
    barcode: 'needs-review',
  };

  let detectedBarcode = context?.scannedBarcode || '';
  let detectedBrand = '';
  let detectedSize = '';
  let detectedPackQty = '';

  // 1. Identify Barcode: Check context first, then explicit labels, catalogue barcodes, or 8/12-14 digit sequences
  if (detectedBarcode) {
    confidence.barcode = 'verified';
  } else {
    const labeledBarcodeMatch = text.match(/\b(?:barcode|ean|upc|code)\s*[:#-]?\s*(\d{8}|\d{12,14})\b/i);
    if (labeledBarcodeMatch) {
      detectedBarcode = labeledBarcodeMatch[1];
      confidence.barcode = 'verified';
    } else {
      // Check against SUPERMARKET_CATALOGUE barcodes first for high confidence
      for (const code of Object.keys(SUPERMARKET_CATALOGUE)) {
        if (text.includes(code)) {
          detectedBarcode = code;
          confidence.barcode = 'verified';
          break;
        }
      }

      if (!detectedBarcode) {
        const standaloneBarcodeMatch = text.match(/\b(\d{13}|\d{12}|\d{14}|\d{8})\b/);
        if (standaloneBarcodeMatch) {
          const val = standaloneBarcodeMatch[1];
          // Exclude 8-digit numbers that look like dates (e.g. 20261025)
          if (!/^20\d{6}$/.test(val)) {
            detectedBarcode = val;
            confidence.barcode = 'suggested';
          }
        }
      }
    }
  }

  // 2. Identify Brand for exclusion and cleaning purposes only (Brand field is removed from user interface)
  const sortedKnownBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sortedKnownBrands) {
    const regex = new RegExp(`\\b${escapeRegExp(b)}\\b`, 'i');
    if (regex.test(text)) {
      detectedBrand = b;
      break;
    }
  }

  // Fallback brand recognition from lines if not in KNOWN_BRANDS
  if (!detectedBrand) {
    for (const line of rawLines) {
      const cleanLine = line.replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
      const words = cleanLine.split(/\s+/).filter(Boolean);
      if (
        words.length >= 1 &&
        words.length <= 3 &&
        cleanLine.length >= 2 &&
        cleanLine.length <= 25 &&
        !isSloganOrNoiseLine(cleanLine) &&
        !/^\d+$/.test(cleanLine)
      ) {
        const variantCheck = detectVariant(cleanLine);
        const sizeCheck = cleanLine.match(/\b\d+\s*(?:g|kg|ml|cl|l|oz|pieces|pcs)\b/i);
        if (!variantCheck.variant && !sizeCheck) {
          detectedBrand = cleanLine;
          break;
        }
      }
    }
  }

  // 3. Identify Size / Quantity & Multipack configurations
  const sizeMultiplierRegex = /\b(\d+)\s*(?:x|\*|×|\u00D7)\s*(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|ltr|l|oz|fl\s*oz|grams?|kilograms?|litres?|millilitres?))\b/i;
  const sizeStandardRegex = /\b(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|cl|ltr|l|oz|fl\s*oz|litres?|grams?)\b/i;
  const packOnlyRegex = /\b(\d+)\s*(?:pcs|pieces|sachets|packs|pk|bottles|cans|bars|rolls|tablets)\b/i;

  const multiplierMatch = text.match(sizeMultiplierRegex);
  if (multiplierMatch) {
    const split = splitSizeAndPackQuantity(multiplierMatch[0]);
    detectedSize = split.sizeQuantity;
    detectedPackQty = split.packQuantity || '';
    confidence.sizeQuantity = 'verified';
  } else {
    const standardMatch = text.match(sizeStandardRegex);
    if (standardMatch) {
      const num = standardMatch[1];
      let unit = standardMatch[2];
      const lowerUnit = unit.toLowerCase();
      if (lowerUnit === 'l' || lowerUnit === 'ltr' || lowerUnit === 'litres' || lowerUnit === 'litre') {
        unit = 'L';
      } else {
        unit = lowerUnit;
      }
      detectedSize = `${num}${unit}`;
      confidence.sizeQuantity = 'verified';
    }
    const packMatch = text.match(packOnlyRegex);
    if (packMatch) {
      detectedPackQty = packMatch[0];
      if (!detectedSize) {
        detectedSize = detectedPackQty;
        confidence.sizeQuantity = 'verified';
      }
    }
  }

  // 4. Identify Variant
  const variantResult = detectVariant(text, { brand: detectedBrand });
  const detectedVariant = variantResult.variant;
  if (detectedVariant) {
    confidence.variant = variantResult.confidence;
  }

  // 5. Identify Colour
  const colourResult = detectColour(text);
  const detectedColour = colourResult ? colourResult.colour : '';
  if (detectedColour) {
    confidence.colour = colourResult?.confidence || 'suggested';
  }

  // 6. Identify Product Name: Check Priority 1 & 2 (Barcode Lookup) -> Priority 3 & 4 (OCR contextual rules)
  let candidateName = '';

  // Check if barcode matches local inventory or supermarket catalogue
  const barcodeToLookup = detectedBarcode || context?.scannedBarcode;
  if (barcodeToLookup && SUPERMARKET_CATALOGUE[barcodeToLookup]) {
    candidateName = SUPERMARKET_CATALOGUE[barcodeToLookup].productName;
    confidence.productName = 'verified';
    if (!detectedSize) detectedSize = SUPERMARKET_CATALOGUE[barcodeToLookup].sizeQuantity;
  } else if (barcodeToLookup && context?.existingProducts) {
    const match = context.existingProducts.find((p) => p.barcode === barcodeToLookup);
    if (match && match.productName) {
      candidateName = match.productName;
      confidence.productName = 'verified';
      if (!detectedSize) detectedSize = match.sizeQuantity;
    }
  }

  // If still unidentified from barcode lookup, process OCR lines contextually
  if (!candidateName) {
    candidateName = extractProductNameFromLines(
      rawLines,
      detectedBrand,
      detectedSize,
      detectedPackQty,
      detectedVariant,
      detectedColour,
      detectedBarcode,
      confidence
    );
  }

  // 7. Suggest Category using existing category engine
  let detectedCategory = '';
  const catResult = suggestCategory(candidateName, detectedBrand, detectedVariant);
  if (catResult && catResult.confidence >= 55) {
    detectedCategory = catResult.category;
    confidence.category = catResult.confidence >= 75 ? 'verified' : 'suggested';
  } else {
    detectedCategory = '';
    confidence.category = 'needs-review';
  }

  return {
    rawText: text,
    brand: detectedBrand || undefined,
    productName: candidateName,
    sizeQuantity: detectedSize,
    packQuantity: detectedPackQty || undefined,
    variant: detectedVariant,
    colour: detectedColour,
    barcode: detectedBarcode || undefined,
    category: detectedCategory,
    confidence,
  };
}

/**
 * Contextually scores candidate OCR lines to extract the genuine product name,
 * filtering out brand names, slogans, measurements, nutrition, instructions, and dates.
 */
function extractProductNameFromLines(
  rawLines: string[],
  detectedBrand: string,
  detectedSize: string,
  detectedPackQty: string,
  detectedVariant: string,
  detectedColour: string,
  detectedBarcode: string,
  confidence: FieldConfidenceMap
): string {
  interface ScoredCandidate {
    originalLine: string;
    cleanedName: string;
    score: number;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const line = rawLines[lineIndex].trim();
    if (!line) continue;

    // Reject lines that are slogans, dates, regulatory marks, instructions, or pure measurements
    if (isSloganOrNoiseLine(line)) {
      continue;
    }

    // Check if line is solely a known brand
    const isPureBrand = KNOWN_BRANDS.some(
      (b) => line.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
    ) || (detectedBrand && line.localeCompare(detectedBrand, undefined, { sensitivity: 'accent' }) === 0);

    if (isPureBrand) {
      continue;
    }

    // Strip brand from line if present at beginning or end
    let cleanLine = line;
    if (detectedBrand) {
      cleanLine = cleanLine.replace(new RegExp(`^${escapeRegExp(detectedBrand)}\\b`, 'i'), '').trim();
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBrand)}$`, 'i'), '').trim();
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBrand)}\\b`, 'gi'), '').trim();
    }
    for (const b of KNOWN_BRANDS) {
      if (new RegExp(`^${escapeRegExp(b)}\\b`, 'i').test(cleanLine)) {
        cleanLine = cleanLine.replace(new RegExp(`^${escapeRegExp(b)}\\b`, 'i'), '').trim();
      }
    }

    // Strip measurements and barcodes from the candidate line
    if (detectedSize) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedSize)}\\b`, 'gi'), '').trim();
    }
    if (detectedPackQty) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedPackQty)}\\b`, 'gi'), '').trim();
    }
    if (detectedBarcode) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBarcode)}\\b`, 'g'), '').trim();
    }
    // Remove standalone measurements embedded in the line (e.g. "250ml", "100g")
    cleanLine = cleanLine.replace(/\b\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|ltr|l|oz|fl\s*oz)\b/gi, '').trim();

    // Clean special punctuation
    cleanLine = cleanLine.replace(/[^a-zA-Z0-9\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanLine.length < 3 || cleanLine.length > 55) {
      continue;
    }

    // Re-check after stripping: is it pure slogan, variant, or colour?
    if (isSloganOrNoiseLine(cleanLine)) {
      continue;
    }

    const lowerClean = cleanLine.toLowerCase();

    // Compute contextual score
    let score = 20;

    // Positive Signal A: Matches a known multi-word product noun pattern (highest priority)
    let matchedNoun = false;
    for (const noun of PRODUCT_NOUN_PATTERNS) {
      if (lowerClean.includes(noun)) {
        score += 65 + noun.length * 1.5;
        matchedNoun = true;
        break;
      }
    }

    // Positive Signal B: Word count (2 to 4 words is ideal for a product name)
    const wordCount = cleanLine.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 4) {
      score += 20;
    } else if (wordCount === 1) {
      // Single word: boost if it's a known product noun, else penalize
      if (matchedNoun) score += 10;
      else score -= 15;
    } else {
      score -= (wordCount - 4) * 10;
    }

    // Positive Signal C: Position in packaging (first 3 non-noise lines are top candidates)
    if (lineIndex === 0) score += 20;
    else if (lineIndex === 1) score += 15;
    else if (lineIndex === 2) score += 10;
    else score -= Math.min(25, (lineIndex - 2) * 5);

    // Negative Signal: Line is identical to detected variant or colour alone
    if (detectedVariant && lowerClean === detectedVariant.toLowerCase()) {
      score -= 50;
    }
    if (detectedColour && lowerClean === detectedColour.toLowerCase()) {
      score -= 50;
    }

    scoredCandidates.push({
      originalLine: line,
      cleanedName: toTitleCase(cleanLine),
      score,
    });
  }

  // Sort candidates by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length > 0 && scoredCandidates[0].score >= 35) {
    const winner = scoredCandidates[0];
    confidence.productName = winner.score >= 60 ? 'suggested' : 'needs-review';
    return winner.cleanedName;
  }

  // If no confident candidate was found, flag for manual review
  confidence.productName = 'needs-review';
  return scoredCandidates.length > 0 ? scoredCandidates[0].cleanedName : '';
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
