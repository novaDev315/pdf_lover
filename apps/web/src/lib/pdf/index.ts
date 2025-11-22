/**
 * PDF utilities for PDFLover web app
 */

export {
  loadPDFDocument,
  renderPageToCanvas,
  renderPageToImage,
  renderPageToImageData,
  renderAllPages,
  renderAllPagesToImages,
  renderAllPagesToImageData,
  canvasToBlob,
  getOptimalOCRScale,
  extractPageText,
  extractAllPagesText,
  isScannedPDF,
} from './pdf-renderer.js';

export type {
  ImageFormat,
  RenderPageOptions,
  RenderAllPagesOptions,
  ImageDataOptions,
  RenderedPage,
  RenderedImage,
} from './pdf-renderer.js';
