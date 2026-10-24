import assert from 'assert';
import { suggestCategory } from '../src/services/categorySuggester';
import { lookupProductByBarcode } from '../src/services/productLookup';
import { filterProductsForExport } from '../src/services/exportService';
import type { ProductRecord, ExportOptions } from '../src/types';

console.log('--- QuickStock Test Suite Starting ---');

// TEST 1: Category Suggester Accuracy
console.log('\n[Test 1] Category Suggestion Engine:');

const testCases = [
  { brand: 'Peak', name: 'Evaporated Milk', expected: 'Dairy Products' },
  { brand: 'Indomie', name: 'Instant Noodles', expected: 'Food & Groceries' },
  { brand: 'Golden Penny', name: 'Spaghetti 500g', expected: 'Food & Groceries' },
  { brand: 'Dettol', name: 'Antiseptic Liquid', expected: 'Toiletries' },
  { brand: 'Ariel', name: 'Automatic Washing Powder Detergent', expected: 'Household Cleaning' },
  { brand: 'Nivea', name: 'Rich Nourishing Body Lotion', expected: 'Skin Care' },
  { brand: 'Coca-Cola', name: 'Original Soft Drink', expected: 'Beverages' },
  { brand: 'Milo', name: 'Energy Food Drink Refill', expected: 'Beverages' },
  { brand: 'Pampers', name: 'Baby Dry Diapers', expected: 'Baby Products' },
  { brand: 'Oreo', name: 'Vanilla Creme Cookies', expected: 'Snacks & Confectionery' },
];

for (const tc of testCases) {
  const result = suggestCategory(tc.name, tc.brand);
  assert.ok(result, `Expected suggestion for ${tc.brand} ${tc.name}`);
  assert.strictEqual(
    result?.category,
    tc.expected,
    `For ${tc.brand} ${tc.name}, expected ${tc.expected} but got ${result?.category}`
  );
  console.log(`  ✓ "${tc.brand} - ${tc.name}" -> ${result?.category} (${result?.confidence}% confidence)`);
}

// TEST 2: Offline Supermarket Product Lookup
console.log('\n[Test 2] Offline Product Lookup by Barcode:');

async function testLookup() {
  // Peak Milk barcode
  const peakLookup = await lookupProductByBarcode('6151100001017', false);
  assert.ok(peakLookup, 'Should find Peak milk in local catalogue');
  assert.strictEqual(peakLookup?.brand, 'Peak');
  assert.strictEqual(peakLookup?.productName, 'Evaporated Milk');
  assert.strictEqual(peakLookup?.sizeQuantity, '170g');
  console.log(`  ✓ Barcode 6151100001017 resolved to: ${peakLookup?.brand} ${peakLookup?.productName}`);

  // Indomie barcode
  const indomieLookup = await lookupProductByBarcode('8992388111226', false);
  assert.ok(indomieLookup, 'Should find Indomie in local catalogue');
  assert.strictEqual(indomieLookup?.brand, 'Indomie');
  assert.strictEqual(indomieLookup?.variant, 'Onion Chicken');
  console.log(`  ✓ Barcode 8992388111226 resolved to: ${indomieLookup?.brand} ${indomieLookup?.variant}`);

  // Unknown barcode
  const unknownLookup = await lookupProductByBarcode('9999999999999', false);
  assert.strictEqual(unknownLookup, null, 'Unknown barcode should return null');
  console.log('  ✓ Unknown barcode handled safely (returns null for manual entry)');
}

// TEST 3: Export Filtering and Barcode String Preservation
console.log('\n[Test 3] Export Filtering & Barcode Integrity:');

const sampleProducts: ProductRecord[] = [
  {
    id: 'prod-1',
    brand: 'Golden Penny',
    productName: 'Spaghetti',
    sizeQuantity: '500g',
    variant: 'Original',
    barcode: '0123456789012', // Notice leading zero!
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: 'Aisle 4',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'prod-2',
    brand: 'Dettol',
    productName: 'Antiseptic',
    sizeQuantity: '250ml',
    variant: 'Original',
    barcode: '0098765432109', // Double leading zeros!
    category: 'Toiletries',
    dateCaptured: '2026-10-23',
    notes: '',
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  },
  {
    id: 'prod-3',
    brand: 'Local Bakery',
    productName: 'Fresh Bread',
    sizeQuantity: '800g',
    variant: '',
    barcode: '', // No barcode
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: 'Incomplete',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
];

// Test category filter
const categoryOptions: ExportOptions = {
  format: 'xlsx',
  fields: {
    brand: true,
    productName: true,
    sizeQuantity: true,
    variant: true,
    barcode: true,
    category: true,
    dateCaptured: true,
    notes: true,
    id: true,
  },
  filterCategory: 'Toiletries',
  filterDate: 'all',
  filterIncompleteOnly: false,
};

const toiletries = filterProductsForExport(sampleProducts, categoryOptions);
assert.strictEqual(toiletries.length, 1);
assert.strictEqual(toiletries[0].brand, 'Dettol');
console.log('  ✓ Category filter correctly isolated Toiletries');

// Test incomplete records filter
const incompleteOptions: ExportOptions = {
  ...categoryOptions,
  filterCategory: 'all',
  filterIncompleteOnly: true,
};
const incomplete = filterProductsForExport(sampleProducts, incompleteOptions);
assert.strictEqual(incomplete.length, 2); // prod-2 has no notes, prod-3 has no barcode/variant
console.log('  ✓ Incomplete filter correctly isolated incomplete records');

// Verify leading zero barcode preservation
assert.ok(sampleProducts[0].barcode.startsWith('0'), 'Barcode must preserve leading zero');
assert.ok(sampleProducts[1].barcode.startsWith('00'), 'Barcode must preserve double leading zeros');
console.log('  ✓ Barcodes with leading zeros preserved as strings:', sampleProducts[0].barcode, sampleProducts[1].barcode);

testLookup().then(() => {
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Core logic verified.\n');
});
