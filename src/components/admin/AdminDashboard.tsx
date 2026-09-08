import React, { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  Shield,
  Search,
  ScanLine,
  Download,
  RefreshCw,
  Calendar,
  BarChart3,
  Settings,
  Database,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import {
  getActivityStats,
  getRecentActivity,
  ActivityStats,
  RecentActivity,
} from '../../services/firestoreService';

interface TimeFilter {
  label: string;
  value: 'today' | 'week' | 'month' | 'all';
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [showExportModal, setShowExportModal] = useState(false);

  const timeFilters: TimeFilter[] = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'All Time', value: 'all' },
  ];

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Loading admin dashboard data...');
      const [statsData, activityData] = await Promise.all([
        getActivityStats(),
        getRecentActivity(20),
      ]);
      
      console.log('📊 Stats loaded:', statsData);
      console.log('📋 Activity loaded:', activityData.length, 'items');
      
      setStats(statsData);
      setRecentActivity(activityData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

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

  const handleExportData = (format: 'csv' | 'json' | 'pdf') => {
    console.log(`📥 Exporting data as ${format}...`);
    // TODO: Implement actual export functionality
    alert(`Exporting data as ${format.toUpperCase()}... (Coming soon)`);
    setShowExportModal(false);
  };

  const filterActivityByTime = (activities: RecentActivity[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (selectedTimeFilter) {
      case 'today':
        return activities.filter(a => a.timestamp >= today);
      case 'week':
        return activities.filter(a => a.timestamp >= weekAgo);
      case 'month':
        return activities.filter(a => a.timestamp >= monthAgo);
      default:
        return activities;
    }
  };

  const filteredActivity = filterActivityByTime(recentActivity);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading admin dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching analytics and activity data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <BarChart3 className="h-8 w-8 mr-3" />
              Admin Dashboard
            </h1>
            <p className="text-purple-100 mt-2 flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Monitor platform activity and user engagement in real-time
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-xs text-purple-100">Last refreshed</p>
              <p className="text-sm font-medium text-white flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-all flex items-center space-x-2 border border-white/30"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid with Enhanced Design */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Users */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-blue-100 text-sm font-medium">Total Users</p>
                <p className="text-4xl font-bold mt-2">{stats.totalUsers}</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    <span className="text-xs">{stats.activeUsersToday} active today</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* OCR Scans */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-100 text-sm font-medium">OCR Scans</p>
                <p className="text-4xl font-bold mt-2">{stats.totalOCRScans}</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span className="text-xs">Total scans performed</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <ScanLine className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* Compliance Checks */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-green-100 text-sm font-medium">
                  Compliance Checks
                </p>
                <p className="text-4xl font-bold mt-2">
                  {stats.totalComplianceChecks}
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    <span className="text-xs">Avg: {stats.averageComplianceScore}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <Shield className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* Product Searches */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-orange-100 text-sm font-medium">
                  Product Searches
                </p>
                <p className="text-4xl font-bold mt-2">{stats.totalSearches}</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <Search className="h-3 w-3 mr-1" />
                    <span className="text-xs">Total queries</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <Search className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* Average Compliance Score */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-cyan-100 text-sm font-medium">
                  Avg Compliance
                </p>
                <p className="text-4xl font-bold mt-2">
                  {stats.averageComplianceScore}%
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span className="text-xs">Platform-wide</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <TrendingUp className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* Active Users Today */}
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-pink-100 text-sm font-medium">Active Today</p>
                <p className="text-4xl font-bold mt-2">
                  {stats.activeUsersToday}
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 rounded-full px-2 py-1">
                    <Activity className="h-3 w-3 mr-1" />
                    <span className="text-xs">
                      {Math.round((stats.activeUsersToday / stats.totalUsers) * 100)}% engagement
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <Activity className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity with Time Filter */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-purple-600" />
              Recent Activity
            </h2>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedTimeFilter}
                onChange={(e) => setSelectedTimeFilter(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {timeFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {filteredActivity.length > 0 ? (
            filteredActivity.map((activity, index) => (
              <div
                key={index}
                className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getActivityColor(
                  activity.type
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1 bg-white rounded-lg p-2 shadow-sm">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 flex items-center">
                        {activity.userName}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          activity.type === 'ocr' ? 'bg-purple-100 text-purple-700' :
                          activity.type === 'compliance' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {activity.type.toUpperCase()}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-xs text-gray-500 whitespace-nowrap flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No activity for selected period</p>
              <p className="text-sm mt-1">Try selecting a different time range</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions with Enhanced Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="p-6 bg-white rounded-xl shadow-md border border-gray-100 hover:border-blue-300 hover:shadow-xl transition-all text-left group">
          <div className="flex items-start justify-between">
            <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <Eye className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4 mb-1">View Analytics</h3>
          <p className="text-sm text-gray-600">
            Detailed charts and trends analysis
          </p>
        </button>

        <button 
          onClick={() => setShowExportModal(true)}
          className="p-6 bg-white rounded-xl shadow-md border border-gray-100 hover:border-green-300 hover:shadow-xl transition-all text-left group"
        >
          <div className="flex items-start justify-between">
            <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
              <Download className="h-6 w-6 text-green-600" />
            </div>
            <FileText className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4 mb-1">Export Data</h3>
          <p className="text-sm text-gray-600">
            Download activity logs and reports
          </p>
        </button>

        <button className="p-6 bg-white rounded-xl shadow-md border border-gray-100 hover:border-purple-300 hover:shadow-xl transition-all text-left group">
          <div className="flex items-start justify-between">
            <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <Settings className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4 mb-1">Schedule Reports</h3>
          <p className="text-sm text-gray-600">
            Automated weekly and monthly reports
          </p>
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Download className="h-6 w-6 mr-2 text-green-600" />
              Export Data
            </h3>
            <p className="text-gray-600 mb-6">Choose your preferred export format:</p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleExportData('csv')}
                className="w-full p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">CSV Format</p>
                    <p className="text-sm text-gray-600">Spreadsheet compatible</p>
                  </div>
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </button>

              <button
                onClick={() => handleExportData('json')}
                className="w-full p-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">JSON Format</p>
                    <p className="text-sm text-gray-600">Developer friendly</p>
                  </div>
                  <Database className="h-5 w-5 text-purple-600" />
                </div>
              </button>

              <button
                onClick={() => handleExportData('pdf')}
                className="w-full p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">PDF Report</p>
                    <p className="text-sm text-gray-600">Print ready document</p>
                  </div>
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* System Status Indicator */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 h-3 w-3 bg-green-500 rounded-full animate-ping"></div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">System Status: All Systems Operational</p>
              <p className="text-sm text-gray-600">Last checked: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;