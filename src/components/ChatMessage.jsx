import React from 'react';
import { Shield, User, Check, CheckCheck, Clock } from 'lucide-react';

export const ChatMessage = ({ message, isOwn }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        <div className={`flex items-center mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'admin' 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500' 
              : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          }`}>
            {message.role === 'admin' ? (
              <Shield className="w-4 h-4 text-white" />
            ) : (
              <User className="w-4 h-4 text-white" />
            )}
          </div>
          <div className={`mx-2 ${isOwn ? 'text-right' : 'text-left'}`}>
            <p className="text-xs text-gray-500">{message.sender}</p>
          </div>
        </div>
        
        <div className={`relative p-3 rounded-2xl shadow-sm ${
          isOwn
            ? message.role === 'admin'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
            : 'bg-white border border-gray-200'
        }`}>
          <p className={`text-sm ${isOwn ? 'text-white' : 'text-gray-800'}`}>
            {message.content}
          </p>
          
          <div className={`flex items-center justify-between mt-2 ${
            isOwn ? 'flex-row-reverse' : 'flex-row'
          }`}>
            <span className={`text-xs ${
              isOwn ? 'text-white/70' : 'text-gray-500'
            }`}>
              {formatTime(message.timestamp)}
            </span>
            {isOwn && (
              <div className="flex items-center space-x-1">
                {getStatusIcon()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};