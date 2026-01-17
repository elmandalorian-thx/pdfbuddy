import { create } from 'zustand';
import type {
  PDFDocument,
  PageInfo,
  Annotation,
  AnnotationsByPage,
  ToolType,
  ToolSettings,
  UndoAction,
} from '@/types';
import { api } from '@/api/client';

interface PDFState {
  // Document state
  document: PDFDocument | null;
  isLoading: boolean;
  error: string | null;

  // Selection state
  selectedPages: Set<number>;

  // Annotation state
  annotations: AnnotationsByPage;
  currentTool: ToolType;
  toolSettings: ToolSettings;

  // Undo/Redo
  undoStack: UndoAction[];
  redoStack: UndoAction[];

  // View state
  activePageForAnnotation: number | null;
  zoom: number;

  // Actions
  loadDocument: (fileId: string, response: {
    original_name: string;
    num_pages: number;
    page_sizes: { width: number; height: number }[];
    thumbnail_urls: string[];
  }) => void;
  clearDocument: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Page selection
  togglePageSelection: (pageNumber: number) => void;
  selectPageRange: (start: number, end: number) => void;
  selectAllPages: () => void;
  clearSelection: () => void;

  // Page operations
  reorderPages: (newOrder: number[]) => void;
  updateThumbnails: (thumbnailUrls: string[]) => void;
  setPageRotation: (pageNumber: number, rotation: number) => void;

  // Annotations
  setCurrentTool: (tool: ToolType) => void;
  updateToolSettings: (settings: Partial<ToolSettings>) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (pageNumber: number, annotationId: string) => void;
  clearPageAnnotations: (pageNumber: number) => void;
  clearAllAnnotations: () => void;
  setActivePageForAnnotation: (pageNumber: number | null) => void;

  // View
  setZoom: (zoom: number) => void;

  // Undo/Redo
  pushUndo: (action: UndoAction) => void;
  undo: () => void;
  redo: () => void;
}

