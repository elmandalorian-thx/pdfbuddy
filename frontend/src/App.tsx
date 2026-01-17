import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  AlertCircle,
  X,
  Moon,
  Sun,
  Keyboard,
  Info,
  FileInput,
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

function App() {
  const { document, error, setError, clearDocument, setZoom, zoom } = usePDFStore();
  const { isDark, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [annotatingPage, setAnnotatingPage] = useState<number | null>(null);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [showFormFiller, setShowFormFiller] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

  const handleAnnotatePage = (pageNumber: number) => {
    setAnnotatingPage(pageNumber);
  };

  const handleCloseAnnotation = () => {
    setAnnotatingPage(null);
  };

  return (
    <TooltipProvider>
      <div ref={containerRef} className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">PDF Buddy</h1>
                <p className="text-xs text-muted-foreground">
                  Edit PDFs with ease
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {document && (
                <>
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {document.originalName} • {document.numPages} page
                    {document.numPages !== 1 ? 's' : ''}
                  </span>

                  {/* Form Filler Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFormFiller(true)}
                    title="Fill Form"
                  >
                    <FileInput className="w-4 h-4" />
                  </Button>

                  {/* Metadata Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMetadataEditor(true)}
                    title="Edit Metadata"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </>
              )}

              {/* Keyboard Shortcuts Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeyboardHelp(true)}
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>

              {document && (
                <Button variant="outline" size="sm" onClick={clearDocument}>
                  New File
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div className="fixed top-16 left-0 right-0 z-40 px-4 py-2 bg-background border-b">
            <div className="container mx-auto">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Uploading...</span>
                <Progress value={uploadProgress} className="flex-1" showLabel />
              </div>
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="fixed top-20 right-4 z-50 animate-slideUp">
            <div className="bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main>
          {!document ? (
            <FileUpload
              onUploadComplete={() => setUploadProgress(null)}
            />
          ) : (
            <>
              <Toolbar />
              <PageGrid onAnnotatePage={handleAnnotatePage} />
            </>
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

        {/* Footer */}
        <footer className="border-t py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>
              PDF Buddy - A comprehensive PDF editing tool. No data is stored on
              our servers. All processing happens locally.
            </p>
            <p className="mt-2 text-xs">
              Press <kbd className="kbd">?</kbd> for keyboard shortcuts
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
