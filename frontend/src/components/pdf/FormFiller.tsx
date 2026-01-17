import React, { useState, useEffect } from 'react';
import { FileInput, Loader2, AlertCircle } from 'lucide-react';
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

interface FormFillerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormField {
  type: string;
  value: string;
  name: string;
  readonly: boolean;
  options?: string[];
}

export function FormFiller({ open, onOpenChange }: FormFillerProps) {
  const { document, setError, updateThumbnails } = usePDFStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, FormField>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [hasFields, setHasFields] = useState(false);

  useEffect(() => {
    if (open && document) {
      loadFormFields();
    }
  }, [open, document]);

  const loadFormFields = async () => {
    if (!document) return;

    setLoading(true);
    try {
      const response = await api.getFormFields(document.fileId);
      if (response.success) {
        setFields(response.fields);
        setHasFields(response.has_forms);

        // Initialize field values
        const initialValues: Record<string, string> = {};
        Object.entries(response.fields).forEach(([name, field]) => {
          initialValues[name] = field.value || '';
        });
        setFieldValues(initialValues);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form fields');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      const response = await api.fillForm(document.fileId, fieldValues);
      if (response.success && response.thumbnail_urls) {
        updateThumbnails(response.thumbnail_urls);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fill form');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const renderField = (name: string, field: FormField) => {
    if (field.readonly) {
      return (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
          {field.value || '(empty)'}
        </div>
      );
    }

    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fieldValues[name] === 'Yes' || fieldValues[name] === 'true'}
              onChange={(e) =>
                handleFieldChange(name, e.target.checked ? 'Yes' : 'Off')
              }
              className="w-4 h-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground">
              {fieldValues[name] === 'Yes' ? 'Checked' : 'Unchecked'}
            </span>
          </div>
        );

      case 'choice':
        return (
          <select
            value={fieldValues[name]}
            onChange={(e) => handleFieldChange(name, e.target.value)}
            className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="">Select an option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'text':
      default:
        return (
          <Input
            value={fieldValues[name]}
            onChange={(e) => handleFieldChange(name, e.target.value)}
            placeholder={`Enter ${name}`}
          />
        );
    }
  };

  const fieldEntries = Object.entries(fields);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileInput className="w-5 h-5" />
            Fill PDF Form
          </DialogTitle>
          <DialogDescription>
            Fill in the form fields in this PDF document.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !hasFields ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              This PDF does not contain any fillable form fields.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {fieldEntries.map(([name, field]) => (
              <div key={name} className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  {name}
                  {field.readonly && (
                    <span className="text-xs text-muted-foreground">(read-only)</span>
                  )}
                  <span className="text-xs text-muted-foreground capitalize">
                    ({field.type})
                  </span>
                </label>
                {renderField(name, field)}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {hasFields && (
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Fill Form'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
