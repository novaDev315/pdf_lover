import * as React from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, Download, FileText, Heart, MessageSquare, Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { importPdfFiles } from '@/lib/import-pdf-files';
import { db } from '@/lib/storage';
import { formatFileSize } from '@/lib/utils';
import { selectFilteredFiles, useFileStore } from '@/store/file-store';

function downloadStoredBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FilesPage() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const files = useFileStore(useShallow(selectFilteredFiles));
  const removeFile = useFileStore((state) => state.removeFile);
  const isLoading = useFileStore((state) => state.isLoading);
  const libraryError = useFileStore((state) => state.error);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const importFiles = React.useCallback(async (selected: FileList | File[]) => {
    setIsImporting(true);
    setError(null);
    useFileStore.getState().setError(null);
    const failures: string[] = [];
    const result = await importPdfFiles(Array.from(selected));
    failures.push(...result.failures.map((failure) => `${failure.filename}: ${failure.message}`));
    if (failures.length > 0) setError(failures.join('\n'));
    setIsImporting(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const download = React.useCallback(async (id: string, filename: string) => {
    setError(null);
    const blob = await db.getDocumentBytes(id);
    if (!blob) {
      setError(`${filename}: stored bytes are unavailable; re-import the original file`);
      return;
    }
    downloadStoredBlob(blob, filename);
  }, []);

  const remove = React.useCallback(async (id: string) => {
    setError(null);
    try {
      await db.deleteDocument(id);
      removeFile(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete document');
    }
  }, [removeFile]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="border-b bg-card dark:bg-surface-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
            <div>
              <h1 className="font-semibold">Local document library</h1>
              <p className="text-xs text-muted-foreground">Originals and versions stay in this browser</p>
            </div>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? 'Importing…' : 'Import PDFs'}
          </Button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(event) => {
              if (event.target.files) void importFiles(event.target.files);
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        {(error ?? libraryError) && (
          <div className="whitespace-pre-wrap rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error ?? libraryError}
          </div>
        )}

        {isLoading ? (
          <p className="py-12 text-center text-muted-foreground">Loading local documents…</p>
        ) : files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">No saved documents</h2>
                <p className="text-sm text-muted-foreground">
                  Import a PDF to store its real bytes and create the original version.
                </p>
              </div>
              <Button onClick={() => inputRef.current?.click()}>Import your first PDF</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {files.map((file) => (
              <Card key={file.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="truncate text-base">{file.filename}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>{file.pageCount} pages</span>
                    <span>{file.status}</span>
                  </div>
                  {file.errorMessage && (
                    <p className="mb-4 text-sm text-red-600 dark:text-red-400">{file.errorMessage}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild disabled={!file.currentVersionId}>
                      <Link to={`/editor?document=${encodeURIComponent(file.id)}`}>
                        <Pencil className="mr-2 h-4 w-4" />Edit
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void download(file.id, file.filename)}>
                      <Download className="mr-2 h-4 w-4" />Download
                    </Button>
                    <Button size="sm" variant="outline" asChild disabled={!file.currentVersionId}>
                      <Link to={`/chat?document=${encodeURIComponent(file.id)}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />Chat
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(file.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
