import React from 'react';
import { User, Shield, MessageCircle } from 'lucide-react';

export const RoleSelection = ({ onRoleSelect }) => {
  const [selectedRole, setSelectedRole] = React.useState(null);
  const [name, setName] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedRole && name.trim()) {
      onRoleSelect(selectedRole, name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Support Chat</h1>
          <p className="text-gray-600">Choose your role to start chatting</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div
              className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selectedRole === 'user'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => setSelectedRole('user')}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">User</h3>
                  <p className="text-sm text-gray-600">Report issues and get support</p>
                </div>
              </div>
            </div>

            <div
              className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selectedRole === 'admin'
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => setSelectedRole('admin')}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Admin</h3>
                  <p className="text-sm text-gray-600">Provide support and resolve issues</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
              placeholder="Enter your name"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!selectedRole || !name.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Start Chatting
          </button>
        </form>
      </div>
    </div>
  );
};