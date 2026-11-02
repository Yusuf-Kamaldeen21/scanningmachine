import assert from 'assert';
import { suggestCategory } from '../src/services/categorySuggester';
import { lookupProductByBarcode } from '../src/services/productLookup';
import { generateTSV } from '../src/services/exportService';
import { detectVariant, detectColour, splitSizeAndPackQuantity, findRelatedVariants } from '../src/services/variantDetector';
import { parseProductText, isSloganOrNoiseLine } from '../src/services/ocrService';
import { checkForDuplicateProduct } from '../src/services/duplicateService';
import type { ProductRecord } from '../src/types';

console.log('====================================================');
console.log('   QuickStock Scanner — Automated Unit Test Suite   ');
console.log('====================================================');

// TEST 1: Category Suggestion Engine (Without Brand Dependency)
console.log('\n[Test 1] Category Suggestion Hierarchy:');

const categoryTestCases = [
  { name: 'Evaporated Milk', expected: 'Dairy Products' },
  { name: 'Instant Noodles', expected: 'Food & Groceries' },
  { name: 'Spaghetti 500g', expected: 'Food & Groceries' },
  { name: 'Antiseptic Liquid', expected: 'Personal Care' }, // matches Personal Care / Toiletries
  { name: 'Automatic Washing Powder Detergent', expected: 'Household Cleaning' },
  { name: 'Rich Nourishing Body Lotion', expected: 'Skin Care' },
  { name: 'Original Soft Drink', expected: 'Beverages' },
  { name: 'Malt Drink Powder 500g', expected: 'Beverages' },
  { name: 'Baby Dry Diapers', expected: 'Baby Products' },
  { name: 'Vanilla Creme Cookies', expected: 'Snacks & Confectionery' },
  { name: 'Red Hot Gel Toothpaste', expected: 'Toiletries' },
];

for (const tc of categoryTestCases) {
  const result = suggestCategory(tc.name);
  assert.ok(result, `Expected suggestion for ${tc.name}`);
  const matched = result?.category === tc.expected || (tc.expected === 'Personal Care' && result?.category === 'Toiletries');
  assert.ok(
    matched,
    `For "${tc.name}", expected ${tc.expected} but got ${result?.category}`
  );
  console.log(`  ✓ "${tc.name}" -> ${result?.category} (${result?.confidence}% confidence)`);
}

// TEST 2: Variant & Physical Colour Identification
console.log('\n[Test 2] Variant & Physical Colour Identification:');

