import * as XLSX from 'xlsx';
import type { ProductRecord, ExportOptions } from '../types';

/**
 * Filter products according to ExportOptions
 */
export function filterProductsForExport(
  products: ProductRecord[],
  options: ExportOptions
): ProductRecord[] {
  return products.filter((item) => {
    // Category filter
    if (options.filterCategory && options.filterCategory !== 'all') {
      if (item.category !== options.filterCategory) return false;
    }

    // Date filter
    if (options.filterDate && options.filterDate !== 'all') {
      if (item.dateCaptured !== options.filterDate) return false;
    }

    // Incomplete records only (missing optional variant, category, notes, or empty barcode)
    if (options.filterIncompleteOnly) {
      const isIncomplete =
        !item.barcode || !item.category || !item.variant || !item.notes;
      if (!isIncomplete) return false;
    }

    return true;
  });
}

/**
 * Formats row objects based on selected fields
 */
function buildExportRows(products: ProductRecord[], options: ExportOptions) {
  return products.map((item) => {
    const row: Record<string, string> = {};

    if (options.fields.brand) row['Brand'] = item.brand;
    if (options.fields.productName) row['Product Name'] = item.productName;
    if (options.fields.sizeQuantity) row['Size / Quantity'] = item.sizeQuantity;
    if (options.fields.variant) row['Variant'] = item.variant || '';
    if (options.fields.barcode) row['Barcode'] = item.barcode ? `${item.barcode}` : '';
    if (options.fields.category) row['Category'] = item.category || 'Uncategorized';
    if (options.fields.dateCaptured) row['Date Captured'] = item.dateCaptured;
    if (options.fields.notes) row['Notes'] = item.notes || '';
    if (options.fields.id) row['Record ID'] = item.id;

    return row;
  });
}

/**
 * Export products to CSV with UTF-8 BOM and leading-zero preservation
 */
export function exportToCSV(products: ProductRecord[], options: ExportOptions): { filename: string; count: number } {
  const filtered = filterProductsForExport(products, options);
  const rows = buildExportRows(filtered, options);

  if (rows.length === 0) {
    throw new Error('No products match the selected export criteria.');
  }

  const headers = Object.keys(rows[0]);

  // Construct CSV lines with escaping and Excel text formula for barcode
  const csvLines: string[] = [];
  csvLines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  for (const row of rows) {
    const line = headers.map((header) => {
      let val = row[header] ?? '';
      // If header is Barcode, format as text formula ="12345" so Excel preserves leading zeros
      if (header === 'Barcode' && val) {
        return `="""${val}"""`;
      }
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvLines.push(line.join(','));
  }

  // Prepend UTF-8 BOM so Excel opens characters properly
  const bom = '\uFEFF';
  const csvContent = bom + csvLines.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `QuickStock_Products_${new Date().toISOString().slice(0, 10)}.csv`;

  triggerDownload(blob, filename);

  return { filename, count: rows.length };
}

/**
 * Export products to Excel (.xlsx) with explicit string typing for Barcodes
 */
export function exportToExcel(products: ProductRecord[], options: ExportOptions): { filename: string; count: number } {
  const filtered = filterProductsForExport(products, options);
  const rows = buildExportRows(filtered, options);

  if (rows.length === 0) {
    throw new Error('No products match the selected export criteria.');
  }

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths and ensure barcode column cells are marked as type 's' (string)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const headers = Object.keys(rows[0]);
  const barcodeColIndex = headers.indexOf('Barcode');

  const colWidths: { wch: number }[] = headers.map((key) => ({
    wch: Math.max(key.length + 4, 14),
  }));

  // Ensure barcode cells are strings
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    if (barcodeColIndex !== -1) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: barcodeColIndex });
      const cell = ws[cellAddress];
      if (cell) {
        cell.t = 's'; // Force string type to preserve leading zeroes!
        cell.z = '@'; // Text formatting in Excel
      }
    }
  }

  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Supermarket Products');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const filename = `QuickStock_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
  triggerDownload(blob, filename);

  return { filename, count: rows.length };
}

/**
 * Full JSON database backup
 */
export function exportToJSON(products: ProductRecord[]): { filename: string; count: number } {
  const backupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalProducts: products.length,
    products,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `QuickStock_Backup_${new Date().toISOString().slice(0, 10)}.json`;

  triggerDownload(blob, filename);
  return { filename, count: products.length };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
