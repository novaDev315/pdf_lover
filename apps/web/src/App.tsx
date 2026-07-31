import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Dashboard } from "@/pages/Dashboard";
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
import { ToolHeader } from "@/components/layout/ToolHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalBatchQueue } from "@/components/batch/GlobalBatchQueue";

const MergePage = lazy(() => import("@/pages/MergePage").then(({ MergePage }) => ({ default: MergePage })));
const SplitPage = lazy(() => import("@/pages/SplitPage").then(({ SplitPage }) => ({ default: SplitPage })));
const CompressPage = lazy(() => import("@/pages/CompressPage").then(({ CompressPage }) => ({ default: CompressPage })));
const ConvertPage = lazy(() => import("@/pages/ConvertPage").then(({ ConvertPage }) => ({ default: ConvertPage })));
const SecurityPage = lazy(() => import("@/pages/SecurityPage").then(({ SecurityPage }) => ({ default: SecurityPage })));
const WatermarkPage = lazy(() => import("@/pages/WatermarkPage").then(({ WatermarkPage }) => ({ default: WatermarkPage })));
const SignaturePage = lazy(() => import("@/pages/SignaturePage").then(({ SignaturePage }) => ({ default: SignaturePage })));
const ChatPage = lazy(() => import("@/pages/ChatPage").then(({ ChatPage }) => ({ default: ChatPage })));
const EditorPage = lazy(() => import("@/pages/EditorPage").then(({ EditorPage }) => ({ default: EditorPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(({ SettingsPage }) => ({ default: SettingsPage })));
const SearchReplacePage = lazy(() => import("@/pages/SearchReplacePage").then(({ SearchReplacePage }) => ({ default: SearchReplacePage })));
const BatchPage = lazy(() => import("@/pages/BatchPage").then(({ BatchPage }) => ({ default: BatchPage })));
const ExtractImagesPage = lazy(() => import("@/pages/ExtractImagesPage").then(({ ExtractImagesPage }) => ({ default: ExtractImagesPage })));
const ExtractTablesPage = lazy(() => import("@/pages/ExtractTablesPage").then(({ ExtractTablesPage }) => ({ default: ExtractTablesPage })));
const PageNumbersPage = lazy(() => import("@/pages/PageNumbersPage").then(({ PageNumbersPage }) => ({ default: PageNumbersPage })));
const CropResizePage = lazy(() => import("@/pages/CropResizePage").then(({ CropResizePage }) => ({ default: CropResizePage })));
const ComparePage = lazy(() => import("@/pages/ComparePage").then(({ ComparePage }) => ({ default: ComparePage })));
const TOCPage = lazy(() => import("@/pages/TOCPage").then(({ TOCPage }) => ({ default: TOCPage })));
const FormDetectionPage = lazy(() => import("@/pages/FormDetectionPage").then(({ FormDetectionPage }) => ({ default: FormDetectionPage })));
const ClassifyPage = lazy(() => import("@/pages/ClassifyPage").then(({ ClassifyPage }) => ({ default: ClassifyPage })));
const HistoryPage = lazy(() => import("@/pages/HistoryPage").then(({ HistoryPage }) => ({ default: HistoryPage })));
const KeyInfoPage = lazy(() => import("@/pages/KeyInfoPage").then(({ KeyInfoPage }) => ({ default: KeyInfoPage })));
const FilesPage = lazy(() => import("@/pages/FilesPage").then(({ FilesPage }) => ({ default: FilesPage })));

function RouteLoading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center bg-surface-50 px-6 dark:bg-surface-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-surface-600 dark:text-surface-300">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading workspace…
      </div>
    </div>
  );
}

function ToolPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-50 dark:bg-surface-950 [&>div]:min-h-[calc(100vh-4rem)]">
      <ToolHeader title={title} />
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
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
          <GlobalBatchQueue />
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
              <Route path="/merge" element={<ToolPage title="Merge PDF"><MergePage /></ToolPage>} />
              <Route path="/split" element={<ToolPage title="Split PDF"><SplitPage /></ToolPage>} />
              <Route path="/compress" element={<ToolPage title="Compress PDF"><CompressPage /></ToolPage>} />
              <Route path="/convert" element={<ToolPage title="Convert PDF"><ConvertPage /></ToolPage>} />
              <Route path="/security" element={<ToolPage title="Protect PDF"><SecurityPage /></ToolPage>} />
              <Route path="/watermark" element={<ToolPage title="Add Watermark"><WatermarkPage /></ToolPage>} />
              <Route path="/signature" element={<ToolPage title="Sign PDF"><SignaturePage /></ToolPage>} />
              <Route path="/chat" element={<ToolPage title="Chat with PDF"><ChatPage /></ToolPage>} />
              <Route path="/editor" element={<ToolPage title="PDF Editor"><EditorPage /></ToolPage>} />
              <Route path="/settings" element={<ToolPage title="Settings"><SettingsPage /></ToolPage>} />
              <Route path="/search" element={<ToolPage title="Search & Overlay"><SearchReplacePage /></ToolPage>} />
              <Route path="/batch" element={<ToolPage title="Batch Operations"><BatchPage /></ToolPage>} />
              <Route path="/extract-images" element={<ToolPage title="Extract Images"><ExtractImagesPage /></ToolPage>} />
              <Route path="/extract-tables" element={<ToolPage title="Extract Tables"><ExtractTablesPage /></ToolPage>} />
              <Route path="/page-numbers" element={<ToolPage title="Page Numbers & Headers"><PageNumbersPage /></ToolPage>} />
              <Route path="/crop-resize" element={<ToolPage title="Crop, Resize & Trim"><CropResizePage /></ToolPage>} />
              <Route path="/compare" element={<ToolPage title="Compare PDFs"><ComparePage /></ToolPage>} />
              <Route path="/toc" element={<ToolPage title="Table of Contents"><TOCPage /></ToolPage>} />
              <Route path="/form-detection" element={<ToolPage title="Detect Form Fields"><FormDetectionPage /></ToolPage>} />
              <Route path="/classify" element={<ToolPage title="Classify Document"><ClassifyPage /></ToolPage>} />
              <Route path="/history" element={<ToolPage title="History"><HistoryPage /></ToolPage>} />
              <Route path="/key-info" element={<ToolPage title="Extract Key Information"><KeyInfoPage /></ToolPage>} />
              <Route path="/files" element={<ToolPage title="Library"><FilesPage /></ToolPage>} />
            </Routes>
          </GlobalKeyboardHandler>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
