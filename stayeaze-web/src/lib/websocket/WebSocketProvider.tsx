import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (topic: string, callback: (data: any) => void) => () => void;
  sendMessage: (destination: string, body: any) => void;
  unreadChatIds: Set<string>;
  markChatAsRead: (id: string) => void;
  hasUnreadChat: (id: string) => boolean;
  addUnreadChat: (id: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
  sendMessage: () => {},
  unreadChatIds: new Set(),
  markChatAsRead: () => {},
  hasUnreadChat: () => false,
  addUnreadChat: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [unreadChatIds, setUnreadChatIds] = useState<Set<string>>(new Set());
  const clientRef = useRef<Client | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = localStorage.getItem('stayeaze_token');

  const markChatAsRead = useCallback((id: string) => {
    if (!id) return;
    setUnreadChatIds((prev) => {
      const next = new Set(prev);
      next.delete(String(id));
      return next;
    });
  }, []);

  const hasUnreadChat = useCallback((id: string) => {
    return !!id && unreadChatIds.has(String(id));
  }, [unreadChatIds]);

  const addUnreadChat = useCallback((id: string) => {
    if (!id) return;
    setUnreadChatIds((prev) => new Set(prev).add(String(id)));
  }, []);

  // Active custom topic subscriptions: topic -> Set of callbacks
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const stompSubscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());

  const getWsUrl = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
    // Remove /api/v1 if present to target root
    const rootUrl = apiBase.replace(/\/api\/v1\/?$/, '');
    return `${rootUrl}/ws-stayeaze`;
  };

  useEffect(() => {
    if (!user || !token) {
      if (clientRef.current?.active) {
        clientRef.current.deactivate();
      }
      setIsConnected(false);
      return;
    }

    const wsUrl = getWsUrl();
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        if (import.meta.env.DEV) {
          // console.debug('[STOMP]', str);
        }
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      setIsConnected(true);
      console.info('🟢 STOMP WebSocket connection established.');

      // 1. Subscribe to personal user notification topic
      if (user.id) {
        client.subscribe(`/topic/notifications/${user.id}`, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            handleNotificationMessage(data);
          } catch (e) {
            console.error('Failed to parse user notification payload:', e);
          }
        });
      }

      // 2. Subscribe to general support tickets queue for staff / super admin
      const isStaff = user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT';
      if (isStaff) {
        client.subscribe('/topic/support-tickets', (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            handleSupportTicketMessage(data);
          } catch (e) {
            console.error('Failed to parse support ticket payload:', e);
          }
        });
      }

      // 3. Subscribe to /topic/visitors for real-time visitor status updates (approvals, rejections, arrivals)
      client.subscribe('/topic/visitors', (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          handleNotificationMessage(data);
        } catch (e) {
          console.error('Failed to parse visitor notification payload:', e);
        }
      });

      // 4. Subscribe to /topic/complaints for real-time complaint creation and status updates
      client.subscribe('/topic/complaints', (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          handleNotificationMessage(data);
        } catch (e) {
          console.error('Failed to parse complaint notification payload:', e);
        }
      });

      // 5. Re-subscribe any dynamic active topics registered in memory
      subscribersRef.current.forEach((callbacks, topic) => {
        const sub = client.subscribe(topic, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            callbacks.forEach((cb) => cb(data));
          } catch (e) {
            console.error(`Failed to handle message for topic ${topic}:`, e);
          }
        });
        stompSubscriptionsRef.current.set(topic, sub);
      });
    };

    client.onDisconnect = () => {
      setIsConnected(false);
      stompSubscriptionsRef.current.clear();
      console.warn('🔴 STOMP WebSocket disconnected.');
    };

    client.onStompError = (frame) => {
      console.error('STOMP Protocol Error:', frame.headers['message'], frame.body);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      stompSubscriptionsRef.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (ignored) {}
      });
      stompSubscriptionsRef.current.clear();
      if (client.active) {
        client.deactivate();
      }
      setIsConnected(false);
    };
  }, [user?.id, token]);

  const handleNotificationMessage = (payload: any) => {
    // Invalidate all complaint, visitor, and support ticket queries automatically (matching slash & non-slash keys)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const keyStr = JSON.stringify(query.queryKey);
        return keyStr.includes('complaint') || keyStr.includes('visitor') || keyStr.includes('notif');
      },
    });

    if (payload?.complaintId) {
      queryClient.invalidateQueries({ queryKey: ['complaint-chat', payload.complaintId] });

      if (payload?.message) {
        const currentName = (user?.name || user?.email || '').toLowerCase().trim();
        const msgSenderName = (payload.senderName || '').toLowerCase().trim();
        const isSelf =
          (payload.senderId && user?.id && String(payload.senderId) === String(user.id)) ||
          (currentName && msgSenderName && currentName === msgSenderName);

        if (!isSelf) {
          addUnreadChat(payload.complaintId);
          toast.info(`💬 New Chat Message (${payload.senderName || 'Support'})`, {
            description: payload.message,
            duration: 5000,
          });
        }
      }
    }

    if (payload?.type === 'VISITOR_APPROVAL_NEEDED') {
      toast.warning(payload.title || '🔔 Visitor at the Gate!', {
        description: payload.message || `${payload.visitorName || 'A visitor'} is waiting for your approval.`,
        duration: 8000,
      });
    } else if (payload?.type === 'VISITOR_APPROVED') {
      toast.success(payload.title || '✅ Visitor Approved!', {
        description: payload.message || `Entry approved for ${payload.visitorName || 'visitor'}.`,
        duration: 6000,
      });
    } else if (payload?.type === 'VISITOR_REJECTED') {
      toast.error(payload.title || '❌ Visitor Denied', {
        description: payload.message || `Entry denied for ${payload.visitorName || 'visitor'}.`,
        duration: 6000,
      });
    } else if (payload?.type === 'COMPLAINT_CREATED') {
      toast.info(payload.title || '🛠️ New Complaint Ticket', {
        description: payload.message || `New complaint ticket ${payload.ticketNumber || ''} created.`,
        duration: 6000,
      });
    } else if (payload?.type === 'COMPLAINT_UPDATED') {
      toast.success(payload.title || '📋 Complaint Status Updated', {
        description: payload.message || `Complaint ${payload.ticketNumber || ''} status updated to ${payload.status}.`,
        duration: 6000,
      });
    } else if (payload?.title) {
      toast.info(payload.title, {
        description: payload.message || payload.description,
      });
    }
  };

  const handleSupportTicketMessage = (payload: any) => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const keyStr = JSON.stringify(query.queryKey);
        return keyStr.includes('support') || keyStr.includes('ticket');
      },
    });

    if (payload?.ticketId) {
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', payload.ticketId] });
      if (payload?.senderRole && user?.role && payload.senderRole !== user.role) {
        addUnreadChat(payload.ticketId);
      }
    }

    if (payload?.type === 'NEW_TICKET') {
      toast.info('New Support Ticket Raised', {
        description: `${payload.ticketNumber || 'Ticket'}: ${payload.subject || 'New inquiry received'}`,
      });
    } else if (payload?.type === 'NEW_MESSAGE' && payload.senderRole === 'CUSTOMER') {
      toast.info('New Message in Support Ticket', {
        description: `${payload.ticketNumber || 'Ticket'}: ${payload.messageSnippet || 'New reply from customer'}`,
      });
    }
  };

  const subscribe = useCallback((topic: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(topic)) {
      subscribersRef.current.set(topic, new Set());
      if (clientRef.current?.connected) {
        const sub = clientRef.current.subscribe(topic, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            const callbacks = subscribersRef.current.get(topic);
            callbacks?.forEach((cb) => cb(data));
          } catch (e) {
            console.error(`Failed to handle message for dynamic topic ${topic}:`, e);
          }
        });
        stompSubscriptionsRef.current.set(topic, sub);
      }
    }
    subscribersRef.current.get(topic)!.add(callback);

    // Return cleanup function to unsubscribe
    return () => {
      const callbacks = subscribersRef.current.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(topic);
          const stompSub = stompSubscriptionsRef.current.get(topic);
          if (stompSub) {
            try {
              stompSub.unsubscribe();
            } catch (ignored) {}
            stompSubscriptionsRef.current.delete(topic);
          }
        }
      }
    };
  }, []);

  const sendMessage = useCallback((destination: string, body: any) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, sendMessage, unreadChatIds, markChatAsRead, hasUnreadChat, addUnreadChat }}>
      {children}
    </WebSocketContext.Provider>
  );
};
