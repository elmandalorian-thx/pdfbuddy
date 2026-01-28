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
  Split,
  Merge,
  RotateCw,
  Trash2,
  Type,
  Droplets,
  FileSearch,
  Bot,
  Command,
  Eye,
  MousePointer,
  Palette,
  Table,
  CheckCircle2,
  Clock,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, isValidPDFType, isValidImageType } from '@/lib/utils';
import { api } from '@/api/client';
import { usePDFStore } from '@/store/pdfStore';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

// Expanded features organized by category
const featureCategories = [
  {
    title: 'Organize',
    features: [
      { icon: Merge, title: 'Merge PDFs', description: 'Combine multiple PDFs into one' },
      { icon: Split, title: 'Split PDF', description: 'Extract pages or split by ranges' },
      { icon: RotateCw, title: 'Rotate Pages', description: 'Rotate any page by 90°' },
      { icon: Trash2, title: 'Delete Pages', description: 'Remove unwanted pages' },
      { icon: MousePointer, title: 'Reorder Pages', description: 'Drag & drop to rearrange' },
      { icon: Layers, title: 'Add Pages', description: 'Insert blank or image pages' },
    ],
  },
  {
    title: 'Annotate',
    features: [
      { icon: Pencil, title: 'Draw & Highlight', description: 'Freehand drawing tools' },
      { icon: Type, title: 'Add Text', description: 'Type anywhere on the page' },
      { icon: Palette, title: 'Colors & Styles', description: 'Custom colors and widths' },
      { icon: FileSearch, title: 'Signatures', description: 'Draw and place signatures' },
      { icon: Droplets, title: 'Watermarks', description: 'Add text watermarks' },
      { icon: Eye, title: 'Preview', description: 'See changes in real-time' },
    ],
  },
  {
    title: 'Convert & Protect',
    features: [
      { icon: Image, title: 'Image to PDF', description: 'Convert JPG, PNG, WEBP' },
      { icon: Lock, title: 'Encrypt PDF', description: 'Password protection' },
      { icon: FileText, title: 'Extract Text', description: 'Get text from any page' },
      { icon: Table, title: 'Extract Tables', description: 'Pull data from tables' },
      { icon: Download, title: 'Download', description: 'Save your edited PDF' },
      { icon: Globe, title: 'OCR Ready', description: 'Text recognition support' },
    ],
  },
  {
    title: 'AI Powered',
    features: [
      { icon: Bot, title: 'AI Assistant', description: 'Chat with your documents' },
      { icon: Sparkles, title: 'Summarize', description: 'Get quick summaries' },
      { icon: Command, title: 'Smart Commands', description: 'Natural language editing' },
      { icon: FileSearch, title: 'Key Points', description: 'Extract important points' },
      { icon: CheckCircle2, title: 'Action Items', description: 'Find tasks & todos' },
      { icon: Clock, title: 'Fast Processing', description: 'Instant AI responses' },
    ],
  },
];

// Trust/benefit badges
const trustBadges = [
  { icon: Shield, label: '100% Private', sublabel: 'Your files stay on our secure servers' },
  { icon: Zap, label: 'Lightning Fast', sublabel: 'Instant processing, no waiting' },
  { icon: Download, label: 'Free to Use', sublabel: 'No account required' },
  { icon: Globe, label: 'Works Anywhere', sublabel: 'Any browser, any device' },
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Hero Section - Above the Fold */}
      <div className="container mx-auto px-4 pt-4 pb-8 md:pt-8 md:pb-12">
        {/* Mini Badge */}
        <div className="text-center mb-4 md:mb-6 page-enter">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Professional PDF Tools - Free &amp; Private</span>
          </div>
        </div>

        {/* Main Upload Zone - Prominent & Above the Fold */}
        <div className="max-w-3xl mx-auto mb-6 md:mb-10">
          <div
            className={cn(
              'relative rounded-2xl p-6 md:p-10 transition-all duration-300',
              'bg-card border-2 border-dashed',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-2xl shadow-primary/20'
                : 'border-border hover:border-primary/50 hover:shadow-xl',
              isLoading && 'pointer-events-none opacity-70'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Decorative gradient blobs */}
            <div className="absolute -top-3 -right-3 w-20 h-20 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-3 -left-3 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative flex flex-col items-center text-center">
              {isLoading ? (
                <div className="py-4">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  </div>
                  <p className="text-lg font-semibold mb-1">{uploadProgress || 'Processing...'}</p>
                  <p className="text-sm text-muted-foreground">This will only take a moment</p>
                </div>
              ) : (
                <>
                  {/* Icons */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/30 float">
                      <FileText className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    </div>
                    <div className="text-2xl text-muted-foreground/30 font-light">+</div>
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 float" style={{ animationDelay: '0.5s' }}>
                      <Image className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    </div>
                  </div>

                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    Drop your files to get started
                  </h1>
                  <p className="text-muted-foreground mb-6 max-w-md text-sm md:text-base">
                    Upload PDFs to edit, or drop images to convert. Multiple files merge automatically.
                  </p>

                  {/* Upload buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                        className="btn-gradient w-full sm:w-auto cursor-pointer h-11 px-6 text-base ripple"
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
                        className="w-full sm:w-auto cursor-pointer h-11 px-6 text-base hover:bg-secondary"
                        asChild
                      >
                        <span>
                          <Image className="w-5 h-5 mr-2" />
                          Upload Images
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* File type chips */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-muted font-medium">PDF</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted font-medium">JPG</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted font-medium">PNG</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted font-medium">WEBP</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">Up to 100MB</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trust Badges - Compact row */}
        <div className="max-w-4xl mx-auto mb-8 md:mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <badge.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{badge.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{badge.sublabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section - Below the Fold */}
      <div className="bg-muted/30 border-t">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Everything you need for PDFs
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete toolkit for editing, annotating, and managing your PDF documents.
            </p>
          </div>

          {/* Feature Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
            {featureCategories.map((category) => (
              <div
                key={category.title}
                className="bg-card rounded-2xl border p-5 md:p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-primary" />
                  {category.title}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {category.features.map((feature) => (
                    <div
                      key={feature.title}
                      className="group flex flex-col items-center text-center p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="font-medium text-sm mb-0.5">{feature.title}</div>
                      <div className="text-xs text-muted-foreground leading-snug">{feature.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="text-center mt-12 md:mt-16">
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20">
              <div className="text-left">
                <h3 className="font-semibold text-lg">Ready to edit your PDFs?</h3>
                <p className="text-sm text-muted-foreground">Drop your files above or click to upload</p>
              </div>
              <label className="touch-target">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <Button size="lg" className="btn-gradient cursor-pointer h-11 px-6" asChild>
                  <span>
                    <Upload className="w-5 h-5 mr-2" />
                    Get Started Free
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 inset-x-0 p-3 bg-background/90 backdrop-blur-lg border-t md:hidden safe-area-bottom z-40">
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
            className="btn-gradient w-full h-12 text-base"
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
      <div className="h-20 md:hidden" />
    </div>
  );
}
