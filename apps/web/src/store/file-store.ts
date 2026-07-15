/**
 * File Management State
 * Manages stored documents, folders, and file organization
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { StoredDocument, DocumentFolder, DocumentStatus } from '@pdflover/shared';

/**
 * View mode for file display
 */
export type ViewMode = 'grid' | 'list';

/**
 * Sort options for files
 */
export type SortBy = 'filename' | 'createdAt' | 'updatedAt' | 'fileSize' | 'pageCount';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Filter options for files
 */
export interface FileFilter {
  /** Filter by document status */
  status?: DocumentStatus;
  /** Filter by folder ID */
  folderId?: string | null;
  /** Filter by tags */
  tags?: string[];
  /** Filter by favorites only */
  favoritesOnly?: boolean;
  /** Search query */
  searchQuery?: string;
}

/**
 * File store state interface
 */
export interface FileState {
  /** All stored documents */
  files: StoredDocument[];
  /** Document folders */
  folders: DocumentFolder[];
  /** Current view mode */
  viewMode: ViewMode;
  /** Current sort field */
  sortBy: SortBy;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Current filter options */
  filter: FileFilter;
  /** Currently selected file IDs */
  selectedFileIds: string[];
  /** Currently expanded folder ID */
  currentFolderId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * File store actions interface
 */
export interface FileActions {
  /** Replace in-memory library state with durable IndexedDB state */
  hydrateLibrary: (files: StoredDocument[], folders: DocumentFolder[]) => void;
  /** Add a file to the store */
  addFile: (file: StoredDocument) => void;
  /** Add multiple files to the store */
  addFiles: (files: StoredDocument[]) => void;
  /** Remove a file by ID */
  removeFile: (fileId: string) => void;
  /** Remove multiple files by IDs */
  removeFiles: (fileIds: string[]) => void;
  /** Update a file */
  updateFile: (fileId: string, updates: Partial<StoredDocument>) => void;
  /** Move file to a folder */
  moveToFolder: (fileId: string, folderId: string | null) => void;
  /** Move multiple files to a folder */
  moveFilesToFolder: (fileIds: string[], folderId: string | null) => void;
  /** Toggle file favorite status */
  toggleFavorite: (fileId: string) => void;
  /** Add tags to a file */
  addTags: (fileId: string, tags: string[]) => void;
  /** Remove tags from a file */
  removeTags: (fileId: string, tags: string[]) => void;
  /** Add a folder */
  addFolder: (folder: DocumentFolder) => void;
  /** Remove a folder */
  removeFolder: (folderId: string) => void;
  /** Update a folder */
  updateFolder: (folderId: string, updates: Partial<DocumentFolder>) => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Set sort options */
  setSortBy: (sortBy: SortBy, direction?: SortDirection) => void;
  /** Set filter options */
  setFilter: (filter: Partial<FileFilter>) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Select a file */
  selectFile: (fileId: string) => void;
  /** Deselect a file */
  deselectFile: (fileId: string) => void;
  /** Toggle file selection */
  toggleFileSelection: (fileId: string) => void;
  /** Select all files */
  selectAllFiles: () => void;
  /** Clear file selection */
  clearSelection: () => void;
  /** Set current folder */
  setCurrentFolder: (folderId: string | null) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all files */
  clearFiles: () => void;
}

/**
 * Combined file store type
 */
export type FileStore = FileState & FileActions;

/**
 * Initial state for the file store
 */
const initialState: FileState = {
  files: [],
  folders: [],
  viewMode: 'grid',
  sortBy: 'updatedAt',
  sortDirection: 'desc',
  filter: {},
  selectedFileIds: [],
  currentFolderId: null,
  isLoading: false,
  error: null,
};

/**
 * File management store
 * Manages stored documents, folders, and file organization
 */
export const useFileStore = create<FileStore>()(
  immer((set, get) => ({
    ...initialState,

    hydrateLibrary: (files, folders) => {
      set((state) => {
        state.files = files;
        state.folders = folders;
        state.selectedFileIds = state.selectedFileIds.filter((id) =>
          files.some((file) => file.id === id)
        );
        state.isLoading = false;
        state.error = null;
      });
    },

    addFile: (file: StoredDocument) => {
      set((state) => {
        const exists = state.files.some((f) => f.id === file.id);
        if (!exists) {
          state.files.push(file);
          // Update folder document count if file is in a folder
          if (file.folderId) {
            const folderIndex = state.folders.findIndex((f) => f.id === file.folderId);
            if (folderIndex !== -1) {
              state.folders[folderIndex].documentCount += 1;
            }
          }
        }
      });
    },

    addFiles: (files: StoredDocument[]) => {
      set((state) => {
        for (const file of files) {
          const exists = state.files.some((f) => f.id === file.id);
          if (!exists) {
            state.files.push(file);
            if (file.folderId) {
              const folderIndex = state.folders.findIndex((f) => f.id === file.folderId);
              if (folderIndex !== -1) {
                state.folders[folderIndex].documentCount += 1;
              }
            }
          }
        }
      });
    },

    removeFile: (fileId: string) => {
      set((state) => {
        const file = state.files.find((f) => f.id === fileId);
        if (file) {
          // Update folder document count
          if (file.folderId) {
            const folderIndex = state.folders.findIndex((f) => f.id === file.folderId);
            if (folderIndex !== -1) {
              state.folders[folderIndex].documentCount = Math.max(
                0,
                state.folders[folderIndex].documentCount - 1
              );
            }
          }
          state.files = state.files.filter((f) => f.id !== fileId);
          state.selectedFileIds = state.selectedFileIds.filter((id) => id !== fileId);
        }
      });
    },

    removeFiles: (fileIds: string[]) => {
      set((state) => {
        for (const fileId of fileIds) {
          const file = state.files.find((f) => f.id === fileId);
          if (file?.folderId) {
            const folderIndex = state.folders.findIndex((f) => f.id === file.folderId);
            if (folderIndex !== -1) {
              state.folders[folderIndex].documentCount = Math.max(
                0,
                state.folders[folderIndex].documentCount - 1
              );
            }
          }
        }
        state.files = state.files.filter((f) => !fileIds.includes(f.id));
        state.selectedFileIds = state.selectedFileIds.filter((id) => !fileIds.includes(id));
      });
    },

    updateFile: (fileId: string, updates: Partial<StoredDocument>) => {
      set((state) => {
        const index = state.files.findIndex((f) => f.id === fileId);
        if (index !== -1) {
          state.files[index] = {
            ...state.files[index],
            ...updates,
            updatedAt: new Date(),
          };
        }
      });
    },

    moveToFolder: (fileId: string, folderId: string | null) => {
      set((state) => {
        const fileIndex = state.files.findIndex((f) => f.id === fileId);
        if (fileIndex !== -1) {
          const file = state.files[fileIndex];
          const oldFolderId = file.folderId;

          // Update old folder count
          if (oldFolderId) {
            const oldFolderIndex = state.folders.findIndex((f) => f.id === oldFolderId);
            if (oldFolderIndex !== -1) {
              state.folders[oldFolderIndex].documentCount = Math.max(
                0,
                state.folders[oldFolderIndex].documentCount - 1
              );
            }
          }

          // Update new folder count
          if (folderId) {
            const newFolderIndex = state.folders.findIndex((f) => f.id === folderId);
            if (newFolderIndex !== -1) {
              state.folders[newFolderIndex].documentCount += 1;
            }
          }

          state.files[fileIndex].folderId = folderId ?? undefined;
          state.files[fileIndex].updatedAt = new Date();
        }
      });
    },

    moveFilesToFolder: (fileIds: string[], folderId: string | null) => {
      const { moveToFolder } = get();
      for (const fileId of fileIds) {
        moveToFolder(fileId, folderId);
      }
    },

    toggleFavorite: (fileId: string) => {
      set((state) => {
        const index = state.files.findIndex((f) => f.id === fileId);
        if (index !== -1) {
          state.files[index].isFavorite = !state.files[index].isFavorite;
          state.files[index].updatedAt = new Date();
        }
      });
    },

    addTags: (fileId: string, tags: string[]) => {
      set((state) => {
        const index = state.files.findIndex((f) => f.id === fileId);
        if (index !== -1) {
          const existingTags = state.files[index].tags ?? [];
          const newTags = [...new Set([...existingTags, ...tags])];
          state.files[index].tags = newTags;
          state.files[index].updatedAt = new Date();
        }
      });
    },

    removeTags: (fileId: string, tags: string[]) => {
      set((state) => {
        const index = state.files.findIndex((f) => f.id === fileId);
        if (index !== -1 && state.files[index].tags) {
          state.files[index].tags = state.files[index].tags?.filter(
            (tag) => !tags.includes(tag)
          );
          state.files[index].updatedAt = new Date();
        }
      });
    },

    addFolder: (folder: DocumentFolder) => {
      set((state) => {
        const exists = state.folders.some((f) => f.id === folder.id);
        if (!exists) {
          state.folders.push(folder);
        }
      });
    },

    removeFolder: (folderId: string) => {
      set((state) => {
        // Move all files in folder to root
        for (const file of state.files) {
          if (file.folderId === folderId) {
            file.folderId = undefined;
          }
        }
        state.folders = state.folders.filter((f) => f.id !== folderId);
        if (state.currentFolderId === folderId) {
          state.currentFolderId = null;
        }
      });
    },

    updateFolder: (folderId: string, updates: Partial<DocumentFolder>) => {
      set((state) => {
        const index = state.folders.findIndex((f) => f.id === folderId);
        if (index !== -1) {
          state.folders[index] = {
            ...state.folders[index],
            ...updates,
            updatedAt: new Date(),
          };
        }
      });
    },

    setViewMode: (mode: ViewMode) => {
      set((state) => {
        state.viewMode = mode;
      });
    },

    setSortBy: (sortBy: SortBy, direction?: SortDirection) => {
      set((state) => {
        state.sortBy = sortBy;
        if (direction) {
          state.sortDirection = direction;
        }
      });
    },

    setFilter: (filter: Partial<FileFilter>) => {
      set((state) => {
        state.filter = { ...state.filter, ...filter };
      });
    },

    clearFilters: () => {
      set((state) => {
        state.filter = {};
      });
    },

    selectFile: (fileId: string) => {
      set((state) => {
        if (!state.selectedFileIds.includes(fileId)) {
          state.selectedFileIds.push(fileId);
        }
      });
    },

    deselectFile: (fileId: string) => {
      set((state) => {
        state.selectedFileIds = state.selectedFileIds.filter((id) => id !== fileId);
      });
    },

    toggleFileSelection: (fileId: string) => {
      set((state) => {
        if (state.selectedFileIds.includes(fileId)) {
          state.selectedFileIds = state.selectedFileIds.filter((id) => id !== fileId);
        } else {
          state.selectedFileIds.push(fileId);
        }
      });
    },

    selectAllFiles: () => {
      set((state) => {
        state.selectedFileIds = state.files.map((f) => f.id);
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedFileIds = [];
      });
    },

    setCurrentFolder: (folderId: string | null) => {
      set((state) => {
        state.currentFolderId = folderId;
      });
    },

    setLoading: (isLoading: boolean) => {
      set((state) => {
        state.isLoading = isLoading;
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
      });
    },

    clearFiles: () => {
      set((state) => {
        state.files = [];
        state.selectedFileIds = [];
        state.error = null;
      });
    },
  }))
);

/**
 * Selector: Get filtered and sorted files
 */
export const selectFilteredFiles = (state: FileStore): StoredDocument[] => {
  let files = [...state.files];

  // Apply filters
  const { status, folderId, tags, favoritesOnly, searchQuery } = state.filter;

  if (status) {
    files = files.filter((f) => f.status === status);
  }

  if (folderId !== undefined) {
    files = files.filter((f) => (f.folderId ?? null) === folderId);
  }

  if (tags && tags.length > 0) {
    files = files.filter((f) => tags.some((tag) => f.tags?.includes(tag)));
  }

  if (favoritesOnly) {
    files = files.filter((f) => f.isFavorite);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    files = files.filter(
      (f) =>
        f.filename.toLowerCase().includes(query) ||
        f.metadata.title?.toLowerCase().includes(query) ||
        f.fullText?.toLowerCase().includes(query)
    );
  }

  // Apply sorting
  const { sortBy, sortDirection } = state;
  files.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'filename':
        comparison = a.filename.localeCompare(b.filename);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'fileSize':
        comparison = a.fileSize - b.fileSize;
        break;
      case 'pageCount':
        comparison = a.pageCount - b.pageCount;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return files;
};

/**
 * Selector: Get files in current folder
 */
export const selectFilesInCurrentFolder = (state: FileStore): StoredDocument[] => {
  return state.files.filter((f) => (f.folderId ?? null) === state.currentFolderId);
};

/**
 * Selector: Get file by ID
 */
export const selectFileById = (fileId: string) => (state: FileStore) =>
  state.files.find((f) => f.id === fileId);

/**
 * Selector: Get selected files
 */
export const selectSelectedFiles = (state: FileStore): StoredDocument[] =>
  state.files.filter((f) => state.selectedFileIds.includes(f.id));

/**
 * Selector: Get folder by ID
 */
export const selectFolderById = (folderId: string) => (state: FileStore) =>
  state.folders.find((f) => f.id === folderId);

/**
 * Selector: Get root level folders
 */
export const selectRootFolders = (state: FileStore): DocumentFolder[] =>
  state.folders.filter((f) => !f.parentId);

/**
 * Selector: Get child folders
 */
export const selectChildFolders = (parentId: string) => (state: FileStore) =>
  state.folders.filter((f) => f.parentId === parentId);
