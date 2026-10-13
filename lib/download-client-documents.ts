import { toast } from 'sonner';

function safeFileName(value: string): string {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'client';
}

export async function downloadClientDocumentsPdf(clientId: string, clientName?: string): Promise<void> {
  try {
    const response = await fetch(`/api/clients/${clientId}/documents/pdf`);
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(result?.error ?? 'Failed to create document PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Client_Documents_${safeFileName(clientName ?? clientId)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Uploaded documents downloaded as one PDF');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to download documents');
  }
}