import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import {
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  AlertTriangle,
  Keyboard,
  Camera,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Loader2,
  Upload,
} from 'lucide-react';
import { playScanSuccessSound, triggerHaptic } from '../../utils/feedback';
import { SUPERMARKET_CATALOGUE } from '../../services/productLookup';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onManualEntryClick: () => void;
  onCapturePackagingClick?: (photoBlob: Blob) => void;
  isPaused?: boolean;
}

// ZXing supported barcode formats for supermarket inventory
const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.ITF,
];

// BarcodeDetector native formats for Android Chrome / Chromium
const NATIVE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
  'itf',
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onManualEntryClick,
  onCapturePackagingClick,
  isPaused = false,
}) => {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showTestBarcodes, setShowTestBarcodes] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isHandlingScanRef = useRef(false);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check secure context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSecure =
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      setIsSecureContext(isSecure);
    }
  }, []);

  // Handle detected barcode with immediate lock & zero artificial delay
  const handleDetectedBarcode = useCallback(
    (decodedText: string) => {
      const cleanCode = decodedText.trim();
      if (!cleanCode || isHandlingScanRef.current || isPaused) return;

      isHandlingScanRef.current = true;
      setLastScannedCode(cleanCode);

      // Instant haptic and audio feedback
      playScanSuccessSound();
      triggerHaptic([50, 40, 50]);

      // Notify parent immediately
      onScanSuccess(cleanCode);

      // Throttling lock reset after 1.5s
      setTimeout(() => {
        isHandlingScanRef.current = false;
      }, 1500);
    },
    [isPaused, onScanSuccess]
  );

  // Stop camera stream & active scanning loops
  const stopScanner = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerStarted(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start high-performance camera & decoder loop
  const startScanner = useCallback(
    async (preferredDeviceId?: string) => {
      stopScanner();
      setCameraLoading(true);
      setCameraError(null);

      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera access API is not supported in this browser.');
        }

        // 1. Enumerate video devices
        let videoDevices: MediaDeviceInfo[] = [];
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
          setCameras(videoDevices);
        } catch (e) {
          console.warn('Could not enumerate cameras:', e);
        }

        // 2. Select rear camera by default
        let selectedDeviceId = preferredDeviceId;
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rear = videoDevices.find((d) =>
            /back|rear|environment|wide|main/i.test(d.label)
          );
          selectedDeviceId = rear ? rear.deviceId : videoDevices[0].deviceId;
        }

        setCurrentCameraId(selectedDeviceId || null);

        // 3. Optimal constraints for high-speed barcode recognition
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: selectedDeviceId
            ? {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Check torch capability
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            const caps = typeof videoTrack.getCapabilities === 'function' ? (videoTrack.getCapabilities() as unknown as Record<string, unknown>) : {};
            if (caps && caps.torch) {
              setHasTorch(true);
            }
          } catch {
            setHasTorch(false);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setScannerStarted(true);
        setCameraLoading(false);

        // 4. Setup hardware-accelerated or ZXing decoder loop
        // Check for native BarcodeDetector API (fastest on Android Chrome)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasNativeBarcodeDetector = 'BarcodeDetector' in window && typeof (window as any).BarcodeDetector === 'function';

        if (hasNativeBarcodeDetector) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nativeDetector = new (window as any).BarcodeDetector({
              formats: NATIVE_FORMATS,
            });

            let lastScanTimestamp = 0;
            const scanFrame = async (timestamp: number) => {
              if (!videoRef.current || !streamRef.current) return;

              // Scan at snappy 12 FPS interval to balance battery and detection speed
              if (
                !isHandlingScanRef.current &&
                !isPaused &&
                timestamp - lastScanTimestamp >= 80 &&
                videoRef.current.readyState >= 2
              ) {
                lastScanTimestamp = timestamp;
                try {
                  const barcodes = await nativeDetector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const firstCode = barcodes[0].rawValue;
                    if (firstCode) {
                      handleDetectedBarcode(firstCode);
                    }
                  }
                } catch {
                  // Non-fatal frame detection error
                }
              }

              animationFrameIdRef.current = requestAnimationFrame(scanFrame);
            };

            animationFrameIdRef.current = requestAnimationFrame(scanFrame);
            return;
          } catch (nativeErr) {
            console.warn('Native BarcodeDetector initialization fallback to ZXing:', nativeErr);
          }
        }

        // ZXing Multi-Format Reader Fallback
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const zxingReader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 100,
        });
        zxingReaderRef.current = zxingReader;

        if (videoRef.current) {
          zxingReader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result && !isHandlingScanRef.current && !isPaused) {
              const text = result.getText();
              if (text) {
                handleDetectedBarcode(text);
              }
            }
          });
        }
      } catch (err) {
        console.error('Camera launch failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(msg);
        setScannerStarted(false);
        setCameraLoading(false);
      }
    },
    [handleDetectedBarcode, isPaused, stopScanner]
  );

  // Initialize camera on mount & cleanup on unmount
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          // @ts-expect-error torch constraint
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Switch camera between available lenses
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    startScanner(nextCamera.deviceId);
  };

  // Capture current video frame as packaging photo
  const handleSnapPackagingPhoto = () => {
    if (!videoRef.current || !onCapturePackagingClick) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              onCapturePackagingClick(blob);
            }
          },
          'image/jpeg',
          0.9
        );
      }
    } catch (err) {
      console.error('Failed to capture packaging snapshot:', err);
    }
  };

  // Fallback: decode from file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
      const reader = new BrowserMultiFormatReader(hints);
      const imgUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(imgUrl);
      URL.revokeObjectURL(imgUrl);
      if (result) {
        handleDetectedBarcode(result.getText());
      }
    } catch {
      alert('Could not decode a clear barcode from the uploaded image. Please try again or enter manually.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center bg-slate-950 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Hidden file input for barcode image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Bar with Camera Controls */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur z-20 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isPaused ? 'Scanner Paused' : 'Fast Rear Camera Scanner'}
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
              title="Switch Camera Lens"
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
        {/* Direct HTML5 video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Loading Spinner */}
        {cameraLoading && !cameraError && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-2" />
            <span className="text-xs text-slate-300 font-medium">Initializing Rear Camera...</span>
          </div>
        )}

        {/* Reticle / Viewfinder Overlay */}
        {scannerStarted && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened vignette around scanning box */}
            <div className="relative w-[82%] max-w-[300px] h-[55%] max-h-[160px] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Corner accent brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

              {/* Animated laser scan line */}
              <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-scan-laser" />

              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[10px] font-medium tracking-wide bg-black/60 text-emerald-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Align EAN / UPC Barcode Here
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
                <span>Upload Barcode</span>
              </button>
            </div>
          </div>
        )}

        {/* Detected Code Banner */}
        {lastScannedCode && (
          <div className="absolute bottom-2 inset-x-3 bg-emerald-950/95 border border-emerald-500/50 backdrop-blur rounded-xl px-3 py-2 flex items-center justify-between text-xs z-20 shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Detected: <strong className="font-mono text-white text-sm">{lastScannedCode}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setLastScannedCode(null);
                isHandlingScanRef.current = false;
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-200 underline font-semibold"
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
            {Object.entries(SUPERMARKET_CATALOGUE).slice(0, 10).map(([code, p]) => (
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
      <div className="w-full grid grid-cols-3 gap-2 p-3 bg-slate-900/90 border-t border-slate-800/80">
        <button
          onClick={onManualEntryClick}
          className="flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold transition border border-slate-700"
        >
          <Keyboard className="w-4 h-4 text-sky-400" />
          <span>Manual</span>
        </button>

        {onCapturePackagingClick && (
          <button
            onClick={handleSnapPackagingPhoto}
            className="flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold transition border border-slate-700"
            title="Take a photo of product packaging for OCR text extraction"
          >
            <Camera className="w-4 h-4 text-amber-400" />
            <span>Snap Packaging</span>
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold transition border border-slate-700"
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>Upload</span>
        </button>
      </div>
    </div>
  );
};
