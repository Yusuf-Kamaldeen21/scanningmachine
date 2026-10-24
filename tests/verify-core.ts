import assert from 'assert';
import { suggestCategory } from '../src/services/categorySuggester';
import { lookupProductByBarcode } from '../src/services/productLookup';
import { generateTSV } from '../src/services/exportService';
import { detectVariant, detectColour, splitSizeAndPackQuantity, findRelatedVariants } from '../src/services/variantDetector';
import { parseProductText } from '../src/services/ocrService';
import type { ProductRecord } from '../src/types';

console.log('====================================================');
console.log('   QuickStock Scanner — Automated Unit Test Suite   ');
console.log('====================================================');

// TEST 1: Category Suggestion Engine
console.log('\n[Test 1] Category Suggestion Hierarchy:');

const categoryTestCases = [
  { brand: 'Peak', name: 'Evaporated Milk', expected: 'Dairy Products' },
  { brand: 'Indomie', name: 'Instant Noodles', expected: 'Food & Groceries' },
  { brand: 'Golden Penny', name: 'Spaghetti 500g', expected: 'Food & Groceries' },
  { brand: 'Dettol', name: 'Antiseptic Liquid', expected: 'Personal Care' }, // Dettol antiseptic
  { brand: 'Ariel', name: 'Automatic Washing Powder Detergent', expected: 'Household Cleaning' },
  { brand: 'Nivea', name: 'Rich Nourishing Body Lotion', expected: 'Skin Care' },
  { brand: 'Coca-Cola', name: 'Original Soft Drink', expected: 'Beverages' },
  { brand: 'Bournvita', name: 'Malt Drink Powder 500g', expected: 'Beverages' },
  { brand: 'Pampers', name: 'Baby Dry Diapers', expected: 'Baby Products' },
  { brand: 'Oreo', name: 'Vanilla Creme Cookies', expected: 'Snacks & Confectionery' },
  { brand: 'Close Up', name: 'Red Hot Gel Toothpaste', expected: 'Toiletries' },
];

for (const tc of categoryTestCases) {
  const result = suggestCategory(tc.name, tc.brand);
  assert.ok(result, `Expected suggestion for ${tc.brand} ${tc.name}`);
  // Should match expected or related personal care / toiletries
  const matched = result?.category === tc.expected || (tc.expected === 'Personal Care' && result?.category === 'Toiletries');
  assert.ok(
    matched,
    `For ${tc.brand} ${tc.name}, expected ${tc.expected} but got ${result?.category}`
  );
  console.log(`  ✓ "${tc.brand} - ${tc.name}" -> ${result?.category} (${result?.confidence}% confidence)`);
}

// TEST 2: Variant & Colour Identification
console.log('\n[Test 2] Variant & Physical Colour Identification:');

// Test flavours / variants
const variantCases = [
  { text: 'Indomie Instant Noodles Onion Chicken 70g', expectedVariant: 'Onion Chicken' },
  { text: 'Indomie Instant Noodles Chicken Flavour 180g', expectedVariant: 'Chicken' },
  { text: 'Oreo Sandwich Cookies Chocolate Creme 154g', expectedVariant: 'Chocolate' },
  { text: 'Peak Evaporated Milk Full Cream 170g', expectedVariant: 'Full Cream' },
  { text: 'Dettol Antiseptic Liquid Original 250ml', expectedVariant: 'Original' },
  { text: 'Fanta Orange Flavoured Drink 500ml', expectedVariant: 'Orange' },
  { text: 'Sprite Lemon-Lime Soda 500ml', expectedVariant: 'Lemon' },
  { text: 'Gentle Soap Bar Unscented 100g', expectedVariant: 'Unscented' },
  { text: 'Beef Seasoning Cubes 50 pieces', expectedVariant: 'Beef' },
];

for (const vc of variantCases) {
  const vResult = detectVariant(vc.text);
  assert.ok(vResult.variant, `Failed to detect variant for: ${vc.text}`);
  assert.strictEqual(
    vResult.variant,
    vc.expectedVariant,
    `For "${vc.text}", expected variant "${vc.expectedVariant}" but got "${vResult.variant}"`
  );
  console.log(`  ✓ Variant: "${vc.text.slice(0, 30)}..." -> "${vResult.variant}"`);
}

