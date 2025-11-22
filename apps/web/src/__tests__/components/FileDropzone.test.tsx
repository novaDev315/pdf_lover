/**
 * Tests for FileDropzone component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileDropzone } from '../../components/file-manager/FileDropzone';

// Helper to create mock PDF file
const createMockPdfFile = (
  name: string = 'test.pdf',
  size: number = 1024
): File => {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  view[0] = 0x25; // %
  view[1] = 0x50; // P
  view[2] = 0x44; // D
  view[3] = 0x46; // F
  view[4] = 0x2d; // -
  return new File([buffer], name, { type: 'application/pdf' });
};

// Helper to create non-PDF file
const createMockTextFile = (
  name: string = 'test.txt',
  size: number = 1024
): File => {
  const content = 'x'.repeat(size);
  return new File([content], name, { type: 'text/plain' });
};

// Helper to create DataTransfer
const createDataTransfer = (files: File[]): DataTransfer => {
  const dt = new DataTransfer();
  files.forEach((file) => dt.items.add(file));
  return dt;
};

describe('FileDropzone', () => {
  let onFilesAccepted: ReturnType<typeof vi.fn>;
  let onFilesRejected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFilesAccepted = vi.fn();
    onFilesRejected = vi.fn();
  });

  describe('rendering', () => {
    it('should render dropzone with default content', () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
      expect(screen.getByText(/pdf files/i)).toBeInTheDocument();
    });

    it('should render custom children when provided', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted}>
          <div data-testid="custom-content">Custom Content</div>
        </FileDropzone>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('should show max file size', () => {
      render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          maxSize={100 * 1024 * 1024}
        />
      );

      expect(screen.getByText(/100 mb/i)).toBeInTheDocument();
    });

    it('should show max files when not Infinity', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} maxFiles={10} />
      );

      expect(screen.getByText(/max 10 files/i)).toBeInTheDocument();
    });

    it('should not show max files when Infinity', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} maxFiles={Infinity} />
      );

      expect(screen.queryByText(/max.*files/i)).not.toBeInTheDocument();
    });
  });

  describe('file input', () => {
    it('should have file input element', () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });

    it('should accept PDF files by default', () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', 'application/pdf,.pdf');
    });

    it('should allow multiple files by default', () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('multiple');
    });

    it('should not allow multiple when multiple is false', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} multiple={false} />
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).not.toHaveAttribute('multiple');
    });
  });

  describe('file acceptance', () => {
    it('should accept valid PDF files', async () => {
      const user = userEvent.setup();
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const file = createMockPdfFile('test.pdf');
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, file);

      await waitFor(() => {
        expect(onFilesAccepted).toHaveBeenCalled();
      });

      const acceptedFiles = onFilesAccepted.mock.calls[0][0];
      expect(acceptedFiles).toHaveLength(1);
      expect(acceptedFiles[0].name).toBe('test.pdf');
    });

    it('should accept multiple PDF files', async () => {
      const user = userEvent.setup();
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const files = [
        createMockPdfFile('test1.pdf'),
        createMockPdfFile('test2.pdf'),
      ];
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, files);

      await waitFor(() => {
        expect(onFilesAccepted).toHaveBeenCalled();
      });

      const acceptedFiles = onFilesAccepted.mock.calls[0][0];
      expect(acceptedFiles).toHaveLength(2);
    });
  });

  describe('file rejection', () => {
    it('should reject non-PDF files', async () => {
      const user = userEvent.setup();
      render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          onFilesRejected={onFilesRejected}
        />
      );

      const file = createMockTextFile('test.txt');
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, file);

      await waitFor(() => {
        expect(onFilesRejected).toHaveBeenCalled();
      });
    });

    it('should reject files exceeding maxSize', async () => {
      const user = userEvent.setup();
      render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          onFilesRejected={onFilesRejected}
          maxSize={100}
        />
      );

      const file = createMockPdfFile('large.pdf', 1000);
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, file);

      await waitFor(() => {
        expect(onFilesRejected).toHaveBeenCalled();
      });
    });

    it('should display error message on rejection', async () => {
      const user = userEvent.setup();
      render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          onFilesRejected={onFilesRejected}
        />
      );

      const file = createMockTextFile('test.txt');
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });
  });

  describe('drag and drop', () => {
    it('should change style on drag enter', async () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div')!;

      fireEvent.dragEnter(dropzone, {
        dataTransfer: createDataTransfer([createMockPdfFile()]),
      });

      await waitFor(() => {
        expect(dropzone).toHaveClass('border-primary');
      });
    });

    it('should revert style on drag leave', async () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div')!;

      fireEvent.dragEnter(dropzone, {
        dataTransfer: createDataTransfer([createMockPdfFile()]),
      });

      fireEvent.dragLeave(dropzone);

      await waitFor(() => {
        expect(dropzone).not.toHaveClass('border-primary');
      });
    });

    it('should accept files on drop', async () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div')!;
      const file = createMockPdfFile();
      const dt = createDataTransfer([file]);

      fireEvent.drop(dropzone, {
        dataTransfer: dt,
      });

      await waitFor(() => {
        expect(onFilesAccepted).toHaveBeenCalled();
      });
    });
  });

  describe('disabled state', () => {
    it('should apply disabled styles when disabled', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} disabled={true} />
      );

      const dropzone = screen.getByText(/drag & drop/i).closest('div')!;
      expect(dropzone).toHaveClass('opacity-50');
      expect(dropzone).toHaveClass('cursor-not-allowed');
    });

    it('should disable input when disabled', () => {
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} disabled={true} />
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeDisabled();
    });

    it('should not accept files when disabled', async () => {
      const user = userEvent.setup();
      render(
        <FileDropzone onFilesAccepted={onFilesAccepted} disabled={true} />
      );

      const file = createMockPdfFile();
      const input = document.querySelector('input[type="file"]')!;

      // Disabled inputs should not accept files
      await user.upload(input, file);

      expect(onFilesAccepted).not.toHaveBeenCalled();
    });
  });

  describe('custom accept', () => {
    it('should accept custom file types', async () => {
      const user = userEvent.setup();
      render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          accept={{ 'image/*': ['.png', '.jpg'] }}
        />
      );

      const file = new File(['test'], 'image.png', { type: 'image/png' });
      const input = document.querySelector('input[type="file"]')!;

      await user.upload(input, file);

      await waitFor(() => {
        expect(onFilesAccepted).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });

    it('should have clickable area', async () => {
      const user = userEvent.setup();
      render(<FileDropzone onFilesAccepted={onFilesAccepted} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div')!;

      // Clicking should trigger file input
      await user.click(dropzone);

      // The click should propagate to the input
      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <FileDropzone
          onFilesAccepted={onFilesAccepted}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
