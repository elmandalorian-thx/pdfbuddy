import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const mockHandlers = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
    onRotate: vi.fn(),
    onAnnotate: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onNextPage: vi.fn(),
    onPrevPage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register keyboard event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useKeyboardShortcuts(mockHandlers));

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('should call onUndo when Ctrl+Z is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onUndo).toHaveBeenCalled();
  });

  it('should call onRedo when Ctrl+Shift+Z is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onRedo).toHaveBeenCalled();
  });

  it('should call onRedo when Ctrl+Y is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onRedo).toHaveBeenCalled();
  });

  it('should call onDelete when Delete key is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onDelete).toHaveBeenCalled();
  });

  it('should call onSelectAll when Ctrl+A is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onSelectAll).toHaveBeenCalled();
  });

  it('should call onRotate when R key is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onRotate).toHaveBeenCalled();
  });

  it('should call onAnnotate when A key is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onAnnotate).toHaveBeenCalled();
  });

  it('should call onZoomIn when + key is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: '+',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onZoomIn).toHaveBeenCalled();
  });

  it('should call onZoomOut when - key is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: '-',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onZoomOut).toHaveBeenCalled();
  });

  it('should call onNextPage when ArrowRight is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onNextPage).toHaveBeenCalled();
  });

  it('should call onPrevPage when ArrowLeft is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onPrevPage).toHaveBeenCalled();
  });

  it('should not trigger shortcuts when disabled', () => {
    renderHook(() => useKeyboardShortcuts({ ...mockHandlers, enabled: false }));

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(mockHandlers.onUndo).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts(mockHandlers));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
