import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFileStore } from '@/store/file-store';

interface PendingShare {
  id: string;
  file: File;
  expiresAt?: number;
}

interface LaunchParams {
  files: FileSystemFileHandle[];
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue;
  }
}

function openShareDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PDFLoverShareTarget', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('pending')) {
        request.result.createObjectStore('pending', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open shared-file handoff'));
  });
}

async function claimSharedFiles(): Promise<File[]> {
  const database = await openShareDatabase();
  try {
    return await new Promise<File[]>((resolve, reject) => {
      const transaction = database.transaction('pending', 'readwrite');
      const store = transaction.objectStore('pending');
      const request = store.getAll();
      request.onsuccess = () => {
        const now = Date.now();
        const entries = (request.result as PendingShare[]).filter(
          (entry) => entry.file instanceof File && (entry.expiresAt === undefined || entry.expiresAt > now),
        );
        store.clear();
        resolve(entries.map((entry) => entry.file));
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read shared PDF files'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to clear shared PDF files'));
    });
  } finally {
    database.close();
  }
}

function reportFailures(failures: Array<{ filename: string; message: string }>): void {
  useFileStore.getState().setError(
    failures.length > 0
      ? failures.map((failure) => `${failure.filename}: ${failure.message}`).join('\n')
      : null,
  );
}

async function importReceivedPdfFiles(files: Iterable<File>) {
  const { importPdfFiles } = await import('@/lib/import-pdf-files');
  return importPdfFiles(files);
}

/** Receives files from installed-PWA share targets and operating-system file handlers. */
export function PwaFileReceiver() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (new URLSearchParams(location.search).get('shareError') === 'invalid-pdf') {
      useFileStore.getState().setError(
        'The shared item was empty, too large, or did not contain a valid PDF header.',
      );
    }
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    void claimSharedFiles()
      .then(async (files) => {
        if (cancelled || files.length === 0) return;
        const result = await importReceivedPdfFiles(files);
        if (cancelled) return;
        reportFailures(result.failures);
        navigate('/files');
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          useFileStore.getState().setError(
            cause instanceof Error ? cause.message : 'Failed to receive shared PDF files',
          );
        }
      });

    window.launchQueue?.setConsumer((params) => {
      void Promise.all(params.files.map((handle) => handle.getFile()))
        .then(importReceivedPdfFiles)
        .then((result) => {
          reportFailures(result.failures);
          navigate('/files');
        })
        .catch((cause: unknown) => {
          useFileStore.getState().setError(
            cause instanceof Error ? cause.message : 'Failed to open PDF files',
          );
        });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
