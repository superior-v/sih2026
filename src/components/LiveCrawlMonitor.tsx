import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  MdFastfood, 
  MdFace, 
  MdElectricalServices, 
  MdCheckroom, 
  MdCleaningServices,
  MdRefresh,
  MdPlayArrow,
  MdStop,
  MdWarning,
  MdCheckCircle,
  MdInfo,
  MdError,
  MdVisibility,
  MdOpenInNew,
  MdLanguage,
  MdShoppingCart,
  MdFileDownload,
  MdAssignment,
  MdLightbulb,
  MdGpsFixed,
  MdAnalytics,
  MdTrendingUp
} from 'react-icons/md';

const categories = [
  { value: 'food', label: 'Food & Beverages', icon: MdFastfood, description: 'Rice, honey, oil, tea, etc.' },
  { value: 'cosmetics', label: 'Cosmetics & Beauty', icon: MdFace, description: 'Face cream, shampoo, soap, etc.' },
  { value: 'electronics', label: 'Electronics', icon: MdElectricalServices, description: 'Phones, headphones, speakers, etc.' },
  { value: 'clothing', label: 'Clothing & Fashion', icon: MdCheckroom, description: 'Shirts, jeans, dresses, shoes, etc.' },
  { value: 'home-care', label: 'Home & Personal Care', icon: MdCleaningServices, description: 'Detergent, cleaner, freshener, etc.' }
];

interface CrawledProduct {
  id: string;
  productName: string;
  price: string | null;
  image: string | null;
  url: string;
  platform: string;
  timestamp: string;
  compliance: {
    score: number;
    status: 'compliant' | 'non-compliant' | 'partial-compliant' | 'error';
    violations: string[];
    evidence: {
      field: string;
      found: boolean;
      value?: string;
      rule: string;
      confidence: number;
    }[];
    analysisTime: string;
    ocrConfidence: number;
  };
}

interface CrawlResponse {
  category: string;
  platform: string;
  totalProducts: number;
  products: CrawledProduct[];
  timestamp: string;
}

