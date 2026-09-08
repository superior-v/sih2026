import React, { useState, useRef } from 'react';
import { Send, Paperclip, Smile, Database, Globe } from 'lucide-react';

export const ChatInput = ({ onSendMessage, disabled, syncStatus }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'synced-remote':
        return <Globe className="w-4 h-4 text-green-500" />;
      case 'synced-local':
        return <Database className="w-4 h-4 text-blue-500" />;
      default:
        return <Database className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Press Enter to send)"
            className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none bg-white/50 max-h-32"
            style={{ minHeight: '48px' }}
            disabled={disabled}
          />
          <div className="absolute right-3 top-3 flex items-center space-x-1">
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={disabled}
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={disabled}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
      
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Enter to send • Shift+Enter for new line</span>
        <div className="flex items-center space-x-1">
          {getSyncIcon()}
          <span>
            {syncStatus === 'synced-remote' && 'Synced with peers'}
            {syncStatus === 'synced-local' && 'Saved locally'}
            {syncStatus === 'connecting' && 'Looking for peers...'}
            {syncStatus === 'offline' && 'Working offline'}
          </span>
        </div>
      </div>
    </div>
  );
};