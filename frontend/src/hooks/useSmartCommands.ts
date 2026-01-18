import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import type { ParsedCommandResponse, CommandSuggestion } from '@/types';

export type CommandPaletteState =
  | 'idle'
  | 'input'
  | 'parsing'
  | 'preview'
  | 'confirming'
  | 'executing'
  | 'success'
  | 'error';

interface UseSmartCommandsOptions {
  fileId: string | null;
  selectedPages?: number[];
  onSuccess?: (result: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

interface UseSmartCommandsReturn {
  // State
  isOpen: boolean;
  state: CommandPaletteState;
  input: string;
  parsedCommand: ParsedCommandResponse | null;
  error: string | null;
  suggestions: CommandSuggestion[];
  isLoading: boolean;

  // Actions
  open: () => void;
  close: () => void;
  setInput: (value: string) => void;
  parseCommand: () => Promise<void>;
  executeCommand: () => Promise<void>;
  confirmCommand: () => void;
  cancelConfirm: () => void;
  reset: () => void;
  selectSuggestion: (suggestion: CommandSuggestion) => void;
}

export function useSmartCommands({
  fileId,
  selectedPages,
  onSuccess,
  onError,
}: UseSmartCommandsOptions): UseSmartCommandsReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<CommandPaletteState>('idle');
  const [input, setInput] = useState('');
  const [parsedCommand, setParsedCommand] = useState<ParsedCommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load suggestions on mount and when input changes
  useEffect(() => {
    if (!isOpen) return;

    // Debounce suggestion fetching
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await api.getCommandSuggestions(input || undefined);
        setSuggestions(response.suggestions);
      } catch {
        // Silently fail for suggestions
      }
    }, 150);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [isOpen, input]);

  const open = useCallback(() => {
    setIsOpen(true);
    setState('input');
    setInput('');
    setParsedCommand(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setState('idle');
    setInput('');
    setParsedCommand(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setState('input');
    setParsedCommand(null);
    setError(null);
  }, []);

  const parseCommand = useCallback(async () => {
    if (!fileId || !input.trim()) return;

    setState('parsing');
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.parseSmartCommand(input, fileId, selectedPages);
      setParsedCommand(result);

      if (!result.success) {
        setError('Could not understand command. Try one of the suggestions.');
        setState('error');
      } else if (result.requires_confirmation) {
        setState('confirming');
      } else {
        setState('preview');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse command';
      setError(errorMessage);
      setState('error');
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, input, selectedPages, onError]);

  const confirmCommand = useCallback(() => {
    setState('preview');
  }, []);

  const cancelConfirm = useCallback(() => {
    setState('input');
    setParsedCommand(null);
  }, []);

  const executeCommand = useCallback(async () => {
    if (!fileId || !parsedCommand) return;

    setState('executing');
    setIsLoading(true);

    try {
      const result = await api.executeSmartCommand(
        fileId,
        parsedCommand.intent,
        parsedCommand.parameters as Record<string, unknown>,
        true
      );

      if (result.success) {
        setState('success');
        onSuccess?.(result.result || {});
        // Auto-close after success
        setTimeout(() => {
          close();
        }, 1500);
      } else {
        setError(result.message);
        setState('error');
        onError?.(result.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute command';
      setError(errorMessage);
      setState('error');
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, parsedCommand, onSuccess, onError, close]);

  const selectSuggestion = useCallback((suggestion: CommandSuggestion) => {
    setInput(suggestion.command);
  }, []);

  return {
    isOpen,
    state,
    input,
    parsedCommand,
    error,
    suggestions,
    isLoading,
    open,
    close,
    setInput,
    parseCommand,
    executeCommand,
    confirmCommand,
    cancelConfirm,
    reset,
    selectSuggestion,
  };
}
