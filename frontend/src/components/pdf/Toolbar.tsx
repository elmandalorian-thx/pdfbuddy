import React, { useState, useRef } from 'react';
import {
  Upload,
  Image,
  Trash2,
  RotateCw,
  Split,
  Merge,
  FileText,
  Lock,
  Droplets,
  Download,
  Undo2,
  Redo2,
  CheckSquare,
  Square,
  Plus,
  Loader2,
  FilePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePDFStore } from '@/store/pdfStore';
import { api } from '@/api/client';
import { parsePageRange, isValidImageType } from '@/lib/utils';

export function Toolbar() {
  const {
    document,
    selectedPages,
    selectAllPages,
    clearSelection,
    undoStack,
    redoStack,
    undo,
    redo,
    setLoading,
    setError,
    isLoading,
  } = usePDFStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const addPdfInputRef = useRef<HTMLInputElement>(null);

  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [showExtractDialog, setShowExtractDialog] = useState(false);

  const [splitMode, setSplitMode] = useState<'individual' | 'ranges' | 'count'>(
    'individual'
  );
  const [splitRanges, setSplitRanges] = useState('');
  const [splitCount, setSplitCount] = useState(1);

  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hasSelection = selectedPages.size > 0;

  // Delete selected pages
  const handleDeleteSelected = async () => {
    if (!document || !hasSelection) return;

    const pages = Array.from(selectedPages);
    if (pages.length >= document.numPages) {
      setError('Cannot delete all pages');
      return;
    }

    setLoading(true);
    try {
      const response = await api.removePages(document.fileId, pages);
      if (response.success) {
        const info = await api.getFileInfo(document.fileId);
        usePDFStore.getState().loadDocument(document.fileId, {
          original_name: document.originalName,
          num_pages: info.num_pages,
          page_sizes: info.page_sizes,
          thumbnail_urls: response.thumbnail_urls || [],
        });
        clearSelection();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pages');
    } finally {
      setLoading(false);
    }
  };

  // Rotate selected pages
  const handleRotateSelected = async () => {
    if (!document || !hasSelection) return;

    const pages = Array.from(selectedPages);
    setLoading(true);
    try {
      const response = await api.rotatePages(document.fileId, pages, 90);
      if (response.success && response.thumbnail_urls) {
        usePDFStore.getState().updateThumbnails(response.thumbnail_urls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate pages');
    } finally {
      setLoading(false);
    }
  };

  // Add blank page
  const handleAddBlankPage = async () => {
    if (!document) return;

    const position = hasSelection
      ? Math.max(...Array.from(selectedPages)) + 1
      : document.numPages + 1;

    setLoading(true);
    try {
      const response = await api.addBlankPage(document.fileId, position);
      if (response.success) {
        const info = await api.getFileInfo(document.fileId);
        usePDFStore.getState().loadDocument(document.fileId, {
          original_name: document.originalName,
          num_pages: info.num_pages,
          page_sizes: info.page_sizes,
          thumbnail_urls: response.thumbnail_urls || [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add page');
    } finally {
      setLoading(false);
    }
  };

  // Add PDF pages to current document
  const handleAddPdf = async (files: FileList) => {
    if (!document || files.length === 0) return;

    setLoading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type === 'application/pdf') {
          const response = await api.appendPDF(document.fileId, file);
          if (response.success && response.thumbnail_urls) {
            const info = await api.getFileInfo(document.fileId);
            usePDFStore.getState().loadDocument(document.fileId, {
              original_name: document.originalName,
              num_pages: info.num_pages,
              page_sizes: info.page_sizes,
              thumbnail_urls: response.thumbnail_urls,
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add PDF');
    } finally {
      setLoading(false);
    }
  };

  // Insert image as page
  const handleInsertImage = async (files: FileList) => {
    if (!document || files.length === 0) return;

    const images = Array.from(files).filter(isValidImageType);
    if (images.length === 0) {
      setError('No valid images selected');
      return;
    }

    const position = hasSelection
      ? Math.max(...Array.from(selectedPages)) + 1
      : document.numPages + 1;

    setLoading(true);
    try {
      // Insert each image
      for (const image of images) {
        await api.insertImage(document.fileId, position, image);
      }

      // Refresh document
      const info = await api.getFileInfo(document.fileId);
      const thumbs = Array.from({ length: info.num_pages }, (_, i) =>
        api.getThumbnailUrl(document.fileId, i + 1)
      );
      usePDFStore.getState().loadDocument(document.fileId, {
        original_name: document.originalName,
        num_pages: info.num_pages,
        page_sizes: info.page_sizes,
        thumbnail_urls: thumbs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert image');
    } finally {
      setLoading(false);
    }
  };

  // Merge with other PDFs
  const handleMerge = async (files: FileList) => {
    if (!document || files.length === 0) return;

    setLoading(true);
    try {
      // Download current PDF and merge with new ones
      const currentResponse = await fetch(api.getDownloadUrl(document.fileId));
      if (!currentResponse.ok) {
        throw new Error(`Failed to download current PDF: ${currentResponse.status === 404 ? 'File not found. Please re-upload the document.' : `HTTP ${currentResponse.status}`}`);
      }
      const currentBlob = await currentResponse.blob();
      const currentFile = new File([currentBlob], document.originalName, {
        type: 'application/pdf',
      });

      const allFiles = [currentFile, ...Array.from(files)];
      const response = await api.mergePDFs(allFiles);

      if (response.success && response.file_id) {
        const info = await api.getFileInfo(response.file_id);
        usePDFStore.getState().loadDocument(response.file_id, {
          original_name: 'merged.pdf',
          num_pages: info.num_pages,
          page_sizes: info.page_sizes,
          thumbnail_urls: response.thumbnail_urls || [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDFs');
    } finally {
      setLoading(false);
    }
  };

  // Split PDF
  const handleSplit = async () => {
    if (!document) return;

    setLoading(true);
    try {
      let ranges: number[][] | undefined;
      if (splitMode === 'ranges' && splitRanges) {
        const parsed = parsePageRange(splitRanges, document.numPages);
        // Convert to ranges format
        ranges = parsed.map((p) => [p, p]);
      }

      const response = await api.splitPDF(
        document.fileId,
        splitMode,
        ranges,
        splitCount
      );

      if (response.success && response.split_files) {
        // Download all split files
        for (const file of response.split_files) {
          const link = window.document.createElement('a');
          link.href = file.download_url;
          link.download = file.filename;
          link.click();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split PDF');
    } finally {
      setLoading(false);
      setShowSplitDialog(false);
    }
  };

  // Add watermark
  const handleAddWatermark = async () => {
    if (!document || !watermarkText.trim()) return;

    setLoading(true);
    try {
      const response = await api.addWatermark(document.fileId, watermarkText, {
        opacity: watermarkOpacity,
      });

      if (response.success && response.thumbnail_urls) {
        usePDFStore.getState().updateThumbnails(response.thumbnail_urls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watermark');
    } finally {
      setLoading(false);
      setShowWatermarkDialog(false);
      setWatermarkText('');
    }
  };

  // Encrypt PDF
  const handleEncrypt = async () => {
    if (!document || !password) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.encryptPDF(document.fileId, password);
      // Download encrypted file
      const link = window.document.createElement('a');
      link.href = api.getDownloadUrl(document.fileId);
      link.download = `encrypted_${document.originalName}`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to encrypt PDF');
    } finally {
      setLoading(false);
      setShowEncryptDialog(false);
      setPassword('');
      setConfirmPassword('');
    }
  };

  // Extract text
  const handleExtractText = async () => {
    if (!document) return;

    setLoading(true);
    try {
      const result = await api.extractText(
        document.fileId,
        hasSelection ? Array.from(selectedPages) : undefined,
        'txt'
      );

      if (result instanceof Blob) {
        const url = URL.createObjectURL(result);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = 'extracted_text.txt';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text');
    } finally {
      setLoading(false);
      setShowExtractDialog(false);
    }
  };

  // Download PDF
  const handleDownload = () => {
    if (!document) return;

    const link = window.document.createElement('a');
    link.href = api.getDownloadUrl(document.fileId);
    link.download = document.originalName;
    link.click();
  };

  if (!document) return null;

  return (
    <>
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center gap-2 p-3 overflow-x-auto">
          {/* Selection controls */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllPages}
              title="Select all"
            >
              <CheckSquare className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={!hasSelection}
              title="Clear selection"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={undoStack.length === 0}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Add content */}
          <div className="flex items-center gap-1 border-r pr-2">
            <input
              ref={addPdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) =>
                e.target.files && handleAddPdf(e.target.files)
              }
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addPdfInputRef.current?.click()}
              disabled={isLoading}
              title="Add PDF pages"
            >
              <FilePlus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">PDF</span>
            </Button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) =>
                e.target.files && handleInsertImage(e.target.files)
              }
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading}
              title="Insert image"
            >
              <Image className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Image</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddBlankPage}
              disabled={isLoading}
              title="Add blank page"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Blank</span>
            </Button>

            <input
              ref={mergeInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleMerge(e.target.files)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mergeInputRef.current?.click()}
              disabled={isLoading}
              title="Merge PDFs"
            >
              <Merge className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Merge</span>
            </Button>
          </div>

          {/* Page operations */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotateSelected}
              disabled={!hasSelection || isLoading}
              title="Rotate selected"
            >
              <RotateCw className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Rotate</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={!hasSelection || isLoading}
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSplitDialog(true)}
              disabled={isLoading}
              title="Split PDF"
            >
              <Split className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Split</span>
            </Button>
          </div>

          {/* Advanced operations */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWatermarkDialog(true)}
              disabled={isLoading}
              title="Add watermark"
            >
              <Droplets className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Watermark</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEncryptDialog(true)}
              disabled={isLoading}
              title="Encrypt PDF"
            >
              <Lock className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Encrypt</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExtractDialog(true)}
              disabled={isLoading}
              title="Extract text"
            >
              <FileText className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Extract</span>
            </Button>
          </div>

          {/* Download */}
          <div className="flex items-center gap-1 ml-auto">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        </div>

      {/* Floating Action Bar - appears when pages are selected */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30">
            <span className="font-semibold">
              {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''} selected
            </span>
            <div className="w-px h-6 bg-primary-foreground/30" />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotateSelected}
                disabled={isLoading}
                className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                title="Rotate selected pages"
              >
                <RotateCw className="w-4 h-4 mr-1" />
                Rotate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isLoading}
                className="text-primary-foreground hover:bg-destructive hover:text-destructive-foreground"
                title="Delete selected pages"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
            <div className="w-px h-6 bg-primary-foreground/30" />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground"
              title="Clear selection"
            >
              <Square className="w-4 h-4" />
            </Button>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </div>
      )}

      {/* Split Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split PDF</DialogTitle>
            <DialogDescription>
              Choose how to split your PDF document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={splitMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSplitMode('individual')}
              >
                Individual Pages
              </Button>
              <Button
                variant={splitMode === 'ranges' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSplitMode('ranges')}
              >
                Page Ranges
              </Button>
              <Button
                variant={splitMode === 'count' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSplitMode('count')}
              >
                By Count
              </Button>
            </div>

            {splitMode === 'ranges' && (
              <div>
                <label className="text-sm font-medium">
                  Page Ranges (e.g., 1-5, 8, 10-12)
                </label>
                <Input
                  value={splitRanges}
                  onChange={(e) => setSplitRanges(e.target.value)}
                  placeholder="1-5, 8, 10-12"
                />
              </div>
            )}

            {splitMode === 'count' && (
              <div>
                <label className="text-sm font-medium">Pages per file</label>
                <Input
                  type="number"
                  min={1}
                  value={splitCount}
                  onChange={(e) => setSplitCount(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSplit} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Split PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Watermark Dialog */}
      <Dialog open={showWatermarkDialog} onOpenChange={setShowWatermarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Watermark</DialogTitle>
            <DialogDescription>
              Add a text watermark to your PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Watermark Text</label>
              <Input
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="CONFIDENTIAL"
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
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWatermarkDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWatermark}
              disabled={!watermarkText.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add Watermark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encrypt Dialog */}
      <Dialog open={showEncryptDialog} onOpenChange={setShowEncryptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encrypt PDF</DialogTitle>
            <DialogDescription>
              Protect your PDF with a password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEncryptDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEncrypt} disabled={!password || isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Encrypt & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Dialog */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Text</DialogTitle>
            <DialogDescription>
              Extract text from your PDF document.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {hasSelection
                ? `Extract text from ${selectedPages.size} selected page(s)`
                : 'Extract text from all pages'}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExtractDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleExtractText} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Extract Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
