import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/documents/[id]/route";
import { createClient, uploadClientDocument } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  withTemporaryUser,
  hardDeleteTestClient,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

function pdfForm(documentType: string, name = "proxy-test.pdf"): FormData {
  const form = new FormData();
  form.set("document_type", documentType);
  form.set("file", new File(["%PDF-1.4 test document content"], name, { type: "application/pdf" }));
  return form;
}

describe("Document Proxy Route (/api/documents/[id])", () => {
  let clientId = "";
  let documentId = "";
  const randomUuid = "00000000-0000-4000-8000-000000000000";

  beforeAll(async () => {
    await loginAsAdmin();
    const client = unwrap(
      await createClient({ full_name: `Proxy Test Client ${uniqueNameSuffix()}` })
    );
    clientId = client.client_id;

    const doc = unwrap(
      await uploadClientDocument(clientId, pdfForm("Valid ID", "test-id-scan.pdf"))
    );
    documentId = doc.document_id;
  });

  afterAll(async () => {
    await loginAsAdmin();
    if (clientId) {
      await hardDeleteTestClient(clientId);
    }
    await logoutUser();
  });

  it("returns 400 for malformed UUID in path", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/not-a-uuid");
    const res = await GET(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid document id/i);
  });

  it("returns 401 JSON for unauthenticated API requests", async () => {
    await logoutUser();
    const req = new NextRequest(`http://localhost:3000/api/documents/${documentId}`, {
      headers: { accept: "application/json" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: documentId }) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/authentication required/i);
  });

  it("returns 307 redirect to login for unauthenticated browser visits", async () => {
    await logoutUser();
    const req = new NextRequest(`http://localhost:3000/api/documents/${documentId}`, {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: documentId }) });
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toMatch(/\/login\?next=/);
    expect(location).toContain(encodeURIComponent(`/api/documents/${documentId}`));
  });

  it("returns 404 when document does not exist", async () => {
    await loginAsAdmin();
    const req = new NextRequest(`http://localhost:3000/api/documents/${randomUuid}`, {
      headers: { accept: "application/json" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: randomUuid }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/document not found/i);
  });

  it("returns 403 when user lacks permissions for the document", async () => {
    await logoutUser();
    await withTemporaryUser({ roleNames: [] }, async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${documentId}`, {
        headers: { accept: "application/json" },
      });
      const res = await GET(req, { params: Promise.resolve({ id: documentId }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/permission/i);
    });
    await loginAsAdmin();
  });

  it("returns 307 redirect with presigned S3 URL for authorized users", async () => {
    await loginAsAdmin();
    const req = new NextRequest(`http://localhost:3000/api/documents/${documentId}`);
    const res = await GET(req, { params: Promise.resolve({ id: documentId }) });

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("response-content-disposition=inline");
  });

  it("includes attachment disposition when download=1 is set", async () => {
    await loginAsAdmin();
    const req = new NextRequest(`http://localhost:3000/api/documents/${documentId}?download=1`);
    const res = await GET(req, { params: Promise.resolve({ id: documentId }) });

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("response-content-disposition=attachment");
  });
});
