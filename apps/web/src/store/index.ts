/**
 * PDFLover Store Exports
 * Centralized export for all Zustand stores
 */

// PDF Store
export {
  usePDFStore,
  selectDocumentById,
  selectPagesForDocument,
  selectTotalPageCount,
  selectAllSelectedPages,
} from './pdf-store';
export type { PDFState, PDFActions, PDFStore, PageSelection } from './pdf-store';

// File Store
export {
  useFileStore,
  selectFilteredFiles,
  selectFilesInCurrentFolder,
  selectFileById,
  selectSelectedFiles,
  selectFolderById,
  selectRootFolders,
  selectChildFolders,
} from './file-store';
export type {
  FileState,
  FileActions,
  FileStore,
  ViewMode,
  SortBy,
  SortDirection,
  FileFilter,
} from './file-store';

// Settings Store
export {
  useSettingsStore,
  selectEffectiveTheme,
  selectHasApiKey,
  selectCurrentModelId,
  selectCloudEnabled,
} from './settings-store';
export type {
  SettingsState,
  SettingsActions,
  SettingsStore,
  Theme,
  ViewerSettings,
  AISettings,
  ProcessingSettings,
  PrivacySettings,
} from './settings-store';

// Chat Store
export {
  useChatStore,
  selectConversationById,
  selectRecentConversations,
  selectConversationsForDocument,
  selectMessageCount,
  selectHasMessages,
  selectLastMessage,
  selectUserMessages,
  selectAssistantMessages,
} from './chat-store';
export type {
  ChatState,
  ChatActions,
  ChatStore,
  CreateConversationOptions,
  AddMessageOptions,
} from './chat-store';

// UI Store
export {
  useUIStore,
  selectUnreadNotificationCount,
  selectNotificationsBySeverity,
  selectIsModalOpen,
  selectZoomDecimal,
  selectIsZoomMin,
  selectIsZoomMax,
  selectErrorNotifications,
  selectHasOpenPanel,
} from './ui-store';
export type {
  UIState,
  UIActions,
  UIStore,
  Notification,
  NotificationSeverity,
  PDFTool,
  ModalType,
  AddNotificationOptions,
} from './ui-store';

// Annotation Store
export {
  useAnnotationStore,
  selectSelectedAnnotation,
  selectAnnotationCount,
  selectAnnotationsByType,
  selectIsToolActive,
  selectUndoCount,
  selectRedoCount,
} from './annotation-store';
export type {
  AnnotationState,
  AnnotationActions,
  AnnotationStore,
  Rect,
  Point,
  Color,
  AnnotationType,
  AnnotationTool,
  BaseAnnotation,
  HighlightAnnotation,
  UnderlineAnnotation,
  StrikethroughAnnotation,
  TextAnnotation,
  NoteAnnotation,
  FreehandAnnotation,
  ShapeAnnotation,
  LineAnnotation,
  ArrowAnnotation,
  ImageAnnotation,
  TextFieldAnnotation,
  CheckboxAnnotation,
  RedactionAnnotation,
  Annotation,
  HistoryEntry,
  ToolOptions,
} from './annotation-store';
