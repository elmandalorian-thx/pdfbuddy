import React, { useCallback, useState } from 'react';
import { Upload, FileText, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, isValidPDFType, isValidImageType, formatFileSize } from '@/lib/utils';
import { api } from '@/api/client';
import { usePDFStore } from '@/store/pdfStore';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const { loadDocument, setLoading, setError, isLoading } = usePDFStore();

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      if (fileArray.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        // Check if it's a single PDF
        if (fileArray.length === 1 && isValidPDFType(fileArray[0])) {
          setUploadProgress('Uploading PDF...');
          const response = await api.uploadPDF(fileArray[0]);
          loadDocument(response.file_id, response);
          onUploadComplete?.();
        }
        // Multiple PDFs - merge them
        else if (fileArray.every(isValidPDFType)) {
          setUploadProgress('Merging PDFs...');
          const response = await api.mergePDFs(fileArray);
          if (response.success && response.file_id) {
            const info = await api.getFileInfo(response.file_id);
            loadDocument(response.file_id, {
              original_name: 'merged.pdf',
              num_pages: info.num_pages,
              page_sizes: info.page_sizes,
              thumbnail_urls: response.thumbnail_urls || [],
            });
            onUploadComplete?.();
          }
        }
        // Images - convert to PDF
        else if (fileArray.every(isValidImageType)) {
          setUploadProgress('Converting images to PDF...');
          const response = await api.imagesToPDF(fileArray);
          if (response.success && response.file_id) {
            const info = await api.getFileInfo(response.file_id);
            loadDocument(response.file_id, {
              original_name: 'images.pdf',
              num_pages: info.num_pages,
              page_sizes: info.page_sizes,
              thumbnail_urls: response.thumbnail_urls || [],
            });
            onUploadComplete?.();
          }
        }
        // Mixed or invalid types
        else {
          throw new Error(
            'Please upload either PDF files or image files (JPG, PNG, WEBP, GIF, TIFF)'
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setLoading(false);
        setUploadProgress(null);
      }
    },
    [loadDocument, setLoading, setError, onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleUpload(files);
      }
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleUpload(files);
      }
      // Reset input
      e.target.value = '';
    },
    [handleUpload]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div
        className={cn(
          'w-full max-w-2xl p-12 border-2 border-dashed rounded-xl transition-all duration-200',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isLoading && 'pointer-events-none opacity-60'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center text-center">
          {isLoading ? (
            <>
              <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">{uploadProgress || 'Processing...'}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-primary/10 rounded-full">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="p-4 bg-secondary rounded-full">
                  <Image className="w-8 h-8 text-secondary-foreground" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-2">
                Drop your files here
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload PDFs to edit, or images to convert to PDF
              </p>

              <div className="flex gap-4 mb-6">
                <label>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button variant="default" className="cursor-pointer" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload PDF
                    </span>
                  </Button>
                </label>

                <label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/tiff"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>
                      <Image className="w-4 h-4 mr-2" />
                      Upload Images
                    </span>
                  </Button>
                </label>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>Supported: PDF, JPG, PNG, WEBP, GIF, TIFF</p>
                <p>Maximum file size: 100MB</p>
                <p>Multiple files will be merged into one PDF</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
