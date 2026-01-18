import { useState, useCallback } from 'react';
import {
  Layers,
  Upload,
  X,
  FileText,
  Droplet,
  Lock,
  RotateCw,
  Type,
  Merge,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';

interface BatchFile {
  file_id: string;
  original_name: string;
  num_pages: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result_url?: string;
  error?: string;
}

interface BatchProcessorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BatchOperation = 'watermark' | 'encrypt' | 'rotate' | 'extract_text' | 'merge';

const operations: { id: BatchOperation; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'watermark', label: 'Add Watermark', icon: <Droplet className="w-4 h-4" />, description: 'Add text watermark to all PDFs' },
  { id: 'encrypt', label: 'Encrypt', icon: <Lock className="w-4 h-4" />, description: 'Password protect all PDFs' },
  { id: 'rotate', label: 'Rotate', icon: <RotateCw className="w-4 h-4" />, description: 'Rotate all pages in PDFs' },
  { id: 'extract_text', label: 'Extract Text', icon: <Type className="w-4 h-4" />, description: 'Extract text from all PDFs' },
  { id: 'merge', label: 'Merge All', icon: <Merge className="w-4 h-4" />, description: 'Combine all PDFs into one' },
];

export function BatchProcessor({ open, onOpenChange }: BatchProcessorProps) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<BatchOperation>('watermark');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Operation-specific settings
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [password, setPassword] = useState('');
  const [rotation, setRotation] = useState(90);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    );
    await uploadFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(selectedFiles);
    e.target.value = '';
  }, []);

  const uploadFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    try {
      const response = await api.batchUpload(filesToUpload);
      const newFiles: BatchFile[] = response.uploaded.map((f) => ({
        file_id: f.file_id,
        original_name: f.original_name,
        num_pages: f.num_pages,
        status: 'pending' as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    } catch {
      // Handle error silently
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
  };

  const clearAll = () => {
    setFiles([]);
    setIsComplete(false);
    setProgress(0);
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setIsComplete(false);

    const fileIds = files.map((f) => f.file_id);

    try {
      let result;

      switch (selectedOperation) {
        case 'watermark':
          result = await api.batchWatermark(fileIds, watermarkText, watermarkOpacity);
          break;
        case 'encrypt':
          result = await api.batchEncrypt(fileIds, password);
          break;
        case 'rotate':
          result = await api.batchRotate(fileIds, rotation);
          break;
        case 'extract_text':
          result = await api.batchExtractText(fileIds);
          break;
        case 'merge':
          result = await api.batchMerge(fileIds);
          break;
      }

      // Update file statuses
      if (result) {
        setFiles((prev) =>
          prev.map((f) => {
            const resultFile = result.results?.find(
              (r: { file_id?: string; original_file_id?: string }) =>
                r.original_file_id === f.file_id || r.file_id === f.file_id
            );
            const errorFile = result.errors?.find(
              (e: { file_id?: string; error?: string }) => e.file_id === f.file_id
            );

            if (resultFile) {
              return {
                ...f,
                status: 'completed' as const,
                result_url: resultFile.download_url,
              };
            } else if (errorFile) {
              return {
                ...f,
                status: 'error' as const,
                error: errorFile.error,
              };
            }
            return f;
          })
        );
      }

      setProgress(100);
      setIsComplete(true);
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error' as const,
          error: 'Processing failed',
        }))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = async () => {
    const completedIds = files
      .filter((f) => f.status === 'completed' && f.result_url)
      .map((f) => f.file_id);

    if (completedIds.length === 0) return;

    try {
      const response = await api.batchDownloadZip(completedIds);
      window.open(response.download_url, '_blank');
    } catch {
      // Handle error silently
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Batch Processing
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* File Upload Area */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              'hover:border-primary hover:bg-primary/5'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag & drop PDF files here, or
            </p>
            <label>
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Files ({files.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={isProcessing}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>

              <div className="max-h-48 overflow-auto space-y-1 border rounded-lg p-2">
                {files.map((file) => (
                  <div
                    key={file.file_id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="flex-1 text-sm truncate">
                      {file.original_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {file.num_pages} pages
                    </span>
                    {file.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    {file.status === 'processing' && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {!isProcessing && file.status === 'pending' && (
                      <button
                        onClick={() => removeFile(file.file_id)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operation Selection */}
          {files.length > 0 && !isComplete && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select Operation</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {operations.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperation(op.id)}
                    disabled={isProcessing}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border transition-colors text-left',
                      selectedOperation === op.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {op.icon}
                    <div>
                      <p className="text-sm font-medium">{op.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {op.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Operation Settings */}
              <div className="p-4 border rounded-lg space-y-3">
                {selectedOperation === 'watermark' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Watermark Text</label>
                      <Input
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="Enter watermark text"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Opacity: {Math.round(watermarkOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                        className="w-full mt-1"
                      />
                    </div>
                  </>
                )}

                {selectedOperation === 'encrypt' && (
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="mt-1"
                    />
                  </div>
                )}

                {selectedOperation === 'rotate' && (
                  <div>
                    <label className="text-sm font-medium">Rotation</label>
                    <div className="flex gap-2 mt-1">
                      {[90, 180, 270].map((deg) => (
                        <Button
                          key={deg}
                          variant={rotation === deg ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRotation(deg)}
                        >
                          {deg}°
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedOperation === 'merge' && (
                  <p className="text-sm text-muted-foreground">
                    All PDFs will be merged in the order shown above.
                  </p>
                )}

                {selectedOperation === 'extract_text' && (
                  <p className="text-sm text-muted-foreground">
                    Text will be extracted from all pages and saved as text files.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results */}
          {isComplete && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Processing Complete</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {files.filter((f) => f.status === 'completed').length} of{' '}
                {files.length} files processed successfully.
              </p>
              <Button onClick={downloadAll}>
                <Download className="w-4 h-4 mr-2" />
                Download All (ZIP)
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isComplete && (
            <Button
              onClick={processFiles}
              disabled={files.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-2" />
                  Process {files.length} File{files.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
