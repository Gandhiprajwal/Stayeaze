import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Send, Lock } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, initials } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWebSocket } from '@/lib/websocket/WebSocketProvider';
import api from '@/lib/api';

interface ComplaintChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: {
    id: string;
    description: string;
    ticketNumber?: string;
    tenantName?: string;
    roomNumber?: string;
    status?: string;
  } | null;
}

export function ComplaintChatDialog({ open, onOpenChange, complaint }: ComplaintChatDialogProps) {
  const { user } = useAuthStore();
  const { subscribe, markChatAsRead } = useWebSocket();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const complaintId = complaint?.id;
  const statusLower = complaint?.status?.toLowerCase();
  const isClosed = statusLower === 'resolved' || statusLower === 'closed';

  useEffect(() => {
    if (complaintId && open) {
      markChatAsRead(complaintId);
    }
  }, [complaintId, open, markChatAsRead]);

  const normalizeMessages = (raw: any): any[] => {
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const map = new Map<string, any>();
    for (const msg of list) {
      if (!msg) continue;
      const key = msg.id ? String(msg.id) : `${msg.senderId || msg.senderRole}-${msg.message}-${msg.createdAt}`;
      map.set(key, msg);
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  };

  // Real-time WebSocket subscription for live complaint chat messages
  useEffect(() => {
    if (!complaintId || !open) return;

    const handleNewMessage = (newMsg: any) => {
      if (!newMsg) return;
      queryClient.setQueryData<any[]>(['complaint-chat', complaintId], (current = []) => {
        return normalizeMessages([...(Array.isArray(current) ? current : []), newMsg]);
      });
    };

    const unsub1 = subscribe(`/topic/complaints/${complaintId}/messages`, handleNewMessage);
    const unsub2 = subscribe(`/topic/complaints/${complaintId}`, handleNewMessage);

    return () => {
      if (typeof unsub1 === 'function') unsub1();
      if (typeof unsub2 === 'function') unsub2();
    };
  }, [complaintId, open, subscribe, queryClient]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['complaint-chat', complaintId],
    queryFn: async () => {
      if (!complaintId) return [];
      const res = await api.get(`/complaints/${complaintId}/messages`);
      return normalizeMessages(res.data);
    },
    enabled: !!complaintId && open,
    staleTime: 0,
    refetchInterval: open ? 2000 : false,
  });

  const currentUserName = user?.name || user?.email || 'User';

  const sendMessageMutation = useMutation({
    mutationFn: (newMsg: { message: string; senderName: string; senderRole: string }) =>
      api.post(`/complaints/${complaintId}/messages`, newMsg),
    onSuccess: (res: any) => {
      setMessage('');
      if (complaintId && res?.data) {
        queryClient.setQueryData<any[]>(['complaint-chat', complaintId], (current = []) => {
          return normalizeMessages([...(Array.isArray(current) ? current : []), res.data]);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['complaint-chat', complaintId] });
    },
    onError: () => {
      toast.error('Failed to send message.');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !complaintId || isClosed) return;

    sendMessageMutation.mutate({
      message: message.trim(),
      senderName: currentUserName || 'User',
      senderRole: user?.role || 'TENANT',
    });
  };

  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col h-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-muted/20 shrink-0">
          <DialogTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Live Ticket Chat ({complaint?.ticketNumber || 'TICKET'})
            </div>
            {complaint?.roomNumber && (
              <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary font-semibold rounded-full border border-primary/20 shrink-0">
                📍 Room {complaint.roomNumber}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {complaint?.description || 'Support ticket discussion thread'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : messages && messages.length > 0 ? (
            messages.map((msg: any, idx: number) => {
              const sender = msg.senderName || '';
              const isCurrentUser =
                (msg.senderId && user?.id && String(msg.senderId) === String(user.id)) ||
                sender === currentUserName ||
                (user?.email && sender.toLowerCase() === user.email.toLowerCase()) ||
                (user?.name && sender.toLowerCase() === user.name.toLowerCase());

              return (
                <div
                  key={msg.id || idx}
                  className={`flex gap-2.5 max-w-[85%] ${isCurrentUser ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {initials(sender || 'User')}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-foreground">{sender || 'User'}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 bg-muted text-muted-foreground rounded font-mono">
                        {msg.senderRole}
                      </span>
                    </div>
                    <div
                      className={`p-3 rounded-xl text-xs shadow-xs ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-muted/60 text-foreground border rounded-tl-none'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <p className={`text-[9px] text-muted-foreground mt-1 ${isCurrentUser ? 'text-right' : ''}`}>
                      {formatDate(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 text-muted-foreground">
              <MessageSquare className="h-10 w-10 stroke-1 mb-2 opacity-50" />
              <p className="text-xs font-medium">No chat messages yet.</p>
              <p className="text-[11px] opacity-75">Start the conversation below.</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {isClosed ? (
          <div className="p-3 border-t bg-muted/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 font-medium shrink-0">
            <Lock className="h-3.5 w-3.5 text-muted-foreground/70" />
            This complaint ticket has been marked as <span className="uppercase font-bold text-foreground">{complaint?.status}</span>. Chat is closed.
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-3 border-t bg-muted/20 flex gap-2 shrink-0">
            <Input
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-background"
            />
            <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
