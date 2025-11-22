/**
 * UI State Management
 * Manages UI-related state like sidebar visibility, tool selection, and notifications
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification interface
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification title */
  title: string;
  /** Notification message */
  message?: string;
  /** Severity level */
  severity: NotificationSeverity;
  /** Auto-dismiss duration in milliseconds (null = no auto-dismiss) */
  duration: number | null;
  /** Timestamp when notification was created */
  timestamp: Date;
  /** Whether notification has been read/dismissed */
  isRead: boolean;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Available PDF tools
 */
export type PDFTool =
  | 'merge'
  | 'split'
  | 'compress'
  | 'convert'
  | 'rotate'
  | 'watermark'
  | 'protect'
  | 'unlock'
  | 'ocr'
  | 'sign'
  | 'redact'
  | null;

/**
 * Modal types
 */
export type ModalType =
  | 'settings'
  | 'about'
  | 'shortcuts'
  | 'export'
  | 'import'
  | 'deleteConfirm'
  | 'apiKey'
  | 'feedback'
  | null;

/**
 * UI store state interface
 */
export interface UIState {
  /** Whether sidebar is open */
  sidebarOpen: boolean;
  /** Whether chat panel is open */
  chatPanelOpen: boolean;
  /** Currently selected tool */
  currentTool: PDFTool;
  /** Active notifications */
  notifications: Notification[];
  /** Currently open modal */
  activeModal: ModalType;
  /** Modal data (context-specific) */
  modalData: Record<string, unknown> | null;
  /** Whether app is in fullscreen mode */
  isFullscreen: boolean;
  /** Whether drag operation is in progress */
  isDragging: boolean;
  /** Current drag data */
  dragData: unknown | null;
  /** Whether keyboard shortcuts overlay is visible */
  showShortcuts: boolean;
  /** Search query (global search) */
  searchQuery: string;
  /** Whether search is focused */
  isSearchFocused: boolean;
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Chat panel width in pixels */
  chatPanelWidth: number;
  /** Whether to show page thumbnails in viewer */
  showThumbnailsSidebar: boolean;
  /** Current zoom level percentage */
  zoomLevel: number;
}

/**
 * Options for creating a notification
 */
