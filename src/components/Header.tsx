import React from 'react';
import { Flag, Shield } from 'lucide-react';
import Logo from '../assets/logo1.svg'; // Ensure you have a logo image at this path or adjust accordingly

const Header = () => {
  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
               <img src={Logo} alt="Logo" className="h-12 w-12" />
              
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Legal Metrology Compliance Checker
              </h1>
              <p className="text-sm text-gray-600">
                Department of Consumer Affairs • Ministry of Consumer Affairs, Food & Public Distribution
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Regulatory Officer Portal</p>
              <p className="text-xs text-gray-500">Government of India</p>
            </div>
            <div className="h-10 w-10 bg-gradient-to-br from-gray-500 to-green-700 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">GOV</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;