// Test Colour Detection (ensuring colour is NOT confused with flavour)
const colourCases = [
  { text: 'Dettol Antiseptic Liquid Green 250ml', expectedColour: 'Green' },
  { text: 'Bournvita Malt Drink Brown 500g', expectedColour: 'Brown' },
  { text: 'Close Up Red Hot Gel Toothpaste Red Box', expectedColour: 'Red' },
  { text: 'Ariel Detergent White Scent', expectedColour: 'White' },
];

for (const cc of colourCases) {
  const cResult = detectColour(cc.text);
  assert.ok(cResult, `Failed to detect colour for: ${cc.text}`);
  assert.strictEqual(
    cResult?.colour,
    cc.expectedColour,
    `For "${cc.text}", expected colour "${cc.expectedColour}" but got "${cResult?.colour}"`
  );
  console.log(`  ✓ Colour: "${cc.text.slice(0, 30)}..." -> "${cResult?.colour}"`);
}

// TEST 3: Size vs Pack Quantity Distinction
console.log('\n[Test 3] Size vs Packaging Quantity Distinction:');

const sizeQuantityCases = [
  { input: '12 x 170g', expectedSize: '170g', expectedPack: '12 pieces' },
  { input: '40 x 70g', expectedSize: '70g', expectedPack: '40 pieces' },
  { input: '500ml (pack of 6)', expectedSize: '500ml', expectedPack: '6 pieces' },
  { input: '12 pieces', expectedSize: '12 pieces', expectedPack: '12 pieces' },
  { input: '1kg', expectedSize: '1kg', expectedPack: undefined },
];

for (const sq of sizeQuantityCases) {
  const result = splitSizeAndPackQuantity(sq.input);
  assert.strictEqual(result.sizeQuantity, sq.expectedSize);
  assert.strictEqual(result.packQuantity, sq.expectedPack);
  console.log(`  ✓ "${sq.input}" -> Unit Size: "${result.sizeQuantity}", Pack Quantity: "${result.packQuantity || 'N/A'}"`);
}

// TEST 4: Variant Product SKU Relationships (Distinct SKUs, NOT merged)
console.log('\n[Test 4] Variant Product SKU Relationships:');

