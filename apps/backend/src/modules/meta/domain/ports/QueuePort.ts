export interface QueuePort {
  enqueue(
    queueName: string,
    jobName: string,
    data: Record<string, unknown>,
    opts?: { jobId?: string }
  ): Promise<void>;
}