export const usePDFStore = create<PDFState>((set, get) => ({
  // Initial state
  document: null,
  isLoading: false,
  error: null,
  selectedPages: new Set(),
  annotations: {},
  currentTool: 'select',
  toolSettings: {
    penColor: '#000000',
    penWidth: 2,
    highlighterColor: '#FFFF00',
    highlighterWidth: 20,
    highlighterOpacity: 0.4,
  },
  undoStack: [],
  redoStack: [],
  activePageForAnnotation: null,
  zoom: 100,

  // Document actions
  loadDocument: (fileId, response) => {
    const pages: PageInfo[] = response.thumbnail_urls.map((url, index) => ({
      id: `page-${index + 1}`,
      pageNumber: index + 1,
      thumbnailUrl: api.getThumbnailUrl(fileId, index + 1),
      width: response.page_sizes[index]?.width || 595,
      height: response.page_sizes[index]?.height || 842,
      rotation: 0,
      selected: false,
    }));

    set({
      document: {
        fileId,
        originalName: response.original_name,
        numPages: response.num_pages,
        pages,
        pageSizes: response.page_sizes,
      },
      selectedPages: new Set(),
      annotations: {},
      undoStack: [],
      redoStack: [],
      error: null,
    });
  },

  clearDocument: () => {
    set({
      document: null,
      selectedPages: new Set(),
      annotations: {},
      undoStack: [],
      redoStack: [],
      activePageForAnnotation: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Page selection actions
  togglePageSelection: (pageNumber) => {
    const selected = new Set(get().selectedPages);
    if (selected.has(pageNumber)) {
      selected.delete(pageNumber);
    } else {
      selected.add(pageNumber);
    }
    set({ selectedPages: selected });
  },

  selectPageRange: (start, end) => {
    const selected = new Set(get().selectedPages);
    const [min, max] = [Math.min(start, end), Math.max(start, end)];
    for (let i = min; i <= max; i++) {
      selected.add(i);
    }
    set({ selectedPages: selected });
  },

  selectAllPages: () => {
    const doc = get().document;
    if (!doc) return;
    const selected = new Set<number>();
    for (let i = 1; i <= doc.numPages; i++) {
      selected.add(i);
    }
    set({ selectedPages: selected });
  },

  clearSelection: () => {
    set({ selectedPages: new Set() });
  },

  // Page operation actions
  reorderPages: (newOrder) => {
    const doc = get().document;
    if (!doc) return;

    // Save current state for undo
    const previousOrder = doc.pages.map((p) => p.pageNumber);
    get().pushUndo({
      type: 'reorder',
      previousState: previousOrder,
      description: 'Reorder pages',
    });

    // Create new pages array based on new order
    const newPages = newOrder.map((oldPageNum, newIndex) => {
      const page = doc.pages.find((p) => p.pageNumber === oldPageNum)!;
      return {
        ...page,
        pageNumber: newIndex + 1,
        id: `page-${newIndex + 1}`,
      };
    });

    // Remap annotations to new page numbers
    const oldAnnotations = get().annotations;
    const newAnnotations: AnnotationsByPage = {};
    newOrder.forEach((oldPageNum, newIndex) => {
      if (oldAnnotations[oldPageNum]) {
        newAnnotations[newIndex + 1] = oldAnnotations[oldPageNum].map((a) => ({
          ...a,
          pageNumber: newIndex + 1,
        }));
      }
    });

    set({
      document: {
        ...doc,
        pages: newPages,
      },
      annotations: newAnnotations,
      redoStack: [],
    });
  },

  updateThumbnails: (thumbnailUrls) => {
    const doc = get().document;
    if (!doc) return;

    const updatedPages = doc.pages.map((page, index) => ({
      ...page,
      thumbnailUrl: thumbnailUrls[index] || page.thumbnailUrl,
    }));

    set({
      document: {
        ...doc,
        pages: updatedPages,
      },
    });
  },

  setPageRotation: (pageNumber, rotation) => {
    const doc = get().document;
    if (!doc) return;

    const updatedPages = doc.pages.map((page) =>
      page.pageNumber === pageNumber ? { ...page, rotation } : page
    );

    set({
      document: {
        ...doc,
        pages: updatedPages,
      },
    });
  },

  // Annotation actions
  setCurrentTool: (tool) => set({ currentTool: tool }),

  updateToolSettings: (settings) => {
    set({
      toolSettings: {
        ...get().toolSettings,
        ...settings,
      },
    });
  },

  addAnnotation: (annotation) => {
    const annotations = { ...get().annotations };
    if (!annotations[annotation.pageNumber]) {
      annotations[annotation.pageNumber] = [];
    }
    annotations[annotation.pageNumber] = [
      ...annotations[annotation.pageNumber],
      annotation,
    ];

    get().pushUndo({
      type: 'annotation',
      previousState: get().annotations,
      description: `Add ${annotation.type}`,
    });

    set({ annotations, redoStack: [] });
  },

  removeAnnotation: (pageNumber, annotationId) => {
    const annotations = { ...get().annotations };
    if (annotations[pageNumber]) {
      get().pushUndo({
        type: 'annotation',
        previousState: get().annotations,
        description: 'Remove annotation',
      });

      annotations[pageNumber] = annotations[pageNumber].filter(
        (a) => a.id !== annotationId
      );
      set({ annotations, redoStack: [] });
    }
  },

  clearPageAnnotations: (pageNumber) => {
    const annotations = { ...get().annotations };
    if (annotations[pageNumber]?.length) {
      get().pushUndo({
        type: 'annotation',
        previousState: get().annotations,
        description: 'Clear page annotations',
      });

      delete annotations[pageNumber];
      set({ annotations, redoStack: [] });
    }
  },

  clearAllAnnotations: () => {
    if (Object.keys(get().annotations).length > 0) {
      get().pushUndo({
        type: 'annotation',
        previousState: get().annotations,
        description: 'Clear all annotations',
      });

      set({ annotations: {}, redoStack: [] });
    }
  },

  setActivePageForAnnotation: (pageNumber) => {
    set({ activePageForAnnotation: pageNumber });
  },

  // View actions
  setZoom: (zoom) => set({ zoom: Math.max(25, Math.min(400, zoom)) }),

  // Undo/Redo actions
  pushUndo: (action) => {
    const undoStack = [...get().undoStack, action].slice(-50); // Keep last 50 actions
    set({ undoStack });
  },

  undo: () => {
    const undoStack = [...get().undoStack];
    const action = undoStack.pop();
    if (!action) return;

    const redoStack = [...get().redoStack];

    if (action.type === 'annotation') {
      redoStack.push({
        type: 'annotation',
        previousState: get().annotations,
        description: action.description,
      });
      set({
        annotations: action.previousState as AnnotationsByPage,
        undoStack,
        redoStack,
      });
    } else if (action.type === 'reorder') {
      const doc = get().document;
      if (!doc) return;

      redoStack.push({
        type: 'reorder',
        previousState: doc.pages.map((p) => p.pageNumber),
        description: action.description,
      });

      const previousOrder = action.previousState as number[];
      const newPages = previousOrder.map((pageNum, index) => ({
        ...doc.pages.find((p) => p.pageNumber === pageNum)!,
        pageNumber: index + 1,
        id: `page-${index + 1}`,
      }));

      set({
        document: { ...doc, pages: newPages },
        undoStack,
        redoStack,
      });
    }
  },

  redo: () => {
    const redoStack = [...get().redoStack];
    const action = redoStack.pop();
    if (!action) return;

    const undoStack = [...get().undoStack];

    if (action.type === 'annotation') {
      undoStack.push({
        type: 'annotation',
        previousState: get().annotations,
        description: action.description,
      });
      set({
        annotations: action.previousState as AnnotationsByPage,
        undoStack,
        redoStack,
      });
    } else if (action.type === 'reorder') {
      const doc = get().document;
      if (!doc) return;

      undoStack.push({
        type: 'reorder',
        previousState: doc.pages.map((p) => p.pageNumber),
        description: action.description,
      });

      const newOrder = action.previousState as number[];
      const newPages = newOrder.map((pageNum, index) => ({
        ...doc.pages.find((p) => p.pageNumber === pageNum)!,
        pageNumber: index + 1,
        id: `page-${index + 1}`,
      }));

      set({
        document: { ...doc, pages: newPages },
        undoStack,
        redoStack,
      });
    }
  },
}));
