# QuickStock Scanner — Mobile Supermarket Product Scanning Web App

**QuickStock Scanner** is a mobile-first, high-speed Progressive Web Application (PWA) designed for supermarket and retail inventory staff to rapidly scan barcodes, identify products, eliminate typing errors, maintain category consistency, and export structured inventory records directly for inventory management systems such as **Moniebook**.

---

## 🚀 Key Features

### 1. High-Speed Mobile Barcode Scanner
- **Rear Camera Priority:** Defaults to the mobile device's back camera (`facingMode: { ideal: "environment" }`).
- **Comprehensive Format Support:** Scans EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code, and ITF.
- **Hardware Feedback:** 
  - **Auditory:** Crisp high-pitched retail scanner POS beep (Web Audio API, zero latency, 100% offline).
  - **Haptic:** Dual-vibration pulse on barcode detection (`navigator.vibrate`).
- **Scanning Reticle & Laser:** Visual target brackets with animated laser line and instant barcode display.
- **Auto-Pause:** Instantly halts scanning after capture to prevent duplicate accidental scans.
- **Hardware Controls:** Flashlight / Torch toggle button and Camera Switching.
- **Fallback Options:** Manual barcode entry, barcode photo/image upload decoder, and quick-test simulation drawer.

### 2. Intelligent Product Lookup Engine
- **Instant Offline Catalogue:** Pre-loaded with FMCG supermarket brands (Peak, Indomie, Golden Penny, Dettol, Ariel, Milo, Coca-Cola, Sprite, Nivea, Vaseline, Knorr, Maggi, Close Up, Oreo).
- **Online Fallback:** Seamless query to the public **Open Food Facts API** for international FMCG products.
- **Manual Graceful Fallback:** If a barcode is not recognized, staff can enter details immediately.

### 3. Smart Product Entry & Consistency
- **Captured Fields:** Brand (Required), Product Name (Required), Size/Quantity (Required), Variant (Optional), Barcode (string, preserves leading zeros), Category (Optional), Date Captured (Auto-filled, editable), Notes (Optional), Unique Record ID.
- **Auto-Focus:** Automatically focuses the first missing required field when opening the form.
- **Smart Category Suggester:** Real-time semantic keyword matching that suggests the standard category based on product name and brand (e.g. Milk & Peak &rarr; `Dairy Products`, Noodles & Spaghetti &rarr; `Food & Groceries`, Bleach & Hypo &rarr; `Household Cleaning`).
- **High-Volume Action:** **Save & Scan Next** button saves the record with audio feedback and instantly reactivates the scanner without page reload.
- **Safe Autofill:** Optional toggles in Settings to remember the last category and remember brand for same-brand batches.

### 4. Duplicate Detection & Safeguards
- **Exact Barcode Checking:** Flags if a scanned or typed barcode already exists in the local database.
- **Fuzzy Match Fallback:** If capturing an item without a barcode, checks brand + product name + size + variant to alert about existing stock.
- **Actionable Alert:** Staff can view the existing record, edit it, cancel, or choose to override and save anyway.

### 5. Standardized Category Management
- Predefined taxonomy:
  - *Food & Groceries, Beverages, Dairy Products, Snacks & Confectionery, Personal Care, Hair Care, Skin Care, Household Cleaning, Baby Products, Toiletries, Frozen Foods, Kitchen Supplies, Stationery, Other*.
- Administrators can add, rename, or delete categories.
- Renaming a category automatically updates all existing products assigned to that category.
- Product count badge for each category.

### 6. Export for Moniebook & Spreadsheets
- **Excel (.xlsx):** Built with SheetJS (`xlsx`), cell type explicitly marked as `'s'` (string) to prevent Excel from stripping leading zeros (e.g. `0123456789012`).
- **CSV:** Formatted with UTF-8 BOM and optional Excel text formula `="0123456789012"`.
- **Customizable Columns:** Toggle Brand, Product Name, Size/Quantity, Variant, Barcode, Category, Date Captured, Notes, Record ID.
- **Flexible Filters:** Filter by category, specific capture date, or only incomplete records.
- **Full JSON Backup & Restore:** Export complete database dumps and restore across devices.

