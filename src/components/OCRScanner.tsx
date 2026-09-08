import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  ScanLine,
  FileImage,
  Download,
  Zap,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import LiveScanner from "./LiveScanner";
import { useAuth } from '../contexts/AuthContext';
import { logOCRScan } from '../services/firestoreService';

type DetectedField = {
  text: string | null;
  confidence: number;
  compliant: boolean;
};

type OCRState = {
  extractedText: string[];
  confidence: number;
  detectedFields: Record<string, DetectedField>;
  // extra returned by backend (if present)
  provider?: "tesseract" | "vision" | "gemini" | "hybrid";
  ms?: number;
  fast?: boolean;
};

// Backend base — configure in .env as VITE_API_BASE=http://localhost:3001
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") ||
  "http://localhost:3001";

// A tiny helper to sleep
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OCRScanner: React.FC = () => {
  const { user } = useAuth(); // 🔥 Get current user
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [ocrResults, setOcrResults] = useState<OCRState | null>(null);
  const [lang, setLang] = useState<"eng" | "eng+hin">("eng");
  const [fast, setFast] = useState<boolean>(false);
  const [provider, setProvider] = useState<
    "tesseract" | "vision" | "gemini" | "hybrid"
  >("tesseract");
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  // Prevent concurrent live-frame uploads
  const liveLockRef = useRef(false);

  // Demo/sample images
  const sampleImages = useMemo(
    () => [
      {
        url:
          "https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1200",
        name: "Packaged Food Product",
        description: "Cereal box with nutrition label",
      },
      {
        url:
          "https://images.pexels.com/photos/4110250/pexels-photo-4110250.jpeg?auto=compress&cs=tinysrgb&w=1200",
        name: "Bottled Product",
        description: "Oil bottle with label information",
      },
      {
        url:
          "https://images.pexels.com/photos/33095/honey-golden-syrup-pouring-sweet.jpg?auto=compress&cs=tinysrgb&w=1200",
        name: "Jar Product",
        description: "Honey jar with product details",
      },
    ],
    []
  );

  // Soft progress "heartbeat" while server works
  function startProgressHeartbeat() {
    stopProgressHeartbeat();
    setProgress(10);
    // creep up to 90% over time so UI doesn't look frozen
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 1 : p));
    }, 700);
  }

  function stopProgressHeartbeat(done = false) {
    if (progressTimerRef.current != null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (done) setProgress(100);
  }

  useEffect(() => {
    return () => stopProgressHeartbeat(); // cleanup on unmount
  }, []);

  // --- API calls with timeout & abort ---
  async function postWithTimeout(url: string, body: BodyInit, headers?: HeadersInit) {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 120000); // 120s cap

    try {
      const r = await fetch(url, {
        method: "POST",
        body,
        headers,
        signal: controller.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const message =
          (data && (data.error || data.message)) ||
          `Request failed (${r.status})`;
        throw new Error(message);
      }
      return data;
    } finally {
      window.clearTimeout(t);
    }
  }

  // 🔥 Helper to log OCR scan to Firebase
  async function logScanToFirebase(data: OCRState) {
    if (!user) return; // Only log if user is authenticated

    try {
      // Combine all extracted text into single string
      const extractedText = data.extractedText.join('\n');
      
      await logOCRScan(
        user.id,
        user.name,
        extractedText,
        data.confidence || 0,
        data.provider || provider
      );
      
      console.log('✅ OCR scan logged to Firebase');
    } catch (error) {
      console.error('❌ Failed to log OCR scan:', error);
      // Don't throw - we don't want to break OCR if logging fails
    }
  }

  async function callServerOCRWithFile(file: File) {
    setError(null);
    setIsScanning(true);
    setOcrResults(null);
    startProgressHeartbeat();

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("lang", lang);
      if (fast) fd.append("fast", "1"); // backend can interpret this
      // choose provider via query
      const url = `${API_BASE}/api/ocr?provider=${encodeURIComponent(provider)}`;

      const data = await postWithTimeout(url, fd);
      setOcrResults(data);
      
      // 🔥 LOG TO FIREBASE
      await logScanToFirebase(data);
      
      stopProgressHeartbeat(true);
      setIsScanning(false);
    } catch (e: any) {
      stopProgressHeartbeat();
      setIsScanning(false);
      setProgress(0);
      setError(e?.message || "OCR failed");
    }
  }

  async function callServerOCRWithUrl(imageUrl: string) {
    setError(null);
    setIsScanning(true);
    setOcrResults(null);
    startProgressHeartbeat();

    try {
      const payload: any = { url: imageUrl, lang };
      if (fast) payload.fast = 1;

      const url = `${API_BASE}/api/ocr?provider=${encodeURIComponent(provider)}`;
      const data = await postWithTimeout(url, JSON.stringify(payload), {
        "Content-Type": "application/json",
      });

      setOcrResults(data);
      
      // 🔥 LOG TO FIREBASE
      await logScanToFirebase(data);
      
      stopProgressHeartbeat(true);
      setIsScanning(false);
    } catch (e: any) {
      stopProgressHeartbeat();
      setIsScanning(false);
      setProgress(0);
      setError(e?.message || "OCR failed");
    }
  }

  async function handleLocalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const localUrl = URL.createObjectURL(f);
    setSelectedImage(localUrl);
    await sleep(100); // allow preview to paint
    await callServerOCRWithFile(f);
  }

  async function handleScanSample(imageUrl: string) {
    setSelectedImage(imageUrl);
    await callServerOCRWithUrl(imageUrl);
  }

  // New: handle blob frames from LiveScanner
  async function handleLiveFrameBlob(blob: Blob) {
    // Avoid concurrent live uploads
    if (liveLockRef.current) return;
    liveLockRef.current = true;

    try {
      // Convert blob -> File to reuse callServerOCRWithFile
      const file = new File([blob], "frame.jpg", { type: blob.type || "image/jpeg" });

      // Show preview of frame
      const url = URL.createObjectURL(blob);
      setSelectedImage(url);
      // revoke after some time to avoid leaks
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // Reuse existing path (preprocess + OCR providers)
      await callServerOCRWithFile(file);
    } catch (e) {
      console.error("Live frame upload error:", e);
    } finally {
      liveLockRef.current = false;
    }
  }

  function exportResults() {
    if (!ocrResults) return;
    const blob = new Blob([JSON.stringify(ocrResults, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr_results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetScan() {
    setSelectedImage("");
    setProgress(0);
    setOcrResults(null);
    setIsScanning(false);
    setError(null);
  }

  const providerLabel: Record<typeof provider, string> = {
    tesseract: "Tesseract (local)",
    vision: "Google Vision",
    gemini: "Gemini (image OCR)",
    hybrid: "Hybrid (Vision → Gemini clean-up)",
  } as any;

  const ocrStepText =
    provider === "tesseract"
      ? fast
        ? "Tesseract OCR (fast)"
        : "Tesseract OCR (general + numeric)"
      : provider === "vision"
      ? "Google Vision OCR"
      : provider === "gemini"
      ? "Gemini OCR"
      : "Hybrid (Vision OCR + Gemini clean-up)";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">OCR Scanner</h2>
        <p className="text-gray-600 mt-1">
          Extract and validate text from product packaging images
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Live scanner integration (mobile camera) */}
      <LiveScanner onFrameBlob={handleLiveFrameBlob} />

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Image Upload & Analysis</h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Provider */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Engine:</label>
              <select
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as typeof provider)
                }
                className="border rounded px-2 py-1 text-sm"
                title="Choose OCR provider"
              >
                <option value="tesseract">Tesseract (local)</option>
                <option value="vision">Google Vision</option>
                <option value="gemini">Gemini</option>
                <option value="hybrid">Hybrid (Vision→Gemini)</option>
              </select>
            </div>

            {/* Fast toggle (applies to tesseract) */}
            <label className="text-sm text-gray-700">
              <input
                type="checkbox"
                className="mr-2 align-middle"
                checked={fast}
                onChange={(e) => setFast(e.target.checked)}
                disabled={provider !== "tesseract"}
                title={
                  provider === "tesseract"
                    ? "Use faster single-pass OCR"
                    : "Fast mode is only for Tesseract"
                }
              />
              Fast mode
            </label>

            {/* Language */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Language:</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as "eng" | "eng+hin")}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="eng">English (eng)</option>
                <option value="eng+hin">English + Hindi (eng+hin)</option>
              </select>
            </div>
          </div>
        </div>

        <div
          className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Upload Product Image
          </p>
          <p className="text-gray-600 mb-4">
            Drag and drop or click to select product packaging image
          </p>
          <button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleLocalFile}
          />
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-900 mb-3">
            Or try with sample images:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleImages.map((image, idx) => (
              <button
                type="button"
                key={idx}
                className="text-left cursor-pointer bg-gray-50 rounded-lg p-4 hover:bg-blue-50 border hover:border-blue-300 transition-all"
                onClick={() => handleScanSample(image.url)}
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
                <p className="font-medium text-gray-900">{image.name}</p>
                <p className="text-sm text-gray-600">{image.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Processing */}
      {isScanning && (
        <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
              <ScanLine className="h-8 w-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="mt-4 text-lg font-medium text-gray-900">
              Processing on server…
            </p>
            <p className="text-sm text-gray-600 mt-1">Progress: {progress}%</p>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <p>• Preprocessing (grayscale, normalize, sharpen, threshold)</p>
              <p>• {ocrStepText}</p>
              <p>• Validating against Legal Metrology fields</p>
              {user && <p className="text-blue-600">• Logging scan to your account...</p>}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {ocrResults && !isScanning && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  OCR Analysis Results
                </h3>
                <p className="text-gray-600">
                  Avg confidence: {Math.round((ocrResults.confidence || 0) * 10) / 10}%
                </p>
                <div className="mt-1 text-xs text-gray-500">
                  Engine:{" "}
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                    {providerLabel[(ocrResults.provider as any) || provider]}
                  </span>
                  {typeof ocrResults.ms === "number" && (
                    <span className="ml-2">
                      • Server time: {ocrResults.ms} ms
                    </span>
                  )}
                  {user && (
                    <span className="ml-2 text-green-600">
                      • ✓ Saved to your account
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700">
                  AI-Powered
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Source Image
                </h4>
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt="Product being analyzed"
                    className="w-full h-64 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-full h-64 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-500">
                    No image
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Extracted Text
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
                  <div className="space-y-2 font-mono text-sm">
                    {ocrResults.extractedText.length ? (
                      ocrResults.extractedText.map((line, i) => (
                        <div key={i} className="p-2 bg-white rounded border">
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500">No text detected.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Field Validation Results
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(ocrResults.detectedFields).map(
                  ([field, data]) => (
                    <div key={field} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-gray-900 capitalize">
                          {field.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                        <div className="flex items-center space-x-2">
                          {data.compliant ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-sm text-gray-600">
                            {data.confidence}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">
                        {data.text || "—"}
                      </p>
                      {!data.compliant && (
                        <p className="text-xs text-red-600 mt-1">
                          Does not meet Legal Metrology requirements (or not
                          detected).
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="mt-6 flex space-x-4">
              <button
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={exportResults}
              >
                <Download className="h-4 w-4" />
                <span>Export Results</span>
              </button>
              <button
                className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={resetScan}
              >
                <FileImage className="h-4 w-4" />
                <span>Scan Another</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          OCR Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <ScanLine className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-medium text-gray-900">Server-side OCR</p>
            <p className="text-sm text-gray-600">
              Sharp preprocessing + selectable engines
            </p>
          </div>
          <div className="text-center p-4">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium text-gray-900">Two-pass / Fast</p>
            <p className="text-sm text-gray-600">
              Tesseract general + numeric or single-pass
            </p>
          </div>
          <div className="text-center p-4">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <FileImage className="h-6 w-6 text-purple-600" />
            </div>
            <p className="font-medium text-gray-900">Cloud engines</p>
            <p className="text-sm text-gray-600">Google Vision / Gemini</p>
          </div>
          <div className="text-center p-4">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Download className="h-6 w-6 text-orange-600" />
            </div>
            <p className="font-medium text-gray-900">Export</p>
            <p className="text-sm text-gray-600">Download JSON results</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRScanner;