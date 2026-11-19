import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/permissions';
import { createClientDocumentUrl } from '@/lib/storage/client-documents';
import { getDocumentDefaultLabel } from '@/lib/format-document-name';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function renderErrorHtml(title: string, message: string, statusCode: number): string {
  const isForbidden = statusCode === 403;
  const badgeColor = isForbidden ? '#ef4444' : '#64748b';
  const badgeBg = isForbidden ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${statusCode} - ${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0b0f17;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.75rem;
      padding: 2rem;
      max-width: 28rem;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: ${badgeColor};
      background: ${badgeBg};
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #f8fafc;
    }
    p {
      font-size: 0.875rem;
      color: #94a3b8;
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #ffffff;
      background: #2563eb;
      border-radius: 0.375rem;
      text-decoration: none;
      transition: background 0.15s;
    }
    a:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${statusCode}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/dashboard">Return to Dashboard</a>
  </div>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
  }

  const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false;

  // Authenticate user session
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    if (acceptsHtml) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl, { status: 307 });
    }
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Look up document record using admin client to differentiate 404 from 403
  const adminClient = createAdminClient();
  const { data: doc, error: docError } = await adminClient
    .from('file_attachment')
    .select('attachment_id, entity_type, entity_id, client_id, property_id, file_path, file_name, file_category')
    .eq('attachment_id', id)
    .maybeSingle<{
      attachment_id: string;
      entity_type: string;
      entity_id: string;
      client_id: string | null;
      property_id: string | null;
      file_path: string;
      file_name: string | null;
      file_category: string;
    }>();

  if (docError || !doc) {
    if (acceptsHtml) {
      return new Response(
        renderErrorHtml('Document Not Found', 'The requested document could not be found or has been removed.', 404),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Authorize user against document entity type
  const isSystemAdmin = await hasPermission('system.read', user.id);
  let isAllowed = isSystemAdmin;

  if (!isAllowed) {
    switch (doc.entity_type) {
      case 'land_title_notice':
        isAllowed = await hasPermission('legal.read', user.id);
        break;
      case 'land_title':
        isAllowed =
          (await hasPermission('legal.read', user.id)) ||
          (Boolean(doc.client_id) && (await hasPermission('clients.read', user.id)));
        break;
      case 'property':
        isAllowed = await hasPermission('properties.read', user.id);
        break;
      case 'client':
        isAllowed =
          (await hasPermission('clients.read', user.id)) ||
          (await hasPermission('legal.read', user.id));
        break;
      default:
        isAllowed =
          (await hasPermission('clients.read', user.id)) ||
          (await hasPermission('legal.read', user.id)) ||
          (await hasPermission('properties.read', user.id));
        break;
    }
  }

  if (!isAllowed) {
    if (acceptsHtml) {
      return new Response(
        renderErrorHtml('Access Denied', 'You do not have permission to view or download this document.', 403),
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    return NextResponse.json({ error: 'You do not have permission to view this document' }, { status: 403 });
  }

  // Mint presigned URL and redirect client directly to S3
  const isDownload = request.nextUrl.searchParams.get('download') === '1';
  const effectiveName = getDocumentDefaultLabel({ file_name: doc.file_name, file_path: doc.file_path });
  const sanitizedName = effectiveName.replace(/["\r\n]/g, '_');
  const dispositionType = isDownload ? 'attachment' : 'inline';

  const signedUrl = await createClientDocumentUrl(doc.file_path, 60, {
    contentDisposition: `${dispositionType}; filename="${sanitizedName}"`,
  });

  return NextResponse.redirect(signedUrl, { status: 307 });
}
