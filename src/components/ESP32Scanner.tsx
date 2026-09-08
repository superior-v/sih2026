// src/components/ESP32Scanner.tsx
import React, { useState, useEffect, useRef } from "react";
import { Camera, Wifi, WifiOff, Scan, Package, RefreshCw } from "lucide-react";

// Type definitions
interface ESP32Status {
  online: boolean;
  loading: boolean;
  status?: any;
  esp32_url?: string;
}

interface ComplianceField {
  text: string | null;
  confidence: number;
  compliant: boolean;
}

interface DetectedFields {
  productName: ComplianceField;
  netQuantity: ComplianceField;
  mrp: ComplianceField;
  manufacturer: ComplianceField;
  countryOfOrigin: ComplianceField;
  consumerCare: ComplianceField;
  bestBefore: ComplianceField;
}

interface OCRResult {
  confidence: number;
  extractedText?: string[];
  detectedFields?: DetectedFields;
}

interface CaptureResult {
  success: boolean;
  imageSize?: number;
  timestamp?: string;
  ocrResult?: OCRResult;
  error?: string;
}

interface ProductInfo {
  productName: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  upc: string | null;
  found: boolean;
}

interface BarcodeResult {
  success: boolean;
  barcode?: string;
  productInfo?: ProductInfo;
  timestamp?: string;
  message?: string;
  error?: string;
}

type ScanMode = "ocr" | "barcode";

