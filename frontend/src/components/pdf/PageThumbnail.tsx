import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, RotateCw, Trash2, Edit3, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageInfo } from '@/types';

interface PageThumbnailProps {
  page: PageInfo;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: (pageNumber: number, shiftKey: boolean, ctrlKey: boolean) => void;
  onRotate?: (pageNumber: number) => void;
  onDelete?: (pageNumber: number) => void;
  onAnnotate?: (pageNumber: number) => void;
}

export function PageThumbnail({
  page,
  isSelected,
  isDragging,
  onSelect,
  onRotate,
  onDelete,
  onAnnotate,
}: PageThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onSelect(page.pageNumber, e.shiftKey, e.ctrlKey || e.metaKey);
    },
    [onSelect, page.pageNumber]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onSelect(page.pageNumber, e.shiftKey, e.ctrlKey || e.metaKey);
      }
    },
    [onSelect, page.pageNumber]
  );

  const handleTouchStart = useCallback(() => {
    setShowActions(true);
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Keep actions visible for a bit after touch
    setTimeout(() => setShowActions(false), 3000);
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col items-center p-3 rounded-2xl transition-all duration-300',
        'touch-feedback no-select gpu',
        isSelected
          ? 'bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
          : 'hover:bg-muted/50',
        isSortableDragging && 'z-50 opacity-90 scale-105 shadow-2xl shadow-black/20',
        isDragging && 'ring-2 ring-primary/50'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
      aria-label={`Page ${page.pageNumber}${isSelected ? ', selected' : ''}`}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'absolute top-4 left-4 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300',
          isSelected
            ? 'bg-primary scale-100 shadow-lg shadow-primary/30'
            : 'bg-white/80 dark:bg-gray-800/80 border border-border scale-0 group-hover:scale-100'
        )}
      >
        {isSelected ? (
          <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
        ) : (
          <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/40" />
        )}
      </div>

      {/* Drag handle - visible on touch/hover */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute top-4 right-4 z-20 p-1.5 rounded-lg cursor-grab active:cursor-grabbing',
          'bg-white/90 dark:bg-gray-800/90 border border-border/50 shadow-sm',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          showActions && 'opacity-100',
          'touch-target'
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Thumbnail container */}
      <div
        className={cn(
          'relative w-full aspect-page rounded-xl overflow-hidden',
          'bg-white dark:bg-gray-900',
          'shadow-lg shadow-black/10 dark:shadow-black/30',
          'border border-border/50',
          'transition-transform duration-300',
          page.rotation === 90 && 'rotate-90',
          page.rotation === 180 && 'rotate-180',
          page.rotation === 270 && '-rotate-90'
        )}
      >
        {/* Skeleton loader */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 skeleton" />
        )}

        {/* Error state */}
        {imageError && (
          <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive text-lg">!</span>
            </div>
            <span className="text-xs text-muted-foreground">Failed to load</span>
          </div>
        )}

        {/* Thumbnail image */}
        <img
          src={page.thumbnailUrl}
          alt={`Page ${page.pageNumber}`}
          className={cn(
            'w-full h-full object-contain transition-all duration-500',
            imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          draggable={false}
          loading="lazy"
        />

        {/* Hover overlay with gradient */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            showActions && 'opacity-100'
          )}
        />
      </div>

      {/* Page number badge */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200',
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {page.pageNumber}
        </span>
      </div>

      {/* Action buttons */}
      <div
        className={cn(
          'absolute bottom-16 left-1/2 -translate-x-1/2 z-20',
          'flex items-center gap-1.5 p-1.5 rounded-xl',
          'bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm',
          'border border-border/50 shadow-xl',
          'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100',
          'transition-all duration-200',
          showActions && 'opacity-100 scale-100'
        )}
      >
        {onAnnotate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnnotate(page.pageNumber);
            }}
            className={cn(
              'p-2.5 rounded-lg transition-all duration-200 touch-target',
              'hover:bg-primary hover:text-primary-foreground',
              'active:scale-95'
            )}
            title="Annotate page"
            aria-label="Annotate page"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
        {onRotate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRotate(page.pageNumber);
            }}
            className={cn(
              'p-2.5 rounded-lg transition-all duration-200 touch-target',
              'hover:bg-primary hover:text-primary-foreground',
              'active:scale-95'
            )}
            title="Rotate 90°"
            aria-label="Rotate page 90 degrees"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.pageNumber);
            }}
            className={cn(
              'p-2.5 rounded-lg transition-all duration-200 touch-target',
              'hover:bg-destructive hover:text-destructive-foreground',
              'active:scale-95'
            )}
            title="Delete page"
            aria-label="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
