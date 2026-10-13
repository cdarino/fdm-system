import { PDFDocument, rgb, type PDFImage } from 'pdf-lib';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getStorageBucket, getStorageClient } from '@/lib/storage/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { DOC_TYPE_LABEL, type DocType } from '@/lib/types/client';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const LABEL_HEIGHT = 24;

function safeFileName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'client';
}

function fileExtension(path: string): string {
  return path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return Response.json({ error: 'Invalid client id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!(await hasPermission('clients.read', authData.user.id))) {
    return Response.json({ error: 'You do not have access to client documents' }, { status: 403 });
  }

  const [{ data: client, error: clientError }, { data: documents, error: documentsError }] =
    await Promise.all([
      supabase.from('client').select('full_name').eq('client_id', clientId).maybeSingle(),
      supabase
        .from('client_document')
        .select('document_id, document_type, file_path, uploaded_at')
        .eq('client_id', clientId)
        .order('uploaded_at', { ascending: true })
        .returns<Array<{ document_id: string; document_type: DocType; file_path: string; uploaded_at: string }>>(),
    ]);

  if (clientError || !client) {
    return Response.json({ error: 'Client record not found' }, { status: 404 });
  }
  if (documentsError) {
    console.error('Failed to load client documents for PDF packet:', documentsError.message);
    return Response.json({ error: 'Unable to load client documents' }, { status: 500 });
  }
  if (!documents?.length) {
    return Response.json({ error: 'This client has no uploaded documents yet' }, { status: 404 });
  }

  try {
    const output = await PDFDocument.create();
    const storage = getStorageClient();
    const bucket = getStorageBucket();

    for (const document of documents) {
      const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: document.file_path }));
      if (!object.Body) throw new Error(`Stored file is empty: ${document.document_type}`);
      const bytes = await object.Body.transformToByteArray();
      const extension = fileExtension(document.file_path);

      if (extension === 'pdf') {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pages = await output.copyPages(source, source.getPageIndices());
        for (const page of pages) output.addPage(page);
        continue;
      }

      let image: PDFImage;
      if (extension === 'jpg' || extension === 'jpeg') {
        image = await output.embedJpg(bytes);
      } else if (extension === 'png') {
        image = await output.embedPng(bytes);
      } else {
        throw new Error(`Unsupported uploaded file format: ${extension || 'unknown'}`);
      }

      const page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const label = DOC_TYPE_LABEL[document.document_type] ?? document.document_type;
      const uploadedDate = new Date(document.uploaded_at).toLocaleDateString('en-PH', {
        dateStyle: 'medium',
        timeZone: 'Asia/Manila',
      });
      page.drawText(`${label} · Uploaded ${uploadedDate}`, {
        x: PAGE_MARGIN,
        y: PAGE_HEIGHT - PAGE_MARGIN,
        size: 12,
        color: rgb(0.2, 0.25, 0.3),
      });

      const availableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
      const availableHeight = PAGE_HEIGHT - PAGE_MARGIN * 2 - LABEL_HEIGHT;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (PAGE_WIDTH - width) / 2,
        y: PAGE_MARGIN + (availableHeight - height) / 2,
        width,
        height,
      });
    }

    const pdfBytes = await output.save();
    const fileName = `Client_Documents_${safeFileName(client.full_name)}.pdf`;
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to assemble client document PDF:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to create PDF packet' },
      { status: 500 },
    );
  }
}