import { useCallback, useState } from 'react';
import {
  Upload,
  FileText,
  Image,
  Loader2,
  Sparkles,
  Shield,
  Zap,
  Layers,
  Pencil,
  Download,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, isValidPDFType, isValidImageType } from '@/lib/utils';
import { api } from '@/api/client';
import { usePDFStore } from '@/store/pdfStore';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

const features = [
  {
    icon: Layers,
    title: 'Merge & Split',
    description: 'Combine PDFs or extract pages',
  },
  {
    icon: Pencil,
    title: 'Annotate',
    description: 'Draw, highlight, and mark up',
  },
  {
    icon: Image,
    title: 'Image to PDF',
    description: 'Convert images instantly',
  },
  {
    icon: Lock,
    title: 'Encrypt',
    description: 'Password protect your files',
  },
];

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
    <div className="min-h-[calc(100vh-4rem)] animated-gradient-bg">
      <div className="container mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16 page-enter">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Free & Private PDF Editing</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-balance">
            Edit PDFs with{' '}
            <span className="gradient-text">Confidence</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Professional PDF tools that respect your privacy. No uploads to the cloud,
            no account needed. Just powerful editing at your fingertips.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-success" />
              <span>100% Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <span>Instant Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span>Free Download</span>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="max-w-3xl mx-auto mb-16 md:mb-24">
          <div
            className={cn(
              'relative rounded-3xl p-8 md:p-12 transition-all duration-300',
              'bg-card/80 backdrop-blur-sm border-2 border-dashed',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.02] shadow-2xl shadow-primary/20'
                : 'border-border hover:border-primary/50 hover:shadow-xl',
              isLoading && 'pointer-events-none opacity-70'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />

            <div className="relative flex flex-col items-center text-center">
              {isLoading ? (
                <div className="py-8">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  </div>
                  <p className="text-xl font-semibold mb-2">{uploadProgress || 'Processing...'}</p>
                  <p className="text-muted-foreground">This will only take a moment</p>
                </div>
              ) : (
                <>
                  {/* Icons */}
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/30 float">
                        <FileText className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </div>
                    </div>
                    <div className="text-3xl text-muted-foreground/30">+</div>
                    <div className="relative">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 float" style={{ animationDelay: '0.5s' }}>
                        <Image className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold mb-3">
                    Drop your files here
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-md">
                    Upload PDFs to edit, or drop images to convert them to PDF.
                    Multiple files will be merged automatically.
                  </p>

                  {/* Upload buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <label className="touch-target">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                        aria-label="Upload PDF files"
                      />
                      <Button
                        size="lg"
                        className="btn-gradient w-full sm:w-auto cursor-pointer h-12 px-8 text-base ripple"
                        asChild
                      >
                        <span>
                          <Upload className="w-5 h-5 mr-2" />
                          Upload PDF
                          <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
                        </span>
                      </Button>
                    </label>

                    <label className="touch-target">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/tiff"
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                        aria-label="Upload image files"
                      />
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto cursor-pointer h-12 px-8 text-base hover:bg-secondary"
                        asChild
                      >
                        <span>
                          <Image className="w-5 h-5 mr-2" />
                          Upload Images
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* File info */}
                  <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                    <span className="px-3 py-1 rounded-full bg-muted">PDF</span>
                    <span className="px-3 py-1 rounded-full bg-muted">JPG</span>
                    <span className="px-3 py-1 rounded-full bg-muted">PNG</span>
                    <span className="px-3 py-1 rounded-full bg-muted">WEBP</span>
                    <span className="px-3 py-1 rounded-full bg-muted">Up to 100MB</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">
            Everything you need to work with PDFs
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="feature-card group"
              >
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA for mobile */}
        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur-lg border-t md:hidden safe-area-bottom">
          <label className="block">
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <Button
              size="lg"
              className="btn-gradient w-full h-14 text-lg"
              asChild
              disabled={isLoading}
            >
              <span>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Files
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>

        {/* Spacer for mobile fixed button */}
        <div className="h-24 md:hidden" />
      </div>
    </div>
  );
}
