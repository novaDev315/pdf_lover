/**
 * AnnotationToolbar Component
 * Provides tools for creating and editing PDF annotations
 */

import * as React from 'react';
import {
  MousePointer2,
  Hand,
  Highlighter,
  Underline,
  Strikethrough,
  Type,
  StickyNote,
  Pencil,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Image,
  TextCursorInput,
  CheckSquare,
  ShieldX,
  Undo2,
  Redo2,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  useAnnotationStore,
  selectSelectedAnnotation,
  type AnnotationTool,
  type Color,
} from '@/store/annotation-store';

/**
 * Predefined colors for annotations
 */
const PRESET_COLORS: { name: string; color: Color }[] = [
  { name: 'Yellow', color: { r: 1, g: 1, b: 0 } },
  { name: 'Green', color: { r: 0.5, g: 1, b: 0.5 } },
  { name: 'Blue', color: { r: 0.5, g: 0.7, b: 1 } },
  { name: 'Pink', color: { r: 1, g: 0.7, b: 0.8 } },
  { name: 'Orange', color: { r: 1, g: 0.7, b: 0.3 } },
  { name: 'Purple', color: { r: 0.8, g: 0.5, b: 1 } },
  { name: 'Red', color: { r: 1, g: 0.3, b: 0.3 } },
  { name: 'Black', color: { r: 0, g: 0, b: 0 } },
  { name: 'White', color: { r: 1, g: 1, b: 1 } },
  { name: 'Gray', color: { r: 0.5, g: 0.5, b: 0.5 } },
];

/**
 * Tool definitions
 */
interface ToolDefinition {
  id: AnnotationTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  group: 'navigation' | 'markup' | 'drawing' | 'forms' | 'other';
}

const TOOLS: ToolDefinition[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V', group: 'navigation' },
  { id: 'hand', label: 'Hand', icon: Hand, shortcut: 'H', group: 'navigation' },
  { id: 'highlight', label: 'Highlight', icon: Highlighter, shortcut: 'L', group: 'markup' },
  { id: 'underline', label: 'Underline', icon: Underline, shortcut: 'U', group: 'markup' },
  { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, shortcut: 'K', group: 'markup' },
  { id: 'text', label: 'Text', icon: Type, shortcut: 'T', group: 'markup' },
  { id: 'note', label: 'Sticky Note', icon: StickyNote, shortcut: 'N', group: 'markup' },
  { id: 'freehand', label: 'Freehand', icon: Pencil, shortcut: 'P', group: 'drawing' },
  { id: 'rectangle', label: 'Rectangle', icon: Square, shortcut: 'R', group: 'drawing' },
  { id: 'circle', label: 'Circle', icon: Circle, shortcut: 'C', group: 'drawing' },
  { id: 'arrow', label: 'Arrow', icon: ArrowRight, shortcut: 'A', group: 'drawing' },
  { id: 'line', label: 'Line', icon: Minus, group: 'drawing' },
  { id: 'image', label: 'Image', icon: Image, group: 'other' },
  { id: 'textfield', label: 'Text Field', icon: TextCursorInput, group: 'forms' },
  { id: 'checkbox', label: 'Checkbox', icon: CheckSquare, group: 'forms' },
  { id: 'redact', label: 'Redact', icon: ShieldX, shortcut: 'X', group: 'other' },
];

/**
 * Color picker component
 */
interface ColorPickerProps {
  value: Color;
  onChange: (color: Color) => void;
  label?: string;
}

function ColorPicker({ value, onChange, label = 'Color' }: ColorPickerProps) {
  const colorToHex = (color: Color): string => {
    const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  const hexToColor = (hex: string): Color => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      };
    }
    return { r: 0, g: 0, b: 0 };
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div
            className="h-4 w-4 rounded border border-border"
            style={{ backgroundColor: colorToHex(value) }}
          />
          <span className="text-xs">{label}</span>
          <Palette className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <div className="p-2">
          <div className="grid grid-cols-5 gap-1 mb-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.name}
                className={cn(
                  'h-6 w-6 rounded border border-border',
                  'hover:ring-2 hover:ring-primary hover:ring-offset-1',
                  colorToHex(value) === colorToHex(preset.color) && 'ring-2 ring-primary'
                )}
                style={{ backgroundColor: colorToHex(preset.color) }}
                onClick={() => onChange(preset.color)}
                title={preset.name}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <input
              type="color"
              value={colorToHex(value)}
              onChange={(e) => onChange(hexToColor(e.target.value))}
              className="h-6 w-10 cursor-pointer rounded border-0 p-0"
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Props for AnnotationToolbar component
 */
export interface AnnotationToolbarProps {
  /** Whether the toolbar is disabled */
  disabled?: boolean;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Orientation of the toolbar */
  orientation?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
}

/**
 * AnnotationToolbar component
 * Provides annotation tools, color picker, and editing controls
 */
