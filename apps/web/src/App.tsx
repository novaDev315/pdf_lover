import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

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
} from '@/pages';
import {
  InstallPrompt,
  UpdateNotification,
  OfflineIndicator,
} from '@/components/pwa';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
      <div className="text-center">
        <FileText className="h-16 w-16 text-surface-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-surface-600 dark:text-surface-400 mb-4">
          This feature is coming soon.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* PWA Components */}
      <OfflineIndicator variant="toast" position="bottom" showOnlineNotification />
      <UpdateNotification position="bottom" />
      <InstallPrompt variant="banner" showDelay={5000} />

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
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
