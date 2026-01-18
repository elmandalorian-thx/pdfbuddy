import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { usePDFStore } from '@/store/pdfStore';
import { PageThumbnail } from './PageThumbnail';
import { api } from '@/api/client';
import type { PageInfo } from '@/types';

interface PageGridProps {
  onAnnotatePage?: (pageNumber: number) => void;
}

export function PageGrid({ onAnnotatePage }: PageGridProps) {
  const {
    document,
    selectedPages,
    togglePageSelection,
    selectPageRange,
    clearSelection,
    reorderPages,
    updateThumbnails,
    setLoading,
    setError,
    isLoading,
  } = usePDFStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastSelectedPage, setLastSelectedPage] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSelect = useCallback(
    (pageNumber: number, shiftKey: boolean, ctrlKey: boolean) => {
      if (shiftKey && lastSelectedPage !== null) {
        selectPageRange(lastSelectedPage, pageNumber);
      } else if (ctrlKey) {
        togglePageSelection(pageNumber);
      } else {
        clearSelection();
        togglePageSelection(pageNumber);
      }
      setLastSelectedPage(pageNumber);
    },
    [lastSelectedPage, selectPageRange, togglePageSelection, clearSelection]
  );

  const handleRotate = useCallback(
    async (pageNumber: number) => {
      if (!document || isLoading) return;

      setLoading(true);
      try {
        const response = await api.rotatePages(document.fileId, [pageNumber], 90);
        if (response.success && response.thumbnail_urls) {
          updateThumbnails(response.thumbnail_urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rotate page');
      } finally {
        setLoading(false);
      }
    },
    [document, isLoading, setLoading, setError, updateThumbnails]
  );

  const handleDelete = useCallback(
    async (pageNumber: number) => {
      if (!document || isLoading) return;
      if (document.numPages <= 1) {
        setError('Cannot delete the only page');
        return;
      }

      setLoading(true);
      try {
        const response = await api.removePages(document.fileId, [pageNumber]);
        if (response.success && response.thumbnail_urls) {
          // Reload document info
          const info = await api.getFileInfo(document.fileId);
          usePDFStore.getState().loadDocument(document.fileId, {
            original_name: document.originalName,
            num_pages: info.num_pages,
            page_sizes: info.page_sizes,
            thumbnail_urls: response.thumbnail_urls,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete page');
      } finally {
        setLoading(false);
      }
    },
    [document, isLoading, setLoading, setError]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || !document || active.id === over.id) return;

      const oldIndex = document.pages.findIndex((p) => p.id === active.id);
      const newIndex = document.pages.findIndex((p) => p.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Calculate new order (1-indexed page numbers)
      const currentOrder = document.pages.map((p) => p.pageNumber);
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);

      // Update local state immediately for smooth UX
      reorderPages(newOrder);

      // Sync with backend
      setLoading(true);
      try {
        const response = await api.reorderPages(document.fileId, newOrder);
        if (response.success && response.thumbnail_urls) {
          updateThumbnails(response.thumbnail_urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder pages');
        // Could revert here if needed
      } finally {
        setLoading(false);
      }
    },
    [document, reorderPages, updateThumbnails, setLoading, setError]
  );

  if (!document || document.pages.length === 0) {
    return null;
  }

  const activePage = activeId
    ? document.pages.find((p) => p.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={document.pages.map((p) => p.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
          {document.pages.map((page) => (
            <PageThumbnail
              key={page.id}
              page={page}
              isSelected={selectedPages.has(page.pageNumber)}
              isDragging={activeId === page.id}
              isLoading={isLoading}
              onSelect={handleSelect}
              onRotate={handleRotate}
              onDelete={handleDelete}
              onAnnotate={onAnnotatePage}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay adjustScale>
        {activePage && (
          <PageThumbnail
            page={activePage}
            isSelected={selectedPages.has(activePage.pageNumber)}
            isDragging
            onSelect={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
