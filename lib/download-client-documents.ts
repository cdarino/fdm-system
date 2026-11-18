import { toast } from 'sonner';

function safeFileName(value: string, fallback = 'client'): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || fallback
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadClientDocumentsPdf(clientId: string, clientName?: string): Promise<void> {
  try {
    const response = await fetch(`/api/clients/${clientId}/documents/pdf`);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error ?? 'Failed to create document PDF');
    }

    const blob = await response.blob();
    triggerBlobDownload(blob, `Client_Documents_${safeFileName(clientName ?? clientId)}.pdf`);
    toast.success('Uploaded documents downloaded as one PDF');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to download documents');
  }
}

export async function downloadTitlePacketPdf(
  titleId: string,
  options?: { documentIds?: string[]; fileLabel?: string }
): Promise<boolean> {
  try {
    const response = await fetch(`/api/titles/${titleId}/packet/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        options?.documentIds ? { documentIds: options.documentIds } : {}
      ),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error ?? 'Failed to assemble turnover packet PDF');
    }

    const blob = await response.blob();
    const fallbackName = `Turnover_Packet_${safeFileName(options?.fileLabel ?? titleId, 'packet')}.pdf`;
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="([^"]+)"/);
    triggerBlobDownload(blob, match?.[1] ?? fallbackName);
    toast.success('Turnover packet downloaded as one PDF');
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to download turnover packet');
    return false;
  }
}
