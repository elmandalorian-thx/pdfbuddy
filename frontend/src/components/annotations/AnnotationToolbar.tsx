import React, { useState, useRef, useEffect } from 'react';
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
  Type,
  Bold,
  Italic,
  Underline,
  ChevronDown,
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

const TEXT_COLORS = [
  '#000000', // Black
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
];

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

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
    updateTextSettings,
    undoStack,
    redoStack,
    undo,
    redo,
  } = usePDFStore();

  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setShowFontDropdown(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
        setShowSizeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    { type: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select' },
    { type: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
    { type: 'highlighter', icon: <Highlighter className="w-4 h-4" />, label: 'Highlighter' },
    { type: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
    { type: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  ];

  return (
    <>
      {/* Text Formatting Floating Toolbar */}
      {currentTool === 'text' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-lg p-2 flex items-center gap-2">
          {/* Font Family Dropdown */}
          <div className="relative" ref={fontDropdownRef}>
            <button
              onClick={() => setShowFontDropdown(!showFontDropdown)}
              className="flex items-center gap-1 px-2 py-1.5 text-sm border rounded-lg hover:bg-muted min-w-[100px] justify-between"
            >
              <span className="truncate" style={{ fontFamily: toolSettings.text.fontFamily }}>
                {toolSettings.text.fontFamily}
              </span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {showFontDropdown && (
              <div className="absolute bottom-full mb-1 left-0 bg-background border rounded-lg shadow-lg py-1 min-w-[140px] max-h-48 overflow-y-auto">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font}
                    onClick={() => {
                      updateTextSettings({ fontFamily: font });
                      setShowFontDropdown(false);
                    }}
                    className={cn(
                      'w-full px-3 py-1.5 text-sm text-left hover:bg-muted',
                      toolSettings.text.fontFamily === font && 'bg-muted'
                    )}
                    style={{ fontFamily: font }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font Size Dropdown */}
          <div className="relative" ref={sizeDropdownRef}>
            <button
              onClick={() => setShowSizeDropdown(!showSizeDropdown)}
              className="flex items-center gap-1 px-2 py-1.5 text-sm border rounded-lg hover:bg-muted min-w-[60px] justify-between"
            >
              <span>{toolSettings.text.fontSize}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSizeDropdown && (
              <div className="absolute bottom-full mb-1 left-0 bg-background border rounded-lg shadow-lg py-1 min-w-[60px] max-h-48 overflow-y-auto">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      updateTextSettings({ fontSize: size });
                      setShowSizeDropdown(false);
                    }}
                    className={cn(
                      'w-full px-3 py-1.5 text-sm text-left hover:bg-muted',
                      toolSettings.text.fontSize === size && 'bg-muted'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Bold */}
          <Button
            variant={toolSettings.text.bold ? 'default' : 'ghost'}
            size="sm"
            onClick={() => updateTextSettings({ bold: !toolSettings.text.bold })}
            title="Bold"
            className="w-8 h-8 p-0"
          >
            <Bold className="w-4 h-4" />
          </Button>

          {/* Italic */}
          <Button
            variant={toolSettings.text.italic ? 'default' : 'ghost'}
            size="sm"
            onClick={() => updateTextSettings({ italic: !toolSettings.text.italic })}
            title="Italic"
            className="w-8 h-8 p-0"
          >
            <Italic className="w-4 h-4" />
          </Button>

          {/* Underline */}
          <Button
            variant={toolSettings.text.underline ? 'default' : 'ghost'}
            size="sm"
            onClick={() => updateTextSettings({ underline: !toolSettings.text.underline })}
            title="Underline"
            className="w-8 h-8 p-0"
          >
            <Underline className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          {/* Text Colors */}
          <div className="flex items-center gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateTextSettings({ textColor: color })}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                  toolSettings.text.textColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={toolSettings.text.textColor}
              onChange={(e) => updateTextSettings({ textColor: e.target.value })}
              className="w-6 h-6 rounded-full cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>
      )}

      {/* Main Toolbar */}
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

        {/* Text tool hint */}
        {currentTool === 'text' && (
          <div className="text-sm text-muted-foreground">
            Click on the page to add text
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
    </>
  );
}
