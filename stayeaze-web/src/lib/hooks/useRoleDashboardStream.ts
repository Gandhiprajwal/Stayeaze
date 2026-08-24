import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useRoleDashboardStream() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: streamData, isSuccess } = useQuery({
    queryKey: ['dashboard', 'role-metrics'],
    queryFn: async () => {
      const res = await api.get('/dashboard/metrics');
      const data = res.data;
      if (data) {
        queryClient.setQueryData(['dashboard', 'role-metrics'], data);
      }
      return data;
    },
    enabled: !!user,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  return { isLiveStreaming: isSuccess, streamData };
}
