import type {
  ApiErrorResponse,
  OperationArtifact,
  OperationJob,
  ProgressInfo,
  ServerOperationKind,
} from '@pdflover/shared';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function apiError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ApiErrorResponse;
    return new Error(body.error?.message || `Server request failed with status ${response.status}`);
  } catch {
    return new Error(`Server request failed with status ${response.status}`);
  }
}

async function getJob(jobId: string, signal?: AbortSignal): Promise<OperationJob> {
  const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, { signal });
  if (!response.ok) throw await apiError(response);
  return response.json() as Promise<OperationJob>;
}

async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

async function waitForJob(
  jobId: string,
  options: { signal?: AbortSignal; onProgress?: (info: ProgressInfo) => void },
): Promise<OperationJob> {
  while (true) {
    if (options.signal?.aborted) {
      await cancelJob(jobId).catch(() => undefined);
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    const job = await getJob(jobId, options.signal);
    options.onProgress?.(job.progress);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'expired') {
      throw new Error(job.error?.message || `Server job ${job.status}`);
    }
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        options.signal?.removeEventListener('abort', abort);
        resolve();
      };
      const timer = setTimeout(finish, 500);
      const abort = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        reject(new DOMException('Operation cancelled', 'AbortError'));
      };
      options.signal?.addEventListener('abort', abort, { once: true });
    });
  }
}

async function downloadArtifact(
  jobId: string,
  artifact: OperationArtifact,
  signal?: AbortSignal,
): Promise<{ data: ArrayBuffer; filename: string; mediaType: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifact.id)}`,
    { signal },
  );
  if (!response.ok) throw await apiError(response);
  const data = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== artifact.sha256) {
    throw new Error(`Downloaded artifact failed integrity validation: ${artifact.filename}`);
  }
  return {
    data,
    filename: artifact.filename,
    mediaType: artifact.mediaType,
  };
}

export async function runServerPdfOperation(input: {
  operation: ServerOperationKind;
  file: File;
  certificate?: File;
  options: unknown;
  signal?: AbortSignal;
  onProgress?: (info: ProgressInfo) => void;
}): Promise<Array<{ data: ArrayBuffer; filename: string; mediaType: string }>> {
  const form = new FormData();
  form.append('options', JSON.stringify(input.options));
  form.append('file', input.file, input.file.name);
  if (input.certificate) form.append('certificate', input.certificate, input.certificate.name);
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs?operation=${encodeURIComponent(input.operation)}`,
    { method: 'POST', body: form, signal: input.signal },
  );
  if (!response.ok) throw await apiError(response);
  const created = await response.json() as OperationJob;
  try {
    const completed = await waitForJob(created.id, {
      signal: input.signal,
      onProgress: input.onProgress,
    });
    return await Promise.all(
      completed.artifacts.map((artifact) =>
        downloadArtifact(completed.id, artifact, input.signal)),
    );
  } finally {
    await cancelJob(created.id).catch(() => undefined);
  }
}
