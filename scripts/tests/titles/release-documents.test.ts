import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { createLandTitle } from "@/lib/actions/titles";
import {
  deleteReleaseDocument,
  getMissingReleaseDocumentsForTitle,
  getReleaseDocumentUrl,
  getReleaseDocuments,
  uploadReleaseDocument,
} from "@/lib/actions/release-documents";
import { assignPropertyFullyPaid, createPropertyLot } from "@/lib/actions/properties";
import { createClient, getClientById, uploadClientDocument } from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  withTemporaryUser,
  hardDeleteTestProperty,
  hardDeleteTestClient,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { uniqueNameSuffix } from "../framework/fake-data";

function pdfForm(documentType: string, name = "scan.pdf", propertyId?: string): FormData {
  const form = new FormData();
  form.set("document_type", documentType);
  form.set("file", new File(["%PDF-1.4 test document"], name, { type: "application/pdf" }));
  if (propertyId) form.set("property_id", propertyId);
  return form;
}

describe("Release documents are client documents", () => {
  const testPropertyIds: string[] = [];
  const testClientIds: string[] = [];
  let clientId = "";
  let lotId = "";
  let titleId = "";

  async function soldLotWithTitle(label: string) {
    const lot = unwrap(
      await createPropertyLot({
        location: `${label} Estate`,
        block_number: faker.number.int({ min: 100, max: 999 }),
        lot_number: faker.number.int({ min: 1, max: 99 }),
        area_size: 150,
        price_per_sqm: 9000,
      })
    );
    testPropertyIds.push(lot.property_id);
    unwrap(await assignPropertyFullyPaid(lot.property_id, clientId));
    const title = unwrap(
      await createLandTitle({
        property_id: lot.property_id,
        title_holder: "fdm",
        title_number: `TCT-${label.replace(/\s/g, "")}-${Date.now()}`,
      })
    );
    return { lotId: lot.property_id, titleId: title.title_id };
  }

  beforeAll(async () => {
    await loginAsAdmin();
    const client = unwrap(await createClient({ full_name: `Release Packet Buyer ${uniqueNameSuffix()}` }));
    testClientIds.push(client.client_id);
    clientId = client.client_id;
    ({ lotId, titleId } = await soldLotWithTitle("Release Packet"));
  });

  afterAll(async () => {
    for (const id of testPropertyIds) {
      try {
        await hardDeleteTestProperty(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const id of testClientIds) {
      try {
        await hardDeleteTestClient(id);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("uploads from the Legal page show on the client profile, linked to the lot", async () => {
    const soa = unwrap(await uploadReleaseDocument(titleId, pdfForm("SOA", "soa.pdf")));
    expect(soa.client_id).toBe(clientId);
    expect(soa.property_id).toBe(lotId);

    const client = await getClientById(clientId);
    expect(client.client_document.some((d) => d.document_id === soa.document_id)).toBe(true);
    expect(await getMissingReleaseDocumentsForTitle(titleId)).not.toContain("SOA");
    expect(await getReleaseDocumentUrl(soa.document_id)).toMatch(/^https?:\/\//);
  });

  it("uploads from the client profile count toward the release packet", async () => {
    // No lot chosen: applies to all of the client's lots
    unwrap(await uploadClientDocument(clientId, pdfForm("Contract", "contract-to-sell.pdf")));
    // Linked to this lot
    unwrap(await uploadClientDocument(clientId, pdfForm("Title Copy", "title.pdf", lotId)));

    const missing = await getMissingReleaseDocumentsForTitle(titleId);
    expect(missing).not.toContain("Contract");
    expect(missing).not.toContain("Title Copy");
  });

  it("does not count another lot's documents", async () => {
    const other = await soldLotWithTitle("Second Lot");
    unwrap(await uploadReleaseDocument(other.titleId, pdfForm("Certificate of Ownership")));

    expect(await getMissingReleaseDocumentsForTitle(titleId)).toContain("Certificate of Ownership");
    expect(await getMissingReleaseDocumentsForTitle(other.titleId)).not.toContain("Certificate of Ownership");
  });

  it("replacing an item swaps this lot's file but keeps files shared by all lots", async () => {
    const first = unwrap(await uploadReleaseDocument(titleId, pdfForm("Payment History", "v1.pdf")));
    const second = unwrap(await uploadReleaseDocument(titleId, pdfForm("Payment History", "v2.pdf")));

    const packet = await getReleaseDocuments(titleId);
    const histories = packet.filter((d) => d.document_type === "Payment History");
    expect(histories.map((d) => d.document_id)).toEqual([second.document_id]);
    expect(histories.some((d) => d.document_id === first.document_id)).toBe(false);

    // The shared Contract from the client profile is untouched by a lot upload
    unwrap(await uploadReleaseDocument(titleId, pdfForm("Contract", "lot-contract.pdf")));
    const contracts = (await getReleaseDocuments(titleId)).filter((d) => d.document_type === "Contract");
    expect(contracts.some((d) => !d.property_id)).toBe(true);
  });

  it("removing an item deletes it from the client's documents too", async () => {
    const deed = unwrap(await uploadReleaseDocument(titleId, pdfForm("Deed of Sale")));
    unwrap(await deleteReleaseDocument(deed.document_id));

    const client = await getClientById(clientId);
    expect(client.client_document.some((d) => d.document_id === deed.document_id)).toBe(false);
  });

  it("does not let the Legal page touch other paperwork or other types", async () => {
    const validId = unwrap(await uploadClientDocument(clientId, pdfForm("Valid ID", "id.pdf")));
    expect((await deleteReleaseDocument(validId.document_id)).success).toBe(false);
    expect((await uploadReleaseDocument(titleId, pdfForm("Valid ID"))).success).toBe(false);
  });

  it("only lets Legal upload release documents", async () => {
    await logoutUser();

    await withTemporaryUser({ roleNames: ["billing_staff"] }, async () => {
      const res = await uploadReleaseDocument(titleId, pdfForm("SOA"));
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toMatch(/Forbidden|permission 'legal.update'/i);
    });

    await withTemporaryUser({ roleNames: ["legal_staff"] }, async () => {
      unwrap(await uploadReleaseDocument(titleId, pdfForm("SOA", "legal-upload.pdf")));
    });

    await loginAsAdmin();
  });
});
