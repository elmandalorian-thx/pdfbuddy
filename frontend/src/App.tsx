import React, { useState } from 'react';
import { FileText, AlertCircle, X } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FileUpload } from '@/components/pdf/FileUpload';
import { PageGrid } from '@/components/pdf/PageGrid';
import { Toolbar } from '@/components/pdf/Toolbar';
import { AnnotationEditor } from '@/components/annotations/AnnotationEditor';
import { usePDFStore } from '@/store/pdfStore';
import { Button } from '@/components/ui/button';

function App() {
  const { document, error, setError, clearDocument } = usePDFStore();
  const [annotatingPage, setAnnotatingPage] = useState<number | null>(null);

  const handleAnnotatePage = (pageNumber: number) => {
    setAnnotatingPage(pageNumber);
  };

  const handleCloseAnnotation = () => {
    setAnnotatingPage(null);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
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

            {document && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {document.originalName} • {document.numPages} page
                  {document.numPages !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDocument}
                >
                  New File
                </Button>
              </div>
            )}
          </div>
        </header>

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
            <FileUpload />
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

        {/* Footer */}
        <footer className="border-t py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>
              PDF Buddy - A comprehensive PDF editing tool.
              No data is stored on our servers. All processing happens locally.
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
