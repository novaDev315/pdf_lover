import { useQuery } from '@tanstack/react-query'

import { fetchApiCapabilities } from '@/lib/api/capabilities'

export function useApiCapabilities() {
  return useQuery({
    queryKey: ['api-capabilities'],
    queryFn: ({ signal }) => fetchApiCapabilities(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

