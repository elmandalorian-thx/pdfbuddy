import { useState, useRef, useEffect } from 'react';
import {
  PenTool,
  Loader2,
  CheckCircle,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePDFStore } from '@/store/pdfStore';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignatureDialog({ open, onOpenChange }: SignatureDialogProps) {
  const { document, updateThumbnails, selectedPages } = usePDFStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  // Signature info
  const [name, setName] = useState('');
  const [reason, setReason] = useState('Document approved');
  const [location, setLocation] = useState('');

  // Placement
  const [selectedPage, setSelectedPage] = useState(1);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(700);

  useEffect(() => {
    if (open) {
      checkSignatureStatus();
      // Set selected page from selection
      if (selectedPages.size > 0) {
        setSelectedPage(Math.min(...Array.from(selectedPages)));
      }
    }
  }, [open, selectedPages]);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [open]);

  const checkSignatureStatus = async () => {
    try {
      const status = await api.getSignatureStatus();
      setIsAvailable(status.available);
    } catch {
      setIsAvailable(true); // Assume available if can't check
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPoints([[x, y]]);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    if (ctx && rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setPoints((prev) => [...prev, [x, y]]);

      // Draw line
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint[0], lastPoint[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    setPoints([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const applySignature = async () => {
    if (!document || points.length < 2) return;

    setIsProcessing(true);
    setError(null);
    setIsComplete(false);

    try {
      const result = await api.addSignature(
        document.fileId,
        selectedPage,
        posX,
        posY,
        {
          name,
          reason,
          location,
          signature_data: { points },
        }
      );

      if (result.thumbnail_urls) {
        updateThumbnails(result.thumbnail_urls);
      }

      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply signature');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    clearSignature();
    setIsComplete(false);
    setError(null);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5" />
            Digital Signature
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {!isAvailable && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">
                  Note: Visual signatures only. Cryptographic signing requires additional setup.
                </span>
              </div>
            </div>
          )}

          {!isComplete ? (
            <>
              {/* Signature Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Draw Your Signature</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="border rounded-lg p-2 bg-white" data-testid="signature-canvas">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    className="cursor-crosshair w-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Draw your signature using your mouse or touchpad
                </p>
              </div>

              {/* Signature Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Your Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="New York, USA"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Reason for Signing</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Document approved"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Placement */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Signature Placement</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Page</label>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(Number(e.target.value))}
                      className="w-full p-2 border rounded-lg bg-background mt-1"
                    >
                      {Array.from({ length: document.numPages }, (_, i) => i + 1).map(
                        (page) => (
                          <option key={page} value={page}>
                            Page {page}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">X Position</label>
                    <Input
                      type="number"
                      value={posX}
                      onChange={(e) => setPosX(Number(e.target.value))}
                      min={0}
                      max={600}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Y Position</label>
                    <Input
                      type="number"
                      value={posY}
                      onChange={(e) => setPosY(Number(e.target.value))}
                      min={0}
                      max={850}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Position is measured from the bottom-left corner of the page in points (1 point = 1/72 inch).
                </p>
              </div>

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
            /* Success */
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-medium mb-2">Signature Applied</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your signature has been added to page {selectedPage}.
              </p>
              <Button variant="outline" onClick={reset}>
                Add Another Signature
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isComplete ? 'Done' : 'Cancel'}
          </Button>
          {!isComplete && (
            <Button
              onClick={applySignature}
              disabled={points.length < 2 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4 mr-2" />
                  Apply Signature
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
