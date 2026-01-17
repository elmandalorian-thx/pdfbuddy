import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { usePDFStore } from './pdfStore';

// Mock the api client
vi.mock('@/api/client', () => ({
  api: {
    getThumbnailUrl: (fileId: string, page: number) => `/api/thumbnail/${fileId}/${page}`,
  },
}));

describe('pdfStore', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      usePDFStore.getState().clearDocument();
    });
  });

  describe('Initial state', () => {
    it('should have null document initially', () => {
      const state = usePDFStore.getState();
      expect(state.document).toBeNull();
    });

    it('should have empty selection initially', () => {
      const state = usePDFStore.getState();
      expect(state.selectedPages.size).toBe(0);
    });

    it('should have default zoom of 100', () => {
      const state = usePDFStore.getState();
      expect(state.zoom).toBe(100);
    });

    it('should have select as default tool', () => {
      const state = usePDFStore.getState();
      expect(state.currentTool).toBe('select');
    });

    it('should have default tool settings', () => {
      const state = usePDFStore.getState();
      expect(state.toolSettings.penColor).toBe('#000000');
      expect(state.toolSettings.penWidth).toBe(2);
      expect(state.toolSettings.highlighterColor).toBe('#FFFF00');
    });
  });

  describe('loadDocument', () => {
    it('should load a document with pages', () => {
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 3,
          page_sizes: [
            { width: 595, height: 842 },
            { width: 595, height: 842 },
            { width: 595, height: 842 },
          ],
          thumbnail_urls: ['/thumb/1', '/thumb/2', '/thumb/3'],
        });
      });

      const state = usePDFStore.getState();
      expect(state.document).not.toBeNull();
      expect(state.document?.fileId).toBe('test-file-id');
      expect(state.document?.originalName).toBe('test.pdf');
      expect(state.document?.numPages).toBe(3);
      expect(state.document?.pages).toHaveLength(3);
    });

    it('should clear selection and annotations when loading new document', () => {
      // First load a document and add selection
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 3,
          page_sizes: [{ width: 595, height: 842 }],
          thumbnail_urls: ['/thumb/1'],
        });
        usePDFStore.getState().togglePageSelection(1);
      });

      expect(usePDFStore.getState().selectedPages.size).toBe(1);

      // Load another document
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id-2', {
          original_name: 'test2.pdf',
          num_pages: 2,
          page_sizes: [{ width: 595, height: 842 }],
          thumbnail_urls: ['/thumb/1'],
        });
      });

      expect(usePDFStore.getState().selectedPages.size).toBe(0);
    });
  });

  describe('clearDocument', () => {
    it('should clear the document and related state', () => {
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 1,
          page_sizes: [{ width: 595, height: 842 }],
          thumbnail_urls: ['/thumb/1'],
        });
        usePDFStore.getState().togglePageSelection(1);
        usePDFStore.getState().clearDocument();
      });

      const state = usePDFStore.getState();
      expect(state.document).toBeNull();
      expect(state.selectedPages.size).toBe(0);
      expect(state.annotations).toEqual({});
    });
  });

  describe('Page selection', () => {
    beforeEach(() => {
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 5,
          page_sizes: Array(5).fill({ width: 595, height: 842 }),
          thumbnail_urls: Array(5).fill('/thumb'),
        });
      });
    });

    it('should toggle page selection', () => {
      act(() => {
        usePDFStore.getState().togglePageSelection(1);
      });
      expect(usePDFStore.getState().selectedPages.has(1)).toBe(true);

      act(() => {
        usePDFStore.getState().togglePageSelection(1);
      });
      expect(usePDFStore.getState().selectedPages.has(1)).toBe(false);
    });

    it('should select multiple pages', () => {
      act(() => {
        usePDFStore.getState().togglePageSelection(1);
        usePDFStore.getState().togglePageSelection(3);
        usePDFStore.getState().togglePageSelection(5);
      });

      const selected = usePDFStore.getState().selectedPages;
      expect(selected.size).toBe(3);
      expect(selected.has(1)).toBe(true);
      expect(selected.has(3)).toBe(true);
      expect(selected.has(5)).toBe(true);
    });

    it('should select page range', () => {
      act(() => {
        usePDFStore.getState().selectPageRange(2, 4);
      });

      const selected = usePDFStore.getState().selectedPages;
      expect(selected.size).toBe(3);
      expect(selected.has(2)).toBe(true);
      expect(selected.has(3)).toBe(true);
      expect(selected.has(4)).toBe(true);
    });

    it('should select page range in reverse order', () => {
      act(() => {
        usePDFStore.getState().selectPageRange(4, 2);
      });

      const selected = usePDFStore.getState().selectedPages;
      expect(selected.size).toBe(3);
      expect(selected.has(2)).toBe(true);
      expect(selected.has(3)).toBe(true);
      expect(selected.has(4)).toBe(true);
    });

    it('should select all pages', () => {
      act(() => {
        usePDFStore.getState().selectAllPages();
      });

      const selected = usePDFStore.getState().selectedPages;
      expect(selected.size).toBe(5);
      for (let i = 1; i <= 5; i++) {
        expect(selected.has(i)).toBe(true);
      }
    });

    it('should clear selection', () => {
      act(() => {
        usePDFStore.getState().selectAllPages();
        usePDFStore.getState().clearSelection();
      });

      expect(usePDFStore.getState().selectedPages.size).toBe(0);
    });
  });

  describe('Zoom', () => {
    it('should set zoom level', () => {
      act(() => {
        usePDFStore.getState().setZoom(150);
      });
      expect(usePDFStore.getState().zoom).toBe(150);
    });

    it('should clamp zoom to minimum 25', () => {
      act(() => {
        usePDFStore.getState().setZoom(10);
      });
      expect(usePDFStore.getState().zoom).toBe(25);
    });

    it('should clamp zoom to maximum 400', () => {
      act(() => {
        usePDFStore.getState().setZoom(500);
      });
      expect(usePDFStore.getState().zoom).toBe(400);
    });
  });

  describe('Tool settings', () => {
    it('should set current tool', () => {
      act(() => {
        usePDFStore.getState().setCurrentTool('pen');
      });
      expect(usePDFStore.getState().currentTool).toBe('pen');
    });

    it('should update tool settings', () => {
      act(() => {
        usePDFStore.getState().updateToolSettings({
          penColor: '#FF0000',
          penWidth: 5,
        });
      });

      const settings = usePDFStore.getState().toolSettings;
      expect(settings.penColor).toBe('#FF0000');
      expect(settings.penWidth).toBe(5);
      // Other settings should remain
      expect(settings.highlighterColor).toBe('#FFFF00');
    });
  });

  describe('Annotations', () => {
    beforeEach(() => {
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 3,
          page_sizes: Array(3).fill({ width: 595, height: 842 }),
          thumbnail_urls: Array(3).fill('/thumb'),
        });
      });
    });

    it('should add annotation', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0], [10, 10]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
      });

      const annotations = usePDFStore.getState().annotations;
      expect(annotations[1]).toHaveLength(1);
      expect(annotations[1][0].id).toBe('ann-1');
    });

    it('should remove annotation', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0], [10, 10]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().removeAnnotation(1, 'ann-1');
      });

      const annotations = usePDFStore.getState().annotations;
      expect(annotations[1]).toHaveLength(0);
    });

    it('should clear page annotations', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().addAnnotation({
          id: 'ann-2',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().clearPageAnnotations(1);
      });

      const annotations = usePDFStore.getState().annotations;
      expect(annotations[1]).toBeUndefined();
    });

    it('should clear all annotations', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().addAnnotation({
          id: 'ann-2',
          type: 'pen',
          pageNumber: 2,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().clearAllAnnotations();
      });

      const annotations = usePDFStore.getState().annotations;
      expect(Object.keys(annotations)).toHaveLength(0);
    });
  });

  describe('Undo/Redo', () => {
    beforeEach(() => {
      act(() => {
        usePDFStore.getState().loadDocument('test-file-id', {
          original_name: 'test.pdf',
          num_pages: 3,
          page_sizes: Array(3).fill({ width: 595, height: 842 }),
          thumbnail_urls: Array(3).fill('/thumb'),
        });
      });
    });

    it('should undo annotation', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
      });

      expect(usePDFStore.getState().annotations[1]).toHaveLength(1);

      act(() => {
        usePDFStore.getState().undo();
      });

      // After undo, annotations should be empty
      expect(usePDFStore.getState().annotations[1]).toBeUndefined();
    });

    it('should redo annotation', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().undo();
        usePDFStore.getState().redo();
      });

      expect(usePDFStore.getState().annotations[1]).toHaveLength(1);
    });

    it('should have empty redo stack after new action', () => {
      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-1',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
        usePDFStore.getState().undo();
      });

      expect(usePDFStore.getState().redoStack).toHaveLength(1);

      act(() => {
        usePDFStore.getState().addAnnotation({
          id: 'ann-2',
          type: 'pen',
          pageNumber: 1,
          points: [[0, 0]],
          color: '#000000',
          width: 2,
          opacity: 1,
        });
      });

      expect(usePDFStore.getState().redoStack).toHaveLength(0);
    });

    it('should limit undo stack to 50 items', () => {
      act(() => {
        for (let i = 0; i < 60; i++) {
          usePDFStore.getState().addAnnotation({
            id: `ann-${i}`,
            type: 'pen',
            pageNumber: 1,
            points: [[0, 0]],
            color: '#000000',
            width: 2,
            opacity: 1,
          });
        }
      });

      expect(usePDFStore.getState().undoStack.length).toBe(50);
    });
  });

  describe('Loading and error states', () => {
    it('should set loading state', () => {
      act(() => {
        usePDFStore.getState().setLoading(true);
      });
      expect(usePDFStore.getState().isLoading).toBe(true);

      act(() => {
        usePDFStore.getState().setLoading(false);
      });
      expect(usePDFStore.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      act(() => {
        usePDFStore.getState().setError('Something went wrong');
      });
      expect(usePDFStore.getState().error).toBe('Something went wrong');

      act(() => {
        usePDFStore.getState().setError(null);
      });
      expect(usePDFStore.getState().error).toBeNull();
    });
  });
});
