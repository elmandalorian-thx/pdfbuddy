import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTouchGestures, useTouchDrag } from './useTouchGestures';

// Helper to create touch events
function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
  const touchList = touches.map((t, i) => ({
    identifier: i,
    clientX: t.clientX,
    clientY: t.clientY,
    target: document.body,
  }));

  return new TouchEvent(type, {
    touches: touchList as unknown as Touch[],
    changedTouches: touchList as unknown as Touch[],
    bubbles: true,
  });
}

describe('useTouchGestures', () => {
  let element: HTMLDivElement;
  let ref: { current: HTMLDivElement };

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    ref = { current: element };
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(element);
    vi.useRealTimers();
  });

  it('should initialize with default scale of 1', () => {
    const { result } = renderHook(() => useTouchGestures(ref));
    expect(result.current.currentScale).toBe(1);
  });

  it('should call onDoubleTap on double tap', () => {
    const onDoubleTap = vi.fn();
    renderHook(() => useTouchGestures(ref, { onDoubleTap }));

    // First tap
    act(() => {
      element.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      element.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]));
    });

    // Second tap within 300ms
    act(() => {
      vi.advanceTimersByTime(200);
      element.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    expect(onDoubleTap).toHaveBeenCalled();
  });

  it('should call onSwipeLeft on left swipe', () => {
    const onSwipeLeft = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeLeft, minSwipeDistance: 50 }));

    act(() => {
      // Start touch
      const startEvent = createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]);
      element.dispatchEvent(startEvent);

      // End touch with left swipe
      const endEvent = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeLeft).toHaveBeenCalled();
  });

  it('should call onSwipeRight on right swipe', () => {
    const onSwipeRight = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeRight, minSwipeDistance: 50 }));

    act(() => {
      const startEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(startEvent);

      const endEvent = createTouchEvent('touchend', [{ clientX: 200, clientY: 100 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeRight).toHaveBeenCalled();
  });

  it('should call onSwipeUp on up swipe', () => {
    const onSwipeUp = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeUp, minSwipeDistance: 50 }));

    act(() => {
      const startEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]);
      element.dispatchEvent(startEvent);

      const endEvent = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeUp).toHaveBeenCalled();
  });

  it('should call onSwipeDown on down swipe', () => {
    const onSwipeDown = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeDown, minSwipeDistance: 50 }));

    act(() => {
      const startEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(startEvent);

      const endEvent = createTouchEvent('touchend', [{ clientX: 100, clientY: 200 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeDown).toHaveBeenCalled();
  });

  it('should not trigger swipe if distance is less than minSwipeDistance', () => {
    const onSwipeLeft = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeLeft, minSwipeDistance: 50 }));

    act(() => {
      const startEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(startEvent);

      // Only 30px movement, less than 50px threshold
      const endEvent = createTouchEvent('touchend', [{ clientX: 70, clientY: 100 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('should not trigger events when disabled', () => {
    const onSwipeLeft = vi.fn();
    renderHook(() => useTouchGestures(ref, { onSwipeLeft, enabled: false }));

    act(() => {
      const startEvent = createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]);
      element.dispatchEvent(startEvent);

      const endEvent = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(endEvent);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('should allow setting scale manually', () => {
    const { result } = renderHook(() => useTouchGestures(ref));

    act(() => {
      result.current.setCurrentScale(2);
    });

    expect(result.current.currentScale).toBe(2);
  });
});

describe('useTouchDrag', () => {
  let element: HTMLDivElement;
  let ref: { current: HTMLDivElement };

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    ref = { current: element };
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(element);
    vi.useRealTimers();
  });

  it('should start with isDragging false', () => {
    const { result } = renderHook(() => useTouchDrag(ref));
    expect(result.current.isDragging).toBe(false);
  });

  it('should set isDragging to true after long press', () => {
    const onDragStart = vi.fn();
    const { result } = renderHook(() => useTouchDrag(ref, onDragStart));

    act(() => {
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isDragging).toBe(true);
    expect(onDragStart).toHaveBeenCalled();
  });

  it('should vibrate on drag start if supported', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, writable: true });

    renderHook(() => useTouchDrag(ref));

    act(() => {
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });

    expect(vibrateMock).toHaveBeenCalledWith(50);
  });

  it('should cancel drag on touch move before long press completes', () => {
    const onDragStart = vi.fn();
    const { result } = renderHook(() => useTouchDrag(ref, onDragStart));

    act(() => {
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(200); // Before 500ms threshold
      element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
      vi.advanceTimersByTime(400);
    });

    expect(result.current.isDragging).toBe(false);
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('should call onDragEnd when touch ends while dragging', () => {
    const onDragEnd = vi.fn();
    const { result } = renderHook(() => useTouchDrag(ref, undefined, onDragEnd));

    act(() => {
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    expect(result.current.isDragging).toBe(false);
    expect(onDragEnd).toHaveBeenCalled();
  });
});
