/**
 * PDF extraction public facade.
 *
 * Keep this import path stable for PdfExtractor, FormInputs and any future
 * consumer. The implementation is intentionally split by responsibility so
 * page-level performance work can evolve without changing this contract.
 */

export {
  PdfExtractionError,
  isAbortError,
  PDF_EXTRACTION_DEFAULTS,
  PDF_EXTRACTION_VERSION,
} from './pdfExtractionPrimitives.js';

export {
  createExtractionSummary,
  extractPdfDocument,
} from './pdfDocumentExtractor.js';
