import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import {
  MergePage,
  SplitPage,
  CompressPage,
  ConvertPage,
  Dashboard,
  SecurityPage,
  WatermarkPage,
  SignaturePage,
  ChatPage,
  EditorPage,
  SettingsPage,
  SearchReplacePage,
  BatchPage,
  ExtractImagesPage,
  ExtractTablesPage,
  PageNumbersPage,
  CropResizePage,
  ComparePage,
  TOCPage,
  FormDetectionPage,
  ClassifyPage,
  HistoryPage,
  KeyInfoPage,
} from '@/pages';
import {
  InstallPrompt,
  UpdateNotification,
  OfflineIndicator,
} from '@/components/pwa';
import { useOperationHistory } from '@/hooks/useOperationHistory';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Global keyboard shortcut handler for undo/redo
 * Wraps the app to provide Ctrl+Z/Y shortcuts
 */
function GlobalKeyboardHandler({ children }: { children: React.ReactNode }) {
  const { undoLastOperation, redoLastOperation, canUndo, canRedo } = useOperationHistory({
    showToasts: true,
    enableKeyboardShortcuts: false, // We handle shortcuts manually below for better control
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Ctrl+Z for undo
      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          undoLastOperation();
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if (
        isCtrlOrCmd &&
        (event.key === 'y' || (event.key === 'z' && event.shiftKey))
      ) {
        if (canRedo) {
          event.preventDefault();
          redoLastOperation();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastOperation, redoLastOperation, canUndo, canRedo]);

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* PWA Components */}
        <OfflineIndicator variant="toast" position="bottom" showOnlineNotification />
        <UpdateNotification position="bottom" />
        <InstallPrompt variant="banner" showDelay={5000} />

        {/* Global Keyboard Handler for Undo/Redo */}
        <GlobalKeyboardHandler>
          {/* Routes */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/merge" element={<MergePage />} />
            <Route path="/split" element={<SplitPage />} />
            <Route path="/compress" element={<CompressPage />} />
            <Route path="/convert" element={<ConvertPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/watermark" element={<WatermarkPage />} />
            <Route path="/signature" element={<SignaturePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchReplacePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/extract-images" element={<ExtractImagesPage />} />
            <Route path="/extract-tables" element={<ExtractTablesPage />} />
            <Route path="/page-numbers" element={<PageNumbersPage />} />
            <Route path="/crop-resize" element={<CropResizePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/toc" element={<TOCPage />} />
            <Route path="/form-detection" element={<FormDetectionPage />} />
            <Route path="/classify" element={<ClassifyPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/key-info" element={<KeyInfoPage />} />
          </Routes>
        </GlobalKeyboardHandler>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
