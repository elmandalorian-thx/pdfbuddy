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
  ChevronUp,
  Palette,
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
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
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

  // Color button component for mobile-friendly rendering
  const ColorButton = ({ color, isSelected, onClick, style = {} }: {
    color: string;
    isSelected: boolean;
    onClick: () => void;
    style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 transition-all touch-target flex-shrink-0',
        isSelected ? 'border-foreground scale-110 ring-2 ring-primary/30' : 'border-transparent hover:scale-110'
      )}
      style={{ backgroundColor: color, ...style }}
      title={color}
    />
  );

  // Render tool options based on current tool
  const renderToolOptions = () => {
    if (currentTool === 'pen') {
      return (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {PEN_COLORS.map((color) => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={toolSettings.penColor === color}
                  onClick={() => updateToolSettings({ penColor: color })}
                />
              ))}
              <input
                type="color"
                value={toolSettings.penColor}
                onChange={(e) => updateToolSettings({ penColor: e.target.value })}
                className="w-7 h-7 sm:w-6 sm:h-6 rounded-full cursor-pointer touch-target"
                title="Custom color"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Width</span>
            <Slider
              value={[toolSettings.penWidth]}
              onValueChange={([value]) => updateToolSettings({ penWidth: value })}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-6 text-right">{toolSettings.penWidth}</span>
          </div>
        </div>
      );
    }

    if (currentTool === 'highlighter') {
      return (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {HIGHLIGHTER_COLORS.map((color) => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={toolSettings.highlighterColor === color}
                  onClick={() => updateToolSettings({ highlighterColor: color })}
                  style={{ opacity: 0.6 }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Width</span>
            <Slider
              value={[toolSettings.highlighterWidth]}
              onValueChange={([value]) => updateToolSettings({ highlighterWidth: value })}
              min={10}
              max={40}
              step={2}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Opacity</span>
            <Slider
              value={[toolSettings.highlighterOpacity * 100]}
              onValueChange={([value]) => updateToolSettings({ highlighterOpacity: value / 100 })}
              min={20}
              max={60}
              step={5}
              className="flex-1"
            />
          </div>
        </div>
      );
    }

    if (currentTool === 'text') {
      return (
        <div className="flex flex-col gap-3 p-3">
          {/* Font and Size Row */}
          <div className="flex gap-2">
            {/* Font Family Dropdown */}
            <div className="relative flex-1" ref={fontDropdownRef}>
              <button
                onClick={() => setShowFontDropdown(!showFontDropdown)}
                className="flex items-center gap-1 px-2 py-2 text-sm border rounded-lg hover:bg-muted w-full justify-between"
              >
                <span className="truncate text-xs" style={{ fontFamily: toolSettings.text.fontFamily }}>
                  {toolSettings.text.fontFamily}
                </span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>
              {showFontDropdown && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-background border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto z-10">
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font}
                      onClick={() => {
                        updateTextSettings({ fontFamily: font });
                        setShowFontDropdown(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-muted',
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
            <div className="relative w-20" ref={sizeDropdownRef}>
              <button
                onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                className="flex items-center gap-1 px-2 py-2 text-sm border rounded-lg hover:bg-muted w-full justify-between"
              >
                <span className="text-xs">{toolSettings.text.fontSize}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSizeDropdown && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-background border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto z-10">
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        updateTextSettings({ fontSize: size });
                        setShowSizeDropdown(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-muted',
                        toolSettings.text.fontSize === size && 'bg-muted'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Style Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant={toolSettings.text.bold ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateTextSettings({ bold: !toolSettings.text.bold })}
                title="Bold"
                className="w-9 h-9 p-0"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant={toolSettings.text.italic ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateTextSettings({ italic: !toolSettings.text.italic })}
                title="Italic"
                className="w-9 h-9 p-0"
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant={toolSettings.text.underline ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateTextSettings({ underline: !toolSettings.text.underline })}
                title="Underline"
                className="w-9 h-9 p-0"
              >
                <Underline className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Text Colors */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            <div className="flex items-center gap-1.5">
              {TEXT_COLORS.map((color) => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={toolSettings.text.textColor === color}
                  onClick={() => updateTextSettings({ textColor: color })}
                />
              ))}
              <input
                type="color"
                value={toolSettings.text.textColor}
                onChange={(e) => updateTextSettings({ textColor: e.target.value })}
                className="w-7 h-7 sm:w-6 sm:h-6 rounded-full cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const hasToolOptions = ['pen', 'highlighter', 'text'].includes(currentTool);

  return (
    <>
      {/* Options Panel (slides up from toolbar on mobile) */}
      {hasToolOptions && showOptionsPanel && (
        <div className="fixed bottom-[4.5rem] sm:bottom-20 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto sm:min-w-[320px] sm:max-w-[400px] z-50 bg-background border rounded-xl shadow-lg animate-slideUp">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium capitalize">{currentTool} Options</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptionsPanel(false)}
              className="h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {renderToolOptions()}
        </div>
      )}

      {/* Main Toolbar */}
      <div className="fixed bottom-0 sm:bottom-4 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto z-50">
        <div className="bg-background border-t sm:border sm:rounded-xl shadow-lg">
          <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-3 p-2 sm:p-3 safe-area-bottom">
            {/* Tool selection */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {tools.map((tool) => (
                <Button
                  key={tool.type}
                  variant={currentTool === tool.type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentTool(tool.type)}
                  title={tool.label}
                  className="w-10 h-10 sm:w-10 sm:h-10"
                >
                  {tool.icon}
                </Button>
              ))}
            </div>

            <div className="w-px h-8 bg-border hidden sm:block" />

            {/* Tool Options Toggle (mobile) / Inline Options (desktop) */}
            {hasToolOptions && (
              <>
                {/* Mobile: Toggle button */}
                <Button
                  variant={showOptionsPanel ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowOptionsPanel(!showOptionsPanel)}
                  className="sm:hidden h-10 w-10"
                  title="Tool options"
                >
                  <Palette className="w-4 h-4" />
                </Button>

                {/* Desktop: Inline options preview */}
                <div className="hidden sm:flex items-center gap-3">
                  {currentTool === 'pen' && (
                    <>
                      <div className="flex items-center gap-1">
                        {PEN_COLORS.slice(0, 4).map((color) => (
                          <ColorButton
                            key={color}
                            color={color}
                            isSelected={toolSettings.penColor === color}
                            onClick={() => updateToolSettings({ penColor: color })}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 w-24">
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
                    </>
                  )}
                  {currentTool === 'highlighter' && (
                    <>
                      <div className="flex items-center gap-1">
                        {HIGHLIGHTER_COLORS.slice(0, 4).map((color) => (
                          <ColorButton
                            key={color}
                            color={color}
                            isSelected={toolSettings.highlighterColor === color}
                            onClick={() => updateToolSettings({ highlighterColor: color })}
                            style={{ opacity: 0.6 }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {currentTool === 'text' && (
                    <div className="text-sm text-muted-foreground">
                      Click to add text
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOptionsPanel(!showOptionsPanel)}
                    className="h-8 px-2"
                  >
                    {showOptionsPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                </div>
              </>
            )}

            <div className="w-px h-8 bg-border" />

            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5 sm:gap-1">
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

            <div className="w-px h-8 bg-border hidden sm:block" />

            {/* Clear, Save, and Close */}
            <div className="flex items-center gap-0.5 sm:gap-1">
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
                className="h-10 px-3 sm:px-4"
              >
                <Save className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Save</span>
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
        </div>
      </div>
    </>
  );
}
