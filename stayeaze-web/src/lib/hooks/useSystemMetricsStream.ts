import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useSystemMetricsStream() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data, isSuccess } = useQuery({
    queryKey: ['dashboard', 'system-metrics'],
    queryFn: async () => {
      const res = await api.get('/system/metrics');
      const metrics = res.data;
      if (metrics) {
        queryClient.setQueryData(['dashboard', 'system-metrics'], metrics);
      }
      return metrics;
    },
    enabled: !!user,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  return { isLiveStreaming: isSuccess, metrics: data };
}
