import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  AlertCircle,
  X,
  Moon,
  Sun,
  Keyboard,
  Info,
  FileInput,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FileUpload } from '@/components/pdf/FileUpload';
import { PageGrid } from '@/components/pdf/PageGrid';
import { Toolbar } from '@/components/pdf/Toolbar';
import { AnnotationEditor } from '@/components/annotations/AnnotationEditor';
import { MetadataEditor } from '@/components/pdf/MetadataEditor';
import { FormFiller } from '@/components/pdf/FormFiller';
import { KeyboardShortcutsHelp } from '@/components/pdf/KeyboardShortcutsHelp';
import { Progress } from '@/components/ui/progress';
import { usePDFStore } from '@/store/pdfStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';

function App() {
  const { document, error, setError, clearDocument, setZoom, zoom, isLoading } = usePDFStore();
  const { isDark, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [annotatingPage, setAnnotatingPage] = useState<number | null>(null);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [showFormFiller, setShowFormFiller] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Success toast
  const [showSuccess, setShowSuccess] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !annotatingPage && !showMetadataEditor && !showFormFiller,
    onAnnotate: () => {
      const { selectedPages } = usePDFStore.getState();
      if (selectedPages.size > 0) {
        setAnnotatingPage(Math.min(...Array.from(selectedPages)));
      }
    },
    onRotate: async () => {
      const { document, selectedPages, setLoading, setError, updateThumbnails } =
        usePDFStore.getState();
      if (!document || selectedPages.size === 0) return;

      setLoading(true);
      try {
        const pages = Array.from(selectedPages);
        const response = await api.rotatePages(document.fileId, pages, 90);
        if (response.success && response.thumbnail_urls) {
          updateThumbnails(response.thumbnail_urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rotate pages');
      } finally {
        setLoading(false);
      }
    },
  });

  // Touch gestures for zoom
  useTouchGestures(containerRef, {
    enabled: !!document,
    onPinchZoom: (scale) => {
      setZoom(Math.round(scale * 100));
    },
    onDoubleTap: () => {
      setZoom(zoom === 100 ? 150 : 100);
    },
  });

  // Listen for ? key to show keyboard help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  const handleAnnotatePage = (pageNumber: number) => {
    setAnnotatingPage(pageNumber);
  };

  const handleCloseAnnotation = () => {
    setAnnotatingPage(null);
  };

  const handleUploadComplete = () => {
    setUploadProgress(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <TooltipProvider>
      <div ref={containerRef} className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold leading-none">PDF Buddy</h1>
                <p className="text-xs text-muted-foreground">
                  Edit PDFs with ease
                </p>
              </div>
            </div>

            {/* Center - Document info */}
            {document && (
              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {document.originalName}
                </span>
                <span className="text-xs text-muted-foreground">
                  • {document.numPages} page{document.numPages !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {document && (
                <>
                  {/* Form Filler Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFormFiller(true)}
                    title="Fill Form"
                    className="touch-target"
                  >
                    <FileInput className="w-5 h-5" />
                  </Button>

                  {/* Metadata Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMetadataEditor(true)}
                    title="Edit Metadata"
                    className="touch-target"
                  >
                    <Info className="w-5 h-5" />
                  </Button>
                </>
              )}

              {/* Keyboard Shortcuts Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardHelp(true)}
                title="Keyboard Shortcuts (?)"
                className="touch-target hidden sm:flex"
              >
                <Keyboard className="w-5 h-5" />
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="touch-target"
              >
                {isDark ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>

              {document && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDocument}
                  className="ml-2 hidden sm:flex"
                >
                  New File
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div className="fixed top-16 left-0 right-0 z-40 px-4 py-2 bg-background/95 backdrop-blur-sm border-b">
            <div className="container mx-auto">
              <div className="flex items-center gap-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
                <Progress value={uploadProgress} className="flex-1" showLabel />
              </div>
            </div>
          </div>
        )}

        {/* Global Loading Overlay */}
        {isLoading && document && (
          <div className="loading-overlay">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
          </div>
        )}

        {/* Success toast */}
        {showSuccess && (
          <div className="fixed top-20 right-4 z-50 animate-slideDown">
            <div className="bg-success text-success-foreground px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm font-medium">File loaded successfully!</p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="fixed top-20 right-4 z-50 animate-slideDown">
            <div
              className={cn(
                'bg-destructive text-destructive-foreground px-4 py-3 rounded-xl shadow-lg',
                'flex items-center gap-3 max-w-md'
              )}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="min-h-[calc(100vh-4rem)]">
          {!document ? (
            <FileUpload onUploadComplete={handleUploadComplete} />
          ) : (
            <div className="animate-fadeIn">
              <Toolbar />
              <PageGrid onAnnotatePage={handleAnnotatePage} />
            </div>
          )}
        </main>

        {/* Annotation Editor Modal */}
        {annotatingPage !== null && (
          <AnnotationEditor
            initialPage={annotatingPage}
            onClose={handleCloseAnnotation}
          />
        )}

        {/* Metadata Editor Dialog */}
        <MetadataEditor
          open={showMetadataEditor}
          onOpenChange={setShowMetadataEditor}
        />

        {/* Form Filler Dialog */}
        <FormFiller open={showFormFiller} onOpenChange={setShowFormFiller} />

        {/* Keyboard Shortcuts Help Dialog */}
        <KeyboardShortcutsHelp
          open={showKeyboardHelp}
          onOpenChange={setShowKeyboardHelp}
        />

        {/* Footer - only on landing */}
        {!document && (
          <footer className="border-t py-8 mt-auto">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              <p className="mb-2">
                PDF Buddy - A comprehensive PDF editing tool.
              </p>
              <p className="text-xs">
                Your files are processed locally and never stored on our servers.
              </p>
              <p className="mt-4 text-xs hidden sm:block">
                Press <kbd className="kbd">?</kbd> for keyboard shortcuts
              </p>
            </div>
          </footer>
        )}

        {/* Mobile-only: New file button when document is loaded */}
        {document && (
          <div className="fixed bottom-4 right-4 z-40 sm:hidden">
            <Button
              onClick={clearDocument}
              size="lg"
              className="rounded-full h-14 px-6 shadow-lg btn-gradient"
            >
              New File
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default App;