export interface AddNotificationOptions {
  title: string;
  message?: string;
  severity?: NotificationSeverity;
  duration?: number | null;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * UI store actions interface
 */
export interface UIActions {
  /** Toggle sidebar visibility */
  toggleSidebar: () => void;
  /** Set sidebar visibility */
  setSidebarOpen: (open: boolean) => void;
  /** Toggle chat panel visibility */
  toggleChatPanel: () => void;
  /** Set chat panel visibility */
  setChatPanelOpen: (open: boolean) => void;
  /** Set current tool */
  setCurrentTool: (tool: PDFTool) => void;
  /** Add a notification */
  addNotification: (options: AddNotificationOptions) => string;
  /** Remove a notification */
  removeNotification: (id: string) => void;
  /** Mark notification as read */
  markNotificationRead: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Open a modal */
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  /** Close current modal */
  closeModal: () => void;
  /** Toggle fullscreen mode */
  toggleFullscreen: () => void;
  /** Set fullscreen mode */
  setFullscreen: (isFullscreen: boolean) => void;
  /** Start drag operation */
  startDrag: (data: unknown) => void;
  /** End drag operation */
  endDrag: () => void;
  /** Toggle shortcuts overlay */
  toggleShortcuts: () => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set search focused state */
  setSearchFocused: (focused: boolean) => void;
  /** Set sidebar width */
  setSidebarWidth: (width: number) => void;
  /** Set chat panel width */
  setChatPanelWidth: (width: number) => void;
  /** Toggle thumbnails sidebar */
  toggleThumbnailsSidebar: () => void;
  /** Set zoom level */
  setZoomLevel: (level: number) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Reset zoom */
  resetZoom: () => void;
}

/**
 * Combined UI store type
 */
export type UIStore = UIState & UIActions;

/**
 * Generate unique ID for notifications
 */
const generateNotificationId = (): string => {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Default notification duration in milliseconds
 */
const DEFAULT_NOTIFICATION_DURATION = 5000;

/**
 * Zoom step percentage
 */
const ZOOM_STEP = 25;

/**
 * Zoom limits
 */
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;

/**
 * Initial state for the UI store
 */
const initialState: UIState = {
  sidebarOpen: true,
  chatPanelOpen: false,
  currentTool: null,
  notifications: [],
  activeModal: null,
  modalData: null,
  isFullscreen: false,
  isDragging: false,
  dragData: null,
  showShortcuts: false,
  searchQuery: '',
  isSearchFocused: false,
  sidebarWidth: 280,
  chatPanelWidth: 400,
  showThumbnailsSidebar: true,
  zoomLevel: 100,
};

/**
 * UI state store
 * Manages sidebar, chat panel, tools, notifications, and other UI state
 */
export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    ...initialState,

    toggleSidebar: () => {
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      });
    },

    setSidebarOpen: (open: boolean) => {
      set((state) => {
        state.sidebarOpen = open;
      });
    },

    toggleChatPanel: () => {
      set((state) => {
        state.chatPanelOpen = !state.chatPanelOpen;
      });
    },

    setChatPanelOpen: (open: boolean) => {
      set((state) => {
        state.chatPanelOpen = open;
      });
    },

    setCurrentTool: (tool: PDFTool) => {
      set((state) => {
        state.currentTool = tool;
      });
    },

    addNotification: (options: AddNotificationOptions): string => {
      const id = generateNotificationId();
      const notification: Notification = {
        id,
        title: options.title,
        message: options.message,
        severity: options.severity ?? 'info',
        duration: options.duration === undefined ? DEFAULT_NOTIFICATION_DURATION : options.duration,
        timestamp: new Date(),
        isRead: false,
        action: options.action,
      };

      set((state) => {
        state.notifications.push(notification);
      });

      // Auto-dismiss if duration is set
      if (notification.duration !== null) {
        setTimeout(() => {
          get().removeNotification(id);
        }, notification.duration);
      }

      return id;
    },

    removeNotification: (id: string) => {
      set((state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id);
      });
    },

    markNotificationRead: (id: string) => {
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        if (notification) {
          notification.isRead = true;
        }
      });
    },

    clearNotifications: () => {
      set((state) => {
        state.notifications = [];
      });
    },

    openModal: (modal: ModalType, data?: Record<string, unknown>) => {
      set((state) => {
        state.activeModal = modal;
        state.modalData = data ?? null;
      });
    },

    closeModal: () => {
      set((state) => {
        state.activeModal = null;
        state.modalData = null;
      });
    },

    toggleFullscreen: () => {
      set((state) => {
        state.isFullscreen = !state.isFullscreen;
      });
    },

    setFullscreen: (isFullscreen: boolean) => {
      set((state) => {
        state.isFullscreen = isFullscreen;
      });
    },

    startDrag: (data: unknown) => {
      set((state) => {
        state.isDragging = true;
        state.dragData = data;
      });
    },

    endDrag: () => {
      set((state) => {
        state.isDragging = false;
        state.dragData = null;
      });
    },

    toggleShortcuts: () => {
      set((state) => {
        state.showShortcuts = !state.showShortcuts;
      });
    },

    setSearchQuery: (query: string) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    setSearchFocused: (focused: boolean) => {
      set((state) => {
        state.isSearchFocused = focused;
      });
    },

    setSidebarWidth: (width: number) => {
      set((state) => {
        state.sidebarWidth = Math.max(200, Math.min(500, width));
      });
    },

    setChatPanelWidth: (width: number) => {
      set((state) => {
        state.chatPanelWidth = Math.max(300, Math.min(600, width));
      });
    },

    toggleThumbnailsSidebar: () => {
      set((state) => {
        state.showThumbnailsSidebar = !state.showThumbnailsSidebar;
      });
    },

    setZoomLevel: (level: number) => {
      set((state) => {
        state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
      });
    },

    zoomIn: () => {
      set((state) => {
        state.zoomLevel = Math.min(MAX_ZOOM, state.zoomLevel + ZOOM_STEP);
      });
    },

    zoomOut: () => {
      set((state) => {
        state.zoomLevel = Math.max(MIN_ZOOM, state.zoomLevel - ZOOM_STEP);
      });
    },

    resetZoom: () => {
      set((state) => {
        state.zoomLevel = 100;
      });
    },
  }))
);

/**
 * Selector: Get unread notification count
 */
export const selectUnreadNotificationCount = (state: UIStore): number =>
  state.notifications.filter((n) => !n.isRead).length;

/**
 * Selector: Get notifications by severity
 */
export const selectNotificationsBySeverity =
  (severity: NotificationSeverity) => (state: UIStore) =>
    state.notifications.filter((n) => n.severity === severity);

/**
 * Selector: Check if a modal is open
 */
export const selectIsModalOpen = (modal: ModalType) => (state: UIStore) =>
  state.activeModal === modal;

/**
 * Selector: Get zoom level as decimal (for CSS transforms)
 */
export const selectZoomDecimal = (state: UIStore): number => state.zoomLevel / 100;

/**
 * Selector: Check if zoom is at minimum
 */
export const selectIsZoomMin = (state: UIStore): boolean => state.zoomLevel <= MIN_ZOOM;

/**
 * Selector: Check if zoom is at maximum
 */
export const selectIsZoomMax = (state: UIStore): boolean => state.zoomLevel >= MAX_ZOOM;

/**
 * Selector: Get error notifications
 */
export const selectErrorNotifications = (state: UIStore): Notification[] =>
  state.notifications.filter((n) => n.severity === 'error');

/**
 * Selector: Check if any panel is open
 */
export const selectHasOpenPanel = (state: UIStore): boolean =>
  state.sidebarOpen || state.chatPanelOpen;
