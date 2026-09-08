import React, { useState } from 'react';
import { Search, Filter, ExternalLink, AlertTriangle, CheckCircle, Eye, Loader, Package, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logSearch } from '../services/firestoreService';

interface Product {
  id: string;
  name: string;
  platform: string;
  seller: string;
  price: string;
  category: string;
  complianceScore: number;
  status: 'compliant' | 'warning' | 'violation';
  lastChecked: string;
  violations: string[];
  image: string;
  url?: string;
  rating?: number;
  ratingCount?: number;
}

const ProductListings: React.FC = () => {
  const { user } = useAuth(); // 🔥 Get current user
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [products, setProducts] = useState<Product[]>([
    // Sample/default products
    {
      id: '2',
      name: 'Premium Basmati Rice 1kg',
      platform: 'Flipkart',
      seller: 'Rice Valley',
      price: '₹450',
      category: 'Food & Beverages',
      complianceScore: 92,
      status: 'compliant',
      lastChecked: '2024-12-28',
      violations: [],
      image: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg?auto=compress&cs=tinysrgb&w=100&h=100',
      rating: 4.5,
      ratingCount: 234
    },
    {
      id: '4',
      name: 'Organic Green Tea 100g',
      platform: 'Amazon',
      seller: 'TeaGarden Direct',
      price: '₹320',
      category: 'Food & Beverages',
      complianceScore: 96,
      status: 'compliant',
      lastChecked: '2024-12-28',
      violations: [],
      image: 'https://images.pexels.com/photos/1638280/pexels-photo-1638280.jpeg?auto=compress&cs=tinysrgb&w=100&h=100',
      rating: 4.8,
      ratingCount: 456
    },
    {
      id: '5',
      name: 'Coconut Oil - Cold Pressed 500ml',
      platform: 'BigBasket',
      seller: 'CocoFresh',
      price: '₹275',
      category: 'Health & Wellness',
      complianceScore: 38,
      status: 'violation',
      lastChecked: '2024-12-28',
      violations: ['Missing net quantity', 'No MRP declaration', 'Missing import date'],
      image: 'https://images.pexels.com/photos/4110250/pexels-photo-4110250.jpeg?auto=compress&cs=tinysrgb&w=100&h=100',
      rating: 3.2,
      ratingCount: 89
    },
    {
      id: '6',
      name: 'Whole Wheat Flour 5kg',
      platform: 'Flipkart',
      seller: 'Grain Mills Ltd',
      price: '₹395',
      category: 'Food & Beverages',
      complianceScore: 85,
      status: 'compliant',
      lastChecked: '2024-12-27',
      violations: [],
      image: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=100&h=100',
      rating: 4.3,
      ratingCount: 178
    }
  ]);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

  // 🔥 Search products via backend API
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Call your product search API
      const response = await fetch(`${API_BASE}/api/products/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.success && data.products) {
        // Transform API response to Product format
        const transformedProducts: Product[] = data.products.map((p: any, idx: number) => ({
          id: p.id || `product-${idx}`,
          name: p.name || p.productName || 'Unknown Product',
          platform: p.platform || 'Amazon',
          seller: p.seller || p.brand || 'Unknown Seller',
          price: p.price ? `₹${p.price}` : 'N/A',
          category: p.category || 'General',
          complianceScore: calculateComplianceScore(p),
          status: getComplianceStatus(calculateComplianceScore(p)),
          lastChecked: new Date().toISOString().split('T')[0],
          violations: extractViolations(p),
          image: p.image || 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=100&h=100',
          url: p.url,
          rating: p.rating || 0,
          ratingCount: p.ratingCount || 0
        }));

        setProducts(transformedProducts);

        // 🔥 LOG TO FIREBASE
        if (user) {
          await logSearch(
            user.id,
            user.name,
            searchTerm,
            transformedProducts.length
          );
          console.log('✅ Product search logged to Firebase');
        }
      } else {
        setProducts([]);
        
        // Log empty search too
        if (user) {
          await logSearch(user.id, user.name, searchTerm, 0);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setProducts([]);
      
      // Log failed search
      if (user) {
        await logSearch(user.id, user.name, searchTerm, 0);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate compliance score from product data
  const calculateComplianceScore = (product: any): number => {
    let score = 100;
    if (!product.name && !product.productName) score -= 20;
    if (!product.price) score -= 20;
    if (!product.brand && !product.seller) score -= 15;
    if (!product.image) score -= 15;
    if (!product.rating) score -= 10;
    return Math.max(score, 0);
  };

  // Get compliance status based on score
  const getComplianceStatus = (score: number): 'compliant' | 'warning' | 'violation' => {
    if (score >= 80) return 'compliant';
    if (score >= 60) return 'warning';
    return 'violation';
  };

  // Extract violations from product data
  const extractViolations = (product: any): string[] => {
    const violations: string[] = [];
    if (!product.name && !product.productName) violations.push('Missing product name');
    if (!product.price) violations.push('Missing MRP declaration');
    if (!product.brand && !product.seller) violations.push('Missing manufacturer/brand info');
    if (!product.image) violations.push('Missing product image');
    return violations;
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.seller.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.platform.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || product.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'violation':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'violation':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Product Listings</h2>
          <p className="text-gray-600 mt-1">Monitor and analyze compliance across e-commerce platforms</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            <span>Advanced Filters</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Eye className="h-4 w-4" />
            <span>Bulk Scan</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products across platforms (e.g., rice 1kg, cooking oil)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchTerm.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            {isSearching ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                <span>Search</span>
              </>
            )}
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="compliant">Compliant</option>
            <option value="warning">Warning</option>
            <option value="violation">Violations</option>
          </select>
        </div>
        {user && hasSearched && (
          <p className="text-xs text-green-600 mt-2">
            ✓ Search logged to your account
          </p>
        )}
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="bg-white rounded-xl shadow-md p-12 border border-gray-100">
          <div className="text-center">
            <Loader className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Searching products across platforms...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}

      {/* Product Grid */}
      {!isSearching && filteredProducts.length > 0 && (
        <>
          <div className="mb-4 text-gray-600">
            Found <strong>{filteredProducts.length}</strong> products
            {searchTerm && ` for "${searchTerm}"`}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=100&h=100';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                      <p className="text-sm text-gray-600">{product.seller}</p>
                      <p className="text-sm text-gray-500">{product.platform} • {product.category}</p>
                      {product.rating > 0 && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-gray-600">
                            {product.rating} ({product.ratingCount})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(product.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                        {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{product.price}</p>
                      <p className="text-xs text-gray-500">Score: {product.complianceScore}%</p>
                    </div>
                  </div>

                  {product.violations.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-medium text-red-800 mb-1">Violations:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {product.violations.map((violation, idx) => (
                          <li key={idx}>• {violation}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 flex space-x-2">
                    {product.url ? (
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>View Product</span>
                      </a>
                    ) : (
                      <button className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                        View Details
                      </button>
                    )}
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                      Re-scan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isSearching && hasSearched && filteredProducts.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 border border-gray-100 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No products found</p>
          {searchTerm && (
            <p className="text-sm text-gray-500 mt-2">
              Try different keywords or check your spelling
            </p>
          )}
        </div>
      )}

      {/* Initial State */}
      {!isSearching && !hasSearched && (
        <div className="bg-white rounded-xl shadow-md p-12 border border-gray-100 text-center">
          <Search className="h-16 w-16 mx-auto text-blue-400 mb-4" />
          <p className="text-gray-600 text-lg">Enter a product name to start searching</p>
          <p className="text-sm text-gray-500 mt-2">
            We'll search across multiple e-commerce platforms and analyze compliance
          </p>
        </div>
      )}

      {/* Summary Stats */}
      {filteredProducts.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{filteredProducts.length}</p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {filteredProducts.filter(p => p.status === 'compliant').length}
              </p>
              <p className="text-sm text-gray-600">Compliant</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {filteredProducts.filter(p => p.status === 'warning').length}
              </p>
              <p className="text-sm text-gray-600">Warnings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {filteredProducts.filter(p => p.status === 'violation').length}
              </p>
              <p className="text-sm text-gray-600">Violations</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductListings;