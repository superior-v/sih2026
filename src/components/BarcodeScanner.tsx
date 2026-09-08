import React, { useState } from "react";
import { Search, AlertTriangle, CheckCircle, X, ExternalLink, Upload, Loader2 } from "lucide-react";

// Type definitions
interface ProductInfo {
  barcode: string;
  productName: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  image: string | null;
  upc: string | null;
  ean: string | null;
  found: boolean;
  error?: string;
}

interface ScanResult {
  found: boolean;
  barcode?: string;
  type?: string;
  productInfo?: ProductInfo | null;
  message?: string;
}

type ActiveTab = "upload" | "manual";

const BarcodeScanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual");
  const [barcodeInput, setBarcodeInput] = useState(""); // ✅ Initialize with empty string instead of undefined
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

  // Handle manual barcode lookup
  const handleManualLookup = async () => {
    if (!barcodeInput.trim()) {
      alert("Please enter a barcode number");
      return;
    }

    setIsProcessing(true);
    setScanResult(null);

    try {
      console.log('🔍 Looking up barcode:', barcodeInput);
      
      const response = await fetch(`${API_BASE}/api/barcode/lookup/${barcodeInput.trim()}`);
      const data = await response.json();

      console.log('📦 Barcode lookup response:', data);

      if (data.found) {
        setScanResult({
          found: true,
          barcode: data.barcode,
          type: "manual",
          productInfo: data,
        });
      } else {
        setScanResult({
          found: false,
          message: data.error || "Product not found in database",
        });
      }
    } catch (error) {
      console.error('❌ Barcode lookup error:', error);
      setScanResult({
        found: false,
        message: error instanceof Error ? error.message : "Failed to lookup barcode",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setScanResult(null);
  };

  // Handle image upload and decode
  const handleImageDecode = async () => {
    if (!selectedFile) {
      alert("Please select an image first");
      return;
    }

    setIsProcessing(true);
    setScanResult(null);

    try {
      console.log('📤 Uploading image for barcode detection...');

      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("lookup", "true");

      const response = await fetch(`${API_BASE}/api/barcode/decode`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log('📦 Barcode decode response:', data);

      if (data.found && data.barcode) {
        setScanResult({
          found: true,
          barcode: data.barcode,
          type: data.type || "image",
          productInfo: data.productInfo,
        });
      } else {
        setScanResult({
          found: false,
          message: data.message || "No barcode detected in image",
        });
      }
    } catch (error) {
      console.error('❌ Barcode decode error:', error);
      setScanResult({
        found: false,
        message: error instanceof Error ? error.message : "Failed to decode barcode",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear upload
  const handleClearUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Barcode Scanner</h2>
        <p className="text-gray-600 mt-1">
          Scan product barcodes and lookup product information
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "manual"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Search className="h-5 w-5" />
                <span>Manual Entry</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "upload"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload Image</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "manual" ? (
            // Manual Entry Tab
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Barcode Number
                </label>
                <input
                  type="text"
                  value={barcodeInput} // ✅ Now always controlled (never undefined)
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="012000000065"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isProcessing}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter UPC, EAN-13, EAN-8, or other standard barcodes
                </p>
              </div>

              <button
                onClick={handleManualLookup}
                disabled={!barcodeInput.trim() || isProcessing}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Looking up...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    <span>Lookup</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            // Upload Image Tab
            <div className="space-y-4">
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("barcode-upload")?.click()}
                >
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">
                    Click to upload barcode image
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                  <input
                    id="barcode-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Barcode preview"
                        className="w-full h-64 object-contain bg-gray-100 rounded-lg"
                      />
                    )}
                    <button
                      onClick={handleClearUpload}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleImageDecode}
                    disabled={isProcessing}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span>Scan Barcode</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              {scanResult.found ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  Scan Result
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  No Barcode Detected
                </>
              )}
            </h3>
          </div>

          <div className="p-6">
            {scanResult.found && scanResult.productInfo ? (
              <div className="space-y-4">
                {/* Barcode Number */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Barcode Number</p>
                  <p className="text-xl font-mono font-bold text-gray-900">
                    {scanResult.barcode}
                  </p>
                </div>

                {/* Product Image */}
                {scanResult.productInfo.image && (
                  <div>
                    <img
                      src={scanResult.productInfo.image}
                      alt={scanResult.productInfo.productName || "Product"}
                      className="w-full h-64 object-contain bg-gray-100 rounded-lg"
                    />
                  </div>
                )}

                {/* Product Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Product Name</p>
                    <p className="font-medium text-gray-900">
                      {scanResult.productInfo.productName || "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Brand</p>
                    <p className="font-medium text-gray-900">
                      {scanResult.productInfo.brand || "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium text-gray-900">
                      {scanResult.productInfo.category || "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">UPC</p>
                    <p className="font-mono text-gray-900">
                      {scanResult.productInfo.upc || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {scanResult.productInfo.description && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Description</p>
                    <p className="text-gray-700">
                      {scanResult.productInfo.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-gray-900 font-medium">
                  {scanResult.message || "Product not found"}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  The barcode might not be in our database or the image quality is too low
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Supported Barcode Formats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-900">UPC-A</p>
            <p className="text-gray-600">12 digits</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">EAN-13</p>
            <p className="text-gray-600">13 digits</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">EAN-8</p>
            <p className="text-gray-600">8 digits</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">QR Code</p>
            <p className="text-gray-600">Variable</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;