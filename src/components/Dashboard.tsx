import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Package,
  ScanLine,
  Shield,
  Search,
  Activity,
  Award,
  Target,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserOCRScans,
  getUserComplianceChecks,
  getUserSearches,
} from '../services/firestoreService';

interface UserStats {
  totalOCRScans: number;
  totalComplianceChecks: number;
  totalSearches: number;
  averageComplianceScore: number;
  compliantProducts: number;
  nonCompliantProducts: number;
  recentActivity: Array<{
    type: 'ocr' | 'compliance' | 'search';
    description: string;
    timestamp: Date;
    status?: 'success' | 'warning' | 'error';
  }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalOCRScans: 0,
    totalComplianceChecks: 0,
    totalSearches: 0,
    averageComplianceScore: 0,
    compliantProducts: 0,
    nonCompliantProducts: 0,
    recentActivity: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadDashboardData = async () => {
    if (!user) {
      console.log('❌ Dashboard: No user found!');
      return;
    }

    setIsLoading(true);
    console.log('🔄 Dashboard: Loading data for user:', user.id, user.name);

    try {
      console.log('📡 Dashboard: Fetching Firebase data...');
      
      const [ocrScans, complianceChecks, searches] = await Promise.all([
        getUserOCRScans(user.id),
        getUserComplianceChecks(user.id),
        getUserSearches(user.id),
      ]);

      console.log('📊 Dashboard: Raw data received:', {
        ocrScans,
        complianceChecks,
        searches,
      });

      console.log('📊 Dashboard: Data counts:', {
        ocrScans: ocrScans.length,
        complianceChecks: complianceChecks.length,
        searches: searches.length,
      });

      const totalOCRScans = ocrScans.length;
      const totalComplianceChecks = complianceChecks.length;
      const totalSearches = searches.length;

      console.log('📈 Stats:', { totalOCRScans, totalComplianceChecks, totalSearches });

      const complianceScores = complianceChecks
        .map((c) => c.complianceScore)
        .filter((score) => score !== undefined && score !== null);
    
      const averageComplianceScore =
        complianceScores.length > 0
          ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length)
          : 0;

      console.log('💯 Compliance scores:', complianceScores);
      console.log('📊 Average:', averageComplianceScore);

      const compliantProducts = complianceChecks.filter((c) => c.isCompliant === true).length;
      const nonCompliantProducts = complianceChecks.filter((c) => c.isCompliant === false).length;

      console.log('✅ Compliant:', compliantProducts);
      console.log('❌ Non-compliant:', nonCompliantProducts);

      const recentActivity = [
        ...ocrScans.slice(0, 10).map((scan) => ({
          type: 'ocr' as const,
          description: `OCR scan completed with ${scan.confidence}% confidence`,
          timestamp: scan.timestamp,
          status: (scan.confidence >= 80 ? 'success' : scan.confidence >= 60 ? 'warning' : 'error') as 'success' | 'warning' | 'error',
        })),
        ...complianceChecks.slice(0, 10).map((check) => ({
          type: 'compliance' as const,
          description: `Checked "${check.productName}" - ${check.complianceScore}% compliant`,
          timestamp: check.timestamp,
          status: (check.isCompliant ? 'success' : 'error') as 'success' | 'warning' | 'error',
        })),
        ...searches.slice(0, 10).map((search) => ({
          type: 'search' as const,
          description: `Searched for "${search.query}" - ${search.resultsCount} results`,
          timestamp: search.timestamp,
          status: (search.resultsCount > 0 ? 'success' : 'warning') as 'success' | 'warning' | 'error',
        })),
      ]
        .filter((activity) => activity.timestamp)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      console.log('🕐 Recent activity:', recentActivity);

      setStats({
        totalOCRScans,
        totalComplianceChecks,
        totalSearches,
        averageComplianceScore,
        compliantProducts,
        nonCompliantProducts,
        recentActivity,
      });

      setLastRefresh(new Date());
      console.log('✅ Dashboard: Stats updated successfully!');

    } catch (error) {
      console.error('❌ Dashboard: Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ocr':
        return <ScanLine className="h-4 w-4 text-purple-600" />;
      case 'compliance':
        return <Shield className="h-4 w-4 text-green-600" />;
      case 'search':
        return <Search className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ocr':
        return 'bg-purple-50 border-purple-200';
      case 'compliance':
        return 'bg-green-50 border-green-200';
      case 'search':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header with Refresh Button */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.name}! 👋</h1>
            <p className="text-blue-100 mt-2">
              Here's your compliance activity overview
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-xs text-blue-100">Last refreshed</p>
              <p className="text-sm font-medium text-white">
                {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadDashboardData}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="h-5 w-5" />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* OCR Scans */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">OCR Scans</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalOCRScans}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total scans performed</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <ScanLine className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Compliance Checks */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Compliance Checks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalComplianceChecks}
              </p>
              <p className="text-xs text-gray-500 mt-1">Products analyzed</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Product Searches */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Product Searches</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalSearches}
              </p>
              <p className="text-xs text-gray-500 mt-1">Search queries made</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Search className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Average Compliance Score - FIXED */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Compliance</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.averageComplianceScore}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Your average score</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Status Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Compliance Overview
          </h3>
          <div className="space-y-4">
            {/* Compliant Products Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  Compliant Products
                </span>
                <span className="text-sm font-bold text-green-600">
                  {stats.compliantProducts}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats.totalComplianceChecks > 0
                        ? (stats.compliantProducts / stats.totalComplianceChecks) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Non-Compliant Products Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  Non-Compliant Products
                </span>
                <span className="text-sm font-bold text-red-600">
                  {stats.nonCompliantProducts}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats.totalComplianceChecks > 0
                        ? (stats.nonCompliantProducts / stats.totalComplianceChecks) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Compliance Rate
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Based on {stats.totalComplianceChecks} product checks
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.totalComplianceChecks > 0
                      ? Math.round(
                          (stats.compliantProducts / stats.totalComplianceChecks) * 100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2 text-blue-600" />
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => (window.location.hash = 'ocr-scanner')}
              className="w-full text-left p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <ScanLine className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Scan Product</p>
                  <p className="text-xs text-gray-600">Extract text with OCR</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => (window.location.hash = 'compliance-checker')}
              className="w-full text-left p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Check Compliance</p>
                  <p className="text-xs text-gray-600">Validate product listing</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => (window.location.hash = 'product-listings')}
              className="w-full text-left p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Search Products</p>
                  <p className="text-xs text-gray-600">Find and analyze listings</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              Recent Activity
            </h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((activity, index) => (
              <div
                key={index}
                className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getActivityColor(
                  activity.type
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">{getActivityIcon(activity.type)}</div>
                    <div>
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                  {activity.status && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : activity.status === 'warning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {activity.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm mt-1">
                Start by scanning products or checking compliance
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Achievement Badge */}
      {stats.averageComplianceScore >= 80 && stats.totalComplianceChecks >= 10 && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center space-x-4">
            <Award className="h-12 w-12" />
            <div>
              <h3 className="text-xl font-bold">Compliance Champion! 🏆</h3>
              <p className="text-yellow-100 text-sm">
                You've maintained an average compliance score of {stats.averageComplianceScore}%
                across {stats.totalComplianceChecks} product checks. Keep up the great work!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;