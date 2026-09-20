'use client';

/**
 * Text extraction from scanned paperwork, run in the browser.
 *
 * Tesseract compiles to WebAssembly and runs on the staff member's machine, so
 * no scan of an ID or a deed is sent to a third party and there is no per-page
 * cost. The trade is speed: budget a few seconds a page, which is why this runs
 * after the upload has already succeeded rather than in front of it.
 *
 * Images are fed to Tesseract directly. PDFs are almost always images wrapped
 * in a PDF when they come from a scanner, so each page is rendered to a canvas
 * first and that bitmap is what gets read.
 */

/** Beyond this, OCR takes long enough that staff would sit waiting on a tab. */
const MAX_PDF_PAGES = 10;

/** Scanner output is often 150 DPI; upscaling materially improves accuracy. */
const PDF_RENDER_SCALE = 2;

export interface ExtractionResult {
  text: string;
  pageCount: number;
  /** True when a PDF was longer than `MAX_PDF_PAGES` and was read only in part. */
  truncated: boolean;
}

async function renderPdfToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import('pdfjs-dist');

  // The worker has to be told where it lives. Pointing at the copy inside the
  // installed package keeps it on the same version as the library itself.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) continue;

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

/**
 * Reads a scanned document and returns its text.
 *
 * Throws only on a genuine failure to start; an unreadable page yields empty
 * text rather than an error, because a blank result is a normal outcome for a
 * photo of a blank page and should not be reported as a fault.
 */
export async function extractDocumentText(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<ExtractionResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: onProgress
      ? (message: { status: string; progress: number }) => {
          if (message.status === 'recognizing text') onProgress(message.progress);
        }
      : undefined,
  });

  try {
    if (file.type === 'application/pdf') {
      const canvases = await renderPdfToCanvases(file);
      const pages: string[] = [];

      for (const canvas of canvases) {
        const { data } = await worker.recognize(canvas);
        pages.push(data.text.trim());
      }

      return {
        text: pages.filter(Boolean).join('\n\n'),
        pageCount: canvases.length,
        truncated: canvases.length === MAX_PDF_PAGES,
      };
    }

    const { data } = await worker.recognize(file);
    return { text: data.text.trim(), pageCount: 1, truncated: false };
  } finally {
    await worker.terminate();
  }
}

/**
 * Collapses OCR output into something a person would want to read back.
 *
 * Tesseract emits the page's own line breaks and a fair amount of noise from
 * scan artefacts. Runs of whitespace are flattened and isolated punctuation
 * fragments dropped, so a stored excerpt reads as text rather than confetti.
 */
export function tidyExtractedText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1 && /[a-z0-9]/i.test(line))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