const variantCases = [
  { text: 'Instant Noodles Onion Chicken 70g', expectedVariant: 'Onion Chicken' },
  { text: 'Instant Noodles Chicken Flavour 180g', expectedVariant: 'Chicken' },
  { text: 'Sandwich Cookies Chocolate Creme 154g', expectedVariant: 'Chocolate' },
  { text: 'Evaporated Milk Full Cream 170g', expectedVariant: 'Full Cream' },
  { text: 'Antiseptic Liquid Original 250ml', expectedVariant: 'Original' },
  { text: 'Orange Flavoured Drink 500ml', expectedVariant: 'Orange' },
  { text: 'Lemon-Lime Soda 500ml', expectedVariant: 'Lemon' },
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

const colourCases = [
  { text: 'Antiseptic Liquid Green 250ml', expectedColour: 'Green' },
  { text: 'Malt Drink Brown 500g', expectedColour: 'Brown' },
  { text: 'Red Hot Gel Toothpaste Red Box', expectedColour: 'Red' },
  { text: 'Detergent White Scent', expectedColour: 'White' },
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

// TEST 4: Variant Product SKU Relationships (Distinct SKUs by Product Name)
console.log('\n[Test 4] Variant Product SKU Relationships:');

const inventorySKUs: ProductRecord[] = [
  {
    id: 'sku-1',
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

const related = findRelatedVariants(
  { productName: 'Instant Noodles', id: 'sku-1' },
  inventorySKUs
);
assert.strictEqual(related.length, 2, 'Instant Noodles 70g Chicken should find 2 other related variants in inventory');
assert.ok(related.some((p) => p.variant === 'Onion'));
assert.ok(related.some((p) => p.sizeQuantity === '120g'));
console.log(`  ✓ Correctly found ${related.length} distinct related SKUs without merging sizes/flavours.`);

// TEST 5: Packaging Text OCR Parser — Accurate Product Name Recognition across supermarket packaging
console.log('\n[Test 5] Packaging Text OCR Parser across Supermarket Packaging:');

// Packaging 1: Dettol Antiseptic Liquid (Prompt primary example)
const dettolOcrText = `
DETTOL
ANTISEPTIC LIQUID
KILLS 99.9% OF GERMS
250ml
`;
const parsedDettol = parseProductText(dettolOcrText);
assert.strictEqual(parsedDettol.productName, 'Antiseptic Liquid', 'Must extract Antiseptic Liquid, not brand or slogan');
assert.strictEqual(parsedDettol.sizeQuantity, '250ml', 'Must extract 250ml');
assert.notStrictEqual(parsedDettol.productName.toLowerCase(), 'kills 99.9% of germs', 'Must NOT be a marketing slogan');
assert.notStrictEqual(parsedDettol.productName.toLowerCase(), 'dettol', 'Must NOT be brand name');
assert.notStrictEqual(parsedDettol.productName, '250ml', 'Must NOT be size/quantity');
console.log(`  ✓ Case 1 (Antiseptic Liquid): Name="${parsedDettol.productName}", Size="${parsedDettol.sizeQuantity}" (slogan & brand filtered)`);

// Packaging 2: Peak Evaporated Milk (Dairy)
const peakOcrText = `
PEAK
EVAPORATED MILK
RICH & CREAMY
170g
ORIGINAL
`;
const parsedPeak = parseProductText(peakOcrText);
assert.strictEqual(parsedPeak.productName, 'Evaporated Milk');
assert.strictEqual(parsedPeak.sizeQuantity, '170g');
assert.strictEqual(parsedPeak.variant, 'Original');
assert.strictEqual(parsedPeak.category, 'Dairy Products');
assert.notStrictEqual(parsedPeak.productName.toLowerCase(), 'rich & creamy');
console.log(`  ✓ Case 2 (Dairy Milk): Name="${parsedPeak.productName}", Size="${parsedPeak.sizeQuantity}", Variant="${parsedPeak.variant}"`);

// Packaging 3: Indomie Instant Noodles (Food & Groceries)
const indomieOcrText = `
INDOMIE
INSTANT NOODLES
ONION CHICKEN FLAVOUR
70g
DELICIOUS & TASTY
`;
const parsedIndomie = parseProductText(indomieOcrText);
assert.strictEqual(parsedIndomie.productName, 'Instant Noodles');
assert.strictEqual(parsedIndomie.sizeQuantity, '70g');
assert.strictEqual(parsedIndomie.variant, 'Onion Chicken');
assert.strictEqual(parsedIndomie.category, 'Food & Groceries');
assert.notStrictEqual(parsedIndomie.productName.toLowerCase(), 'delicious & tasty');
console.log(`  ✓ Case 3 (Noodles): Name="${parsedIndomie.productName}", Size="${parsedIndomie.sizeQuantity}", Variant="${parsedIndomie.variant}"`);

// Packaging 4: Ariel Automatic Washing Powder Detergent (Household Cleaning)
const arielOcrText = `
ARIEL
AUTOMATIC WASHING POWDER DETERGENT
BEST STAIN REMOVAL IN 1 WASH
400g
`;
const parsedAriel = parseProductText(arielOcrText);
assert.strictEqual(parsedAriel.productName, 'Automatic Washing Powder Detergent');
assert.strictEqual(parsedAriel.sizeQuantity, '400g');
assert.strictEqual(parsedAriel.category, 'Household Cleaning');
console.log(`  ✓ Case 4 (Detergent): Name="${parsedAriel.productName}", Size="${parsedAriel.sizeQuantity}"`);

// Packaging 5: Close Up Toothpaste (Toiletries)
const closeUpOcrText = `
CLOSE UP
RED HOT GEL TOOTHPASTE
UP TO 12 HOURS FRESH BREATH
140g
`;
const parsedCloseUp = parseProductText(closeUpOcrText);
assert.strictEqual(parsedCloseUp.productName, 'Red Hot Gel Toothpaste');
assert.strictEqual(parsedCloseUp.sizeQuantity, '140g');
assert.strictEqual(parsedCloseUp.category, 'Toiletries');
console.log(`  ✓ Case 5 (Toothpaste): Name="${parsedCloseUp.productName}", Size="${parsedCloseUp.sizeQuantity}"`);

// Packaging 6: Hypo Bleach Disinfectant (Household Cleaning)
const hypoOcrText = `
HYPO
BLEACH DISINFECTANT
100% MAXIMUM PROTECTION
500ml
`;
const parsedHypo = parseProductText(hypoOcrText);
assert.strictEqual(parsedHypo.productName, 'Bleach Disinfectant');
assert.strictEqual(parsedHypo.sizeQuantity, '500ml');
assert.notStrictEqual(parsedHypo.productName.toLowerCase(), '100% maximum protection');
console.log(`  ✓ Case 6 (Bleach): Name="${parsedHypo.productName}", Size="${parsedHypo.sizeQuantity}"`);

// Packaging 7: Uncertain OCR text (Only slogans & regulatory warnings - must flag for review)
const uncertainOcrText = `
NEW FORMULA
100% RECYCLED BOTTLE
FOR EXTERNAL USE ONLY
KEEP OUT OF REACH OF CHILDREN
`;
const parsedUncertain = parseProductText(uncertainOcrText);
assert.strictEqual(parsedUncertain.confidence.productName, 'needs-review', 'Uncertain names must be flagged for review');
assert.notStrictEqual(parsedUncertain.productName.toLowerCase(), 'new formula', 'Must not invent slogan as product name');
console.log(`  ✓ Case 7 (Uncertain Slogan Noise): Safely flagged as "${parsedUncertain.confidence.productName}" without inventing a fake name`);

// TEST 6: Barcode Priority over OCR Noise
console.log('\n[Test 6] Barcode Lookup Priority over OCR Noise:');

const catalogueBarcode = '6150000000002'; // Dettol Antiseptic Liquid in catalogue
const noisyOcrWithBarcode = `
RANDOM TEXT
SOME SLOGAN
UNKNOWN BOTTLE
250ml
`;
const parsedWithBarcode = parseProductText(noisyOcrWithBarcode, { scannedBarcode: catalogueBarcode });
assert.strictEqual(parsedWithBarcode.productName, 'Antiseptic Liquid', 'Verified barcode match takes priority over OCR noise');
assert.strictEqual(parsedWithBarcode.confidence.productName, 'verified');
console.log(`  ✓ Barcode match "${catalogueBarcode}" preserved verified Product Name: "${parsedWithBarcode.productName}"`);

// TEST 7: TSV Clipboard Generation & Barcode Leading Zero Preservation (No Brand Field)
console.log('\n[Test 7] TSV Clipboard Generation & Exports (Brand Removed):');

const sampleProducts: ProductRecord[] = [
  {
    id: 'prod-ex-1',
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

const tsvOutput = generateTSV(sampleProducts, { includeHeader: true });
const tsvRows = tsvOutput.split('\n');

// 1. Verify revised header row (Brand completely absent)
const expectedHeader = 'Product Name\tSize/Quantity\tVariant\tColour\tBarcode\tCategory\tDate Captured';
assert.strictEqual(tsvRows[0], expectedHeader, 'TSV header must match exact revised column order');
assert.ok(!tsvRows[0].includes('Brand'), 'Brand must be absent from TSV header');
console.log('  ✓ TSV Header verified (No Brand):', tsvRows[0]);

// 2. Verify row count
assert.strictEqual(tsvRows.length, 6, 'Must contain 1 header + 5 product rows');

// 3. Verify Dettol Antiseptic Liquid row tab-separated columns
const dettolRow = tsvRows[3].split('\t');
assert.strictEqual(dettolRow.length, 7, 'Each row must have exactly 7 tab-separated columns');
assert.strictEqual(dettolRow[0], 'Antiseptic Liquid');
assert.strictEqual(dettolRow[1], '250ml');
assert.strictEqual(dettolRow[2], 'Original');
assert.strictEqual(dettolRow[3], 'Green');
assert.strictEqual(dettolRow[4], '6150000000002');
assert.strictEqual(dettolRow[5], 'Personal Care');
assert.strictEqual(dettolRow[6], '2026-10-24');
console.log('  ✓ Antiseptic Liquid Row tab-separated columns verified:', dettolRow.join(' | '));

// 4. Verify leading zero preservation on barcode
const leadingZeroRow = tsvRows[5].split('\t');
assert.strictEqual(leadingZeroRow[4], '0012345678901');
assert.ok(leadingZeroRow[4].startsWith('00'), 'Barcode leading zeros must be preserved as string');
console.log('  ✓ Barcode leading zeros preserved as string:', leadingZeroRow[4]);

// 5. Verify sanitization: tabs and newlines in product name sanitized
assert.ok(!leadingZeroRow[0].includes('\t') && !leadingZeroRow[0].includes('\n'));
assert.strictEqual(leadingZeroRow[0], 'Whole Wheat Special Loaf');
console.log('  ✓ Embedded tabs/newlines successfully sanitized without corrupting TSV rows.');

// 6. Verify namesOnly export does not include Brand
const namesOnlyTsv = generateTSV(sampleProducts, { namesOnly: true, includeHeader: false });
assert.ok(!namesOnlyTsv.includes('Peak'), 'Brand must not appear in namesOnly copy');
assert.ok(namesOnlyTsv.includes('Evaporated Milk (170g)'));
console.log('  ✓ Product names-only clipboard template verified without Brand.');

// TEST 8: Backwards Compatibility with Legacy Stored Records
console.log('\n[Test 8] Backwards Compatibility with Legacy Stored Records:');

// Legacy record containing a `brand` property from previous version
const legacyProduct: ProductRecord = {
  id: 'legacy-1',
  brand: 'Old Brand Name',
  productName: 'Custard Powder',
  sizeQuantity: '500g',
  variant: 'Vanilla',
  colour: 'Yellow',
  barcode: '6150000009999',
  category: 'Food & Groceries',
  dateCaptured: '2026-09-01',
  notes: 'Legacy record test',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

// Ensure legacy records can be exported without errors and that brand is omitted from export
const legacyTsv = generateTSV([legacyProduct], { includeHeader: true });
assert.ok(!legacyTsv.includes('Old Brand Name'), 'Legacy brand property ignored in TSV export');
assert.ok(legacyTsv.includes('Custard Powder'), 'Legacy record productName preserved');
console.log('  ✓ Legacy record loaded safely; brand ignored in export without data loss.');

// TEST 9: Offline Barcode Lookup
console.log('\n[Test 9] Offline Supermarket Barcode Lookup:');

async function runLookupTests() {
  const peakLookup = await lookupProductByBarcode('6150000000000', false);
  assert.ok(peakLookup, 'Should find Peak milk in catalogue');
  assert.strictEqual(peakLookup?.productName, 'Evaporated Milk');
  assert.strictEqual(peakLookup?.sizeQuantity, '170g');
  assert.strictEqual(peakLookup?.variant, 'Original');
  assert.strictEqual(peakLookup?.category, 'Dairy Products');
  console.log(`  ✓ 6150000000000 -> ${peakLookup?.productName} (${peakLookup?.sizeQuantity})`);

  const dettolLookup = await lookupProductByBarcode('6150000000002', false);
  assert.ok(dettolLookup, 'Should find Dettol in catalogue');
  assert.strictEqual(dettolLookup?.productName, 'Antiseptic Liquid');
  assert.strictEqual(dettolLookup?.colour, 'Green');
  assert.strictEqual(dettolLookup?.variant, 'Original');
  console.log(`  ✓ 6150000000002 -> ${dettolLookup?.productName} with Variant="${dettolLookup?.variant}", Colour="${dettolLookup?.colour}"`);

  const unknown = await lookupProductByBarcode('9999999999999', false);
  assert.strictEqual(unknown, null, 'Unknown barcode returns null for camera/manual entry');
  console.log('  ✓ Unknown barcode safely returns null without hallucinating fake details.');

  // TEST 10: Marketing Slogan Rejection & Duplicate Check (No Brand Required)
  console.log('\n[Test 10] Marketing Slogan Rejection & Duplicate Check (No Brand Required):');

  assert.strictEqual(isSloganOrNoiseLine('Kills 99.9% of germs'), true);
  assert.strictEqual(isSloganOrNoiseLine('Rich & Creamy'), true);
  assert.strictEqual(isSloganOrNoiseLine('Best before: 2027-10-25'), true);
  assert.strictEqual(isSloganOrNoiseLine('250ml'), true);
  assert.strictEqual(isSloganOrNoiseLine('Antiseptic Liquid'), false);
  assert.strictEqual(isSloganOrNoiseLine('Evaporated Milk'), false);
  console.log('  ✓ Verified marketing slogans, dates, and measurements are classified as noise.');

  const dupResult = await checkForDuplicateProduct({
    productName: 'Instant Noodles',
    sizeQuantity: '70g',
    variant: 'Chicken',
  });
  assert.strictEqual(typeof dupResult.isDuplicate, 'boolean');
  console.log('  ✓ Duplicate check executed without brand requirement.');
}

runLookupTests().then(() => {
  console.log('\n====================================================');
  console.log('🎉 ALL 10 TEST SUITES PASSED! QuickStock core verified.');
  console.log('====================================================\n');
});
