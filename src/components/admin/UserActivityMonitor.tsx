import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Activity,
  ScanLine,
  Shield,
  Search as SearchIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getAllUsers,
  getUserOCRScans,
  getUserComplianceChecks,
  getUserSearches,
  User,
  OCRScanLog,
  ComplianceCheckLog,
  SearchLog,
} from '../../services/firestoreService';

interface UserWithActivity extends User {
  recentOCRScans?: OCRScanLog[];
  recentComplianceChecks?: ComplianceCheckLog[];
  recentSearches?: SearchLog[];
}

const UserActivityMonitor: React.FC = () => {
  const [users, setUsers] = useState<UserWithActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserActivity = async (userId: string) => {
    try {
      const [ocrScans, complianceChecks, searches] = await Promise.all([
        getUserOCRScans(userId),
        getUserComplianceChecks(userId),
        getUserSearches(userId),
      ]);

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                recentOCRScans: ocrScans.slice(0, 5),
                recentComplianceChecks: complianceChecks.slice(0, 5),
                recentSearches: searches.slice(0, 5),
              }
            : user
        )
      );
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  };

  const toggleUserExpansion = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      const user = users.find((u) => u.id === userId);
      if (user && !user.recentOCRScans) {
        loadUserActivity(userId);
      }
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Activity Monitor</h1>
          <p className="text-gray-600 mt-1">Track individual user actions and engagement</p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div key={user.id}>
                {/* User Header */}
                <div
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleUserExpansion(user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <UserIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.name}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Joined {formatDate(user.createdAt)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      {/* Stats */}
                      <div className="flex space-x-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            {user.stats?.ocrScans || 0}
                          </p>
                          <p className="text-xs text-gray-500">OCR</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {user.stats?.complianceChecks || 0}
                          </p>
                          <p className="text-xs text-gray-500">Checks</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            {user.stats?.searches || 0}
                          </p>
                          <p className="text-xs text-gray-500">Searches</p>
                        </div>
                      </div>

                      {/* Expand Icon */}
                      {expandedUser === user.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Activity Details */}
                {expandedUser === user.id && (
                  <div className="px-6 pb-6 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {/* Recent OCR Scans */}
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <ScanLine className="h-4 w-4 text-purple-600" />
                          <h4 className="font-semibold text-gray-900">Recent OCR Scans</h4>
                        </div>
                        {user.recentOCRScans && user.recentOCRScans.length > 0 ? (
                          <div className="space-y-2">
                            {user.recentOCRScans.map((scan, idx) => (
                              <div key={idx} className="text-xs text-gray-600 border-l-2 border-purple-300 pl-2">
                                <p className="font-medium">{scan.provider} - {scan.confidence}%</p>
                                <p className="text-gray-500">{formatDate(scan.timestamp)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No recent scans</p>
                        )}
                      </div>

                      {/* Recent Compliance Checks */}
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <Shield className="h-4 w-4 text-green-600" />
                          <h4 className="font-semibold text-gray-900">Recent Compliance Checks</h4>
                        </div>
                        {user.recentComplianceChecks && user.recentComplianceChecks.length > 0 ? (
                          <div className="space-y-2">
                            {user.recentComplianceChecks.map((check, idx) => (
                              <div key={idx} className="text-xs text-gray-600 border-l-2 border-green-300 pl-2">
                                <p className="font-medium truncate">{check.productName}</p>
                                <p className="text-gray-500">
                                  {check.complianceScore}% - {formatDate(check.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No recent checks</p>
                        )}
                      </div>

                      {/* Recent Searches */}
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <SearchIcon className="h-4 w-4 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">Recent Searches</h4>
                        </div>
                        {user.recentSearches && user.recentSearches.length > 0 ? (
                          <div className="space-y-2">
                            {user.recentSearches.map((search, idx) => (
                              <div key={idx} className="text-xs text-gray-600 border-l-2 border-blue-300 pl-2">
                                <p className="font-medium truncate">"{search.query}"</p>
                                <p className="text-gray-500">
                                  {search.resultsCount} results - {formatDate(search.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No recent searches</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-500">
              <UserIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">{users.length}</p>
            <p className="text-sm text-gray-600">Total Users</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-purple-600">
              {users.reduce((sum, u) => sum + (u.stats?.ocrScans || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Total OCR Scans</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">
              {users.reduce((sum, u) => sum + (u.stats?.complianceChecks || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Total Checks</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange-600">
              {users.reduce((sum, u) => sum + (u.stats?.searches || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Total Searches</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserActivityMonitor;