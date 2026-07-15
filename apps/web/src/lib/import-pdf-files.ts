import { loadPDFDocument } from '@pdflover/pdf-core';
import { db } from '@/lib/storage';
import { useFileStore } from '@/store/file-store';

export interface PdfImportFailure {
  filename: string;
  message: string;
}

/** Import PDF files into the durable local library and hydrate UI state. */
export async function importPdfFiles(
  selected: Iterable<File>,
): Promise<{ imported: number; failures: PdfImportFailure[] }> {
  let imported = 0;
  const failures: PdfImportFailure[] = [];

  for (const file of selected) {
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await loadPDFDocument(bytes);
      const document = await db.importDocument({
        file,
        filename: file.name,
        pageCount: pdf.getPageCount(),
        metadata: {
          title: pdf.getTitle(),
          author: pdf.getAuthor(),
          subject: pdf.getSubject(),
          creator: pdf.getCreator(),
          producer: pdf.getProducer(),
          creationDate: pdf.getCreationDate(),
          modificationDate: pdf.getModificationDate(),
        },
      });
      useFileStore.getState().addFile(document);
      imported += 1;
    } catch (cause) {
      failures.push({
        filename: file.name,
        message: cause instanceof Error ? cause.message : 'import failed',
      });
    }
  }

  return { imported, failures };
}
