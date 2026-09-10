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
  , MdForum
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

interface ProductInsightFinding {
  key: string;
  issue: string;
  mentions: number;
  prevalence: number;
  confidence: 'high' | 'medium' | 'low';
  sources: { title: string; url: string; source: string; publishedAt: string | null }[];
}

interface ProductInsightReport {
  productName: string;
  generatedAt: string;
  sourceMethod: string;
  sourceCount: number;
  caveat: string;
  summary: string;
  findings: ProductInsightFinding[];
  sources: { title: string; url: string; source: string; publishedAt: string | null; contextOnly?: boolean }[];
}

interface ComplaintReport {
  category: string;
  generatedAt: string;
  sourceMethod: string;
  sourceCount: number;
  complaintSourceCount: number;
  caveat: string;
  executiveSummary: string;
  recurringIssues: {
    key: string;
    issue: string;
    mentions: number;
    prevalence: number;
    confidence: 'high' | 'medium' | 'low';
    sources: { title: string; url: string; source: string; publishedAt: string | null }[];
  }[];
  hotspots: {
    subject: string;
    source: string;
    url: string;
    publishedAt: string | null;
    issues: string[];
    evidence: string;
  }[];
  productCandidates: { productName: string; productUrl: string; source: string; evidence: string }[];
  relatedDiscussion: { title: string; url: string; source: string; snippet: string }[];
}

interface PublicProductAnalysis {
  product: { productName: string; discoveredName: string; url: string; image: string | null };
  analysis: {
    provider: string;
    ocrConfidence: number;
    extractedText: string;
    detectedFields: Record<string, { text?: string | null; compliant?: boolean; notes?: string }>;
    complianceScore: number | null;
    status: string;
    note: string;
  };
}

interface HotspotAnalysisReport {
  category: string;
  analyzedAt: string;
  method: string;
  crawledCount: number;
  retainedCount: number;
  filteredNoiseCount: number;
  caveat: string;
  executiveSummary: string;
  findings: {
    key: string;
    issue: string;
    mentions: number;
    confidence: 'high' | 'medium' | 'low';
    sources: { subject: string; url: string; source: string; evidence: string; relevanceScore: number }[];
  }[];
  retainedSources: { subject: string; source: string; url: string; issues: string[]; evidence: string; relevanceScore: number }[];
  filteredSources: { subject: string; source: string; url: string; reason: string }[];
  recommendedActions: string[];
}

