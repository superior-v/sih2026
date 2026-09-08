import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface CrawlResult {
  id: string;
  timestamp: string;
  productName: string;
  platform: string;
  url: string;
  complianceScore: number;
  status: 'compliant' | 'non-compliant' | 'processing';
  violations: string[];
  evidence: {
    field: string;
    found: boolean;
    value?: string;
    rule: string;
    confidence: number;
  }[];
}

interface EnhancedDashboardProps {
  isLiveMode: boolean;
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({ isLiveMode }) => {
  const [crawlResults, setCrawlResults] = useState<CrawlResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CrawlResult | null>(null);
  const [filters, setFilters] = useState({
    platform: 'all',
    compliance: 'all',
    dateRange: '24h'
  });
  const [stats, setStats] = useState({
    totalScanned: 0,
    compliantCount: 0,
    violationCount: 0,
    averageScore: 0
  });

  // Excel export function
  const exportToExcel = () => {
    const exportData = filteredResults.map((result, index) => {
      const evidenceData = result.evidence.reduce((acc, evidence) => {
        acc[`${evidence.field}_Found`] = evidence.found ? 'Yes' : 'No';
        acc[`${evidence.field}_Value`] = evidence.value || 'N/A';
        acc[`${evidence.field}_Confidence`] = `${Math.round(evidence.confidence * 100)}%`;
        return acc;
      }, {} as any);

      return {
        'Sr. No': index + 1,
        'Product Name': result.productName,
        'Platform': result.platform,
        'URL': result.url,
        'Compliance Score': `${result.complianceScore}%`,
        'Status': result.status,
        'Violations Count': result.violations.length,
        'Violations': result.violations.join('; '),
        'Scan Date': new Date(result.timestamp).toLocaleDateString(),
        'Scan Time': new Date(result.timestamp).toLocaleTimeString(),
        ...evidenceData
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Compliance Report');
    
    const fileName = `Compliance_Report_${isLiveMode ? 'Live' : 'Test'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Mock data for demonstration
  useEffect(() => {
    const mockResults: CrawlResult[] = [
      {
        id: '001',
        timestamp: '2024-09-16T10:30:00Z',
        productName: 'Premium Basmati Rice 5kg',
        platform: 'Amazon',
        url: 'https://amazon.in/premium-basmati-rice',
        complianceScore: 95,
        status: 'compliant',
        violations: [],
        evidence: [
          { field: 'Product Name', found: true, value: 'Premium Basmati Rice', rule: 'Rule 6(1)', confidence: 0.98 },
          { field: 'Net Quantity', found: true, value: '5 kg', rule: 'Rule 6(2)', confidence: 0.95 },
          { field: 'MRP', found: true, value: '₹450.00', rule: 'Rule 6(3)', confidence: 0.92 },
          { field: 'Manufacturer', found: true, value: 'ABC Foods Pvt. Ltd.', rule: 'Rule 6(4)', confidence: 0.89 }
        ]
      },
      {
        id: '002',
        timestamp: '2024-09-16T10:25:00Z',
        productName: 'Organic Honey 500g',
        platform: 'Flipkart',
        url: 'https://flipkart.com/organic-honey',
        complianceScore: 45,
        status: 'non-compliant',
        violations: ['Missing MRP declaration', 'Incomplete manufacturer details', 'No packing date'],
        evidence: [
          { field: 'Product Name', found: true, value: 'Organic Honey', rule: 'Rule 6(1)', confidence: 0.96 },
          { field: 'Net Quantity', found: true, value: '500g', rule: 'Rule 6(2)', confidence: 0.89 },
          { field: 'MRP', found: false, rule: 'Rule 6(3)', confidence: 0.0 },
          { field: 'Manufacturer', found: false, rule: 'Rule 6(4)', confidence: 0.0 }
        ]
      },
      {
        id: '003',
        timestamp: '2024-09-16T10:20:00Z',
        productName: 'Herbal Face Cream 50g',
        platform: 'Nykaa',
        url: 'https://nykaa.com/herbal-face-cream',
        complianceScore: 88,
        status: 'compliant',
        violations: ['Minor formatting issue in date'],
        evidence: [
          { field: 'Product Name', found: true, value: 'Herbal Face Cream', rule: 'Rule 6(1)', confidence: 0.94 },
          { field: 'Net Quantity', found: true, value: '50g', rule: 'Rule 6(2)', confidence: 0.91 },
          { field: 'MRP', found: true, value: '₹225.00', rule: 'Rule 6(3)', confidence: 0.87 },
          { field: 'Manufacturer', found: true, value: 'XYZ Cosmetics Ltd.', rule: 'Rule 6(4)', confidence: 0.83 }
        ]
      },
      {
        id: '004',
        timestamp: '2024-09-16T10:15:00Z',
        productName: 'Green Tea Bags 25ct',
        platform: 'BigBasket',
        url: 'https://bigbasket.com/green-tea-bags',
        complianceScore: 35,
        status: 'non-compliant',
        violations: ['Unclear quantity format', 'Missing manufacturer address', 'No licensing info'],
        evidence: [
          { field: 'Product Name', found: true, value: 'Green Tea Bags', rule: 'Rule 6(1)', confidence: 0.93 },
          { field: 'Net Quantity', found: false, rule: 'Rule 6(2)', confidence: 0.0 },
          { field: 'MRP', found: true, value: '₹120', rule: 'Rule 6(3)', confidence: 0.85 },
          { field: 'Manufacturer', found: false, rule: 'Rule 6(4)', confidence: 0.0 }
        ]
      },
      {
        id: '005',
        timestamp: '2024-09-16T10:10:00Z',
        productName: 'Masala Powder 100g',
        platform: 'Amazon',
        url: 'https://amazon.in/masala-powder',
        complianceScore: 25,
        status: 'non-compliant',
        violations: ['Non-standard units', 'Missing MRP format', 'Language inconsistency', 'No license info'],
        evidence: [
          { field: 'Product Name', found: true, value: 'मसाला पाउडर', rule: 'Rule 6(1)', confidence: 0.78 },
          { field: 'Net Quantity', found: false, rule: 'Rule 6(2)', confidence: 0.0 },
          { field: 'MRP', found: false, rule: 'Rule 6(3)', confidence: 0.0 },
          { field: 'Manufacturer', found: false, rule: 'Rule 6(4)', confidence: 0.0 }
        ]
      },
      {
        id: '006',
        timestamp: '2024-09-16T10:05:00Z',
        productName: 'Liquid Dishwash 1L',
        platform: 'Flipkart',
        url: 'https://flipkart.com/liquid-dishwash',
        complianceScore: 98,
        status: 'compliant',
        violations: [],
        evidence: [
          { field: 'Product Name', found: true, value: 'Liquid Dishwash', rule: 'Rule 6(1)', confidence: 0.97 },
          { field: 'Net Quantity', found: true, value: '1 Litre', rule: 'Rule 6(2)', confidence: 0.99 },
          { field: 'MRP', found: true, value: '₹180.00', rule: 'Rule 6(3)', confidence: 0.94 },
          { field: 'Manufacturer', found: true, value: 'Clean Home Industries', rule: 'Rule 6(4)', confidence: 0.91 }
        ]
      }
    ];

    setCrawlResults(mockResults);
    
    // Calculate stats
    const totalScanned = mockResults.length;
    const compliantCount = mockResults.filter(r => r.status === 'compliant').length;
    const violationCount = mockResults.filter(r => r.status === 'non-compliant').length;
    const averageScore = mockResults.reduce((sum, r) => sum + r.complianceScore, 0) / totalScanned;

    setStats({
      totalScanned,
      compliantCount,
      violationCount,
      averageScore: Math.round(averageScore)
    });
  }, []);

  const filteredResults = crawlResults.filter(result => {
    if (filters.platform !== 'all' && result.platform !== filters.platform) return false;
    if (filters.compliance !== 'all' && result.status !== filters.compliance) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-100';
      case 'non-compliant': return 'text-red-600 bg-red-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
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
              {isLiveMode ? '🔴 Live Crawl Dashboard' : '🧪 Test Crawl Dashboard'}
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time monitoring of e-commerce platform compliance scanning
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isLiveMode ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isLiveMode ? 'LIVE' : 'TEST'}
            </div>
            <button 
              onClick={exportToExcel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📊 Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl">📊</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Scanned</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalScanned}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-xl">✅</span>
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
              <span className="text-xl">❌</span>
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
              <span className="text-xl">📈</span>
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">🔍 Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={filters.platform}
              onChange={(e) => setFilters({...filters, platform: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Platforms</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Nykaa">Nykaa</option>
              <option value="BigBasket">BigBasket</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Status</label>
            <select
              value={filters.compliance}
              onChange={(e) => setFilters({...filters, compliance: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-Compliant</option>
              <option value="processing">Processing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Results List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">📋 Crawl Results ({filteredResults.length})</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredResults.map((result) => (
              <div
                key={result.id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                  selectedResult?.id === result.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => setSelectedResult(result)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate">{result.productName}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(result.status)}`}>
                    {result.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>🏪 {result.platform}</span>
                  <span className={`font-semibold ${getScoreColor(result.complianceScore)}`}>
                    {result.complianceScore}%
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  🕒 {new Date(result.timestamp).toLocaleString()}
                </div>
                {result.violations.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-red-600">
                      ⚠️ {result.violations.length} violation(s)
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">🔍 Evidence Details</h3>
          </div>
          <div className="p-4">
            {selectedResult ? (
              <div>
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">{selectedResult.productName}</h4>
                  <p className="text-sm text-gray-600 mb-1">🏪 Platform: {selectedResult.platform}</p>
                  <p className="text-sm text-gray-600 mb-1">
                    🔗 URL: <a href={selectedResult.url} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:underline truncate">{selectedResult.url}</a>
                  </p>
                  <p className="text-sm text-gray-600">
                    🕒 Scanned: {new Date(selectedResult.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">📊 Compliance Score</h5>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          selectedResult.complianceScore >= 80 ? 'bg-green-500' :
                          selectedResult.complianceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${selectedResult.complianceScore}%` }}
                      />
                    </div>
                    <span className={`ml-3 font-semibold ${getScoreColor(selectedResult.complianceScore)}`}>
                      {selectedResult.complianceScore}%
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">📋 Field Analysis</h5>
                  <div className="space-y-2">
                    {selectedResult.evidence.map((evidence, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{evidence.field}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            evidence.found ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {evidence.found ? '✅ Found' : '❌ Missing'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>📜 Rule: {evidence.rule}</p>
                          {evidence.value && <p>💡 Value: "{evidence.value}"</p>}
                          <p>🎯 Confidence: {Math.round(evidence.confidence * 100)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedResult.violations.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">⚠️ Violations</h5>
                    <div className="space-y-1">
                      {selectedResult.violations.map((violation, index) => (
                        <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          • {violation}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <span className="text-4xl">📋</span>
                <p className="mt-2">Select a result to view evidence details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Updates Indicator */}
      {isLiveMode && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
          🔴 Live Updates Active
        </div>
      )}
    </div>
  );
};

export default EnhancedDashboard;