import { useEffect } from 'react';
import { db } from '@/lib/storage';
import { useFileStore } from '@/store/file-store';

/** Hydrates volatile UI state from the durable local document library. */
export function LibraryHydrator() {
  const hydrateLibrary = useFileStore((state) => state.hydrateLibrary);
  const setLoading = useFileStore((state) => state.setLoading);
  const setError = useFileStore((state) => state.setError);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      db.getAllDocuments({ limit: Number.MAX_SAFE_INTEGER }),
      db.getFolders(),
    ])
      .then(([documents, folders]) => {
        if (!cancelled) hydrateLibrary(documents.items, folders);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoading(false);
          setError(error instanceof Error ? error.message : 'Failed to load the local library');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hydrateLibrary, setError, setLoading]);

  return null;
}
