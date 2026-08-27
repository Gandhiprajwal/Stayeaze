import { useState, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Custom React hook that monitors real-time browser online/offline connectivity.
 * Triggers toast alerts and provides reactive boolean for offline banners.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Back online!', {
        id: 'network-status',
        duration: 3500,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are currently offline. Changes will sync when reconnected.', {
        id: 'network-status',
        duration: 6000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
