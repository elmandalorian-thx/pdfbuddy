import { useState, useEffect, useRef, useCallback } from 'react';
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
  Plus,
  Layers,
  ScanText,
  PenTool,
  Command,
  Sparkles,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FileUpload } from '@/components/pdf/FileUpload';
import { PageGrid } from '@/components/pdf/PageGrid';
import { Toolbar } from '@/components/pdf/Toolbar';
import { AnnotationEditor } from '@/components/annotations/AnnotationEditor';
import { MetadataEditor } from '@/components/pdf/MetadataEditor';
import { FormFiller } from '@/components/pdf/FormFiller';
import { KeyboardShortcutsHelp } from '@/components/pdf/KeyboardShortcutsHelp';
import { BatchProcessor } from '@/components/pdf/BatchProcessor';
import { OCRDialog } from '@/components/pdf/OCRDialog';
import { SignatureDialog } from '@/components/pdf/SignatureDialog';
import { CommandPalette } from '@/components/smart-commands/CommandPalette';
import { AIAssistantPanel } from '@/components/ai';
import { Progress } from '@/components/ui/progress';
import { usePDFStore } from '@/store/pdfStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { useTheme } from '@/hooks/useTheme';
import { useSmartCommands } from '@/hooks/useSmartCommands';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { cn, isValidPDFType } from '@/lib/utils';

