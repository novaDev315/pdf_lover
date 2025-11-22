/**
 * TextEditor Component
 * Rich text editor for text annotations and sticky notes
 */

import * as React from 'react';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  type TextAnnotation,
  type NoteAnnotation,
  type Color,
  type Rect,
} from '@/store/annotation-store';

/**
 * Font family options
 */
type FontFamily = 'Helvetica' | 'Times' | 'Courier';

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times', label: 'Times New Roman' },
  { value: 'Courier', label: 'Courier' },
];

/**
 * Font size options
 */
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

/**
 * Convert Color to CSS rgba string
 */
function colorToRgba(color: Color, opacity: number = 1): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Props for TextEditor component
 */
export interface TextEditorProps {
  /** Type of text element being edited */
  type: 'text' | 'note';
  /** Initial content */
  initialContent?: string;
  /** Initial title (for notes) */
  initialTitle?: string;
  /** Font size */
  fontSize?: number;
  /** Font family */
  fontFamily?: FontFamily;
  /** Text color */
  color?: Color;
  /** Whether text is bold */
  bold?: boolean;
  /** Whether text is italic */
  italic?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Position and size of the editor */
  rect: Rect;
  /** Scale factor */
  scale?: number;
  /** Callback when content changes */
  onChange?: (content: string, title?: string) => void;
  /** Callback when editing is confirmed */
  onConfirm?: (data: TextEditorData) => void;
  /** Callback when editing is cancelled */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Data returned from the text editor
 */
export interface TextEditorData {
  content: string;
  title?: string;
  fontSize: number;
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
}

/**
 * TextEditor component
 * Provides rich text editing capabilities for annotations
 */
export function TextEditor({
  type,
  initialContent = '',
  initialTitle = 'Note',
  fontSize: initialFontSize = 14,
  fontFamily: initialFontFamily = 'Helvetica',
  color = { r: 0, g: 0, b: 0 },
  bold: initialBold = false,
  italic: initialItalic = false,
  align: initialAlign = 'left',
  rect,
  scale = 1,
  onChange,
  onConfirm,
  onCancel,
  className,
}: TextEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [title, setTitle] = React.useState(initialTitle);
  const [fontSize, setFontSize] = React.useState(initialFontSize);
  const [fontFamily, setFontFamily] = React.useState<FontFamily>(initialFontFamily);
  const [bold, setBold] = React.useState(initialBold);
  const [italic, setItalic] = React.useState(initialItalic);
  const [align, setAlign] = React.useState<'left' | 'center' | 'right'>(initialAlign);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus textarea on mount
  React.useEffect(() => {
    if (type === 'note' && inputRef.current) {
      inputRef.current.focus();
    } else if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [type]);

  // Handle content change
  const handleContentChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      onChange?.(newContent, title);
    },
    [onChange, title]
  );

