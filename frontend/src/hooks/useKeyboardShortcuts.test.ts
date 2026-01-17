import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { usePDFStore } from '@/store/pdfStore';

// Mock the PDF store
vi.mock('@/store/pdfStore', () => ({
  usePDFStore: vi.fn(),
}));

// Mock the API
vi.mock('@/api/client', () => ({
  api: {
    removePages: vi.fn(),
    getFileInfo: vi.fn(),
  },
}));

describe('useKeyboardShortcuts', () => {
  const mockStoreState = {
    document: { fileId: 'test-file', numPages: 5, originalName: 'test.pdf', pages: [] },
    selectedPages: new Set([1]),
    selectAllPages: vi.fn(),
    clearSelection: vi.fn(),
    togglePageSelection: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    undoStack: ['action1'],
    redoStack: ['action2'],
    setLoading: vi.fn(),
    setError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePDFStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStoreState);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register keyboard event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useKeyboardShortcuts());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('should call undo when Ctrl+Z is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.undo).toHaveBeenCalled();
  });

  it('should call redo when Ctrl+Shift+Z is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.redo).toHaveBeenCalled();
  });

  it('should call redo when Ctrl+Y is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.redo).toHaveBeenCalled();
  });

  it('should call onDelete when Delete key is pressed', () => {
    const onDelete = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onDelete }));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call selectAllPages when Ctrl+A is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.selectAllPages).toHaveBeenCalled();
  });

  it('should call onRotate when R key is pressed', () => {
    const onRotate = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onRotate }));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(onRotate).toHaveBeenCalled();
  });

  it('should call onAnnotate when E key is pressed', () => {
    const onAnnotate = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onAnnotate }));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'e',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(onAnnotate).toHaveBeenCalled();
  });

  it('should navigate with ArrowRight key', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.clearSelection).toHaveBeenCalled();
    expect(mockStoreState.togglePageSelection).toHaveBeenCalled();
  });

  it('should navigate with ArrowLeft key', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.clearSelection).toHaveBeenCalled();
    expect(mockStoreState.togglePageSelection).toHaveBeenCalled();
  });

  it('should clear selection on Escape', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.clearSelection).toHaveBeenCalled();
  });

  it('should not trigger shortcuts when disabled', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: false }));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.undo).not.toHaveBeenCalled();
  });

  it('should not trigger when no document is loaded', () => {
    (usePDFStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStoreState,
      document: null,
    });

    renderHook(() => useKeyboardShortcuts());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockStoreState.undo).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
