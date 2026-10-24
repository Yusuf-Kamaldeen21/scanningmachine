import { createWorker } from 'tesseract.js';
import type { FieldConfidenceMap } from '../types';
import { suggestCategory } from './categorySuggester';
import { detectVariant, detectColour, splitSizeAndPackQuantity } from './variantDetector';

export interface ParsedPackagingResult {
  rawText: string;
  brand: string;
  productName: string;
  sizeQuantity: string;
  packQuantity?: string;
  variant: string;
  colour: string;
  category: string;
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
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && !/^[0-9\W]+$/.test(l));

  const confidence: FieldConfidenceMap = {
    brand: 'needs-review',
    productName: 'needs-review',
    sizeQuantity: 'needs-review',
    variant: 'needs-review',
    colour: 'needs-review',
    category: 'needs-review',
  };

  let detectedBrand = '';
  let detectedSize = '';
  let detectedPackQty = '';

  // 1. Identify Brand: match against KNOWN_BRANDS or pick top prominent word
  for (const b of KNOWN_BRANDS) {
    const regex = new RegExp(`\\b${escapeRegExp(b)}\\b`, 'i');
    if (regex.test(text)) {
      detectedBrand = b;
      confidence.brand = 'verified';
      break;
    }
  }

  // Fallback brand from first line if not found in dictionary
  if (!detectedBrand && lines.length > 0) {
    const firstLine = lines[0].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (firstLine && firstLine.length <= 25) {
      detectedBrand = firstLine;
      confidence.brand = 'suggested';
    }
  }

  // 2. Identify Size / Quantity & Pack configurations
  // Patterns like "170g", "500ml", "1kg", "1.5L", "12 x 170g", "70g (Pack of 12)"
  const sizeMultiplierRegex = /\b(\d+)\s*(?:x|\*)\s*(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|l|oz|fl\s*oz|ltr))\b/i;
  const sizeStandardRegex = /\b(\d+(?:\.\d+)?\s*(?:g|kg|ml|cl|l|oz|fl\s*oz|ltr|litres?|grams?))\b/i;
  const packOnlyRegex = /\b(\d+)\s*(?:pcs|pieces|sachets|packs|pk|bottles|cans|bars|rolls)\b/i;

  const multiplierMatch = text.match(sizeMultiplierRegex);
  if (multiplierMatch) {
    const split = splitSizeAndPackQuantity(multiplierMatch[0]);
    detectedSize = split.sizeQuantity;
    detectedPackQty = split.packQuantity || '';
    confidence.sizeQuantity = 'verified';
  } else {
    const standardMatch = text.match(sizeStandardRegex);
    if (standardMatch) {
      detectedSize = standardMatch[1].replace(/\s+/g, '');
      confidence.sizeQuantity = 'verified';
    }
    const packMatch = text.match(packOnlyRegex);
    if (packMatch) {
      detectedPackQty = packMatch[0];
      if (!detectedSize) {
        detectedSize = detectedPackQty;
        confidence.sizeQuantity = 'suggested';
      }
    }
  }

  // 3. Identify Variant
  const variantResult = detectVariant(text);
  const detectedVariant = variantResult.variant;
  if (detectedVariant) {
    confidence.variant = variantResult.confidence;
  }

  // 4. Identify Colour
  const colourResult = detectColour(text);
  const detectedColour = colourResult ? colourResult.colour : '';
  if (detectedColour) {
    confidence.colour = colourResult?.confidence || 'suggested';
  }

  // 5. Identify Product Name: clean text after removing brand, size, variant tokens
  let candidateName = '';
  for (const line of lines) {
    let cleanLine = line;
    if (detectedBrand) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedBrand)}\\b`, 'gi'), '');
    }
    if (detectedSize) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedSize)}\\b`, 'gi'), '');
    }
    if (detectedVariant) {
      cleanLine = cleanLine.replace(new RegExp(`\\b${escapeRegExp(detectedVariant)}\\b`, 'gi'), '');
    }
    cleanLine = cleanLine.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanLine.length >= 3 && cleanLine.length <= 40) {
      // Prioritize food/supermarket descriptors
      candidateName = cleanLine;
      confidence.productName = 'suggested';
      break;
    }
  }

  if (!candidateName && lines.length > 1) {
    candidateName = lines[1].slice(0, 35).trim();
  }

  // 6. Suggest Category
  const catResult = suggestCategory(candidateName, detectedBrand, detectedVariant);
  const detectedCategory = catResult ? catResult.category : 'Food & Groceries';
  if (catResult && catResult.confidence >= 70) {
    confidence.category = 'verified';
  } else if (catResult) {
    confidence.category = 'suggested';
  }

  return {
    rawText: text,
    brand: detectedBrand || '',
    productName: candidateName || '',
    sizeQuantity: detectedSize || '',
    packQuantity: detectedPackQty || undefined,
    variant: detectedVariant || '',
    colour: detectedColour || '',
    category: detectedCategory,
    confidence,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