  // Handle title change
  const handleTitleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      onChange?.(content, newTitle);
    },
    [onChange, content]
  );

  // Handle confirm
  const handleConfirm = React.useCallback(() => {
    onConfirm?.({
      content,
      title: type === 'note' ? title : undefined,
      fontSize,
      fontFamily,
      bold,
      italic,
      align,
    });
  }, [content, title, type, fontSize, fontFamily, bold, italic, align, onConfirm]);

  // Handle keyboard shortcuts
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to confirm
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
        return;
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }

      // Ctrl/Cmd + B for bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setBold((prev) => !prev);
        return;
      }

      // Ctrl/Cmd + I for italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setItalic((prev) => !prev);
        return;
      }
    },
    [handleConfirm, onCancel]
  );

  // Calculate position and size
  const editorStyle: React.CSSProperties = {
    position: 'absolute',
    left: rect.x * scale,
    top: rect.y * scale,
    minWidth: Math.max(200, rect.width * scale),
    minHeight: type === 'note' ? 150 : Math.max(50, rect.height * scale),
  };

  // Text style
  const textStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily === 'Times' ? '"Times New Roman", Times, serif' :
      fontFamily === 'Courier' ? '"Courier New", Courier, monospace' :
        'Helvetica, Arial, sans-serif',
    fontWeight: bold ? 'bold' : 'normal',
    fontStyle: italic ? 'italic' : 'normal',
    textAlign: align,
    color: colorToRgba(color),
  };

  return (
    <div
      className={cn(
        'bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50',
        className
      )}
      style={editorStyle}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 border-b bg-muted/50">
        {/* Font Family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              <Type className="h-3 w-3" />
              <span className="text-xs max-w-16 truncate">{fontFamily}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FONT_FAMILIES.map((font) => (
              <DropdownMenuItem
                key={font.value}
                onClick={() => setFontFamily(font.value)}
                className={cn(fontFamily === font.value && 'bg-muted')}
              >
                <span style={{ fontFamily: font.label }}>{font.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font Size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 min-w-10">
              <span className="text-xs">{fontSize}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => setFontSize(size)}
                className={cn(fontSize === size && 'bg-muted')}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={bold ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setBold((prev) => !prev)}
            >
              <Bold className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (Ctrl+B)</TooltipContent>
        </Tooltip>

        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={italic ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setItalic((prev) => !prev)}
            >
              <Italic className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Alignment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={align === 'left' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAlign('left')}
            >
              <AlignLeft className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Left</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={align === 'center' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAlign('center')}
            >
              <AlignCenter className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Center</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={align === 'right' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAlign('right')}
            >
              <AlignRight className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Right</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Confirm/Cancel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={onCancel}
            >
              <X className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancel (Esc)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-green-600"
              onClick={handleConfirm}
            >
              <Check className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Confirm (Ctrl+Enter)</TooltipContent>
        </Tooltip>
      </div>

      {/* Content Area */}
      <div className="p-2">
        {type === 'note' && (
          <Input
            ref={inputRef}
            value={title}
            onChange={handleTitleChange}
            placeholder="Note title..."
            className="mb-2 h-8 text-sm font-medium"
          />
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder={type === 'note' ? 'Enter note content...' : 'Enter text...'}
          className={cn(
            'w-full min-h-20 resize-none border-0 bg-transparent p-0 focus:outline-none focus:ring-0'
          )}
          style={textStyle}
          rows={type === 'note' ? 5 : 2}
        />
      </div>
    </div>
  );
}

/**
 * Props for NotePopover component
 */
export interface NotePopoverProps {
  /** The note annotation */
  note: NoteAnnotation;
  /** Scale factor */
  scale?: number;
  /** Whether the popover is open */
  isOpen?: boolean;
  /** Callback when popover is toggled */
  onToggle?: () => void;
  /** Callback when note content is updated */
  onUpdate?: (title: string, content: string) => void;
  /** Callback when note is deleted */
  onDelete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * NotePopover component
 * Displays a sticky note with expandable content
 */
export function NotePopover({
  note,
  scale = 1,
  isOpen = false,
  onToggle,
  onUpdate,
  onDelete,
  className,
}: NotePopoverProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);

  // Note icon position
  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: note.rect.x * scale,
    top: note.rect.y * scale,
  };

  // Popover position
  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    left: (note.rect.x + 24) * scale,
    top: note.rect.y * scale,
    minWidth: 200,
    maxWidth: 300,
  };

  const handleSave = () => {
    onUpdate?.(title, content);
    setIsEditing(false);
  };

  const noteColor = colorToRgba(note.color, 0.9);

  return (
    <>
      {/* Note Icon */}
      <button
        className={cn(
          'absolute flex items-center justify-center w-6 h-6 rounded shadow-sm cursor-pointer',
          'hover:brightness-95 transition-all',
          isOpen && 'ring-2 ring-primary'
        )}
        style={{
          ...iconStyle,
          backgroundColor: noteColor,
          border: '1px solid rgba(0,0,0,0.2)',
        }}
        onClick={onToggle}
        title={note.title}
      >
        <span className="text-xs font-bold text-black/70">N</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className={cn(
            'absolute rounded-lg shadow-lg overflow-hidden z-40',
            className
          )}
          style={{
            ...popoverStyle,
            backgroundColor: noteColor,
            border: '1px solid rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b border-black/10">
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-6 text-sm font-medium bg-white/50 border-0"
              />
            ) : (
              <span className="font-medium text-sm text-black/80">{note.title}</span>
            )}
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleSave}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setTitle(note.title);
                      setContent(note.content);
                      setIsEditing(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Type className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={onDelete}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-2">
            {isEditing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-16 resize-none border-0 bg-white/50 rounded p-1 text-sm focus:outline-none"
                rows={4}
              />
            ) : (
              <p className="text-sm text-black/70 whitespace-pre-wrap">
                {note.content || <span className="italic">No content</span>}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-2 pb-2 text-xs text-black/50">
            {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </>
  );
}

TextEditor.displayName = 'TextEditor';
NotePopover.displayName = 'NotePopover';

export default TextEditor;
