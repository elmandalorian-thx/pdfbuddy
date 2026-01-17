import { useEffect, useCallback } from 'react';
import { usePDFStore } from '@/store/pdfStore';
import { api } from '@/api/client';

interface KeyboardShortcutsOptions {
  enabled?: boolean;
  onDelete?: () => void;
  onRotate?: () => void;
  onAnnotate?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { enabled = true, onDelete, onRotate, onAnnotate } = options;

  const {
    document,
    selectedPages,
    selectAllPages,
    clearSelection,
    togglePageSelection,
    undo,
    redo,
    undoStack,
    redoStack,
    setLoading,
    setError,
  } = usePDFStore();

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (!enabled || !document) return;

      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Z - Undo
      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          undo();
        }
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((modKey && e.shiftKey && e.key === 'z') || (modKey && e.key === 'y')) {
        e.preventDefault();
        if (redoStack.length > 0) {
          redo();
        }
        return;
      }

      // Ctrl/Cmd + A - Select all
      if (modKey && e.key === 'a') {
        e.preventDefault();
        selectAllPages();
        return;
      }

      // Escape - Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Delete or Backspace - Delete selected pages
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPages.size > 0) {
        e.preventDefault();
        if (onDelete) {
          onDelete();
        } else {
          // Default delete behavior
          if (selectedPages.size >= document.numPages) {
            setError('Cannot delete all pages');
            return;
          }
          setLoading(true);
          try {
            const pages = Array.from(selectedPages);
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
        }
        return;
      }

      // R - Rotate selected pages
      if (e.key === 'r' && !modKey && selectedPages.size > 0) {
        e.preventDefault();
        if (onRotate) {
          onRotate();
        }
        return;
      }

      // E - Edit/Annotate first selected page
      if (e.key === 'e' && !modKey && selectedPages.size > 0) {
        e.preventDefault();
        if (onAnnotate) {
          onAnnotate();
        }
        return;
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentSelection = Array.from(selectedPages).sort((a, b) => a - b);
        const lastSelected = currentSelection[currentSelection.length - 1] || 0;
        const nextPage = Math.min(lastSelected + 1, document.numPages);

        if (e.shiftKey) {
          // Extend selection
          togglePageSelection(nextPage);
        } else {
          // Move selection
          clearSelection();
          togglePageSelection(nextPage);
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentSelection = Array.from(selectedPages).sort((a, b) => a - b);
        const firstSelected = currentSelection[0] || 2;
        const prevPage = Math.max(firstSelected - 1, 1);

        if (e.shiftKey) {
          // Extend selection
          togglePageSelection(prevPage);
        } else {
          // Move selection
          clearSelection();
          togglePageSelection(prevPage);
        }
        return;
      }

      // Home - Select first page
      if (e.key === 'Home') {
        e.preventDefault();
        clearSelection();
        togglePageSelection(1);
        return;
      }

      // End - Select last page
      if (e.key === 'End') {
        e.preventDefault();
        clearSelection();
        togglePageSelection(document.numPages);
        return;
      }
    },
    [
      enabled,
      document,
      selectedPages,
      selectAllPages,
      clearSelection,
      togglePageSelection,
      undo,
      redo,
      undoStack,
      redoStack,
      setLoading,
      setError,
      onDelete,
      onRotate,
      onAnnotate,
    ]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

// Keyboard shortcuts help data
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], mac: ['⌘', 'Z'], description: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], mac: ['⌘', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Ctrl', 'A'], mac: ['⌘', 'A'], description: 'Select all pages' },
  { keys: ['Escape'], mac: ['Escape'], description: 'Clear selection' },
  { keys: ['Delete'], mac: ['Delete'], description: 'Delete selected pages' },
  { keys: ['R'], mac: ['R'], description: 'Rotate selected pages' },
  { keys: ['E'], mac: ['E'], description: 'Annotate selected page' },
  { keys: ['←', '↑'], mac: ['←', '↑'], description: 'Select previous page' },
  { keys: ['→', '↓'], mac: ['→', '↓'], description: 'Select next page' },
  { keys: ['Shift', '→'], mac: ['Shift', '→'], description: 'Extend selection' },
  { keys: ['Home'], mac: ['Home'], description: 'Select first page' },
  { keys: ['End'], mac: ['End'], description: 'Select last page' },
];
