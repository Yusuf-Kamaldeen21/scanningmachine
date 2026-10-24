import { db } from '../db';
import type { DuplicateCheckResult, ProductRecord } from '../types';

/**
 * Checks if a product is a duplicate of an existing record.
 * 1. Exact barcode match (if barcode is non-empty).
 * 2. If barcode is empty or unbarcoded, checks for exact match on Brand + ProductName + Size + Variant.
 *
 * NOTE: Products with the same Brand and Product Name but DIFFERENT sizes, flavours, or pack configurations
 * are distinct SKUs / related variants, NOT duplicates.
 */
export async function checkForDuplicateProduct(
  candidate: {
    id?: string;
    barcode?: string;
    brand: string;
    productName: string;
    sizeQuantity: string;
    variant?: string;
  }
): Promise<DuplicateCheckResult> {
  const cleanBarcode = candidate.barcode?.trim() || '';

  // 1. Exact Barcode check
  if (cleanBarcode) {
    const existingWithBarcode = await db.products
      .where('barcode')
      .equals(cleanBarcode)
      .first();

    if (existingWithBarcode && existingWithBarcode.id !== candidate.id) {
      return {
        isDuplicate: true,
        existingProduct: existingWithBarcode,
        matchType: 'barcode',
        matchReason: `Barcode ${cleanBarcode} is already registered to "${existingWithBarcode.brand} - ${existingWithBarcode.productName}" (${existingWithBarcode.sizeQuantity})`,
      };
    }
  }

  // 2. Matching for non-barcoded or unbarcoded items
  const cleanBrand = candidate.brand.trim().toLowerCase();
  const cleanName = candidate.productName.trim().toLowerCase();
  const cleanSize = candidate.sizeQuantity.trim().toLowerCase();
  const cleanVariant = (candidate.variant || '').trim().toLowerCase();

  if (cleanBrand && cleanName) {
    const allProducts = await db.products.toArray();
    const exactMatch = allProducts.find((p) => {
      if (p.id === candidate.id) return false;

      const pBrand = p.brand.trim().toLowerCase();
      const pName = p.productName.trim().toLowerCase();
      const pSize = p.sizeQuantity.trim().toLowerCase();
      const pVariant = (p.variant || '').trim().toLowerCase();

      // Brand and name must match
      if (pBrand !== cleanBrand || pName !== cleanName) {
        return false;
      }

      // If sizes are provided and different -> different SKU, NOT a duplicate
      if (cleanSize && pSize && cleanSize !== pSize) {
        return false;
      }

      // If variants are provided and different -> different flavour/SKU, NOT a duplicate
      if (cleanVariant && pVariant && cleanVariant !== pVariant) {
        return false;
      }

      // If both size and variant match (or both are missing)
      return true;
    });

    if (exactMatch) {
      return {
        isDuplicate: true,
        existingProduct: exactMatch,
        matchType: 'fuzzy',
        matchReason: `Identical product SKU already exists: "${exactMatch.brand} - ${exactMatch.productName} (${exactMatch.sizeQuantity}${exactMatch.variant ? ', ' + exactMatch.variant : ''})"`,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: 'none',
  };
}

/**
 * Identify all duplicate groups in an array of products (useful for bulk auditing).
 */
export function identifyDuplicateBarcodes(products: ProductRecord[]): Map<string, ProductRecord[]> {
  const barcodeGroups = new Map<string, ProductRecord[]>();

  for (const p of products) {
    const code = p.barcode?.trim();
    if (!code) continue;

    if (!barcodeGroups.has(code)) {
      barcodeGroups.set(code, []);
    }
    barcodeGroups.get(code)!.push(p);
  }

  // Filter to only groups with >1 record
  const duplicatesOnly = new Map<string, ProductRecord[]>();
  for (const [code, group] of barcodeGroups.entries()) {
    if (group.length > 1) {
      duplicatesOnly.set(code, group);
    }
  }

  return duplicatesOnly;
}
