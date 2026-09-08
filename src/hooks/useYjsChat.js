import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';

export const useYjsChat = (roomId, user) => {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [syncStatus, setSyncStatus] = useState('offline');
  
  // Use refs to ensure providers are only created once
  const docRef = useRef(null);
  const webrtcProviderRef = useRef(null);
  const indexeddbProviderRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent re-initialization
    if (initializedRef.current) {
      return;
    }
    
    initializedRef.current = true;

    // Initialize Y.Doc only once
    if (!docRef.current) {
      docRef.current = new Y.Doc();
    }

    const doc = docRef.current;

    // Initialize IndexedDB persistence for offline storage
    const indexeddbProvider = new IndexeddbPersistence(roomId, doc);
    indexeddbProviderRef.current = indexeddbProvider;
    
    // Initialize WebRTC provider for peer-to-peer synchronization
    const webrtcProvider = new WebrtcProvider(roomId, doc, {
      signaling: ['wss://signaling.yjs.dev'],
      password: null,
      maxConns: 20,
      filterBcConns: true,
      peerOpts: {}
    });
    
    webrtcProviderRef.current = webrtcProvider;

    // Handle IndexedDB sync status
    indexeddbProvider.on('synced', () => {
      setSyncStatus('synced-local');
      setConnected(true);
    });

    // Handle WebRTC connection status
    webrtcProvider.on('status', ({ status }) => {
      if (status === 'connected') {
        setSyncStatus('synced-remote');
        setConnected(true);
      } else if (status === 'connecting') {
        setSyncStatus('connecting');
      } else {
        setSyncStatus('offline');
      }
    });

    webrtcProvider.on('peers', ({ added, removed, webrtcPeers }) => {
      console.log('WebRTC peers changed:', { added, removed, total: webrtcPeers.length });
    });

    // Get shared types
    const messagesArray = doc.getArray('messages');
    const awareness = webrtcProvider.awareness;

    // Set user awareness - use setLocalStateField instead of setLocalState
    awareness.setLocalStateField('user', {
      name: user.name,
      role: user.role,
      id: user.id,
      timestamp: Date.now()
    });

    // Listen to messages changes
    const updateMessages = () => {
      const allMessages = messagesArray.toArray();
      setMessages([...allMessages].sort((a, b) => a.timestamp - b.timestamp));
    };

    messagesArray.observe(updateMessages);
    updateMessages();

    // Listen to awareness changes (online users)
    const updateAwareness = () => {
      const users = new Set();
      awareness.getStates().forEach((state) => {
        if (state.user) {
          users.add(state.user.id);
        }
      });
      setOnlineUsers(users);
    };

    awareness.on('change', updateAwareness);
    updateAwareness();

    // Clean up on unmount
    return () => {
      messagesArray.unobserve(updateMessages);
      awareness.off('change', updateAwareness);
      
      if (webrtcProviderRef.current) {
        webrtcProviderRef.current.destroy();
        webrtcProviderRef.current = null;
      }
      
      if (indexeddbProviderRef.current) {
        indexeddbProviderRef.current.destroy();
        indexeddbProviderRef.current = null;
      }
      
      initializedRef.current = false;
    };
  }, [roomId, user.name, user.role, user.id]);

  const sendMessage = useCallback((content) => {
    if (!docRef.current) return;
    
    const messagesArray = docRef.current.getArray('messages');
    const message = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      sender: user.name,
      role: user.role,
      timestamp: Date.now(),
      status: 'sent'
    };

    // Add message to CRDT - will automatically sync across all connected peers
    messagesArray.push([message]);
  }, [user]);

  return {
    messages,
    connected,
    onlineUsers,
    syncStatus,
    sendMessage
  };
};