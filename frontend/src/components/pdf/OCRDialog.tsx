import { useState, useEffect } from 'react';
import {
  ScanText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  FileSearch,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePDFStore } from '@/store/pdfStore';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';

interface OCRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OCRMode = 'extract' | 'searchable';

export function OCRDialog({ open, onOpenChange }: OCRDialogProps) {
  const { document, updateThumbnails } = usePDFStore();
  const [isAvailable, setIsAvailable] = useState(false);
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [selectedLanguage, setSelectedLanguage] = useState('eng');
  const [mode, setMode] = useState<OCRMode>('extract');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState<Record<number, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (open) {
      checkOCRStatus();
    }
  }, [open]);

  const checkOCRStatus = async () => {
    try {
      const status = await api.getOCRStatus();
      setIsAvailable(status.available);
      if (status.supported_languages) {
        setLanguages(status.supported_languages);
      }
    } catch {
      setIsAvailable(false);
    }
  };

  const handleProcess = async () => {
    if (!document) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setExtractedText(null);
    setIsComplete(false);

    try {
      if (mode === 'extract') {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        const result = await api.ocrExtractText(document.fileId, selectedLanguage);
        clearInterval(progressInterval);

        setExtractedText(result.text);
        setProgress(100);
        setIsComplete(true);
      } else {
        // Create searchable PDF
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 5, 90));
        }, 1000);

        const result = await api.ocrCreateSearchable(
          document.fileId,
          selectedLanguage
        );
        clearInterval(progressInterval);

        if (result.thumbnail_urls) {
          updateThumbnails(result.thumbnail_urls);
        }

        setProgress(100);
        setIsComplete(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed');
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyText = () => {
    if (!extractedText) return;
    const fullText = Object.entries(extractedText)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, text]) => `--- Page ${page} ---\n${text}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullText);
  };

  const downloadText = () => {
    if (!extractedText) return;
    const fullText = Object.entries(extractedText)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, text]) => `--- Page ${page} ---\n${text}`)
      .join('\n\n');

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'extracted_text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setExtractedText(null);
    setIsComplete(false);
    setProgress(0);
    setError(null);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="w-5 h-5" />
            OCR - Optical Character Recognition
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {!isAvailable ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <h3 className="font-medium mb-2">OCR Not Available</h3>
              <p className="text-sm text-muted-foreground">
                Tesseract OCR is not installed on the server.
                <br />
                Please install Tesseract to enable OCR functionality.
              </p>
            </div>
          ) : !isComplete ? (
            <>
              {/* Mode Selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">OCR Mode</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('extract')}
                    disabled={isProcessing}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border transition-colors text-left',
                      mode === 'extract'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <FileSearch className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium">Extract Text</p>
                      <p className="text-xs text-muted-foreground">
                        Extract text content from scanned pages
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('searchable')}
                    disabled={isProcessing}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border transition-colors text-left',
                      mode === 'searchable'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <ScanText className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium">Make Searchable</p>
                      <p className="text-xs text-muted-foreground">
                        Add invisible text layer for search
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Language</h3>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isProcessing}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  {Object.entries(languages).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Select the primary language of the document for better accuracy.
                </p>
              </div>

              {/* Info */}
              <div className="p-4 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-2">About {mode === 'extract' ? 'Text Extraction' : 'Searchable PDF'}:</p>
                {mode === 'extract' ? (
                  <p className="text-muted-foreground">
                    This will analyze each page as an image and extract any visible text.
                    Best for scanned documents, images, or PDFs without selectable text.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    This will create a new PDF with an invisible text layer overlaid on the images.
                    The resulting PDF will be searchable and you can select/copy text.
                  </p>
                )}
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing with OCR...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">
                    This may take a while for documents with many pages.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">OCR Complete</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {mode === 'extract'
                    ? `Text extracted from ${Object.keys(extractedText || {}).length} pages.`
                    : 'PDF has been converted to a searchable format.'}
                </p>
              </div>

              {/* Extracted Text Preview */}
              {extractedText && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Extracted Text</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={copyText}>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadText}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto border rounded-lg p-4 bg-muted/30 text-sm font-mono whitespace-pre-wrap">
                    {Object.entries(extractedText)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([page, text]) => (
                        <div key={page} className="mb-4">
                          <div className="text-primary font-bold mb-1">
                            --- Page {page} ---
                          </div>
                          <div>{text || '(No text found)'}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={reset}>
                Process Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isAvailable && !isComplete && (
            <Button onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ScanText className="w-4 h-4 mr-2" />
                  Start OCR
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
