import { db } from '../db';
import type { DuplicateCheckResult } from '../types';

/**
 * Checks if a product is a duplicate of an existing record.
 * 1. Checks exact barcode match (if barcode is non-empty).
 * 2. If barcode is empty or no barcode match, checks fuzzy match on Brand + ProductName + Size + Variant.
 * Excludes the current product's id if editing an existing product.
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

  // 1. Barcode check
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
        matchReason: `Barcode ${cleanBarcode} is already registered to "${existingWithBarcode.brand} - ${existingWithBarcode.productName}"`,
      };
    }
  }

  // 2. Fuzzy match for non-barcode or unbarcoded items
  const cleanBrand = candidate.brand.trim().toLowerCase();
  const cleanName = candidate.productName.trim().toLowerCase();
  const cleanSize = candidate.sizeQuantity.trim().toLowerCase();
  const cleanVariant = (candidate.variant || '').trim().toLowerCase();

  if (cleanBrand && cleanName) {
    // Check all products with similar brand and name
    const allProducts = await db.products.toArray();
    const fuzzyMatch = allProducts.find((p) => {
      if (p.id === candidate.id) return false;

      const pBrand = p.brand.trim().toLowerCase();
      const pName = p.productName.trim().toLowerCase();
      const pSize = p.sizeQuantity.trim().toLowerCase();
      const pVariant = (p.variant || '').trim().toLowerCase();

      // If brand, name, and size match closely
      const brandMatch = pBrand === cleanBrand;
      const nameMatch = pName === cleanName || pName.includes(cleanName) || cleanName.includes(pName);
      const sizeMatch = !cleanSize || !pSize || pSize === cleanSize;
      const variantMatch = !cleanVariant || !pVariant || pVariant === cleanVariant;

      return brandMatch && nameMatch && sizeMatch && variantMatch;
    });

    if (fuzzyMatch) {
      return {
        isDuplicate: true,
        existingProduct: fuzzyMatch,
        matchType: 'fuzzy',
        matchReason: `Similar item found: "${fuzzyMatch.brand} - ${fuzzyMatch.productName} (${fuzzyMatch.sizeQuantity})" captured on ${fuzzyMatch.dateCaptured}`,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: 'none',
  };
}