const LiveCrawlMonitor: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [crawlResults, setCrawlResults] = useState<CrawledProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CrawledProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightReport, setInsightReport] = useState<ProductInsightReport | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [complaintReport, setComplaintReport] = useState<ComplaintReport | null>(null);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
  const [hotspotAnalysis, setHotspotAnalysis] = useState<HotspotAnalysisReport | null>(null);
  const [isAnalyzingHotspots, setIsAnalyzingHotspots] = useState(false);
  const [publicProductAnalysis, setPublicProductAnalysis] = useState<PublicProductAnalysis | null>(null);
  const [analyzingProductUrl, setAnalyzingProductUrl] = useState<string | null>(null);
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
    { value: 'flipkart', label: '🛒 Flipkart' },
    { value: 'swiggy', label: '🛍️ Swiggy Instamart' },
    { value: 'blinkit', label: '⚡ Blinkit' },
    { value: 'zepto', label: '🚴 Zepto' }
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
    setInsightReport(null);
    setComplaintReport(null);
    setHotspotAnalysis(null);
    setPublicProductAnalysis(null);
    setStats({
      totalScanned: 0,
      compliantCount: 0,
      violationCount: 0,
      averageScore: 0
    });
  };

  const analyzePublicProduct = async (candidate: ComplaintReport['productCandidates'][number]) => {
    setAnalyzingProductUrl(candidate.productUrl);
    setError(null);
    try {
      const response = await fetch('/api/analyze-public-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not analyse product');
      setPublicProductAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyse product');
    } finally {
      setAnalyzingProductUrl(null);
    }
  };

  const analyzeComplaintHotspots = async () => {
    if (!complaintReport) return;
    setIsAnalyzingHotspots(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze-complaint-hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory, hotspots: complaintReport.hotspots }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyse complaint hotspots');
      setHotspotAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse complaint hotspots');
    } finally {
      setIsAnalyzingHotspots(false);
    }
  };

  const findComplaintHotspots = async () => {
    setIsLoadingComplaints(true);
    setError(null);
    try {
      const response = await fetch('/api/complaint-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to find complaint hotspots');
      setComplaintReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find complaint hotspots');
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  const loadProductInsights = async () => {
    if (!selectedProduct) return;
    setIsLoadingInsights(true);
    setError(null);
    try {
      const response = await fetch('/api/product-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct.productName,
          productUrl: selectedProduct.url,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to gather public discussion');
      setInsightReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to gather public discussion');
    } finally {
      setIsLoadingInsights(false);
    }
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

          <button
            onClick={findComplaintHotspots}
            disabled={isLoadingComplaints}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center"
          >
            <MdWarning className="mr-2" />
            {isLoadingComplaints ? 'Finding complaint hotspots...' : 'Find complaint hotspots'}
          </button>
        </div>
      </div>

      {complaintReport && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-indigo-600">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                <MdWarning className="text-indigo-600" />
                Public Complaint Hotspot Report
              </h3>
              <p className="text-sm text-gray-600 mt-1">{complaintReport.executiveSummary}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {complaintReport.sourceCount} sources • {complaintReport.sourceMethod}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{complaintReport.caveat}</p>

          <button
            onClick={analyzeComplaintHotspots}
            disabled={isAnalyzingHotspots || complaintReport.hotspots.length === 0}
            className="mb-5 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-gray-400"
          >
            <MdAnalytics />
            {isAnalyzingHotspots ? 'Crawling and filtering evidence...' : 'Analyse these complaint hotspots'}
          </button>

          {complaintReport.recurringIssues.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {complaintReport.recurringIssues.map((issue) => (
                <div key={issue.key} className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-medium text-gray-900">{issue.issue}</h4>
                    <span className="text-sm font-semibold text-indigo-700">{issue.mentions} mentions</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{issue.prevalence}% of sources • {issue.confidence} confidence</p>
                  <div className="mt-2 space-y-1">
                    {issue.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-blue-700 hover:underline">
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-5">No recurring compliance-related complaint signal was detected.</p>
          )}

          <h4 className="font-medium text-gray-900 mb-2">Products and discussions to review</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {complaintReport.hotspots.length > 0 ? complaintReport.hotspots.map((hotspot) => (
              <div key={hotspot.url} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <a href={hotspot.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline text-sm">
                    {hotspot.subject}
                  </a>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{hotspot.source}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{hotspot.issues.join(' • ')}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{hotspot.evidence}</p>
              </div>
            )) : <p className="text-sm text-gray-500">No complaint sources matched the configured signals.</p>}
          </div>
          {complaintReport.productCandidates.length > 0 && (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Specific products found in marketplace sources</h4>
              <div className="space-y-2">
                {complaintReport.productCandidates.map((candidate) => (
                  <div key={candidate.productUrl} className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <div className="min-w-0">
                      <a href={candidate.productUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-blue-700 hover:underline">{candidate.productName}</a>
                      <p className="text-xs text-gray-500">Found via {candidate.source}</p>
                    </div>
                    <button
                      onClick={() => analyzePublicProduct(candidate)}
                      disabled={analyzingProductUrl === candidate.productUrl}
                      className="whitespace-nowrap rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-gray-400"
                    >
                      {analyzingProductUrl === candidate.productUrl ? 'Analysing...' : 'Analyse product compliance'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {complaintReport.relatedDiscussion.length > 0 && (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-1">India consumer complaint research</h4>
              <p className="text-xs text-gray-500 mb-2">These are India-focused consumer discussions and reports. They provide category-level signals unless a specific product is identified above.</p>
              <div className="space-y-2">
                {complaintReport.relatedDiscussion.map((source) => (
                  <div key={source.url} className="rounded-lg border border-gray-200 p-3">
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">{source.title}</a>
                    <p className="text-xs text-gray-500 mt-1">{source.source}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{source.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hotspotAnalysis && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-emerald-600">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Final Complaint Hotspot Analysis</h3>
              <p className="text-sm text-gray-700 mt-1">{hotspotAnalysis.executiveSummary}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{hotspotAnalysis.method}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Sources crawled</p><p className="text-xl font-bold text-gray-900">{hotspotAnalysis.crawledCount}</p></div>
            <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-gray-500">Evidence retained</p><p className="text-xl font-bold text-emerald-700">{hotspotAnalysis.retainedCount}</p></div>
            <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-gray-500">Noise filtered</p><p className="text-xl font-bold text-amber-700">{hotspotAnalysis.filteredNoiseCount}</p></div>
          </div>
          <p className="text-xs text-gray-500 mb-4">{hotspotAnalysis.caveat}</p>
          {hotspotAnalysis.findings.length > 0 && (
            <div className="space-y-3 mb-5">
              {hotspotAnalysis.findings.map((finding) => (
                <div key={finding.key} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-medium text-gray-900">{finding.issue}</h4>
                    <span className="text-sm font-semibold text-emerald-700">{finding.mentions} retained</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{finding.confidence} confidence after page crawl</p>
                  <div className="mt-2 space-y-1">
                    {finding.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-blue-700 hover:underline">
                        {source.subject}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h4 className="font-medium text-gray-900 mb-2">Recommended authority workflow</h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            {hotspotAnalysis.recommendedActions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        </div>
      )}

      {publicProductAnalysis && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-900">Specific Product Compliance Analysis</h3>
          <p className="mt-1 text-sm text-gray-700">{publicProductAnalysis.product.productName}</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-gray-500">Compliance score</p><p className="text-xl font-bold text-blue-700">{publicProductAnalysis.analysis.complianceScore == null ? 'Pending label' : `${publicProductAnalysis.analysis.complianceScore}%`}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">OCR provider</p><p className="text-sm font-semibold text-gray-900">{publicProductAnalysis.analysis.provider}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">OCR confidence</p><p className="text-xl font-bold text-gray-900">{publicProductAnalysis.analysis.ocrConfidence}%</p></div>
          </div>
          <p className="mt-4 text-sm text-gray-700">{publicProductAnalysis.analysis.note}</p>
          {Object.keys(publicProductAnalysis.analysis.detectedFields).length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(publicProductAnalysis.analysis.detectedFields).map(([field, value]) => (
                <div key={field} className="rounded border border-gray-200 p-2 text-sm">
                  <div className="flex justify-between gap-2"><span className="font-medium capitalize">{field}</span><span className={value.compliant ? 'text-green-700' : 'text-red-700'}>{value.compliant ? 'Found' : 'Missing / unclear'}</span></div>
                  {value.text && <p className="mt-1 text-xs text-gray-600">{value.text}</p>}
                  {value.notes && <p className="mt-1 text-xs text-gray-500">{value.notes}</p>}
                </div>
              ))}
            </div>
          )}
          <a href={publicProductAnalysis.product.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-blue-700 hover:underline">Open product source</a>
        </div>
      )}

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
                    <button
                      onClick={loadProductInsights}
                      disabled={isLoadingInsights}
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      <MdForum />
                      {isLoadingInsights ? 'Gathering public reports...' : 'What users are saying'}
                    </button>
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

                  {insightReport && insightReport.productName === selectedProduct.productName && (
                    <div className="mt-5 border-t border-gray-200 pt-4">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <MdForum className="text-indigo-600" />
                        Public discussion signals
                      </h5>
                      <p className="text-sm text-gray-700 mb-2">{insightReport.summary}</p>
                      <p className="text-xs text-gray-500 mb-3">
                        {insightReport.sourceCount} public sources via {insightReport.sourceMethod}. {insightReport.caveat}
                      </p>
                      {insightReport.findings.length > 0 ? (
                        <div className="space-y-2">
                          {insightReport.findings.map((finding) => (
                            <div key={finding.key} className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-gray-900">{finding.issue}</span>
                                <span className="whitespace-nowrap text-xs font-semibold text-indigo-700">
                                  {finding.mentions} mention{finding.mentions === 1 ? '' : 's'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-600">
                                {finding.prevalence}% of retrieved sources • {finding.confidence} confidence
                              </p>
                              <div className="mt-2 space-y-1">
                                {finding.sources.map((source) => (
                                  <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-blue-700 hover:underline">
                                    {source.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No repeated compliance-related issue was detected.</p>
                      )}
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