const ESP32Scanner: React.FC = () => {
  const [esp32Status, setEsp32Status] = useState<ESP32Status>({
    online: false,
    loading: true,
  });
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [scanMode, setScanMode] = useState<ScanMode>("ocr");
  const imgRef = useRef<HTMLImageElement>(null);

  // Check ESP32 status on component mount
  useEffect(() => {
    checkESP32Status();
    getStreamUrl();
  }, []);

  const checkESP32Status = async (): Promise<void> => {
    try {
      setEsp32Status((prev) => ({ ...prev, loading: true }));
      const response = await fetch("/api/esp32/status");
      const data: {
        online: boolean;
        status?: any;
        esp32_url?: string;
      } = await response.json();
      
      setEsp32Status({
        online: data.online,
        loading: false,
        status: data.status,
        esp32_url: data.esp32_url,
      });
    } catch (error) {
      console.error("Failed to check ESP32 status:", error);
      setEsp32Status({ online: false, loading: false });
    }
  };

  const getStreamUrl = async (): Promise<void> => {
    try {
      const response = await fetch("/api/esp32/stream");
      const data: { streamUrl: string } = await response.json();
      setStreamUrl(data.streamUrl);
    } catch (error) {
      console.error("Failed to get stream URL:", error);
    }
  };

  const captureImage = async (): Promise<void> => {
    if (!esp32Status.online) return;

    setIsCapturing(true);
    setCaptureResult(null);
    setBarcodeResult(null);

    try {
      const endpoint =
        scanMode === "barcode"
          ? "/api/esp32/scan-barcode"
          : "/api/esp32/capture";
      const url =
        scanMode === "ocr" ? `${endpoint}?ocr=true&provider=gemini` : endpoint;

      const response = await fetch(url, { method: "POST" });
      const data = await response.json();

      if (scanMode === "barcode") {
        setBarcodeResult(data as BarcodeResult);
      } else {
        setCaptureResult(data as CaptureResult);
      }
    } catch (error) {
      console.error("Capture failed:", error);
      setCaptureResult({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const renderComplianceFields = (fields: DetectedFields | undefined): JSX.Element | null => {
    if (!fields) return null;

    return (
      <div className="mt-4 space-y-2">
        <h4 className="font-semibold text-gray-700">
          Detected Legal Metrology Fields:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {Object.entries(fields).map(([key, field]) => (
            <div
              key={key}
              className={`p-2 rounded ${
                field.compliant
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <span className="font-medium capitalize">
                {key.replace(/([A-Z])/g, " $1")}:{" "}
              </span>
              <span
                className={field.compliant ? "text-green-700" : "text-red-700"}
              >
                {field.text || "Not found"}
              </span>
              <div className="text-xs text-gray-500">
                Confidence: {field.confidence}% | {field.compliant ? "✓" : "✗"}{" "}
                Compliant
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarcodeResult = (): JSX.Element | null => {
    if (!barcodeResult) return null;

    return (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">
          Barcode Scan Result
        </h4>

        {barcodeResult.success && barcodeResult.barcode ? (
          <div className="space-y-3">
            <div className="text-lg font-mono bg-white p-2 rounded border">
              {barcodeResult.barcode}
            </div>

            {barcodeResult.productInfo && barcodeResult.productInfo.found ? (
              <div className="bg-white p-3 rounded border">
                <h5 className="font-medium text-gray-800 mb-2">
                  Product Information:
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong>Name:</strong>{" "}
                    {barcodeResult.productInfo.productName || "N/A"}
                  </div>
                  <div>
                    <strong>Brand:</strong>{" "}
                    {barcodeResult.productInfo.brand || "N/A"}
                  </div>
                  <div>
                    <strong>Category:</strong>{" "}
                    {barcodeResult.productInfo.category || "N/A"}
                  </div>
                  <div>
                    <strong>UPC:</strong>{" "}
                    {barcodeResult.productInfo.upc || "N/A"}
                  </div>
                </div>
                {barcodeResult.productInfo.description && (
                  <div className="mt-2">
                    <strong>Description:</strong>{" "}
                    {barcodeResult.productInfo.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-yellow-700 bg-yellow-50 p-2 rounded">
                Barcode detected but product information not found in database
              </div>
            )}
          </div>
        ) : (
          <div className="text-red-700">
            {barcodeResult.message ||
              barcodeResult.error ||
              "Failed to scan barcode"}
          </div>
        )}
      </div>
    );
  };

  const handleScanModeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setScanMode(e.target.value as ScanMode);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    e.currentTarget.src =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjczODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNhbWVyYSBTdHJlYW0gVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Camera className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                ESP32 Camera Scanner
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {esp32Status.loading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
              ) : esp32Status.online ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 text-sm">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 text-sm">Offline</span>
                </>
              )}
              <button
                onClick={checkESP32Status}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {!esp32Status.online ? (
            <div className="text-center py-8">
              <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                ESP32 Camera Not Connected
              </h3>
              <p className="text-gray-500 mb-4">
                Please ensure your ESP32 camera is connected and running at:{" "}
                {esp32Status.esp32_url || "http://192.168.1.100"}
              </p>
              <button
                onClick={checkESP32Status}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Live Stream */}
              {streamUrl && (
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">
                    Live Stream
                  </h3>
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      ref={imgRef}
                      src={streamUrl}
                      alt="ESP32 Live Stream"
                      className="w-full max-w-md mx-auto block"
                      onError={handleImageError}
                    />
                  </div>
                </div>
              )}

              {/* Scan Controls */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">
                  Capture & Analyze
                </h3>

                {/* Mode Selection */}
                <div className="mb-4">
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="scanMode"
                        value="ocr"
                        checked={scanMode === "ocr"}
                        onChange={handleScanModeChange}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Package className="h-4 w-4" />
                      <span>OCR Analysis (Legal Metrology)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="scanMode"
                        value="barcode"
                        checked={scanMode === "barcode"}
                        onChange={handleScanModeChange}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Scan className="h-4 w-4" />
                      <span>Barcode Scanner</span>
                    </label>
                  </div>
                </div>

                {/* Capture Button */}
                <button
                  onClick={captureImage}
                  disabled={isCapturing}
                  className={`
                    flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors
                    ${
                      isCapturing
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }
                  `}
                >
                  {isCapturing ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : scanMode === "barcode" ? (
                    <Scan className="h-5 w-5" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <span>
                    {isCapturing
                      ? "Capturing..."
                      : scanMode === "barcode"
                      ? "Scan Barcode"
                      : "Capture & Analyze"}
                  </span>
                </button>
              </div>

              {/* Results */}
              {scanMode === "ocr" && captureResult && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-700 mb-2">
                    Capture Result
                  </h4>
                  {captureResult.success ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        <strong>Status:</strong> Success |{" "}
                        <strong>Size:</strong>{" "}
                        {captureResult.imageSize 
                          ? (captureResult.imageSize / 1024).toFixed(1) 
                          : "0"} KB
                      </div>
                      {captureResult.ocrResult && (
                        <div>
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>OCR Confidence:</strong>{" "}
                            {captureResult.ocrResult.confidence}%
                          </div>
                          {captureResult.ocrResult.extractedText &&
                            captureResult.ocrResult.extractedText.length > 0 && (
                            <div className="bg-white p-3 rounded border">
                              <strong>Extracted Text:</strong>
                              <div className="mt-1 text-sm font-mono whitespace-pre-wrap">
                                {captureResult.ocrResult.extractedText.join(
                                  "\n"
                                )}
                              </div>
                            </div>
                          )}
                          {renderComplianceFields(
                            captureResult.ocrResult.detectedFields
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-600">
                      Error: {captureResult.error}
                    </div>
                  )}
                </div>
              )}

              {scanMode === "barcode" && renderBarcodeResult()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ESP32Scanner;