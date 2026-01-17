import { useEffect, useRef, useCallback, useState } from 'react';

interface TouchGesturesOptions {
  onPinchZoom?: (scale: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  minSwipeDistance?: number;
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startDistance: number;
  startScale: number;
  lastTap: number;
}

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  options: TouchGesturesOptions = {}
) {
  const {
    onPinchZoom,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDoubleTap,
    minSwipeDistance = 50,
    enabled = true,
  } = options;

  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startDistance: 0,
    startScale: 1,
    lastTap: 0,
  });

  const [currentScale, setCurrentScale] = useState(1);

  const getDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      touchState.current.startX = touch.clientX;
      touchState.current.startY = touch.clientY;

      // Double tap detection
      const now = Date.now();
      if (now - touchState.current.lastTap < 300) {
        onDoubleTap?.();
      }
      touchState.current.lastTap = now;

      // Pinch zoom start
      if (e.touches.length === 2) {
        touchState.current.startDistance = getDistance(e.touches);
        touchState.current.startScale = currentScale;
      }
    },
    [enabled, onDoubleTap, getDistance, currentScale]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      // Pinch zoom
      if (e.touches.length === 2 && onPinchZoom) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        if (touchState.current.startDistance > 0) {
          const scale =
            touchState.current.startScale *
            (currentDistance / touchState.current.startDistance);
          const clampedScale = Math.max(0.5, Math.min(3, scale));
          setCurrentScale(clampedScale);
          onPinchZoom(clampedScale);
        }
      }
    },
    [enabled, onPinchZoom, getDistance]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      // Swipe detection (only for single touch)
      if (e.changedTouches.length === 1 && touchState.current.startDistance === 0) {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchState.current.startX;
        const deltaY = touch.clientY - touchState.current.startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > minSwipeDistance || absY > minSwipeDistance) {
          if (absX > absY) {
            // Horizontal swipe
            if (deltaX > 0) {
              onSwipeRight?.();
            } else {
              onSwipeLeft?.();
            }
          } else {
            // Vertical swipe
            if (deltaY > 0) {
              onSwipeDown?.();
            } else {
              onSwipeUp?.();
            }
          }
        }
      }

      // Reset pinch state
      touchState.current.startDistance = 0;
    },
    [enabled, minSwipeDistance, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { currentScale, setCurrentScale };
}

// Hook for handling touch-friendly drag on mobile
export function useTouchDrag(
  elementRef: React.RefObject<HTMLElement>,
  onDragStart?: () => void,
  onDragEnd?: () => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      onDragStart?.();
      // Vibrate on mobile if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms long press to start drag
  }, [onDragStart]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) {
      setIsDragging(false);
      onDragEnd?.();
    }
  }, [isDragging, onDragEnd]);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves
    if (longPressTimer.current && !isDragging) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, [isDragging]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [elementRef, handleTouchStart, handleTouchEnd, handleTouchMove]);

  return { isDragging };
}
