import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
  FilesPage,
} from "@/pages";
import {
  InstallPrompt,
  UpdateNotification,
  OfflineIndicator,
} from "@/components/pwa";
import { useOperationHistory } from "@/hooks/useOperationHistory";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LibraryHydrator } from "@/components/LibraryHydrator";
import { PwaFileReceiver } from "@/components/PwaFileReceiver";
import { SettingsEffects } from "@/components/layout/SettingsEffects";
import { AppFooter } from "@/components/layout/AppFooter";
import { TooltipProvider } from "@/components/ui/tooltip";

function ToolPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-950">
      {children}
      <AppFooter />
    </div>
  );
}

/**
 * Global keyboard shortcut handler for undo/redo
 * Wraps the app to provide Ctrl+Z/Y shortcuts
 */
function GlobalKeyboardHandler({ children }: { children: React.ReactNode }) {
  const { undoLastOperation, redoLastOperation, canUndo, canRedo } =
    useOperationHistory({
      showToasts: true,
      enableKeyboardShortcuts: false, // We handle shortcuts manually below for better control
    });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Ctrl+Z for undo
      if (isCtrlOrCmd && event.key === "z" && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          undoLastOperation();
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if (
        isCtrlOrCmd &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        if (canRedo) {
          event.preventDefault();
          redoLastOperation();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoLastOperation, redoLastOperation, canUndo, canRedo]);

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsEffects />
      <TooltipProvider>
        <BrowserRouter>
          <LibraryHydrator />
          <PwaFileReceiver />
          {/* PWA Components */}
          <OfflineIndicator
            variant="toast"
            position="bottom"
            showOnlineNotification
          />
          <UpdateNotification position="bottom" />
          <InstallPrompt variant="banner" showDelay={5000} />

          {/* Global Keyboard Handler for Undo/Redo */}
          <GlobalKeyboardHandler>
            {/* Routes */}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/merge" element={<ToolPage><MergePage /></ToolPage>} />
              <Route path="/split" element={<ToolPage><SplitPage /></ToolPage>} />
              <Route path="/compress" element={<ToolPage><CompressPage /></ToolPage>} />
              <Route path="/convert" element={<ToolPage><ConvertPage /></ToolPage>} />
              <Route path="/security" element={<ToolPage><SecurityPage /></ToolPage>} />
              <Route path="/watermark" element={<ToolPage><WatermarkPage /></ToolPage>} />
              <Route path="/signature" element={<ToolPage><SignaturePage /></ToolPage>} />
              <Route path="/chat" element={<ToolPage><ChatPage /></ToolPage>} />
              <Route path="/editor" element={<ToolPage><EditorPage /></ToolPage>} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/search" element={<ToolPage><SearchReplacePage /></ToolPage>} />
              <Route path="/batch" element={<ToolPage><BatchPage /></ToolPage>} />
              <Route path="/extract-images" element={<ToolPage><ExtractImagesPage /></ToolPage>} />
              <Route path="/extract-tables" element={<ToolPage><ExtractTablesPage /></ToolPage>} />
              <Route path="/page-numbers" element={<ToolPage><PageNumbersPage /></ToolPage>} />
              <Route path="/crop-resize" element={<ToolPage><CropResizePage /></ToolPage>} />
              <Route path="/compare" element={<ToolPage><ComparePage /></ToolPage>} />
              <Route path="/toc" element={<ToolPage><TOCPage /></ToolPage>} />
              <Route path="/form-detection" element={<ToolPage><FormDetectionPage /></ToolPage>} />
              <Route path="/classify" element={<ToolPage><ClassifyPage /></ToolPage>} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/key-info" element={<ToolPage><KeyInfoPage /></ToolPage>} />
              <Route path="/files" element={<FilesPage />} />
            </Routes>
          </GlobalKeyboardHandler>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
