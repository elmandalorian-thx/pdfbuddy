import React from 'react';
import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { usePDFStore } from '@/store/pdfStore';
import type { ToolType } from '@/types';

interface AnnotationToolbarProps {
  onSave: () => void;
  onClose: () => void;
  onClear: () => void;
  isSaving?: boolean;
}

const PEN_COLORS = [
  '#000000', // Black
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
];

const HIGHLIGHTER_COLORS = [
  '#FFFF00', // Yellow
  '#00FF00', // Green
  '#FF69B4', // Pink
  '#00BFFF', // Blue
  '#FFA500', // Orange
];

export function AnnotationToolbar({
  onSave,
  onClose,
  onClear,
  isSaving,
}: AnnotationToolbarProps) {
  const {
    currentTool,
    toolSettings,
    setCurrentTool,
    updateToolSettings,
    undoStack,
    redoStack,
    undo,
    redo,
  } = usePDFStore();

  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    { type: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select' },
    { type: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
    { type: 'highlighter', icon: <Highlighter className="w-4 h-4" />, label: 'Highlighter' },
    { type: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-lg p-3 flex items-center gap-4">
      {/* Tool selection */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <Button
            key={tool.type}
            variant={currentTool === tool.type ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentTool(tool.type)}
            title={tool.label}
            className="w-10 h-10"
          >
            {tool.icon}
          </Button>
        ))}
      </div>

      <div className="w-px h-8 bg-border" />

      {/* Pen settings */}
      {currentTool === 'pen' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateToolSettings({ penColor: color })}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                  toolSettings.penColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={toolSettings.penColor}
              onChange={(e) => updateToolSettings({ penColor: e.target.value })}
              className="w-6 h-6 rounded-full cursor-pointer"
              title="Custom color"
            />
          </div>

          <div className="flex items-center gap-2 w-32">
            <span className="text-xs text-muted-foreground">Width</span>
            <Slider
              value={[toolSettings.penWidth]}
              onValueChange={([value]) => updateToolSettings({ penWidth: value })}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-4">{toolSettings.penWidth}</span>
          </div>
        </div>
      )}

      {/* Highlighter settings */}
      {currentTool === 'highlighter' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {HIGHLIGHTER_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateToolSettings({ highlighterColor: color })}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                  toolSettings.highlighterColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: color, opacity: 0.6 }}
                title={color}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 w-32">
            <span className="text-xs text-muted-foreground">Width</span>
            <Slider
              value={[toolSettings.highlighterWidth]}
              onValueChange={([value]) =>
                updateToolSettings({ highlighterWidth: value })
              }
              min={10}
              max={40}
              step={2}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2 w-32">
            <span className="text-xs text-muted-foreground">Opacity</span>
            <Slider
              value={[toolSettings.highlighterOpacity * 100]}
              onValueChange={([value]) =>
                updateToolSettings({ highlighterOpacity: value / 100 })
              }
              min={20}
              max={60}
              step={5}
              className="flex-1"
            />
          </div>
        </div>
      )}

      <div className="w-px h-8 bg-border" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo"
          className="w-10 h-10"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo"
          className="w-10 h-10"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="w-px h-8 bg-border" />

      {/* Clear and Save */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          title="Clear annotations"
          className="w-10 h-10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          title="Save annotations"
        >
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          title="Close"
          className="w-10 h-10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