const inventorySKUs: ProductRecord[] = [
  {
    id: 'sku-1',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Chicken',
    barcode: '6150000000001',
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'sku-2',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Onion',
    barcode: '6150000000010',
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'sku-3',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '120g',
    variant: 'Chicken',
    barcode: '6150000000011',
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
];

// Check related SKUs for sku-1
const related = findRelatedVariants(
  { brand: 'Indomie', productName: 'Instant Noodles', id: 'sku-1' },
  inventorySKUs
);
assert.strictEqual(related.length, 2, 'Indomie 70g Chicken should find 2 other related variants in inventory');
assert.ok(related.some((p) => p.variant === 'Onion'));
assert.ok(related.some((p) => p.sizeQuantity === '120g'));
console.log(`  ✓ Correctly found ${related.length} distinct related SKUs without merging sizes/flavours.`);

// TEST 5: Packaging Text OCR Parser
console.log('\n[Test 5] Packaging Text & Field Extraction:');

const mockPackagingOcrText = `
PEAK
EVAPORATED MILK
RICH & CREAMY
170g
ORIGINAL
`;

const parsed = parseProductText(mockPackagingOcrText);
assert.strictEqual(parsed.brand, 'Peak');
assert.strictEqual(parsed.sizeQuantity, '170g');
assert.strictEqual(parsed.variant, 'Original');
assert.strictEqual(parsed.category, 'Dairy Products');
assert.strictEqual(parsed.confidence.brand, 'verified');
console.log(`  ✓ Extracted from raw packaging text: Brand="${parsed.brand}", Name="${parsed.productName}", Size="${parsed.sizeQuantity}", Variant="${parsed.variant}", Category="${parsed.category}"`);

// TEST 6: TSV Clipboard Generation & Excel Barcode Preservation
console.log('\n[Test 6] TSV Clipboard Generation & Barcode Preservation:');

const promptExampleProducts: ProductRecord[] = [
  {
    id: 'prod-ex-1',
    brand: 'Peak',
    productName: 'Evaporated Milk',
    sizeQuantity: '170g',
    variant: 'Original',
    colour: 'N/A',
    barcode: '6150000000000',
    category: 'Dairy Products',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'prod-ex-2',
    brand: 'Indomie',
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Chicken',
    colour: 'N/A',
    barcode: '6150000000001',
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'prod-ex-3',
    brand: 'Dettol',
    productName: 'Antiseptic Liquid',
    sizeQuantity: '250ml',
    variant: 'Original',
    colour: 'Green',
    barcode: '6150000000002',
    category: 'Personal Care',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'prod-ex-4',
    brand: 'Bournvita',
    productName: 'Malt Drink Powder',
    sizeQuantity: '500g',
    variant: 'Original',
    colour: 'Brown',
    barcode: '6150000000003',
    category: 'Beverages',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    id: 'prod-ex-5',
    brand: 'Local Bread',
    productName: 'Whole Wheat\tSpecial\nLoaf', // Notice tabs and newlines to test sanitization!
    sizeQuantity: '800g',
    variant: 'Original',
    colour: 'Brown',
    barcode: '0012345678901', // Leading double zeros!
    category: 'Food & Groceries',
    dateCaptured: '2026-10-24',
    notes: '',
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
  },
];

const tsvOutput = generateTSV(promptExampleProducts, { includeHeader: true });
const tsvRows = tsvOutput.split('\n');

// 1. Verify header row
assert.strictEqual(
  tsvRows[0],
  'Brand\tProduct Name\tSize/Quantity\tVariant\tColour\tBarcode\tCategory\tDate',
  'TSV header must match exact column order'
);
console.log('  ✓ TSV Header verified:', tsvRows[0]);

// 2. Verify rows count
assert.strictEqual(tsvRows.length, 6, 'Must contain 1 header + 5 product rows');

// 3. Verify Dettol row contains Colour 'Green'
const dettolRow = tsvRows[3].split('\t');
assert.strictEqual(dettolRow[0], 'Dettol');
assert.strictEqual(dettolRow[1], 'Antiseptic Liquid');
assert.strictEqual(dettolRow[2], '250ml');
assert.strictEqual(dettolRow[3], 'Original');
assert.strictEqual(dettolRow[4], 'Green');
assert.strictEqual(dettolRow[5], '6150000000002');
console.log('  ✓ Dettol Row tab-separated columns verified:', dettolRow.join(' | '));

// 4. Verify leading zero preservation on barcode
const leadingZeroRow = tsvRows[5].split('\t');
assert.strictEqual(leadingZeroRow[5], '0012345678901');
assert.ok(leadingZeroRow[5].startsWith('00'), 'Barcode leading zero must be preserved as text');

// 5. Verify sanitization: tabs and newlines in product name sanitized
assert.ok(!leadingZeroRow[1].includes('\t') && !leadingZeroRow[1].includes('\n'));
assert.strictEqual(leadingZeroRow[1], 'Whole Wheat Special Loaf');
console.log('  ✓ Embedded tabs/newlines successfully sanitized without corrupting TSV rows.');

// TEST 7: Offline Barcode Lookup
console.log('\n[Test 7] Offline Supermarket Barcode Lookup:');

async function runLookupTests() {
  const peakLookup = await lookupProductByBarcode('6150000000000', false);
  assert.ok(peakLookup, 'Should find Peak milk in catalogue');
  assert.strictEqual(peakLookup?.brand, 'Peak');
  assert.strictEqual(peakLookup?.productName, 'Evaporated Milk');
  assert.strictEqual(peakLookup?.sizeQuantity, '170g');
  assert.strictEqual(peakLookup?.variant, 'Original');
  assert.strictEqual(peakLookup?.category, 'Dairy Products');
  console.log(`  ✓ 6150000000000 -> ${peakLookup?.brand} ${peakLookup?.productName} (${peakLookup?.sizeQuantity})`);

  const dettolLookup = await lookupProductByBarcode('6150000000002', false);
  assert.ok(dettolLookup, 'Should find Dettol in catalogue');
  assert.strictEqual(dettolLookup?.colour, 'Green');
  assert.strictEqual(dettolLookup?.variant, 'Original');
  console.log(`  ✓ 6150000000002 -> ${dettolLookup?.brand} with Variant="${dettolLookup?.variant}", Colour="${dettolLookup?.colour}"`);

  const unknown = await lookupProductByBarcode('9999999999999', false);
  assert.strictEqual(unknown, null, 'Unknown barcode returns null for camera/manual entry');
  console.log('  ✓ Unknown barcode safely returns null without hallucinating fake details.');
}

runLookupTests().then(() => {
  console.log('\n====================================================');
  console.log('🎉 ALL 7 TEST SUITES PASSED! QuickStock core verified.');
  console.log('====================================================\n');
});