export function AnnotationToolbar({
  disabled = false,
  compact = false,
  orientation = 'horizontal',
  className,
}: AnnotationToolbarProps) {
  const {
    currentTool,
    toolOptions,
    setCurrentTool,
    setToolOptions,
    undo,
    redo,
    canUndo,
    canRedo,
    removeAnnotation,
    toggleLock,
    duplicateAnnotation,
    selectedAnnotationId,
  } = useAnnotationStore();

  const selectedAnnotation = useAnnotationStore(selectSelectedAnnotation);

  // Group tools for better organization
  const navigationTools = TOOLS.filter((t) => t.group === 'navigation');
  const markupTools = TOOLS.filter((t) => t.group === 'markup');
  const drawingTools = TOOLS.filter((t) => t.group === 'drawing');
  const formTools = TOOLS.filter((t) => t.group === 'forms');
  const otherTools = TOOLS.filter((t) => t.group === 'other');

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Delete selected annotation
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnotationId) {
          e.preventDefault();
          removeAnnotation(selectedAnnotationId);
        }
        return;
      }

      // Tool shortcuts (only without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOLS.find(
          (t) => t.shortcut?.toLowerCase() === e.key.toLowerCase()
        );
        if (tool) {
          e.preventDefault();
          setCurrentTool(tool.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedAnnotationId,
    undo,
    redo,
    removeAnnotation,
    setCurrentTool,
  ]);

  const renderToolButton = (tool: ToolDefinition) => {
    const Icon = tool.icon;
    const isActive = currentTool === tool.id;

    return (
      <Tooltip key={tool.id}>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size={compact ? 'sm' : 'icon'}
            onClick={() => setCurrentTool(tool.id)}
            disabled={disabled}
            aria-label={tool.label}
            aria-pressed={isActive}
            className={cn(compact && 'h-8 w-8')}
          >
            <Icon className={cn('h-4 w-4', compact && 'h-3.5 w-3.5')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={orientation === 'vertical' ? 'right' : 'bottom'}>
          <p>
            {tool.label}
            {tool.shortcut && <span className="ml-2 text-muted-foreground">({tool.shortcut})</span>}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex gap-1 p-2 bg-background border rounded-lg shadow-sm',
        isVertical ? 'flex-col w-12' : 'flex-row items-center',
        className
      )}
    >
      {/* Navigation Tools */}
      <div className={cn('flex gap-0.5', isVertical && 'flex-col')}>
        {navigationTools.map(renderToolButton)}
      </div>

      <div className={cn('h-6 w-px bg-border mx-1', isVertical && 'h-px w-6 my-1')} />

      {/* Markup Tools */}
      <div className={cn('flex gap-0.5', isVertical && 'flex-col')}>
        {markupTools.map(renderToolButton)}
      </div>

      <div className={cn('h-6 w-px bg-border mx-1', isVertical && 'h-px w-6 my-1')} />

      {/* Drawing Tools */}
      <div className={cn('flex gap-0.5', isVertical && 'flex-col')}>
        {drawingTools.map(renderToolButton)}
      </div>

      {!compact && (
        <>
          <div className={cn('h-6 w-px bg-border mx-1', isVertical && 'h-px w-6 my-1')} />

          {/* Form Tools */}
          <div className={cn('flex gap-0.5', isVertical && 'flex-col')}>
            {formTools.map(renderToolButton)}
          </div>

          <div className={cn('h-6 w-px bg-border mx-1', isVertical && 'h-px w-6 my-1')} />

          {/* Other Tools */}
          <div className={cn('flex gap-0.5', isVertical && 'flex-col')}>
            {otherTools.map(renderToolButton)}
          </div>
        </>
      )}

      {!isVertical && (
        <>
          <div className="h-6 w-px bg-border mx-2" />

          {/* Color Picker */}
          <ColorPicker
            value={toolOptions.color}
            onChange={(color) => setToolOptions({ color })}
            label="Fill"
          />

          <ColorPicker
            value={toolOptions.strokeColor}
            onChange={(color) => setToolOptions({ strokeColor: color })}
            label="Stroke"
          />

          {/* Stroke Width */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-muted-foreground">Width:</span>
            <Slider
              value={[toolOptions.strokeWidth]}
              onValueChange={([value]) => setToolOptions({ strokeWidth: value })}
              min={1}
              max={20}
              step={1}
              className="w-20"
              disabled={disabled}
            />
            <span className="text-xs w-4">{toolOptions.strokeWidth}</span>
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Undo/Redo */}
          <div className="flex gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undo}
                  disabled={disabled || !canUndo()}
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={redo}
                  disabled={disabled || !canRedo()}
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Shift+Z)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Selection Actions */}
          {selectedAnnotation && (
            <>
              <div className="h-6 w-px bg-border mx-2" />

              <div className="flex gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateAnnotation(selectedAnnotation.id)}
                      disabled={disabled}
                      aria-label="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Duplicate</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleLock(selectedAnnotation.id)}
                      disabled={disabled}
                      aria-label={selectedAnnotation.locked ? 'Unlock' : 'Lock'}
                    >
                      {selectedAnnotation.locked ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{selectedAnnotation.locked ? 'Unlock' : 'Lock'}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAnnotation(selectedAnnotation.id)}
                      disabled={disabled || selectedAnnotation.locked}
                      aria-label="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete (Del)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

AnnotationToolbar.displayName = 'AnnotationToolbar';

export default AnnotationToolbar;
