import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { usePDFStore } from '@/store/pdfStore';
import { generateId } from '@/lib/utils';
import type { Annotation } from '@/types';

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

    canvas.renderAll();
  }, [currentTool, toolSettings]);

  // Load existing annotations
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Clear existing paths (keep background)
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.type === 'path') {
        canvas.remove(obj);
      }
    });

    // Add saved annotations
    pageAnnotations.forEach((annotation) => {
      if (annotation.points.length < 2) return;

      const pathData = annotation.points
        .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
        .join(' ');

      const path = new fabric.Path(pathData, {
        stroke: annotation.color,
        strokeWidth: annotation.width,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        opacity: annotation.opacity,
        selectable: currentTool === 'select',
        data: { annotationId: annotation.id },
      });

      canvas.add(path);
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

      const annotation: Annotation = {
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

  // Handle eraser
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || currentTool !== 'eraser') return;

    const handleMouseDown = (e: fabric.IEvent<MouseEvent>) => {
      const target = e.target;
      if (target && target.type === 'path' && target.data?.annotationId) {
        removeAnnotation(pageNumber, target.data.annotationId);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', handleMouseDown as any);

    // Change cursor for eraser
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('mouse:down', handleMouseDown as any);
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
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
