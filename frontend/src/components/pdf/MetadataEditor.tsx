import React, { useState, useEffect } from 'react';
import { FileText, User, BookOpen, Tag, Loader2 } from 'lucide-react';
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
import { api } from '@/api/client';
import { usePDFStore } from '@/store/pdfStore';

interface MetadataEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Metadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creation_date: string;
  modification_date: string;
}

export function MetadataEditor({ open, onOpenChange }: MetadataEditorProps) {
  const { document, setError } = usePDFStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<Metadata>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creation_date: '',
    modification_date: '',
  });

  useEffect(() => {
    if (open && document) {
      loadMetadata();
    }
  }, [open, document]);

  const loadMetadata = async () => {
    if (!document) return;

    setLoading(true);
    try {
      const response = await api.getMetadata(document.fileId);
      if (response.success) {
        setMetadata(response.metadata);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      await api.updateMetadata(document.fileId, {
        title: metadata.title || undefined,
        author: metadata.author || undefined,
        subject: metadata.subject || undefined,
        keywords: metadata.keywords || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Metadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Metadata</DialogTitle>
          <DialogDescription>
            Update the document properties and metadata.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Title
              </label>
              <Input
                value={metadata.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Document title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Author
              </label>
              <Input
                value={metadata.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="Author name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Subject
              </label>
              <Input
                value={metadata.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="Document subject"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Keywords
              </label>
              <Input
                value={metadata.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                placeholder="Comma-separated keywords"
              />
            </div>

            {(metadata.creator || metadata.producer) && (
              <div className="pt-4 border-t text-sm text-muted-foreground space-y-1">
                {metadata.creator && (
                  <p>Created with: {metadata.creator}</p>
                )}
                {metadata.producer && (
                  <p>Producer: {metadata.producer}</p>
                )}
                {metadata.creation_date && (
                  <p>Created: {metadata.creation_date}</p>
                )}
                {metadata.modification_date && (
                  <p>Modified: {metadata.modification_date}</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
