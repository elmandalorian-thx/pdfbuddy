import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, RotateCw, Trash2, Edit3 } from 'lucide-react';
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
    zIndex: isSortableDragging ? 1000 : 'auto',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect(page.pageNumber, e.shiftKey, e.ctrlKey || e.metaKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect(page.pageNumber, e.shiftKey, e.ctrlKey || e.metaKey);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col items-center p-2 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing',
        isSelected
          ? 'bg-primary/10 ring-2 ring-primary'
          : 'hover:bg-muted',
        isSortableDragging && 'opacity-50 shadow-2xl scale-105',
        isDragging && 'ring-2 ring-primary/50'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      {...attributes}
      {...listeners}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 left-3 z-10 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Thumbnail container */}
      <div
        className={cn(
          'relative w-[150px] h-[200px] bg-white rounded shadow-md overflow-hidden border border-muted',
          page.rotation === 90 && 'rotate-90',
          page.rotation === 180 && 'rotate-180',
          page.rotation === 270 && '-rotate-90'
        )}
      >
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Failed to load</span>
          </div>
        )}

        {/* Thumbnail image */}
        <img
          src={page.thumbnailUrl}
          alt={`Page ${page.pageNumber}`}
          className={cn(
            'w-full h-full object-contain transition-opacity duration-200',
            imageLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          draggable={false}
        />
      </div>

      {/* Page number */}
      <span className="mt-2 text-sm font-medium text-muted-foreground">
        {page.pageNumber}
      </span>

      {/* Action buttons - show on hover */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onAnnotate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnnotate(page.pageNumber);
            }}
            className="p-1.5 bg-white rounded-full shadow hover:bg-primary hover:text-white transition-colors"
            title="Annotate"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
        {onRotate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRotate(page.pageNumber);
            }}
            className="p-1.5 bg-white rounded-full shadow hover:bg-primary hover:text-white transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.pageNumber);
            }}
            className="p-1.5 bg-white rounded-full shadow hover:bg-destructive hover:text-white transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
