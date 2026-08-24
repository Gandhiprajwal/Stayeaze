import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useApiMetricsStream() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data, isSuccess } = useQuery({
    queryKey: ['super-admin-api-metrics'],
    queryFn: async () => {
      const res = await api.get('/super-admin/api-metrics');
      const metrics = res.data;
      if (metrics) {
        queryClient.setQueryData(['super-admin-api-metrics'], metrics);
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
