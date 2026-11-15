'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { extractDocumentText } from '@/lib/ocr/extract-document-text';
import { indexEntityText } from '@/lib/actions/search-index';
import { getAttachmentUrl } from '@/lib/actions/attachments';
import type { IndexableEntity, UnindexedDocument } from '@/lib/types/search';

export interface OcrJob {
  id: string;
  attachmentId: string;
  file?: File;
  fileName: string;
  entityType: IndexableEntity;
  keywords?: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress: number;
  page?: number;
  totalPages?: number;
  error?: string;
}

export interface EnqueueFileParams {
  attachmentId: string;
  file: File;
  fileName?: string;
  entityType?: IndexableEntity;
  keywords?: string;
}

interface OcrQueueContextValue {
  jobs: OcrJob[];
  activeJob: OcrJob | null;
  pendingCount: number;
  completedCount: number;
  isProcessing: boolean;
  enqueueFile: (params: EnqueueFileParams) => void;
  enqueueRemoteAttachment: (attachment: UnindexedDocument) => Promise<void>;
  clearCompleted: () => void;
}

const OcrQueueContext = createContext<OcrQueueContextValue | null>(null);

export function OcrQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<OcrJob[]>([]);
  const isWorkingRef = useRef(false);

  // Warn if closing the browser tab while OCR jobs are still in progress.
  const isProcessing = jobs.some((j) => j.status === 'pending' || j.status === 'processing');

  useEffect(() => {
    if (!isProcessing) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  // Processes the next pending OCR job in serial queue.
  const processNextJob = useCallback(async () => {
    if (isWorkingRef.current) return;

    const nextJob = jobs.find((j) => j.status === 'pending');
    if (!nextJob || !nextJob.file) return;

    isWorkingRef.current = true;
    setJobs((prev) =>
      prev.map((j) => (j.id === nextJob.id ? { ...j, status: 'processing', progress: 0 } : j))
    );

    try {
      const result = await extractDocumentText(
        nextJob.file,
        (progress, page, totalPages) => {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === nextJob.id ? { ...j, progress, page, totalPages } : j
            )
          );
        }
      );

      // Save extracted text to search_index
      await indexEntityText({
        entity_id: nextJob.attachmentId,
        entity_type: nextJob.entityType,
        content: result.text || null,
        keywords: nextJob.keywords || nextJob.fileName || null,
      });

      setJobs((prev) =>
        prev.map((j) => (j.id === nextJob.id ? { ...j, status: 'done', progress: 1 } : j))
      );
    } catch (err) {
      console.warn(`OCR processing failed for ${nextJob.fileName}:`, err);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === nextJob.id
            ? {
                ...j,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Text extraction failed',
              }
            : j
        )
      );
    } finally {
      isWorkingRef.current = false;
    }
  }, [jobs]);

  useEffect(() => {
    void processNextJob();
  }, [processNextJob]);

  const enqueueFile = useCallback(
    ({
      attachmentId,
      file,
      fileName,
      entityType = 'client_document',
      keywords,
    }: EnqueueFileParams) => {
      const newJob: OcrJob = {
        id: `${attachmentId}-${Date.now()}`,
        attachmentId,
        file,
        fileName: fileName ?? file.name,
        entityType,
        keywords,
        status: 'pending',
        progress: 0,
      };

      setJobs((prev) => {
        // Avoid duplicate jobs for the same attachment
        if (prev.some((j) => j.attachmentId === attachmentId && j.status !== 'failed')) {
          return prev;
        }
        return [...prev, newJob];
      });
    },
    []
  );

  // Downloads an unindexed document from S3 and enqueues it.
  const enqueueRemoteAttachment = useCallback(
    async (attachment: UnindexedDocument) => {
      try {
        const presignedUrl = await getAttachmentUrl(attachment.attachment_id);
        const response = await fetch(presignedUrl);
        if (!response.ok) throw new Error('Failed to download document from storage');

        const blob = await response.blob();
        const file = new File([blob], attachment.file_name, {
          type: attachment.mime_type || blob.type || 'application/pdf',
        });

        enqueueFile({
          attachmentId: attachment.attachment_id,
          file,
          fileName: attachment.file_name,
          entityType: (attachment.entity_type as IndexableEntity) || 'client_document',
          keywords: [attachment.file_category, attachment.client_name].filter(Boolean).join(' '),
        });
      } catch (err) {
        console.error('Failed to hydrate remote document for OCR:', err);
      }
    },
    [enqueueFile]
  );

  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'pending' || j.status === 'processing'));
  }, []);

  const activeJob = jobs.find((j) => j.status === 'processing') ?? null;
  const pendingCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'processing'
  ).length;
  const completedCount = jobs.filter((j) => j.status === 'done').length;

  return (
    <OcrQueueContext.Provider
      value={{
        jobs,
        activeJob,
        pendingCount,
        completedCount,
        isProcessing,
        enqueueFile,
        enqueueRemoteAttachment,
        clearCompleted,
      }}
    >
      {children}
    </OcrQueueContext.Provider>
  );
}

export function useOcrQueue(): OcrQueueContextValue {
  const context = useContext(OcrQueueContext);
  if (!context) {
    throw new Error('useOcrQueue must be used within an OcrQueueProvider');
  }
  return context;
}
