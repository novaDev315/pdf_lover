/**
 * OperationBadge - Small badge showing operation type
 * Used in history panel and throughout the app
 */

import * as React from 'react';
import {
  FileText,
  Scissors,
  Minimize2,
  FileOutput,
  Droplets,
  Lock,
  RotateCw,
  Crop,
  Maximize2,
  ArrowUpDown,
  Trash2,
  Image,
  Type,
  ScanText,
  PenTool,
  Edit3,
  MoreHorizontal,
  Merge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { OperationType } from '@/store/history-store';
import { getOperationTypeLabel } from '@/store/history-store';

/**
 * Configuration for operation type display
 */
interface OperationConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

/**
 * Get icon and colors for an operation type
 */
function getOperationConfig(type: OperationType): OperationConfig {
  const configs: Record<OperationType, OperationConfig> = {
    merge: {
      icon: <Merge className="h-3.5 w-3.5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    },
    split: {
      icon: <Scissors className="h-3.5 w-3.5" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    },
    compress: {
      icon: <Minimize2 className="h-3.5 w-3.5" />,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
    },
    convert: {
      icon: <FileOutput className="h-3.5 w-3.5" />,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
    },
    watermark: {
      icon: <Droplets className="h-3.5 w-3.5" />,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800',
    },
    security: {
      icon: <Lock className="h-3.5 w-3.5" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    },
    rotate: {
      icon: <RotateCw className="h-3.5 w-3.5" />,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800',
    },
    crop: {
      icon: <Crop className="h-3.5 w-3.5" />,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800',
    },
    resize: {
      icon: <Maximize2 className="h-3.5 w-3.5" />,
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800',
    },
    reorder: {
      icon: <ArrowUpDown className="h-3.5 w-3.5" />,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    },
    delete_pages: {
      icon: <Trash2 className="h-3.5 w-3.5" />,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800',
    },
    extract_images: {
      icon: <Image className="h-3.5 w-3.5" />,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800',
    },
    extract_text: {
      icon: <Type className="h-3.5 w-3.5" />,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700',
    },
    ocr: {
      icon: <ScanText className="h-3.5 w-3.5" />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
    },
    signature: {
      icon: <PenTool className="h-3.5 w-3.5" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800',
    },
    annotation: {
      icon: <Edit3 className="h-3.5 w-3.5" />,
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-950 border-fuchsia-200 dark:border-fuchsia-800',
    },
    edit: {
      icon: <FileText className="h-3.5 w-3.5" />,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800',
    },
    other: {
      icon: <MoreHorizontal className="h-3.5 w-3.5" />,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-700',
    },
  };

  return configs[type] ?? configs.other;
}

/**
 * Props for OperationBadge
 */
export interface OperationBadgeProps {
  /** Operation type */
  type: OperationType;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * OperationBadge component
 * Displays a small badge indicating the type of PDF operation
 */
export function OperationBadge({
  type,
  size = 'sm',
  showLabel = false,
  showTooltip = true,
  className,
  onClick,
}: OperationBadgeProps) {
  const config = getOperationConfig(type);
  const label = getOperationTypeLabel(type);

  const sizeClasses = {
    sm: 'h-6 text-xs gap-1 px-1.5',
    md: 'h-7 text-sm gap-1.5 px-2',
    lg: 'h-8 text-sm gap-2 px-2.5',
  };

  const iconSizeClasses = {
    sm: '[&>svg]:h-3 [&>svg]:w-3',
    md: '[&>svg]:h-3.5 [&>svg]:w-3.5',
    lg: '[&>svg]:h-4 [&>svg]:w-4',
  };

  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium transition-colors',
        config.color,
        config.bgColor,
        sizeClasses[size],
        iconSizeClasses[size],
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {config.icon}
      {showLabel && <span>{label}</span>}
    </span>
  );

  if (showTooltip && !showLabel) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Get the icon component for an operation type
 */
export function getOperationIcon(
  type: OperationType,
  className?: string
): React.ReactNode {
  const config = getOperationConfig(type);
  return React.cloneElement(config.icon as React.ReactElement, {
    className: cn('h-4 w-4', className),
  });
}

/**
 * Get the color classes for an operation type
 */
export function getOperationColors(type: OperationType): {
  color: string;
  bgColor: string;
} {
  const config = getOperationConfig(type);
  return {
    color: config.color,
    bgColor: config.bgColor,
  };
}

export default OperationBadge;
