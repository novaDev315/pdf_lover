import { BatchPanel } from '@/components/batch/BatchPanel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBatchProcessor } from '@/hooks/useBatchProcessor'
import { useBatchStore } from '@/store/batch-store'

/** Lazy runtime so PDF processing engines do not inflate the initial dashboard bundle. */
export function BatchQueueRuntime() {
  const isPanelOpen = useBatchStore((state) => state.isPanelOpen)
  const setPanelOpen = useBatchStore((state) => state.setPanelOpen)

  useBatchProcessor({ autoProcess: true, showToasts: true, storeResults: true })

  return (
    <Dialog open={isPanelOpen} onOpenChange={setPanelOpen}>
      <DialogContent className="h-[min(90vh,48rem)] w-[calc(100%-2rem)] max-w-sm overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Batch queue</DialogTitle>
          <DialogDescription>Review, reorder, process, and download queued PDF operations.</DialogDescription>
        </DialogHeader>
        <BatchPanel collapsible={false} className="h-full w-full border-l-0 pt-1" />
      </DialogContent>
    </Dialog>
  )
}