const LiveCrawlMonitor: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [crawlResults, setCrawlResults] = useState<CrawledProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CrawledProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalScanned: 0,
    compliantCount: 0,
    violationCount: 0,
    averageScore: 0
  });

  const categories = [
    { value: 'food', label: 'Food & Beverages', icon: MdFastfood, description: 'Rice, honey, oil, tea, etc.' },
    { value: 'cosmetics', label: 'Cosmetics & Beauty', icon: MdFace, description: 'Face cream, shampoo, soap, etc.' },
    { value: 'electronics', label: 'Electronics', icon: MdElectricalServices, description: 'Phones, headphones, chargers, etc.' },
    { value: 'clothing', label: 'Clothing & Fashion', icon: MdCheckroom, description: 'Shirts, jeans, shoes, etc.' },
    { value: 'home-care', label: 'Home Care', icon: MdCleaningServices, description: 'Detergent, cleaners, fresheners, etc.' }
  ];

  const platforms = [
    { value: 'all', label: <span className="flex items-center gap-2"><MdLanguage className="text-blue-500" /> All Platforms</span> },
    { value: 'amazon', label: '📦 Amazon' },
    { value: 'flipkart', label: '🛒 Flipkart' }
  ];

  useEffect(() => {
    if (crawlResults.length > 0) {
      const totalScanned = crawlResults.length;
      const compliantCount = crawlResults.filter(p => p.compliance.status === 'compliant').length;
      const violationCount = crawlResults.filter(p => p.compliance.status === 'non-compliant').length;
      const averageScore = Math.round(
        crawlResults.reduce((sum, p) => sum + p.compliance.score, 0) / totalScanned
      );

      setStats({
        totalScanned,
        compliantCount,
        violationCount,
        averageScore
      });
    }
  }, [crawlResults]);

  const startCrawling = async () => {
    setIsLoading(true);
    setError(null);
    setIsLive(true);

    try {
      const response = await fetch('http://localhost:3001/api/crawl-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: selectedCategory,
          platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
          maxProducts: 10
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to crawl products: ${response.statusText}`);
      }

      const data: CrawlResponse = await response.json();
      setCrawlResults(data.products);
      
      // Simulate real-time updates for demo
      if (data.products.length > 0) {
        setSelectedProduct(data.products[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to crawl products');
      console.error('Crawling error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCrawling = () => {
    setIsLive(false);
  };

  const clearResults = () => {
    setCrawlResults([]);
    setSelectedProduct(null);
    setStats({
      totalScanned: 0,
      compliantCount: 0,
      violationCount: 0,
      averageScore: 0
    });
  };

  const exportToExcel = () => {
    if (crawlResults.length === 0) {
      alert('No data to export. Please crawl some products first.');
      return;
    }

    // Prepare data for Excel export
    const exportData = crawlResults.map((product, index) => ({
      'S.No': index + 1,
      'Product Name': product.productName,
      'Platform': product.platform,
      'Price': product.price || 'N/A',
      'Compliance Status': product.compliance?.status || 'Unknown',
      'Compliance Score (%)': product.compliance?.score || 0,
      'MRP Found': product.compliance?.evidence?.find(e => e.field === 'MRP')?.found ? 'Yes' : 'No',
      'Manufacturer Found': product.compliance?.evidence?.find(e => e.field === 'Manufacturer')?.found ? 'Yes' : 'No',
      'Import Date Found': product.compliance?.evidence?.find(e => e.field === 'Import Date')?.found ? 'Yes' : 'No',
      'Quantity Found': product.compliance?.evidence?.find(e => e.field === 'Quantity')?.found ? 'Yes' : 'No',
      'Ingredients Found': product.compliance?.evidence?.find(e => e.field === 'Ingredients')?.found ? 'Yes' : 'No',
      'Violations': product.compliance?.violations?.length || 0,
      'Product URL': product.url,
      'Crawled At': new Date().toLocaleString()
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { wch: 8 },   // S.No
      { wch: 30 },  // Product Name
      { wch: 12 },  // Platform
      { wch: 12 },  // Price
      { wch: 15 },  // Compliance Status
      { wch: 18 },  // Compliance Score
      { wch: 12 },  // MRP Found
      { wch: 18 },  // Manufacturer Found
      { wch: 18 },  // Import Date Found
      { wch: 15 },  // Quantity Found
      { wch: 18 },  // Ingredients Found
      { wch: 12 },  // Violations
      { wch: 50 },  // Product URL
      { wch: 20 }   // Crawled At
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Compliance Report');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `LiveCrawl_Compliance_Report_${timestamp}.xlsx`;

    // Save the file
    XLSX.writeFile(wb, filename);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-100';
      case 'non-compliant': return 'text-red-600 bg-red-100';
      case 'partial-compliant': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🔴 Live Product Crawl Monitor
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time compliance monitoring of e-commerce products using AI-powered crawling
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isLive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {isLive ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MdStop className="text-gray-500" />
                  STOPPED
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <MdError className="text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MdInfo className="text-blue-500" />
          Crawl Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {categories.find(c => c.value === selectedCategory)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {platforms.map(platform => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={startCrawling}
            disabled={isLoading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Crawling...
              </>
            ) : (
              <><MdPlayArrow className="mr-2" /> Start Live Crawl</>
            )}
          </button>
          
          <button
            onClick={stopCrawling}
            disabled={!isLive || isLoading}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center"
          >
            <MdStop className="mr-2" /> Stop Crawl
          </button>
          
          <button
            onClick={clearResults}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center"
          >
            🗑️ Clear Results
          </button>
          
          <button
            onClick={exportToExcel}
            disabled={isLoading || crawlResults.length === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center"
          >
            <MdFileDownload className="mr-2" /> Export Report
          </button>
        </div>
      </div>

      {/* Statistics */}
      {crawlResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MdAnalytics className="text-blue-500 text-xl" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Products Scanned</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalScanned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MdCheckCircle className="text-green-500 text-xl" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Compliant</p>
                <p className="text-2xl font-bold text-green-600">{stats.compliantCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <MdError className="text-red-500 text-xl" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Violations</p>
                <p className="text-2xl font-bold text-red-600">{stats.violationCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MdTrendingUp className="text-green-500 text-xl" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Avg Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                  {stats.averageScore}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {crawlResults.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MdShoppingCart className="text-blue-500" />
                Crawled Products ({crawlResults.length})
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {crawlResults.map((product) => (
                <div
                  key={product.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    selectedProduct?.id === product.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex items-start space-x-3">
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.productName}
                        className="w-16 h-16 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 truncate text-sm">
                          {product.productName}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(product.compliance.status)}`}>
                          {product.compliance.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>🏪 {product.platform}</span>
                        <span className={`font-semibold ${getScoreColor(product.compliance.score)}`}>
                          {product.compliance.score}%
                        </span>
                      </div>
                      {product.price && (
                        <div className="text-sm text-gray-600">💰 ₹{product.price}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        🕒 {new Date(product.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MdVisibility className="text-purple-500" />
                Compliance Analysis
              </h3>
            </div>
            <div className="p-4">
              {selectedProduct ? (
                <div>
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">{selectedProduct.productName}</h4>
                    <p className="text-sm text-gray-600 mb-1">🏪 Platform: {selectedProduct.platform}</p>
                    {selectedProduct.price && (
                      <p className="text-sm text-gray-600 mb-1">💰 Price: ₹{selectedProduct.price}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      🕒 Analyzed: {new Date(selectedProduct.compliance.analysisTime).toLocaleString()}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <MdAnalytics className="text-blue-500" />
                      Compliance Score
                    </h5>
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${
                            selectedProduct.compliance.score >= 80 ? 'bg-green-500' :
                            selectedProduct.compliance.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedProduct.compliance.score}%` }}
                        />
                      </div>
                      <span className={`ml-3 font-semibold ${getScoreColor(selectedProduct.compliance.score)}`}>
                        {selectedProduct.compliance.score}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      OCR Confidence: {selectedProduct.compliance.ocrConfidence}%
                    </p>
                  </div>

                  <div className="mb-4">
                    <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <MdAssignment className="text-gray-600" />
                      Field Analysis
                    </h5>
                    <div className="space-y-2">
                      {selectedProduct.compliance.evidence.map((evidence, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{evidence.field}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              evidence.found ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {evidence.found ? (
                                <span className="flex items-center gap-1">
                                  <MdCheckCircle className="text-green-500" />
                                  Found
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <MdError className="text-red-500" />
                                  Missing
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            <p>📜 Rule: {evidence.rule}</p>
                            {evidence.value && (
                              <p className="flex items-center gap-1">
                                <MdLightbulb className="text-yellow-500" />
                                Value: "{evidence.value}"
                              </p>
                            )}
                            <p className="flex items-center gap-1">
                              <MdGpsFixed className="text-blue-500" />
                              Confidence: {Math.round(evidence.confidence * 100)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedProduct.compliance.violations.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <MdWarning className="text-yellow-500" />
                        Violations Found
                      </h5>
                      <div className="space-y-1">
                        {selectedProduct.compliance.violations.map((violation, index) => (
                          <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            • {violation}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <a
                      href={selectedProduct.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      🔗 View Original Product Page
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MdShoppingCart className="text-gray-400 text-4xl" />
                  <p className="mt-2">Select a product to view compliance analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Indicator */}
      {isLive && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
          🔴 Live Crawl Active
        </div>
      )}
    </div>
  );
};

export default LiveCrawlMonitor;