function App() {
  const { document, error, setError, clearDocument, setZoom, zoom, isLoading, setLoading, loadDocument } = usePDFStore();
  const { isDark, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [annotatingPage, setAnnotatingPage] = useState<number | null>(null);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [showFormFiller, setShowFormFiller] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showBatchProcessor, setShowBatchProcessor] = useState(false);
  const [showOCRDialog, setShowOCRDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Smart Commands
  const smartCommands = useSmartCommands({
    fileId: document?.fileId || null,
    selectedPages: Array.from(usePDFStore.getState().selectedPages),
    onSuccess: async () => {
      // Refresh document after successful command
      if (document) {
        try {
          const info = await api.getFileInfo(document.fileId);
          loadDocument(document.fileId, {
            original_name: document.originalName,
            num_pages: info.num_pages,
            page_sizes: info.page_sizes,
            thumbnail_urls: document.pages.map((_, i) => api.getThumbnailUrl(document.fileId, i + 1)),
          });
        } catch {
          // Silent fail, document will refresh on next action
        }
      }
    },
    onError: (error) => {
      setError(error);
    },
  });

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Success toast
  const [showSuccess, setShowSuccess] = useState(false);

  // Drag and drop for appending PDFs
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!document) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, [document]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!document) return;
    e.preventDefault();
    e.stopPropagation();
  }, [document]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  // Reset drag state when drag ends (user cancels or drops outside)
  useEffect(() => {
    const handleDragEnd = () => {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    };

    const handleWindowDrop = (e: DragEvent) => {
      // Reset on any drop (even outside our drop zone)
      dragCounter.current = 0;
      setIsDraggingOver(false);
    };

    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (!document) return;

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(isValidPDFType);

    if (pdfFiles.length === 0) {
      setError('Please drop PDF files only');
      return;
    }

    setLoading(true);
    try {
      // Append each PDF file sequentially
      for (const file of pdfFiles) {
        const response = await api.appendPDF(document.fileId, file);
        if (response.success && response.thumbnail_urls) {
          // Update the document with new page info
          const info = await api.getFileInfo(document.fileId);
          loadDocument(document.fileId, {
            original_name: document.originalName,
            num_pages: info.num_pages,
            page_sizes: info.page_sizes,
            thumbnail_urls: response.thumbnail_urls,
          });
        }
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to append PDF');
    } finally {
      setLoading(false);
    }
  }, [document, setLoading, setError, loadDocument]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !annotatingPage && !showMetadataEditor && !showFormFiller && !smartCommands.isOpen,
    onCommandPalette: () => {
      if (document) {
        smartCommands.open();
      }
    },
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
          <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-base sm:text-lg font-bold leading-none">PDF Buddy</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                  Edit PDFs with ease
                </p>
              </div>
            </div>

            {/* Center - Document info */}
            {document && (
              <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50">
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
            <div className="flex items-center gap-0.5 sm:gap-1">
              {document && (
                <>
                  {/* Primary actions - always visible */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => smartCommands.open()}
                    title="Smart Commands (⌘K)"
                    className="h-9 w-9 sm:h-10 sm:w-10"
                  >
                    <Command className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAIAssistant(true)}
                    title="AI Assistant"
                    className="h-9 w-9 sm:h-10 sm:w-10"
                  >
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  {/* Secondary actions - hidden on small mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowOCRDialog(true)}
                    title="OCR - Extract Text from Scans"
                    className="h-9 w-9 sm:h-10 sm:w-10 hidden xs:flex"
                  >
                    <ScanText className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSignatureDialog(true)}
                    title="Add Digital Signature"
                    className="h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex"
                  >
                    <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFormFiller(true)}
                    title="Fill Form"
                    className="h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex"
                  >
                    <FileInput className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMetadataEditor(true)}
                    title="Edit Metadata"
                    className="h-9 w-9 sm:h-10 sm:w-10 hidden md:flex"
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </>
              )}

              {/* Batch Processing - hidden on mobile when document is loaded */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBatchProcessor(true)}
                title="Batch Processing"
                className={cn(
                  "h-9 w-9 sm:h-10 sm:w-10",
                  document ? "hidden md:flex" : ""
                )}
              >
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              {/* Keyboard Shortcuts - desktop only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardHelp(true)}
                title="Keyboard Shortcuts (?)"
                className="h-9 w-9 sm:h-10 sm:w-10 hidden md:flex"
              >
                <Keyboard className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              {/* Theme Toggle - always visible */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>

              {document && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDocument}
                  className="ml-1 sm:ml-2 hidden sm:flex h-8 sm:h-9 text-xs sm:text-sm"
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
          <div className="fixed top-16 sm:top-20 left-4 right-4 sm:left-auto sm:right-4 z-50 animate-slideDown">
            <div className="bg-success text-success-foreground px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium">File loaded successfully!</p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="fixed top-16 sm:top-20 left-4 right-4 sm:left-auto sm:right-4 z-50 animate-slideDown">
            <div
              className={cn(
                'bg-destructive text-destructive-foreground px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-lg',
                'flex items-center gap-2 sm:gap-3 sm:max-w-md'
              )}
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <p className="text-xs sm:text-sm flex-1 line-clamp-2">{error}</p>
              <button
                onClick={() => setError(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main
          className="min-h-[calc(100vh-4rem)] relative"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!document ? (
            <FileUpload onUploadComplete={handleUploadComplete} />
          ) : (
            <div className="animate-fadeIn">
              <Toolbar />
              <PageGrid onAnnotatePage={handleAnnotatePage} />
            </div>
          )}

          {/* Drop overlay for appending PDFs */}
          {isDraggingOver && document && (
            <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-primary rounded-lg m-4 transition-all">
              <div className="text-center p-8 bg-background/90 rounded-2xl shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Drop to Append</h3>
                <p className="text-muted-foreground">
                  Drop PDF files here to add them to the end of your document
                </p>
              </div>
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

        {/* Batch Processor Dialog */}
        <BatchProcessor
          open={showBatchProcessor}
          onOpenChange={setShowBatchProcessor}
        />

        {/* OCR Dialog */}
        <OCRDialog
          open={showOCRDialog}
          onOpenChange={setShowOCRDialog}
        />

        {/* Signature Dialog */}
        <SignatureDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
        />

        {/* AI Assistant Panel */}
        <AIAssistantPanel
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          fileId={document?.fileId || null}
          fileName={document?.originalName}
        />

        {/* Smart Commands Palette */}
        <CommandPalette
          isOpen={smartCommands.isOpen}
          onClose={smartCommands.close}
          state={smartCommands.state}
          input={smartCommands.input}
          onInputChange={smartCommands.setInput}
          onSubmit={smartCommands.parseCommand}
          onExecute={smartCommands.executeCommand}
          onConfirm={smartCommands.confirmCommand}
          onCancel={smartCommands.cancelConfirm}
          onReset={smartCommands.reset}
          parsedCommand={smartCommands.parsedCommand}
          suggestions={smartCommands.suggestions}
          onSelectSuggestion={smartCommands.selectSuggestion}
          error={smartCommands.error}
          isLoading={smartCommands.isLoading}
          disabled={!document}
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
