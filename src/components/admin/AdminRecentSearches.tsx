import React, { useState, useEffect } from 'react';
import { Search, Clock, User } from 'lucide-react';
import { getRecentSearches, getSearchesByUser } from '../../services/firestoreService';

interface SearchRecord {
  id: string;
  userId: string;
  userName: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

const AdminRecentSearches: React.FC = () => {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [nameFilter, setNameFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSearches();
  }, []);

  const fetchSearches = async () => {
    setLoading(true);
    try {
      const searchList = await getRecentSearches(100);
      setSearches(searchList as SearchRecord[]);
    } catch (error) {
      console.error('Failed to fetch searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByName = async () => {
    if (!nameFilter.trim()) {
      fetchSearches();
      return;
    }

    setLoading(true);
    try {
      const filtered = await getSearchesByUser(nameFilter);
      setSearches(filtered as SearchRecord[]);
    } catch (error) {
      console.error('Failed to filter searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Recent Searches</h2>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by user name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleFilterByName()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleFilterByName}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Filter
          </button>
          <button
            onClick={fetchSearches}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Search List */}
      {loading ? (
        <div className="text-center py-8">Loading searches...</div>
      ) : (
        <div className="space-y-4">
          {searches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No searches found</div>
          ) : (
            searches.map((search) => (
              <div key={search.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Search className="h-5 w-5 text-indigo-600" />
                      <p className="font-medium text-gray-900">{search.query}</p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{search.userName}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimestamp(search.timestamp)}</span>
                      </span>
                      <span>{search.resultCount} results</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminRecentSearches;