import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  archiveClient,
  unarchiveClient,
  deleteClient,
  addContactInfo,
  updateContactInfo,
  deleteContactInfo,
  createClientDocument,
  updateClientDocumentLabel,
  deleteClientDocument,
  createClientLog,
  getClientLogs,
} from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  hardDeleteTestClient,
  runTrackedCleanups,
} from "../framework/session";
import { unwrap } from "../framework/action-helper";
import { fakePhMobile, uniqueNameSuffix } from "../framework/fake-data";

function fakeTin(): string {
  const d = faker.string.numeric(9);
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}`;
}

describe("Client Management Actions", () => {
  const testClientIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    for (const id of testClientIds) {
      try {
        await hardDeleteTestClient(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    await logoutUser();
    await runTrackedCleanups();
  });

  it("getClients rejects when unauthenticated", async () => {
    await logoutUser();
    await expect(getClients()).rejects.toThrow("Unauthorized: You must be logged in");
    await loginAsAdmin();
  });

  it("createClient creates client with contact records", async () => {
    const fullName = faker.person.fullName();
    const email = faker.internet.email();
    const phone = fakePhMobile();
    const address = `${faker.location.streetAddress()}, ${faker.location.city()}`;
    const tinNumber = fakeTin();

    const newClient = unwrap(await createClient({
      full_name: fullName,
      address,
      tin_number: tinNumber,
      status: "Active",
      contacts: [
        { type: "Email", value: email, is_primary: true },
        { type: "Phone", value: phone, is_primary: false },
      ],
    }));

    expect(newClient.client_id).toBeDefined();
    expect(newClient.full_name).toBe(fullName);
    testClientIds.push(newClient.client_id);

    const clientWithDetails = await getClientById(newClient.client_id);
    expect(clientWithDetails.contact_info.length).toBe(2);

    const primaryContact = clientWithDetails.contact_info.find((c) => c.is_primary);
    expect(primaryContact?.value).toBe(email);
  });

  it("getClientById returns a consolidated profile including property lots", async () => {
    const client = unwrap(await createClient({
      full_name: faker.person.fullName(),
      status: "Active",
    }));
    testClientIds.push(client.client_id);

    // Regression guard: `property_lot.client_id` was dropped in 20260914223800,
    // so embedding property_lot directly from client throws PGRST200. The lots
    // have to be walked through account_party -> ledger_account.
    const details = await getClientById(client.client_id);

    expect(details.client_id).toBe(client.client_id);
    expect(Array.isArray(details.properties)).toBe(true);
    expect(Array.isArray(details.client_document)).toBe(true);
    expect(Array.isArray(details.client_log)).toBe(true);
  });

  it("getClients filters by search term across name and TIN", async () => {
    const uniqueTag = `FakerTag-${uniqueNameSuffix()}`;
    const fullName = `${faker.person.fullName()} ${uniqueTag}`;
    const tinNumber = fakeTin();

    const client = unwrap(await createClient({
      full_name: fullName,
      tin_number: tinNumber,
      status: "Active",
    }));
    testClientIds.push(client.client_id);

    // Search by partial name
    const byName = await getClients({ search: uniqueTag });
    expect(byName.data.some((c) => c.client_id === client.client_id)).toBe(true);

    // Search by TIN
    const byTin = await getClients({ search: tinNumber });
    expect(byTin.data.some((c) => c.client_id === client.client_id)).toBe(true);
  });

  it("getClients filters by status and supports pagination", async () => {
    const uniqueSuffix = uniqueNameSuffix();
    const activeClient = unwrap(await createClient({
      full_name: `${faker.person.fullName()} Active ${uniqueSuffix}`,
      status: "Active",
    }));
    const inactiveClient = unwrap(await createClient({
      full_name: `${faker.person.fullName()} Inactive ${uniqueSuffix}`,
      status: "Inactive",
    }));
    testClientIds.push(activeClient.client_id, inactiveClient.client_id);

    const activeList = await getClients({ search: `${uniqueSuffix}`, status: "Active" });
    expect(activeList.data.some((c) => c.client_id === activeClient.client_id)).toBe(true);
    expect(activeList.data.some((c) => c.client_id === inactiveClient.client_id)).toBe(false);

    // Test pagination limit
    const pageOne = await getClients({ limit: 1 });
    expect(pageOne.data.length).toBeLessThanOrEqual(1);
    expect(pageOne.limit).toBe(1);
  });

  it("updateClient modifies client fields", async () => {
    const client = unwrap(await createClient({
      full_name: faker.person.fullName(),
      address: faker.location.streetAddress(),
      tin_number: fakeTin(),
      status: "Active",
    }));
    testClientIds.push(client.client_id);

    const updatedName = faker.person.fullName();
    const updatedAddress = faker.location.streetAddress();

    const updated = unwrap(await updateClient(client.client_id, {
      full_name: updatedName,
      status: "Inactive",
      address: updatedAddress,
    }));

    expect(updated.full_name).toBe(updatedName);
    expect(updated.status).toBe("Inactive");
    expect(updated.address).toBe(updatedAddress);
  });

  it("addContactInfo enforces single primary contact exclusivity", async () => {
    const client = unwrap(await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Phone", value: fakePhMobile(), is_primary: true }],
    }));
    testClientIds.push(client.client_id);

    // Add a new primary contact
    const newEmail = faker.internet.email();
    const newContact = unwrap(await addContactInfo(client.client_id, {
      type: "Email",
      value: newEmail,
      is_primary: true,
    }));

    const clientDetails = await getClientById(client.client_id);
    const primaryContacts = clientDetails.contact_info.filter((c) => c.is_primary);

    expect(primaryContacts.length).toBe(1);
    expect(primaryContacts[0].contact_id).toBe(newContact.contact_id);
    expect(primaryContacts[0].value).toBe(newEmail);
  });

  it("updateContactInfo and deleteContactInfo manage contact records", async () => {
    const client = unwrap(await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Phone", value: fakePhMobile(), is_primary: false }],
    }));
    testClientIds.push(client.client_id);

    const initialDetails = await getClientById(client.client_id);
    const contactId = initialDetails.contact_info[0].contact_id;

    // Update contact value
    const updatedPhone = fakePhMobile();
    const updated = unwrap(await updateContactInfo(contactId, { value: updatedPhone }));
    expect(updated.value).toBe(updatedPhone);

    // Delete contact
    unwrap(await deleteContactInfo(contactId));
    const afterDelete = await getClientById(client.client_id);
    expect(afterDelete.contact_info.length).toBe(0);
  });

  it("createClientDocument and deleteClientDocument manage document metadata", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const docName = faker.system.commonFileName("pdf");
    const doc = await createClientDocument(client.client_id, {
      document_type: "Valid ID",
      file_path: `/uploads/clients/${docName}`,
    });

    expect(doc.document_id).toBeDefined();
    expect(doc.document_type).toBe("Valid ID");

    const withDoc = await getClientById(client.client_id);
    expect(withDoc.client_document.some((d) => d.document_id === doc.document_id)).toBe(true);

    unwrap(await deleteClientDocument(doc.document_id));

    const afterDelete = await getClientById(client.client_id);
    expect(afterDelete.client_document.some((d) => d.document_id === doc.document_id)).toBe(false);
  });

  it("supports custom document types with user-defined names", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const docName = faker.system.commonFileName("pdf");
    const customType = "Barangay Clearance Certificate";
    const doc = await createClientDocument(client.client_id, {
      document_type: customType,
      file_path: `/uploads/clients/${docName}`,
    });

    expect(doc.document_id).toBeDefined();
    expect(doc.document_type).toBe(customType);

    const withDoc = await getClientById(client.client_id);
    const found = withDoc.client_document.find((d) => d.document_id === doc.document_id);
    expect(found).toBeDefined();
    expect(found?.document_type).toBe(customType);

    unwrap(await deleteClientDocument(doc.document_id));
  });

  it("updateClientDocumentLabel sets and clears a document label", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const doc = await createClientDocument(client.client_id, {
      document_type: "Valid ID",
      file_path: `/uploads/clients/${faker.system.commonFileName("pdf")}`,
    });
    expect(doc.label).toBeNull();

    const labeled = unwrap(await updateClientDocumentLabel(doc.document_id, "Driver's License"));
    expect(labeled.label).toBe("Driver's License");

    const loaded = await getClientById(client.client_id);
    expect(loaded.client_document.find((d) => d.document_id === doc.document_id)?.label).toBe(
      "Driver's License"
    );

    const cleared = unwrap(await updateClientDocumentLabel(doc.document_id, "   "));
    expect(cleared.label).toBeNull();
  });

  it("enforces document placement: personal allows only Valid ID and custom types, property requires property_id", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    // Property document type under personal (no property_id) must be rejected
    await expect(
      createClientDocument(client.client_id, {
        document_type: "Contract",
        file_path: "/uploads/clients/contract.pdf",
      })
    ).rejects.toThrow(/assigned to a property folder/i);

    // Valid ID with a property_id must be rejected
    const dummyLotId = faker.string.uuid();
    await expect(
      createClientDocument(client.client_id, {
        document_type: "Valid ID",
        file_path: "/uploads/clients/id.pdf",
        property_id: dummyLotId,
      })
    ).rejects.toThrow(/under personal documents/i);
  });

  it("createClientLog and getClientLogs record and retrieve client audit entries", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const logEntry = await createClientLog(client.client_id, {
      event_type: "CLIENT_REGISTERED",
      description: "Client registration submitted via admin panel",
    });

    expect(logEntry.log_id).toBeDefined();
    expect(logEntry.event_type).toBe("CLIENT_REGISTERED");
    expect(logEntry.performer_name).toBeTruthy();
    expect(logEntry.performer_name).not.toBe("System");

    const logs = await getClientLogs(client.client_id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].event_type).toBe("CLIENT_REGISTERED");
    expect(logs[0].performer_name).toBe(logEntry.performer_name);
    const profile = await getClientById(client.client_id);
    expect(profile.client_log.find(log => log.log_id === logEntry.log_id)?.performer_name).toBe(logEntry.performer_name);

    const listResult = await getClients({ search: client.full_name });
    const clientItem = listResult.data.find((c) => c.client_id === client.client_id);
    expect(clientItem?.latest_activity).not.toBeNull();
    expect(clientItem?.latest_activity?.performer_name).not.toBe("System");
  });

  it("deleteClient removes client and all associated relations", async () => {
    const client = unwrap(await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Email", value: faker.internet.email(), is_primary: true }],
    }));

    await createClientLog(client.client_id, {
      event_type: "PRE_DELETE_AUDIT",
      description: "Log before client deletion",
    });

    unwrap(await deleteClient(client.client_id));

    await expect(getClientById(client.client_id)).rejects.toThrow("Client not found");
  });

  it("archiveClient sets archived_at and unarchiveClient clears it", async () => {
    const client = unwrap(await createClient({ full_name: faker.person.fullName() }));
    testClientIds.push(client.client_id);

    const archived = unwrap(await archiveClient(client.client_id));
    expect(archived.status).toBe("Archived");
    expect(archived.archived_at).not.toBeNull();

    const retrievedArchived = await getClientById(client.client_id);
    expect(retrievedArchived.archived_at).toBe(archived.archived_at);

    const restored = unwrap(await unarchiveClient(client.client_id));
    expect(restored.status).toBe("Active");
    expect(restored.archived_at).toBeNull();
  });

  it("creates and updates client with civil_status, spouse_name, spouse_contact, and gender", async () => {
    const fullName = faker.person.fullName();
    const spouseName = faker.person.fullName();
    const spouseContact = faker.phone.number();

    const client = unwrap(
      await createClient({
        full_name: fullName,
        civil_status: "Married",
        spouse_name: spouseName,
        spouse_contact: [spouseContact],
        gender: "Female",
        status: "Active",
      })
    );
    testClientIds.push(client.client_id);

    expect(client.civil_status).toBe("Married");
    expect(client.spouse_name).toBe(spouseName);
    expect(client.spouse_contact).toEqual([spouseContact]);
    expect(client.gender).toBe("Female");

    const fetched = await getClientById(client.client_id);
    expect(fetched.civil_status).toBe("Married");
    expect(fetched.spouse_name).toBe(spouseName);
    expect(fetched.spouse_contact).toEqual([spouseContact]);
    expect(fetched.gender).toBe("Female");

    const listedResult = await getClients({ search: fullName, limit: 20 });
    const listed = listedResult.data.find((c) => c.client_id === client.client_id);
    expect(listed).toBeDefined();
    expect(listed?.civil_status).toBe("Married");
    expect(listed?.spouse_name).toBe(spouseName);
    expect(listed?.spouse_contact).toEqual([spouseContact]);
    expect(listed?.gender).toBe("Female");

    const updated = unwrap(
      await updateClient(client.client_id, {
        civil_status: "Single",
      })
    );

    expect(updated.civil_status).toBe("Single");
    expect(updated.spouse_name).toBeNull();
    expect(updated.spouse_contact).toBeNull();

    const fetchedAfter = await getClientById(client.client_id);
    expect(fetchedAfter.civil_status).toBe("Single");
    expect(fetchedAfter.spouse_name).toBeNull();
    expect(fetchedAfter.spouse_contact).toBeNull();
  });

  it("rejects client creation when status is Married without spouse name or spouse contact", async () => {
    const noSpouseNameResult = await createClient({
      full_name: faker.person.fullName(),
      civil_status: "Married",
      spouse_name: "",
      spouse_contact: ["09171234567"],
      status: "Active",
    });

    expect(noSpouseNameResult.success).toBe(false);
    if (!noSpouseNameResult.success) {
      expect(noSpouseNameResult.error).toContain("Spouse name is required for married clients");
    }

    const noContactResult = await createClient({
      full_name: faker.person.fullName(),
      civil_status: "Married",
      spouse_name: faker.person.fullName(),
      spouse_contact: [],
      status: "Active",
    });

    expect(noContactResult.success).toBe(false);
    if (!noContactResult.success) {
      expect(noContactResult.error).toContain("At least one spouse contact is required for married clients");
    }

    const emptyContactResult = await createClient({
      full_name: faker.person.fullName(),
      civil_status: "Married",
      spouse_name: faker.person.fullName(),
      spouse_contact: ["   "],
      status: "Active",
    });

    expect(emptyContactResult.success).toBe(false);
    if (!emptyContactResult.success) {
      expect(emptyContactResult.error).toContain("Spouse contact cannot be empty text");
    }
  });

  it("updates married client with multiple dynamic spouse contacts", async () => {
    const fullName = faker.person.fullName();
    const spouseName = faker.person.fullName();
    const initialContact = "09171234567";

    const client = unwrap(
      await createClient({
        full_name: fullName,
        civil_status: "Married",
        spouse_name: spouseName,
        spouse_contact: [initialContact],
        status: "Active",
      })
    );
    testClientIds.push(client.client_id);

    const updated = unwrap(
      await updateClient(client.client_id, {
        civil_status: "Married",
        spouse_name: spouseName,
        spouse_contact: [initialContact, "spouse@email.com", "09281234567"],
      })
    );

    expect(updated.spouse_contact).toEqual([initialContact, "spouse@email.com", "09281234567"]);

    const fetched = await getClientById(client.client_id);
    expect(fetched.spouse_contact).toEqual([initialContact, "spouse@email.com", "09281234567"]);
  });
});

