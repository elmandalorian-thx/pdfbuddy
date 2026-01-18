import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { usePDFStore } from '@/store/pdfStore';
import { generateId } from '@/lib/utils';
import type { Annotation, TextAnnotation, DrawAnnotation } from '@/types';

interface AnnotationCanvasProps {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

export function AnnotationCanvas({
  pageNumber,
  imageUrl,
  width,
  height,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<[number, number][]>([]);

  const {
    currentTool,
    toolSettings,
    annotations,
    addAnnotation,
    removeAnnotation,
  } = usePDFStore();

  const pageAnnotations = annotations[pageNumber] || [];

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      isDrawingMode: false,
      selection: currentTool === 'select',
      backgroundColor: 'transparent',
    });

    fabricCanvasRef.current = canvas;

    // Load background image
    fabric.Image.fromURL(imageUrl, (img) => {
      img.scaleToWidth(width);
      img.scaleToHeight(height);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        originX: 'left',
        originY: 'top',
      });
    }, { crossOrigin: 'anonymous' });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [imageUrl, width, height]);

  // Update canvas mode based on current tool
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = currentTool === 'pen' || currentTool === 'highlighter';
    canvas.selection = currentTool === 'select';

    if (canvas.isDrawingMode) {
      const brush = new fabric.PencilBrush(canvas);

      if (currentTool === 'pen') {
        brush.color = toolSettings.penColor;
        brush.width = toolSettings.penWidth;
      } else {
        // Highlighter with opacity
        const color = fabric.Color.fromHex(toolSettings.highlighterColor);
        color.setAlpha(toolSettings.highlighterOpacity);
        brush.color = color.toRgba();
        brush.width = toolSettings.highlighterWidth;
      }

      canvas.freeDrawingBrush = brush;
    }

    // Set cursor for text tool
    if (currentTool === 'text') {
      canvas.defaultCursor = 'text';
      canvas.hoverCursor = 'text';
    } else if (currentTool === 'eraser') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }

    canvas.renderAll();
  }, [currentTool, toolSettings]);

  // Load existing annotations (both paths and text)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Clear existing objects (keep background)
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.type === 'path' || obj.type === 'i-text' || obj.type === 'textbox') {
        canvas.remove(obj);
      }
    });

    // Add saved annotations
    pageAnnotations.forEach((annotation) => {
      if (annotation.type === 'text') {
        // Text annotation
        const textAnnotation = annotation as TextAnnotation;
        const text = new fabric.IText(textAnnotation.text, {
          left: textAnnotation.x,
          top: textAnnotation.y,
          fontSize: textAnnotation.fontSize,
          fontFamily: textAnnotation.fontFamily,
          fill: textAnnotation.color,
          fontWeight: textAnnotation.bold ? 'bold' : 'normal',
          fontStyle: textAnnotation.italic ? 'italic' : 'normal',
          underline: textAnnotation.underline,
          selectable: currentTool === 'select',
          editable: currentTool === 'select',
          data: { annotationId: annotation.id, type: 'text' },
        });
        canvas.add(text);
      } else {
        // Draw annotation (pen/highlighter)
        const drawAnnotation = annotation as DrawAnnotation;
        if (drawAnnotation.points.length < 2) return;

        const pathData = drawAnnotation.points
          .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
          .join(' ');

        const path = new fabric.Path(pathData, {
          stroke: drawAnnotation.color,
          strokeWidth: drawAnnotation.width,
          fill: '',
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          opacity: drawAnnotation.opacity,
          selectable: currentTool === 'select',
          data: { annotationId: annotation.id, type: 'draw' },
        });

        canvas.add(path);
      }
    });

    canvas.renderAll();
  }, [pageAnnotations, currentTool]);

  // Handle path creation
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: { path: fabric.Path }) => {
      const path = e.path;
      if (!path) return;

      // Extract points from path
      const pathData = path.path;
      const points: [number, number][] = [];

      if (pathData) {
        pathData.forEach((cmd: any) => {
          if (cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Q') {
            points.push([cmd[1], cmd[2]]);
            if (cmd[0] === 'Q') {
              points.push([cmd[3], cmd[4]]);
            }
          }
        });
      }

      if (points.length < 2) return;

      const annotation: DrawAnnotation = {
        id: generateId(),
        type: currentTool === 'highlighter' ? 'highlighter' : 'pen',
        points,
        color:
          currentTool === 'highlighter'
            ? toolSettings.highlighterColor
            : toolSettings.penColor,
        width:
          currentTool === 'highlighter'
            ? toolSettings.highlighterWidth
            : toolSettings.penWidth,
        opacity:
          currentTool === 'highlighter' ? toolSettings.highlighterOpacity : 1,
        pageNumber,
      };

      addAnnotation(annotation);

      // Remove the fabric path, we'll redraw from state
      canvas.remove(path);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', handlePathCreated as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('path:created', handlePathCreated as any);
    };
  }, [currentTool, toolSettings, pageNumber, addAnnotation]);

  // Handle text tool clicks
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || currentTool !== 'text') return;

    const handleMouseDown = (e: fabric.IEvent<MouseEvent>) => {
      // Don't create new text if clicking on existing object
      if (e.target) return;

      const pointer = canvas.getPointer(e.e);

      // Create text annotation
      const textAnnotation: TextAnnotation = {
        id: generateId(),
        type: 'text',
        text: 'Type here...',
        x: pointer.x,
        y: pointer.y,
        fontSize: toolSettings.text.fontSize,
        fontFamily: toolSettings.text.fontFamily,
        color: toolSettings.text.textColor,
        bold: toolSettings.text.bold,
        italic: toolSettings.text.italic,
        underline: toolSettings.text.underline,
        pageNumber,
      };

      addAnnotation(textAnnotation);

      // Create the fabric text object for immediate editing
      const text = new fabric.IText(textAnnotation.text, {
        left: pointer.x,
        top: pointer.y,
        fontSize: toolSettings.text.fontSize,
        fontFamily: toolSettings.text.fontFamily,
        fill: toolSettings.text.textColor,
        fontWeight: toolSettings.text.bold ? 'bold' : 'normal',
        fontStyle: toolSettings.text.italic ? 'italic' : 'normal',
        underline: toolSettings.text.underline,
        selectable: true,
        editable: true,
        data: { annotationId: textAnnotation.id, type: 'text' },
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', handleMouseDown as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('mouse:down', handleMouseDown as any);
    };
  }, [currentTool, toolSettings.text, pageNumber, addAnnotation]);

  // Handle text editing completion - update annotation
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleTextChanged = (e: fabric.IEvent & { target?: fabric.IText }) => {
      const target = e.target;
      if (!target || target.type !== 'i-text' || !target.data?.annotationId) return;

      const annotationId = target.data.annotationId;
      const existingAnnotations = usePDFStore.getState().annotations[pageNumber] || [];
      const existingAnnotation = existingAnnotations.find(a => a.id === annotationId);

      if (existingAnnotation && existingAnnotation.type === 'text') {
        // Update the annotation with new text
        const updatedAnnotation: TextAnnotation = {
          ...(existingAnnotation as TextAnnotation),
          text: target.text || '',
          x: target.left || 0,
          y: target.top || 0,
        };

        // Remove old and add updated
        removeAnnotation(pageNumber, annotationId);
        addAnnotation(updatedAnnotation);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('text:changed', handleTextChanged as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('object:modified', handleTextChanged as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('text:changed', handleTextChanged as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('object:modified', handleTextChanged as any);
    };
  }, [pageNumber, addAnnotation, removeAnnotation]);

  // Handle eraser for both paths and text
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || currentTool !== 'eraser') return;

    const handleMouseDown = (e: fabric.IEvent<MouseEvent>) => {
      const target = e.target;
      if (target && target.data?.annotationId) {
        removeAnnotation(pageNumber, target.data.annotationId);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', handleMouseDown as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('mouse:down', handleMouseDown as any);
    };
  }, [currentTool, pageNumber, removeAnnotation]);

  return (
    <div
      ref={containerRef}
      className="relative bg-gray-100 shadow-lg rounded overflow-hidden"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="canvas-container" />
    </div>
  );
}
