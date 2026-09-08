import React from 'react';
import { MessageCircle, Wifi, WifiOff, User, Shield, Database, Globe, Loader } from 'lucide-react';

export const ChatHeader = ({ connected, onlineUsers, currentUser, syncStatus }) => {
  const otherUsersOnline = Math.max(0, onlineUsers.size - 1);

  const getSyncStatusInfo = () => {
    switch (syncStatus) {
      case 'synced-local':
        return {
          icon: <Database className="w-4 h-4 text-blue-500" />,
          text: 'Local Storage',
          color: 'text-blue-600'
        };
      case 'synced-remote':
        return {
          icon: <Globe className="w-4 h-4 text-green-500" />,
          text: 'Peer Synced',
          color: 'text-green-600'
        };
      case 'connecting':
        return {
          icon: <Loader className="w-4 h-4 text-yellow-500 animate-spin" />,
          text: 'Connecting',
          color: 'text-yellow-600'
        };
      default:
        return {
          icon: <WifiOff className="w-4 h-4 text-gray-500" />,
          text: 'Offline',
          color: 'text-gray-600'
        };
    }
  };

  const statusInfo = getSyncStatusInfo();

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-10 h-10 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">CRDT Chat</h1>
            <p className="text-sm text-gray-600">
              Local-first collaborative messaging
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {statusInfo.icon}
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced-remote' ? 'bg-green-500' : 
              syncStatus === 'synced-local' ? 'bg-blue-500' :
              syncStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-500'
            }`} />
            <span className={`text-sm ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-full">
            {currentUser.role === 'admin' ? (
              <Shield className="w-4 h-4 text-indigo-600" />
            ) : (
              <User className="w-4 h-4 text-blue-600" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {currentUser.name}
            </span>
          </div>
          
          {otherUsersOnline > 0 && (
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>{otherUsersOnline} peers</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {syncStatus === 'synced-remote' && 'Messages sync automatically across all connected peers'}
        {syncStatus === 'synced-local' && 'Messages saved locally - will sync when peers connect'}
        {syncStatus === 'connecting' && 'Looking for peers to sync with...'}
        {syncStatus === 'offline' && 'Working offline - messages saved locally'}
      </div>
    </div>
  );
};