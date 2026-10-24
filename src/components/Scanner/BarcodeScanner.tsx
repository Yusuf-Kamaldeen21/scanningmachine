import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  AlertTriangle,
  Keyboard,
  Upload,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { playScanSuccessSound, triggerHaptic } from '../../utils/feedback';
import { SUPERMARKET_CATALOGUE } from '../../services/productLookup';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onManualEntryClick: () => void;
  isPaused?: boolean;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.ITF,
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onManualEntryClick,
  isPaused = false,
}) => {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showTestBarcodes, setShowTestBarcodes] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isHandlingScanRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check secure context (HTTPS or localhost)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSecure =
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      setIsSecureContext(isSecure);
    }
  }, []);

  // Handle successful scan
  const handleDetectedBarcode = useCallback(
    (decodedText: string) => {
      if (isHandlingScanRef.current || isPaused) return;
      isHandlingScanRef.current = true;

      setLastScannedCode(decodedText);
      playScanSuccessSound();
      triggerHaptic([50, 40, 50]);

      // Automatically pause scanner and pass result to parent
      try {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.pause(true);
        }
      } catch (err) {
        console.warn('Error pausing scanner:', err);
      }

      onScanSuccess(decodedText);

      // Reset throttle lock after a brief pause
      setTimeout(() => {
        isHandlingScanRef.current = false;
      }, 1500);
    },
    [isPaused, onScanSuccess]
  );

  // Initialize and start scanner
  const startScanner = useCallback(
    async (cameraId?: string) => {
      setCameraError(null);
      try {
        // Enumerate devices if not already done
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('No video camera detected on this device.');
        }

        setCameras(devices);

        // Pick back camera by default if not specified
        let selectedId = cameraId;
        if (!selectedId) {
          const rearCam = devices.find((d) =>
            /back|rear|environment|wide/i.test(d.label)
          );
          selectedId = rearCam ? rearCam.id : devices[0].id;
        }

        setCurrentCameraId(selectedId);

        // Clean up previous instance
        if (html5QrCodeRef.current) {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current = null;
        }

        const scanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        html5QrCodeRef.current = scanner;

        await scanner.start(
          selectedId,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(minEdge * 0.85),
                height: Math.floor(minEdge * 0.55),
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDetectedBarcode(decodedText);
          },
          () => {
            // Scanning in progress...
          }
        );

        setScannerStarted(true);

        // Check torch capability
        try {
          const capabilities = scanner.getRunningTrackCapabilities();
          // @ts-expect-error torch capability on track
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err) {
        console.error('Camera start error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(msg);
        setScannerStarted(false);
      }
    },
    [handleDetectedBarcode]
  );

  // Stop scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        setScannerStarted(false);
      }
    }
  }, []);

  // Mount effect
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scanner = html5QrCodeRef.current as any;
      if (typeof scanner.applyVideoConstraints === 'function') {
        await scanner.applyVideoConstraints({
          advanced: [{ torch: nextState }],
        });
      }
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed', err);
    }
  };

  // Switch Camera
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    stopScanner().then(() => startScanner(nextCamera.id));
  };

  // Decode from file upload (fallback)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('qr-reader-file');
      }
      const result = await scanner.scanFile(file, true);
      handleDetectedBarcode(result);
    } catch {
      alert('Could not detect a clear barcode in the uploaded image. Please try again or enter manually.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Hidden file input for barcode image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />
      <div id="qr-reader-file" className="hidden" />

      {/* Top Bar with Camera Controls */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur z-20 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isPaused ? 'Scanner Paused' : 'Live Camera Scanner'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl transition-colors ${
                torchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title="Toggle Flashlight"
            >
              {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          )}

          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowTestBarcodes(!showTestBarcodes)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-xs font-medium border border-sky-500/40"
            title="Simulate barcode scan"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Test Codes</span>
          </button>
        </div>
      </div>

      {/* Camera Viewport Area */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video max-h-[380px] bg-black flex items-center justify-center overflow-hidden">
        {/* The video element container for html5-qrcode */}
        <div id="qr-reader" className="w-full h-full object-cover" />

        {/* Reticle / Target Overlay */}
        {scannerStarted && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened vignette around scanning box */}
            <div className="relative w-[78%] max-w-[280px] h-[58%] max-h-[160px] border-2 border-emerald-400/90 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner accent brackets */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />

              {/* Animated laser scan line */}
              <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-scan-laser" />

              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[10px] font-medium tracking-wide bg-black/60 text-emerald-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Align Barcode Here
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera Permission / Error Fallback */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Camera Access Required</h4>
            <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">
              {!isSecureContext
                ? 'Camera access requires a secure connection (HTTPS or localhost). Please ensure the site is served via HTTPS.'
                : cameraError.includes('NotAllowedError') || cameraError.includes('Permission')
                ? 'Camera permission was denied. Please allow camera permissions in your browser address bar settings.'
                : 'Unable to start camera. Please verify another app is not using it, or use manual entry below.'}
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => startScanner()}
                className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>

              <button
                onClick={onManualEntryClick}
                className="flex items-center space-x-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Enter Manually</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Image</span>
              </button>
            </div>
          </div>
        )}

        {/* Detected Code Banner */}
        {lastScannedCode && (
          <div className="absolute bottom-2 inset-x-3 bg-emerald-950/90 border border-emerald-500/50 backdrop-blur rounded-xl px-3 py-1.5 flex items-center justify-between text-xs z-20">
            <div className="flex items-center space-x-1.5 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Detected: <strong className="font-mono text-white">{lastScannedCode}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                  html5QrCodeRef.current.resume();
                }
                setLastScannedCode(null);
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-200 underline font-medium"
            >
              Rescan
            </button>
          </div>
        )}
      </div>

      {/* Test Barcode Quick Select Drawer (Allows testing without physical barcodes) */}
      {showTestBarcodes && (
        <div className="w-full bg-slate-900 border-t border-slate-800 p-3 max-h-48 overflow-y-auto z-20 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Barcode Simulation (FMCG Supermarket Goods)
            </span>
            <button
              onClick={() => setShowTestBarcodes(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Object.entries(SUPERMARKET_CATALOGUE).slice(0, 8).map(([code, p]) => (
              <button
                key={code}
                onClick={() => {
                  setShowTestBarcodes(false);
                  handleDetectedBarcode(code);
                }}
                className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-left rounded-lg text-xs transition border border-slate-700/60"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-slate-200">{p.brand}</span>{' '}
                  <span className="text-slate-400">{p.productName} ({p.sizeQuantity})</span>
                </div>
                <span className="font-mono text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800 shrink-0">
                  {code.slice(-6)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Quick Action Bar */}
      <div className="w-full grid grid-cols-2 gap-2 p-3 bg-slate-900/90 border-t border-slate-800/80">
        <button
          onClick={onManualEntryClick}
          className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold transition border border-slate-700"
        >
          <Keyboard className="w-4 h-4 text-sky-400" />
          <span>Manual Barcode</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold transition border border-slate-700"
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>Upload Image</span>
        </button>
      </div>
    </div>
  );
};
