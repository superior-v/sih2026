import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './components/auth/Login';
import { Signup } from './components/auth/Signup';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Admin Components
import AdminDashboard from './components/admin/AdminDashboard';
import UserActivityMonitor from './components/admin/UserActivityMonitor';

// User Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ComplianceChecker from './components/ComplianceChecker';
import ProductListings from './components/ProductListings';
import OCRScanner from './components/OCRScanner';
import Reports from './components/Reports';
import LiveCrawlMonitor from './components/LiveCrawlMonitor';
import ESP32Scanner from './components/ESP32Scanner';
import BarcodeScanner from './components/BarcodeScanner';
import EnhancedDashboard from './components/EnhancedDashboard';

// Chatbot Component
import Chatbot from './components/chatbot/Chatbot';

// User App Component with Navigation
function UserApp() {
  const [activeView, setActiveView] = React.useState('dashboard');

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      
      case 'live-dashboard':
        return <EnhancedDashboard />;

      case 'live-crawl':
        return <LiveCrawlMonitor />;
      
      case 'checker':
        return <ComplianceChecker />;
      
      case 'products':
        return <ProductListings />;
      
      case 'ocr':
        return <OCRScanner />;
      
      case 'esp32':
        return <ESP32Scanner />;
      
      case 'barcode':
        return <BarcodeScanner />;
      
      case 'reports':
        return <Reports />;
      
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 p-6">
          {renderActiveView()}
        </main>
      </div>
      
      {/* 🤖 Chatbot for User Portal */}
      <Chatbot userRole="user" />
    </div>
  );
}

// Admin App Component with Navigation
function AdminApp() {
  const [activeView, setActiveView] = React.useState('admin-dashboard');

  const renderActiveView = () => {
    switch (activeView) {
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'user-activity':
        return <UserActivityMonitor />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
              <p className="text-sm text-purple-100">Legal Metrology Platform</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 bg-white/20 text-white text-sm font-medium rounded-full backdrop-blur-sm">
                👑 Administrator
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Admin Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] shadow-sm">
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveView('admin-dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeView === 'admin-dashboard'
                  ? 'bg-purple-50 text-purple-700 font-medium shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveView('user-activity')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeView === 'user-activity'
                  ? 'bg-purple-50 text-purple-700 font-medium shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>User Activity</span>
            </button>

            <div className="pt-4 mt-4 border-t border-gray-200">
              <a
                href="/login"
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </a>
            </div>
          </nav>
        </aside>

        {/* Admin Main Content */}
        <main className="flex-1 p-6">
          {renderActiveView()}
        </main>
      </div>

      {/* 🤖 Chatbot for Admin Portal */}
      <Chatbot userRole="admin" />
    </div>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login role="user" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/login" element={<Login role="admin" />} />

          {/* Protected User Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="user">
                <UserApp />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminApp />
              </ProtectedRoute>
            }
          />

          {/* Redirect root based on role - default to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;