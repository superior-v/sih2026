import React, { useEffect, useRef } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useYjsChat } from '../hooks/useYjsChat';

export const Chat = ({ user, onBack }) => {
  const messagesEndRef = useRef(null);
  const roomId = 'crdt-support-chat'; // CRDT room identifier
  
  const { messages, connected, onlineUsers, syncStatus, sendMessage } = useYjsChat(roomId, user);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message for admins when they first join
  useEffect(() => {
    if (connected && messages.length === 0 && user.role === 'admin') {
      setTimeout(() => {
        sendMessage("Hello! I'm here to help you with any issues you might have. This chat uses CRDT technology for real-time collaboration without requiring a central server.");
      }, 1000);
    }
  }, [connected, messages.length, user.role, sendMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <ChatHeader 
        connected={connected}
        onlineUsers={onlineUsers}
        currentUser={user}
        syncStatus={syncStatus}
      />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                <span className="text-white text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                CRDT Chat Ready!
              </h3>
              <p className="text-gray-500 mb-4">
                Your messages are stored locally and sync automatically with other users
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <div className="font-medium mb-2">✨ Local-first Features:</div>
                <ul className="text-left space-y-1">
                  <li>• Works offline - messages saved locally</li>
                  <li>• Automatic peer-to-peer synchronization</li>
                  <li>• No central server required</li>
                  <li>• Conflict-free collaborative editing</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwn={message.sender === user.name}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <ChatInput 
        onSendMessage={sendMessage}
        disabled={false} // CRDT always allows sending (works offline)
        syncStatus={syncStatus}
      />
      
      <div className="bg-white/50 backdrop-blur-sm border-t border-gray-200 p-2">
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← Back to role selection
        </button>
      </div>
    </div>
  );
};