### 7. Offline Support & PWA
- **Local Persistence:** Powered by **IndexedDB** using **Dexie.js**.
- **PWA Service Worker:** Pre-caches application shell, icons, and bundles for reliable offline operation.
- **Connection Indicator:** Live badge displaying "Online" or "Offline - Local Storage Active".

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 + `@vitejs/plugin-react` |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **Icons** | Lucide React |
| **Database** | IndexedDB via `dexie` & `dexie-react-hooks` |
| **Barcode Scanner** | `html5-qrcode` (HTML5 Camera API & Canvas) |
| **Spreadsheets** | `xlsx` (SheetJS) |
| **Offline / PWA** | `vite-plugin-pwa` + Workbox |
| **Milestone Effects** | `canvas-confetti` |

---

## 📦 Setup & Installation

### Prerequisites
- Node.js (v18 or higher; tested on Node.js v25.2.1)
- npm (v9 or higher)

### Installation
```bash
# Clone or navigate to the project directory
cd scanningMachine

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```

### Building for Production
```bash
# Typecheck and build PWA bundle
npm run build

# Preview production build
npm run preview
```

> **Windows PowerShell Tip:** If running scripts is restricted by PowerShell Execution Policy, invoke commands via `npm.cmd`:
> ```powershell
> npm.cmd install
> npm.cmd run dev
> npm.cmd run build
> ```

---

## 📱 Mobile Camera & HTTPS Requirements

Mobile browsers (especially Chrome on Android and Safari on iOS) restrict camera access (`getUserMedia`) to **Secure Contexts**:
1. **Localhost:** `http://localhost:5173` or `http://127.0.0.1:5173`.
2. **HTTPS:** Any public URL served over `https://`.

If testing from a phone on the same Wi-Fi network:
- Use an HTTPS tunnel such as `ngrok http 5173` or `cloudflared tunnel`.
- Or enable chrome flags on Android: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with your local IP.
- Alternatively, use the built-in **"Upload Image"** scanner or the **"Test Codes"** drawer to simulate scans.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + S` | Open Barcode Scanner |
| `Alt + D` | Navigate to Dashboard |
| `Alt + R` | View Product Records Table |
| `Alt + E` | Open Export Modal |
| `Ctrl + Enter` (in form) | Save & Scan Next |

---

## 🧪 Verification & Test Scenarios

Run the automated test suite verifying category suggestions, product lookups, and export filtering:
```bash
npx.cmd tsx tests/verify-core.ts
```

### Manual Acceptance Test Scenarios
1. **Scan valid barcode with camera:** Tap the bottom scanner button &rarr; point at an FMCG product &rarr; camera detects code, beeps, vibrates, and opens the pre-filled form.
2. **Manual barcode entry:** Tap "Manual Barcode" on the scanner screen &rarr; enter barcode string &rarr; click Save.
3. **Save product with required fields:** Enter Brand, Product Name, and Size &rarr; Save.
4. **Validation check:** Leave Product Name blank &rarr; attempt to save &rarr; error warning tone sounds and input is highlighted.
5. **Duplicate barcode detection:** Scan or enter barcode `6151100001017` twice &rarr; warning banner displays existing Peak milk record with options to view, edit, or override.
6. **Capture product without barcode:** Tap "Manual Entry" &rarr; leave barcode blank &rarr; enter Brand and Name &rarr; saves successfully as unbarcoded item.
7. **Persistence test:** Refresh browser or restart computer &rarr; all products remain intact in IndexedDB.
8. **Export verification:** Open Export modal &rarr; select Excel (.xlsx) &rarr; verify generated file preserves leading zeros (e.g. `0123456789012`).
9. **Responsive test:** Shrink window to 375px mobile view &rarr; bottom navigation and touch-friendly buttons adapt seamlessly.
10. **Offline test:** Disconnect Wi-Fi &rarr; status badge updates to "Offline" &rarr; product capture, category management, and exports continue without disruption.
11. **Camera permission denial:** Deny camera permission &rarr; friendly troubleshooting screen appears with instant buttons for Manual Entry and Image Upload.

---

## 📄 License
MIT License. Built for supermarket retail inventory management.
