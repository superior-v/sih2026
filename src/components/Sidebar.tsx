import React from 'react';
import { 
  BarChart3, 
  Search, 
  Package, 
  ScanLine, 
  FileText, 

  CheckCircle,
  Camera, 
  Scan 
} from 'lucide-react'; 

import { 
  MdLiveTv, 
  MdSmartToy, 
} from 'react-icons/md';


interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, color: 'text-blue-600' },
     { id: 'live-dashboard', label: 'Live Crawl Monitor', icon: MdLiveTv, color: 'text-red-600' },
    { id: 'live-crawl', label: 'AI Product Crawler', icon: MdSmartToy, color: 'text-purple-600' },
    { id: 'checker', label: 'Compliance Checker', icon: Search, color: 'text-purple-600' },
    { id: 'products', label: 'Product Listings', icon: Package, color: 'text-green-600' },
    { id: 'ocr', label: 'OCR Scanner', icon: ScanLine, color: 'text-orange-600' },
    { id: 'esp32', label: 'ESP32 Scanner', icon: Camera, color: 'text-teal-600' },
    { id: 'barcode', label: 'Barcode Scanner', icon: Scan, color: 'text-indigo-600' },
    { id: 'reports', label: 'Reports', icon: FileText, color: 'text-red-600' },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg border-r border-gray-200">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">System Active</span>
          </div>
          
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeView === item.id
                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={`h-5 w-5 ${activeView === item.id ? 'text-blue-600' : item.color}`} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;