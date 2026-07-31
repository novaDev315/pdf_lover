/**
 * AddToBatchButton - Reusable button for adding operations to batch queue
 * Used by tool panels to enable batch processing
 */

import * as React from 'react';
import { Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  useBatchStore,
  type BatchOperationType,
  type BatchOperationOptions,
  type BatchFileInfo,
} from '@/store/batch-store';
import { generateId } from '@/lib/utils';
import { validateBatchOperation } from '@/lib/batch-validation';

/**
 * Props for AddToBatchButton
 */
export interface AddToBatchButtonProps {
  /** Operation type for this batch operation */
  operationType: BatchOperationType;
  /** Files to include in the operation */
  files: File[];
  /** Options for the operation */
  options: BatchOperationOptions;
  /** Callback after adding to queue */
  onAdded?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show as icon only */
  iconOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom button text */
  label?: string;
}

/**
 * Button component for adding operations to the batch queue
 */
export function AddToBatchButton({
  operationType,
  files,
  options,
  onAdded,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  className,
  label = 'Add to Batch',
}: AddToBatchButtonProps) {
  const { toast } = useToast();
  const { addToQueue, setPanelOpen } = useBatchStore();

  const handleAddToBatch = React.useCallback(() => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files before adding to batch',
        variant: 'destructive',
      });
      return;
    }

    const validationError = validateBatchOperation(operationType, options);
    if (validationError) {
      toast({ ...validationError, variant: 'destructive' });
      return;
    }

    const batchFiles: BatchFileInfo[] = files.map((file) => ({
      id: generateId(),
      name: file.name,
      size: file.size,
      file,
    }));

    addToQueue({
      type: operationType,
      files: batchFiles,
      options,
    });

    toast({
      title: 'Added to batch queue',
      description: `${operationType} operation added with ${files.length} file(s)`,
    });

    setPanelOpen(true);
    onAdded?.();
  }, [files, operationType, options, addToQueue, toast, setPanelOpen, onAdded]);

  const isDisabled = disabled || files.length === 0;

  if (iconOnly) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="icon"
              onClick={handleAddToBatch}
              disabled={isDisabled}
              className={className}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleAddToBatch}
      disabled={isDisabled}
      className={className}
    >
      <Layers className="h-4 w-4 mr-1.5" />
      {label}
    </Button>
  );
}

/**
 * Hook to create add to batch handler
 */
export function useAddToBatch() {
  const { toast } = useToast();
  const { addToQueue, setPanelOpen } = useBatchStore();

  const addToBatch = React.useCallback(
    (
      operationType: BatchOperationType,
      files: File[],
      options: BatchOperationOptions
    ) => {
      if (files.length === 0) {
        toast({
          title: 'No files selected',
          description: 'Please select files before adding to batch',
          variant: 'destructive',
        });
        return false;
      }

      const validationError = validateBatchOperation(operationType, options);
      if (validationError) {
        toast({ ...validationError, variant: 'destructive' });
        return false;
      }

      const batchFiles: BatchFileInfo[] = files.map((file) => ({
        id: generateId(),
        name: file.name,
        size: file.size,
        file,
      }));

      const operationId = addToQueue({
        type: operationType,
        files: batchFiles,
        options,
      });

      toast({
        title: 'Added to batch queue',
        description: `${operationType} operation added with ${files.length} file(s)`,
      });

      setPanelOpen(true);
      return operationId;
    },
    [addToQueue, toast, setPanelOpen]
  );

  return { addToBatch };
}
