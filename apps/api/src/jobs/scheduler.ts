interface ScheduledJob {
  id: string;
  clientKey: string;
  controller: AbortController;
  task: (signal: AbortSignal) => Promise<void>;
}

/** Bounded in-process scheduler for temporary PDF jobs. */
export class JobScheduler {
  private readonly queue: ScheduledJob[] = [];
  private readonly running = new Map<string, ScheduledJob>();
  private readonly runningByClient = new Map<string, number>();
  private closed = false;

  constructor(
    private readonly globalLimit: number,
    private readonly clientLimit: number,
  ) {}

  enqueue(id: string, clientKey: string, task: (signal: AbortSignal) => Promise<void>): void {
    if (this.closed) throw new Error('Job scheduler is closed');
    const controller = new AbortController();
    this.queue.push({ id, clientKey, controller, task });
    this.pump();
  }

  cancel(id: string): boolean {
    const queuedIndex = this.queue.findIndex((job) => job.id === id);
    if (queuedIndex >= 0) {
      const [job] = this.queue.splice(queuedIndex, 1);
      job?.controller.abort();
      return true;
    }
    const running = this.running.get(id);
    if (!running) return false;
    running.controller.abort();
    return true;
  }

  close(): void {
    this.closed = true;
    for (const job of this.queue.splice(0)) job.controller.abort();
    for (const job of this.running.values()) job.controller.abort();
  }

  private pump(): void {
    if (this.closed) return;
    while (this.running.size < this.globalLimit) {
      const index = this.queue.findIndex(
        (job) => (this.runningByClient.get(job.clientKey) ?? 0) < this.clientLimit,
      );
      if (index < 0) return;
      const [job] = this.queue.splice(index, 1);
      if (!job) return;
      this.running.set(job.id, job);
      this.runningByClient.set(
        job.clientKey,
        (this.runningByClient.get(job.clientKey) ?? 0) + 1,
      );
      void job.task(job.controller.signal).finally(() => {
        this.running.delete(job.id);
        const remaining = (this.runningByClient.get(job.clientKey) ?? 1) - 1;
        if (remaining > 0) this.runningByClient.set(job.clientKey, remaining);
        else this.runningByClient.delete(job.clientKey);
        this.pump();
      });
    }
  }
}
