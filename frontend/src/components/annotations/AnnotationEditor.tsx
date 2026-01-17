import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { usePDFStore } from '@/store/pdfStore';
import { api } from '@/api/client';

interface AnnotationEditorProps {
  initialPage?: number;
  onClose: () => void;
}

export function AnnotationEditor({ initialPage = 1, onClose }: AnnotationEditorProps) {
  const {
    document,
    annotations,
    clearPageAnnotations,
    setLoading,
    setError,
    isLoading,
    zoom,
    setZoom,
  } = usePDFStore();

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load high-quality preview for current page
  useEffect(() => {
    if (!document) return;

    setLoadingPreview(true);
    const url = api.getPreviewUrl(document.fileId, currentPage, 150);
    setPreviewUrl(url);

    // Preload image
    const img = new Image();
    img.onload = () => setLoadingPreview(false);
    img.onerror = () => setLoadingPreview(false);
    img.src = url;
  }, [document, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (document && currentPage < document.numPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handleClear = () => {
    clearPageAnnotations(currentPage);
  };

  const handleSave = async () => {
    if (!document) return;

    setIsSaving(true);
    try {
      // Convert annotations to API format
      const annotationsForApi: Record<number, unknown[]> = {};

      Object.entries(annotations).forEach(([page, pageAnnotations]) => {
        annotationsForApi[parseInt(page)] = pageAnnotations.map((a) => ({
          type: a.type,
          points: a.points,
          color: a.color,
          width: a.width,
          opacity: a.opacity,
        }));
      });

      const response = await api.saveAnnotations(
        document.fileId,
        annotationsForApi,
        'high'
      );

      if (response.success) {
        // Refresh thumbnails
        if (response.thumbnail_urls) {
          usePDFStore.getState().updateThumbnails(response.thumbnail_urls);
        }
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save annotations');
    } finally {
      setIsSaving(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 25, 50));
  };

  if (!document) return null;

  const pageInfo = document.pages[currentPage - 1];
  const canvasWidth = (pageInfo?.width || 595) * (zoom / 100);
  const canvasHeight = (pageInfo?.height || 842) * (zoom / 100);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold">Annotate Page</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {document.numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= document.numPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm w-16 text-center">{zoom}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-muted/50 p-8 flex items-center justify-center">
        {loadingPreview ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading page...</span>
          </div>
        ) : previewUrl ? (
          <AnnotationCanvas
            pageNumber={currentPage}
            imageUrl={previewUrl}
            width={canvasWidth}
            height={canvasHeight}
          />
        ) : (
          <div className="text-muted-foreground">Failed to load page</div>
        )}
      </div>

      {/* Toolbar */}
      <AnnotationToolbar
        onSave={handleSave}
        onClose={onClose}
        onClear={handleClear}
        isSaving={isSaving}
      />
    </div>
  );
}
