import { lazy, Suspense } from 'react'
import { Layers } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBatchStore } from '@/store/batch-store'

const BatchQueueRuntime = lazy(() =>
  import('@/components/batch/BatchQueueRuntime').then(({ BatchQueueRuntime }) => ({
    default: BatchQueueRuntime,
  })),
)

/** Keeps queued work processing and reachable from every route. */
export function GlobalBatchQueue() {
  const queueLength = useBatchStore((state) => state.queue.length)
  const isPanelOpen = useBatchStore((state) => state.isPanelOpen)
  const setPanelOpen = useBatchStore((state) => state.setPanelOpen)

  return (
    <>
      {queueLength > 0 && !isPanelOpen && (
        <Button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-24 right-5 z-40 gap-2 rounded-full shadow-lg sm:bottom-5"
          aria-label={`Open batch queue with ${queueLength} operation${queueLength === 1 ? '' : 's'}`}
        >
          <Layers className="h-4 w-4" />
          Queue
          <span className="rounded-full bg-white/20 px-1.5 text-xs">{queueLength}</span>
        </Button>
      )}

      {(queueLength > 0 || isPanelOpen) && (
        <Suspense fallback={null}>
          <BatchQueueRuntime />
        </Suspense>
      )}
    </>
  )
}
