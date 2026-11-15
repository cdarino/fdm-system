'use client';

import { useEffect, useState } from 'react';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { Loader2, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TopBarOcrStatus() {
  const { jobs, activeJob, pendingCount, completedCount, isProcessing, clearCompleted } =
    useOcrQueue();
  const [showCompleted, setShowCompleted] = useState(false);

  // Briefly show completion status before fading away.
  useEffect(() => {
    if (!isProcessing && completedCount > 0) {
      setShowCompleted(true);
      const timer = setTimeout(() => {
        setShowCompleted(false);
        clearCompleted();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, completedCount, clearCompleted]);

  if (!isProcessing && !showCompleted) {
    return null;
  }

  const progressLabel = activeJob?.page && activeJob?.totalPages
    ? `p. ${activeJob.page}/${activeJob.totalPages}`
    : activeJob?.progress
    ? `${Math.round(activeJob.progress * 100)}%`
    : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="Document text extraction status"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>
                Indexing text {pendingCount > 1 ? `(${pendingCount})` : ''}
              </span>
              {progressLabel && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {progressLabel}
                </span>
              )}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span className="text-success">Text indexed</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Processing document text</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span>Document indexing finished</span>
              </>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {isProcessing
              ? 'Text is being extracted for full-text search. Please keep this tab open.'
              : 'All pending documents have been indexed for search.'}
          </p>
        </div>

        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border bg-row-hover p-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground" title={job.fileName}>
                  {job.fileName}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[10px]">
                {job.status === 'processing' ? (
                  <span className="text-primary font-medium">
                    {job.page && job.totalPages
                      ? `Page ${job.page}/${job.totalPages}`
                      : `${Math.round(job.progress * 100)}%`}
                  </span>
                ) : job.status === 'pending' ? (
                  <span className="text-muted-foreground">Queued</span>
                ) : job.status === 'done' ? (
                  <span className="text-success">Done</span>
                ) : (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> Failed
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
