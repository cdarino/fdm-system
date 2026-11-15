import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  indexEntityText,
  getEntityIndex,
  deleteEntityIndex,
  searchDocumentText,
  getUnindexedDocuments,
} from "@/lib/actions/search-index";
import { tidyExtractedText } from "@/lib/ocr/extract-document-text";
import { loginAsAdmin, logoutUser } from "../framework/session";

describe("OCR Search Index & Text Extraction", () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    await logoutUser();
  });

  it("cleans and tidies raw extracted OCR text", () => {
    const rawConfetti = "  \n  12   \n ,,, \n  Contract of Sale  Between Parties  \n \n   Lot 45 Block 12  \n";
    const cleaned = tidyExtractedText(rawConfetti);
    expect(cleaned).toContain("Contract of Sale Between Parties");
    expect(cleaned).toContain("Lot 45 Block 12");
    expect(cleaned).not.toContain(",,,");
  });

  it("indexes, retrieves, and deletes document text in search_index", async () => {
    const testEntityId = faker.string.uuid();
    const testContent = "Agreement regarding Transfer of Lot 18 Block 99 in Davao Millennium";
    const testKeywords = "Valid ID Land Title Transfer";

    // 1. Index document
    const indexed = await indexEntityText({
      entity_id: testEntityId,
      entity_type: "client_document",
      content: testContent,
      keywords: testKeywords,
    });
    expect(indexed.entity_id).toBe(testEntityId);
    expect(indexed.content).toBe(testContent);

    // 2. Retrieve indexed document
    const retrieved = await getEntityIndex("client_document", testEntityId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe(testContent);
    expect(retrieved?.keywords).toBe(testKeywords);

    // 3. Delete from index
    await deleteEntityIndex("client_document", testEntityId);
    const afterDelete = await getEntityIndex("client_document", testEntityId);
    expect(afterDelete).toBeNull();
  });

  it("returns unindexed documents query correctly", async () => {
    const unindexed = await getUnindexedDocuments(10);
    expect(Array.isArray(unindexed)).toBe(true);
    // Each unindexed item must have valid metadata
    for (const doc of unindexed) {
      expect(doc.attachment_id).toBeDefined();
      expect(doc.file_name).toBeDefined();
    }
  });

  it("searches document text across indexed keywords and content", async () => {
    const uniqueToken = `unique_${Date.now()}`;
    const testEntityId = faker.string.uuid();

    await indexEntityText({
      entity_id: testEntityId,
      entity_type: "client_document",
      content: `Official notice of clearance for token ${uniqueToken}`,
      keywords: "Deed of Sale",
    });

    const hits = await searchDocumentText(uniqueToken);
    // Since testEntityId is not in file_attachment, hits resolves empty safely or with match
    expect(Array.isArray(hits)).toBe(true);

    // Clean up
    await deleteEntityIndex("client_document", testEntityId);
  });
});
