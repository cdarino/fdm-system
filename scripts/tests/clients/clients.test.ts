import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  addContactInfo,
  updateContactInfo,
  deleteContactInfo,
  createClientDocument,
  deleteClientDocument,
  createClientLog,
  getClientLogs,
} from "@/lib/actions/clients";
import {
  loginAsAdmin,
  logoutUser,
  getTestAdminClient,
  runTrackedCleanups,
} from "../framework/session";

describe("Client Management Actions", () => {
  const testClientIds: string[] = [];

  beforeAll(async () => {
    await loginAsAdmin();
  });

  afterAll(async () => {
    const adminClient = getTestAdminClient();
    for (const id of testClientIds) {
      try {
        await adminClient.from("client").delete().eq("client_id", id);
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
    const phone = faker.phone.number();
    const address = `${faker.location.streetAddress()}, ${faker.location.city()}`;
    const tinNumber = `TIN-${faker.string.numeric(9)}`;

    const newClient = await createClient({
      full_name: fullName,
      address,
      tin_number: tinNumber,
      status: "Active",
      contacts: [
        { type: "Email", value: email, is_primary: true },
        { type: "Phone", value: phone, is_primary: false },
      ],
    });

    expect(newClient.client_id).toBeDefined();
    expect(newClient.full_name).toBe(fullName);
    testClientIds.push(newClient.client_id);

    const clientWithDetails = await getClientById(newClient.client_id);
    expect(clientWithDetails.contact_info.length).toBe(2);

    const primaryContact = clientWithDetails.contact_info.find((c) => c.is_primary);
    expect(primaryContact?.value).toBe(email);
  });

  it("getClients filters by search term across name and TIN", async () => {
    const uniqueTag = `FakerTag-${Date.now()}`;
    const fullName = `${faker.person.fullName()} ${uniqueTag}`;
    const tinNumber = `TIN-${uniqueTag}`;

    const client = await createClient({
      full_name: fullName,
      tin_number: tinNumber,
      status: "Active",
    });
    testClientIds.push(client.client_id);

    // Search by partial name
    const byName = await getClients({ search: uniqueTag });
    expect(byName.data.some((c) => c.client_id === client.client_id)).toBe(true);

    // Search by TIN
    const byTin = await getClients({ search: tinNumber });
    expect(byTin.data.some((c) => c.client_id === client.client_id)).toBe(true);
  });

  it("getClients filters by status and supports pagination", async () => {
    const uniqueSuffix = Date.now();
    const activeClient = await createClient({
      full_name: `${faker.person.fullName()} Active ${uniqueSuffix}`,
      status: "Active",
    });
    const inactiveClient = await createClient({
      full_name: `${faker.person.fullName()} Inactive ${uniqueSuffix}`,
      status: "Inactive",
    });
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
    const client = await createClient({
      full_name: faker.person.fullName(),
      address: faker.location.streetAddress(),
      tin_number: `TIN-${faker.string.numeric(9)}`,
      status: "Active",
    });
    testClientIds.push(client.client_id);

    const updatedName = faker.person.fullName();
    const updatedAddress = faker.location.streetAddress();

    const updated = await updateClient(client.client_id, {
      full_name: updatedName,
      status: "Inactive",
      address: updatedAddress,
    });

    expect(updated.full_name).toBe(updatedName);
    expect(updated.status).toBe("Inactive");
    expect(updated.address).toBe(updatedAddress);
  });

  it("addContactInfo enforces single primary contact exclusivity", async () => {
    const client = await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Phone", value: faker.phone.number(), is_primary: true }],
    });
    testClientIds.push(client.client_id);

    // Add a new primary contact
    const newEmail = faker.internet.email();
    const newContact = await addContactInfo(client.client_id, {
      type: "Email",
      value: newEmail,
      is_primary: true,
    });

    const clientDetails = await getClientById(client.client_id);
    const primaryContacts = clientDetails.contact_info.filter((c) => c.is_primary);

    expect(primaryContacts.length).toBe(1);
    expect(primaryContacts[0].contact_id).toBe(newContact.contact_id);
    expect(primaryContacts[0].value).toBe(newEmail);
  });

  it("updateContactInfo and deleteContactInfo manage contact records", async () => {
    const client = await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Phone", value: faker.phone.number(), is_primary: false }],
    });
    testClientIds.push(client.client_id);

    const initialDetails = await getClientById(client.client_id);
    const contactId = initialDetails.contact_info[0].contact_id;

    // Update contact value
    const updatedPhone = faker.phone.number();
    const updated = await updateContactInfo(contactId, { value: updatedPhone });
    expect(updated.value).toBe(updatedPhone);

    // Delete contact
    await deleteContactInfo(contactId);
    const afterDelete = await getClientById(client.client_id);
    expect(afterDelete.contact_info.length).toBe(0);
  });

  it("createClientDocument and deleteClientDocument manage document metadata", async () => {
    const client = await createClient({ full_name: faker.person.fullName() });
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

    await deleteClientDocument(doc.document_id);

    const afterDelete = await getClientById(client.client_id);
    expect(afterDelete.client_document.some((d) => d.document_id === doc.document_id)).toBe(false);
  });

  it("createClientLog and getClientLogs record and retrieve client audit entries", async () => {
    const client = await createClient({ full_name: faker.person.fullName() });
    testClientIds.push(client.client_id);

    const logEntry = await createClientLog(client.client_id, {
      event_type: "CLIENT_REGISTERED",
      description: "Client registration submitted via admin panel",
    });

    expect(logEntry.log_id).toBeDefined();
    expect(logEntry.event_type).toBe("CLIENT_REGISTERED");

    const logs = await getClientLogs(client.client_id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].event_type).toBe("CLIENT_REGISTERED");

    const listResult = await getClients({ search: client.full_name });
    const clientItem = listResult.data.find((c) => c.client_id === client.client_id);
    expect(clientItem?.latest_activity).not.toBeNull();
    expect(clientItem?.latest_activity?.performer_name).not.toBe("System");
  });

  it("deleteClient removes client and all associated relations", async () => {
    const client = await createClient({
      full_name: faker.person.fullName(),
      contacts: [{ type: "Email", value: faker.internet.email(), is_primary: true }],
    });

    await createClientLog(client.client_id, {
      event_type: "PRE_DELETE_AUDIT",
      description: "Log before client deletion",
    });

    await deleteClient(client.client_id);

    await expect(getClientById(client.client_id)).rejects.toThrow("Client not found");
  });
});
