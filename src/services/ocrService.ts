import { createWorker } from 'tesseract.js';
import type { FieldConfidenceMap } from '../types';
import { suggestCategory } from './categorySuggester';
import { detectVariant, detectColour, splitSizeAndPackQuantity } from './variantDetector';
import { SUPERMARKET_CATALOGUE } from './productLookup';

export interface ParsedPackagingResult {
  rawText: string;
  brand: string;
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

// Known supermarket FMCG Brands for accurate matching from OCR noise
const KNOWN_BRANDS: string[] = [
  'Peak',
  'Indomie',
  'Golden Penny',
  'Dettol',
  'Nestle',
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
];

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

      // Draw and apply mild contrast & brightness filter for clear OCR
      ctx.drawImage(img, 0, 0, width, height);

      // Return downscaled JPEG data URL
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
  onProgress?: (progress: number, status: string) => void
): Promise<ParsedPackagingResult> {
  onProgress?.(10, 'Preprocessing image...');
  const optimizedImageData = await preprocessImage(imageSource);

  onProgress?.(30, 'Initializing OCR engine...');
  const worker = await getOcrWorker();

  onProgress?.(60, 'Scanning packaging text...');
  const ret = await worker.recognize(optimizedImageData);
  const rawText = ret.data.text || '';

  onProgress?.(90, 'Extracting supermarket fields...');
  const parsed = parseProductText(rawText);
  onProgress?.(100, 'Complete');

  return parsed;
}

/**
 * Parses raw text extracted from packaging OCR into structured product fields.
 */
export function parseProductText(text: string): ParsedPackagingResult {
  const rawLines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const confidence: FieldConfidenceMap = {
    brand: 'needs-review',
    productName: 'needs-review',
    sizeQuantity: 'needs-review',
    variant: 'needs-review',
    colour: 'needs-review',
    category: 'needs-review',
    barcode: 'needs-review',
  };

  let detectedBarcode = '';
  let detectedBrand = '';
  let detectedSize = '';
  let detectedPackQty = '';

  // 1. Identify Barcode: Check for explicit barcode tags, catalogue barcodes, or 8/12-14 digit sequences
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

  // 2. Identify Brand: match against KNOWN_BRANDS (sorted longest first to avoid substring collision)
  const sortedKnownBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sortedKnownBrands) {
    const regex = new RegExp(`\\b${escapeRegExp(b)}\\b`, 'i');
    if (regex.test(text)) {
      detectedBrand = b;
      confidence.brand = 'verified';
      break;
    }
  }

  // Patterns for lines that are definitely NOT brand names (ingredients, nutritional facts, instructions, etc.)
  const NON_BRAND_PATTERNS = /^(ingredients?|nutrition|facts|serving|directions?|instructions?|store|keep|batch|mfg|exp|expiry|best before|net wt|net weight|barcode|ean|upc|flavour|flavor|product of|warning|caution|contains|made in|produced|distributed|recycle|halal|nafdac|reg|consumer care|tel|email|phone|po box|www|http|composition|storage|special|delicious|original taste|premium quality|quality|rich & creamy)\b/i;

  // Fallback brand identification from lines if not in KNOWN_BRANDS
  if (!detectedBrand) {
    for (const line of rawLines) {
      const cleanLine = line.replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
      const words = cleanLine.split(/\s+/).filter(Boolean);
      // Valid brand candidates are concise (1-3 words, 2-25 characters), not noise/instructions, and not pure numbers
      if (
        words.length >= 1 &&
        words.length <= 3 &&
        cleanLine.length >= 2 &&
        cleanLine.length <= 25 &&
        !NON_BRAND_PATTERNS.test(cleanLine) &&
        !/^\d+$/.test(cleanLine)
      ) {
        const variantCheck = detectVariant(cleanLine);
        const sizeCheck = cleanLine.match(/\b\d+\s*(?:g|kg|ml|cl|l|oz|pieces|pcs)\b/i);
        if (!variantCheck.variant && !sizeCheck) {
          detectedBrand = cleanLine;
          confidence.brand = 'needs-review';
          break;
        }
      }
    }
  }

  // 3. Identify Size / Quantity & Multipack configurations
  // Multipliers: e.g. "12 x 170g", "12 × 50g", "40 x 70g", "6 * 330ml"
  const sizeMultiplierRegex = /\b(\d+)\s*(?:x|\*|×|\u00D7)\s*(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|ltr|l|oz|fl\s*oz|grams?|kilograms?|litres?|millilitres?))\b/i;
  // Standard units: e.g. "70g", "170g", "500ml", "1L", "5kg", "1.5L", "250ml"
  const sizeStandardRegex = /\b(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|cl|ltr|l|oz|fl\s*oz|litres?|grams?)\b/i;
  // Multipack piece counts: e.g. "6 pieces", "12 pieces", "50 pieces", "24 sachets"
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

  // 6. Identify Product Name: extract informative product name excluding brand, size, variant, colour, barcode tokens
  let candidateName = '';

  // If a known barcode was identified, catalogue has the verified product name
  if (detectedBarcode && SUPERMARKET_CATALOGUE[detectedBarcode]) {
    candidateName = SUPERMARKET_CATALOGUE[detectedBarcode].productName;
    confidence.productName = 'verified';
  } else {
    for (const line of rawLines) {
      let cleanLine = line;
      if (detectedBrand) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBrand)}\\b`, 'gi'), '');
      }
      if (detectedSize) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedSize)}\\b`, 'gi'), '');
      }
      if (detectedPackQty) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedPackQty)}\\b`, 'gi'), '');
      }
      if (detectedVariant) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedVariant)}\\b`, 'gi'), '');
      }
      if (detectedColour) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedColour)}\\b`, 'gi'), '');
      }
      if (detectedBarcode) {
        cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBarcode)}\\b`, 'g'), '');
      }

      // Clean special characters but preserve alphanumeric and ampersands
      cleanLine = cleanLine.replace(/[^a-zA-Z0-9\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();

      if (NON_BRAND_PATTERNS.test(cleanLine)) {
        continue;
      }

      if (cleanLine.length >= 3 && cleanLine.length <= 40) {
        candidateName = cleanLine;
        confidence.productName = 'suggested';
        break;
      }
    }

    if (!candidateName && rawLines.length > 1) {
      const secondLine = rawLines[1].replace(/[^a-zA-Z0-9\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (secondLine && !NON_BRAND_PATTERNS.test(secondLine) && secondLine.length <= 40) {
        candidateName = secondLine;
        confidence.productName = 'suggested';
      }
    }
  }

  // 7. Suggest Category: call existing category suggestion engine
  let detectedCategory = '';
  const catResult = suggestCategory(candidateName, detectedBrand, detectedVariant);
  if (catResult && catResult.confidence >= 60) {
    detectedCategory = catResult.category;
    confidence.category = catResult.confidence >= 75 ? 'verified' : 'suggested';
  } else {
    // If not determined confidently, leave unselected and flag for review
    detectedCategory = '';
    confidence.category = 'needs-review';
  }

  return {
    rawText: text,
    brand: detectedBrand || '',
    productName: candidateName || '',
    sizeQuantity: detectedSize || '',
    packQuantity: detectedPackQty || undefined,
    variant: detectedVariant || '',
    colour: detectedColour || '',
    barcode: detectedBarcode || undefined,
    category: detectedCategory,
    confidence,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
