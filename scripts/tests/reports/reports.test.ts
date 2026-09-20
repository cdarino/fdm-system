import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import fs from "node:fs";
import path from "node:path";
import { getClientReportData, getPropertyReportData } from "@/lib/actions/reports";
import { generateClientPdfReport } from "@/lib/reports/pdf-client-report";
import { generatePropertyPdfReport } from "@/lib/reports/pdf-property-report";
import {
  createClient,
  addContactInfo,
  createClientDocument,
  createClientLog,
} from "@/lib/actions/clients";
import {
  createPropertyLot,
  assignPropertyClient,
} from "@/lib/actions/properties";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
  runTrackedCleanups,
} from "../framework/session";

describe("Operational Summary Reports & PDF Generation", () => {
  const testClientIds: string[] = [];
  const testPropertyIds: string[] = [];
  const createdPdfs: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    const adminClient = getTestAdminClient();

    // Clean up created property lots
    for (const id of testPropertyIds) {
      try {
        await adminClient.from("property_lot").delete().eq("property_id", id);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up created clients
    for (const id of testClientIds) {
      try {
        await adminClient.from("client").delete().eq("client_id", id);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up any generated PDF files on disk
    for (const filePath of createdPdfs) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore file cleanup
      }
    }

    await logoutUser();
    await runTrackedCleanups();
  });

  it("getClientReportData rejects when unauthenticated", async () => {
    await logoutUser();
    await expect(getClientReportData("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      "Unauthorized: You must be logged in"
    );
    await loginAsAdmin();
  });

  it("getPropertyReportData rejects when unauthenticated", async () => {
    await logoutUser();
    await expect(getPropertyReportData("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      "Unauthorized: You must be logged in"
    );
    await loginAsAdmin();
  });

  it("getClientReportData and generateClientPdfReport produce complete report", async () => {
    // Create test client with full profile
    const fullName = `${faker.person.fullName()} PDF-Test`;
    const client = await createClient({
      full_name: fullName,
      address: "123 Davao Riverfront Blvd",
      tin_number: `TIN-${faker.string.numeric(9)}`,
    });
    testClientIds.push(client.client_id);

    // Add primary contact
    await addContactInfo(client.client_id, {
      type: "Email",
      value: faker.internet.email(),
      is_primary: true,
    });

    // Add document
    await createClientDocument(client.client_id, {
      document_type: "Valid ID",
      file_path: "/storage/documents/valid_id.pdf",
    });

    // Add activity log
    await createClientLog(client.client_id, {
      event_type: "Consultation",
      description: "Initial client meeting regarding subdivision lot investment",
    });

    // Create property lot and assign to client
    const location = `Site-${faker.string.alphanumeric(6)}`;
    const lot = await createPropertyLot({
      location,
      block_number: Math.floor(Math.random() * 900) + 10,
      lot_number: Math.floor(Math.random() * 900) + 10,
      area_size: 200,
      price_per_sqm: 12000,
      status: "Open",
    });
    testPropertyIds.push(lot.property_id);

    await assignPropertyClient(lot.property_id, client.client_id, "Sold", {
      total_contract_price: 2400000,
    });

    // Fetch aggregated client report data
    const reportData = await getClientReportData(client.client_id);

    expect(reportData.client.full_name).toBe(fullName);
    expect(reportData.contacts.length).toBeGreaterThanOrEqual(1);
    expect(reportData.documents.length).toBe(1);
    expect(reportData.documentChecklist.present).toContain("Valid ID");
    expect(reportData.documentChecklist.isComplete).toBe(false);
    expect(reportData.documentChecklist.missing).toContain("Contract");
    expect(reportData.documentChecklist.missing).toContain("Deed of Sale");
    expect(reportData.logs.length).toBeGreaterThanOrEqual(1);
    expect(reportData.properties.length).toBe(1);
    expect(reportData.properties[0].total_contract_price).toBe(2400000);
    expect(reportData.financials.totalPortfolioValue).toBe(2400000);
    expect(reportData.financials.totalAreaSqm).toBe(200);

    // Generate PDF without errors
    expect(() => generateClientPdfReport(reportData)).not.toThrow();

    // Track created PDF for cleanup
    const sanitizedName = reportData.client.full_name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const pdfFilename = `Client_Report_${sanitizedName}_${dateStr}.pdf`;
    createdPdfs.push(path.resolve(process.cwd(), pdfFilename));
  });

  it("getPropertyReportData and generatePropertyPdfReport produce complete report", async () => {
    // Create test lot
    const location = `Subdivision-${faker.string.alphanumeric(6)}`;
    const lot = await createPropertyLot({
      location,
      block_number: Math.floor(Math.random() * 900) + 10,
      lot_number: Math.floor(Math.random() * 900) + 10,
      area_size: 150,
      price_per_sqm: 10000,
      status: "Open",
    });
    testPropertyIds.push(lot.property_id);

    // Create client and assign
    const client = await createClient({
      full_name: `${faker.person.fullName()} Lot-Buyer`,
      tin_number: `TIN-${faker.string.numeric(9)}`,
    });
    testClientIds.push(client.client_id);

    await assignPropertyClient(lot.property_id, client.client_id, "Reserved", {
      total_contract_price: 1500000,
    });

    // Fetch property report data
    const propertyReport = await getPropertyReportData(lot.property_id);

    expect(propertyReport.lot.location).toBe(location);
    expect(propertyReport.lot.area_size).toBe(150);
    expect(propertyReport.calculated_total_price).toBe(1500000);
    expect(propertyReport.active_account).toBeDefined();
    expect(propertyReport.active_account?.total_contract_price).toBe(1500000);
    expect(propertyReport.parties.length).toBe(1);
    expect(propertyReport.parties[0].client_id).toBe(client.client_id);

    // Generate PDF without errors
    expect(() => generatePropertyPdfReport(propertyReport)).not.toThrow();

    // Track created PDF for cleanup
    const dateStr = new Date().toISOString().slice(0, 10);
    const pdfFilename = `Property_Report_Block${propertyReport.lot.block_number}_Lot${propertyReport.lot.lot_number}_${dateStr}.pdf`;
    createdPdfs.push(path.resolve(process.cwd(), pdfFilename));
  });
});
