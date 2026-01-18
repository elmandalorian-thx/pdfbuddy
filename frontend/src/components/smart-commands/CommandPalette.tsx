import React, { useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  Search,
  RotateCw,
  Trash2,
  FileText,
  Lock,
  Scissors,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommandSuggestion, ParsedCommandResponse } from '@/types';
import type { CommandPaletteState } from '@/hooks/useSmartCommands';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  state: CommandPaletteState;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onExecute: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onReset: () => void;
  parsedCommand: ParsedCommandResponse | null;
  suggestions: CommandSuggestion[];
  onSelectSuggestion: (suggestion: CommandSuggestion) => void;
  error: string | null;
  isLoading: boolean;
  disabled?: boolean;
}

const INTENT_ICONS: Record<string, React.ReactNode> = {
  remove_pages: <Trash2 className="w-4 h-4" />,
  rotate_pages: <RotateCw className="w-4 h-4" />,
  add_watermark: <FileText className="w-4 h-4" />,
  encrypt: <Lock className="w-4 h-4" />,
  split: <Scissors className="w-4 h-4" />,
  extract_text: <FileText className="w-4 h-4" />,
  ocr: <Search className="w-4 h-4" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Page Operations': <FileText className="w-4 h-4" />,
  'Document Operations': <Lock className="w-4 h-4" />,
  'Content Extraction': <Search className="w-4 h-4" />,
  Metadata: <FileText className="w-4 h-4" />,
};

export function CommandPalette({
  isOpen,
  onClose,
  state,
  input,
  onInputChange,
  onSubmit,
  onExecute,
  onConfirm,
  onCancel,
  onReset,
  parsedCommand,
  suggestions,
  onSelectSuggestion,
  error,
  isLoading,
  disabled,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current && state === 'input') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, state]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state === 'confirming' || state === 'preview') {
          onReset();
        } else {
          onClose();
        }
        return;
      }

      if (state === 'input') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (input.trim()) {
            onSubmit();
          } else if (suggestions[selectedIndex]) {
            onSelectSuggestion(suggestions[selectedIndex]);
          }
        } else if (e.key === 'Tab' && suggestions[selectedIndex]) {
          e.preventDefault();
          onSelectSuggestion(suggestions[selectedIndex]);
        }
      } else if (state === 'preview') {
        if (e.key === 'Enter') {
          e.preventDefault();
          onExecute();
        }
      } else if (state === 'confirming') {
        if (e.key === 'Enter') {
          e.preventDefault();
          onConfirm();
        }
      }
    },
    [state, input, suggestions, selectedIndex, onSubmit, onSelectSuggestion, onExecute, onConfirm, onReset, onClose]
  );

  // Group suggestions by category
  const groupedSuggestions = React.useMemo(() => {
    const groups: Record<string, CommandSuggestion[]> = {};
    suggestions.forEach((s) => {
      if (!groups[s.category]) {
        groups[s.category] = [];
      }
      groups[s.category].push(s);
    });
    return groups;
  }, [suggestions]);

  const renderContent = () => {
    switch (state) {
      case 'input':
      case 'parsing':
        return (
          <>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command... (e.g., 'remove pages 1-5')"
                className="pl-9 pr-16 h-12 text-base"
                disabled={isLoading || disabled}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}K
              </kbd>
            </div>

            {/* Suggestions */}
            {Object.keys(groupedSuggestions).length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto">
                {Object.entries(groupedSuggestions).map(([category, items]) => (
                  <div key={category} className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_ICONS[category] || <Command className="w-3 h-3" />}
                      {category}
                    </div>
                    {items.map((suggestion, idx) => {
                      const globalIdx = suggestions.indexOf(suggestion);
                      return (
                        <button
                          key={suggestion.command}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                            globalIdx === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                          )}
                          onClick={() => onSelectSuggestion(suggestion)}
                        >
                          <span className="text-muted-foreground">
                            {INTENT_ICONS[suggestion.intent] || <Sparkles className="w-4 h-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{suggestion.command}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {suggestion.description}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Parsing command...</span>
              </div>
            )}
          </>
        );

      case 'confirming':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-600 dark:text-amber-400">
                  Confirm Action
                </h4>
                <p className="text-sm mt-1">{parsedCommand?.action_preview}</p>
                {parsedCommand?.warnings && parsedCommand.warnings.length > 0 && (
                  <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                    {parsedCommand.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={onConfirm} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Confirm
              </Button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {INTENT_ICONS[parsedCommand?.intent || ''] || <Command className="w-4 h-4" />}
                <span className="font-medium">{parsedCommand?.action_preview}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Command: <code className="bg-background px-1 rounded">{input}</code>
              </div>
              {parsedCommand && parsedCommand.confidence < 0.9 && (
                <div className="mt-2 text-xs text-amber-600">
                  Confidence: {Math.round(parsedCommand.confidence * 100)}%
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onReset}>
                Edit
              </Button>
              <Button onClick={onExecute} className="gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Execute
              </Button>
            </div>
          </div>
        );

      case 'executing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Executing command...</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <p className="mt-3 font-medium">Command executed successfully!</p>
            <p className="text-sm text-muted-foreground">{parsedCommand?.action_preview}</p>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-destructive">Error</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
            {parsedCommand?.suggestions && parsedCommand.suggestions.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Did you mean:</p>
                <div className="space-y-1">
                  {parsedCommand.suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm"
                      onClick={() => {
                        onInputChange(s);
                        onReset();
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onReset}>
                Try Again
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-[500px] p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Command className="w-4 h-4" />
            Smart Commands
          </DialogTitle>
          <DialogDescription className="text-xs">
            Control PDF Buddy with natural language
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
