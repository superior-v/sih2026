import React, { useState } from 'react';
import { Download, Calendar, Filter, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const Reports = () => {
  const [dateRange, setDateRange] = useState('30days');
  const [reportType, setReportType] = useState('violations');

  const violationTrends = [
    { date: '2024-12-01', violations: 145, resolved: 89 },
    { date: '2024-12-08', violations: 167, resolved: 102 },
    { date: '2024-12-15', violations: 134, resolved: 98 },
    { date: '2024-12-22', violations: 142, resolved: 87 },
    { date: '2024-12-29', violations: 128, resolved: 95 },
  ];

  const categoryData = [
    { category: 'Food & Beverages', violations: 89, compliant: 234 },
    { category: 'Personal Care', violations: 67, compliant: 187 },
    { category: 'Health Products', violations: 45, compliant: 156 },
    { category: 'Baby Care', violations: 34, compliant: 123 },
    { category: 'Home & Kitchen', violations: 23, compliant: 98 },
  ];

  const platformMetrics = [
    { platform: 'Amazon', totalProducts: 1247892, violations: 892, complianceRate: 99.3 },
    { platform: 'Flipkart', totalProducts: 987643, violations: 654, complianceRate: 99.3 },
    { platform: 'Myntra', totalProducts: 456789, violations: 287, complianceRate: 99.4 },
    { platform: 'Nykaa', totalProducts: 234567, violations: 145, complianceRate: 99.4 },
    { platform: 'BigBasket', totalProducts: 123456, violations: 89, complianceRate: 99.3 },
  ];

  const reportSummary = {
    totalScanned: 3650347,
    totalViolations: 2067,
    overallCompliance: 99.3,
    topViolationType: 'Missing MRP Declaration',
    mostProblematicPlatform: 'Amazon',
    improvementTrend: '+2.1%'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Compliance Reports</h2>
          <p className="text-gray-600 mt-1">Comprehensive analytics and violation tracking</p>
        </div>
        <div className="flex space-x-3">
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="1year">Last Year</option>
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Scanned</p>
              <p className="text-xl font-bold text-gray-900">{reportSummary.totalScanned.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Violations</p>
              <p className="text-xl font-bold text-red-600">{reportSummary.totalViolations.toLocaleString()}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Compliance Rate</p>
              <p className="text-xl font-bold text-green-600">{reportSummary.overallCompliance}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-600">Top Violation</p>
          <p className="text-sm font-bold text-gray-900">{reportSummary.topViolationType}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-600">Problem Platform</p>
          <p className="text-sm font-bold text-gray-900">{reportSummary.mostProblematicPlatform}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-600">Monthly Trend</p>
          <p className="text-sm font-bold text-green-600">{reportSummary.improvementTrend}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violation Trends */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Violation Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={violationTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="violations" stroke="#EF4444" strokeWidth={3} />
              <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Analysis */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Violations by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="violations" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="compliant" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform Performance Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Platform Performance Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Products
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Violations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compliance Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {platformMetrics.map((platform, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{platform.platform}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {platform.totalProducts.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {platform.violations}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-green-600">{platform.complianceRate}%</div>
                      {platform.complianceRate > 99 && <TrendingUp className="ml-1 h-4 w-4 text-green-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all">
            <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-gray-900">Monthly Report</p>
            <p className="text-sm text-gray-600">Comprehensive monthly analysis</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all">
            <AlertCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-900">Violation Summary</p>
            <p className="text-sm text-gray-600">Detailed violation breakdown</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all">
            <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-gray-900">Trend Analysis</p>
            <p className="text-sm text-gray-600">Historical compliance trends</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;