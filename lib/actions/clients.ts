"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import {
  type Client,
  type ClientWithDetails,
  type ContactInfo,
  type ClientDocument,
  type ClientLog,
  type DocType,
  type CreateClientInput,
  type UpdateClientInput,
  type CreateContactInfoInput,
  type UpdateContactInfoInput,
  type CreateClientDocumentInput,
  type CreateClientLogInput,
  type ClientInteractionInput,
  type ClientDocumentChecklist,
  type ClientDocumentNotification,
  type GetClientsParams,
  type PaginatedResult,
  REQUIRED_CLIENT_DOCUMENTS,
} from "@/lib/types/client";

import { getPaginationOffsets, buildPaginatedResult } from "@/lib/pagination";

export async function getClients(
  params?: GetClientsParams
): Promise<PaginatedResult<Client>> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { page, limit, from, to } = getPaginationOffsets(params);

  let query = supabase
    .from("client")
    .select("*", { count: "exact" });

  if (params?.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`full_name.ilike.${term},tin_number.ilike.${term},address.ilike.${term}`);
  }

  if (params?.status?.trim()) {
    query = query.eq("status", params.status.trim());
  } else if (!params?.includeArchived) {
    // Keep active lists clear by excluding archived files unless explicitly included
    query = query.neq("status", "Archived");
  }

  if (params?.area?.trim()) {
    query = query.ilike("address", `%${params.area.trim()}%`);
  }

  const sortBy = params?.sortBy ?? "created_at";
  const ascending = params?.sortOrder === "asc";
  query = query.order(sortBy, { ascending }).range(from, to);

  const { data, error, count } = await query.returns<Client[]>();
  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  return buildPaginatedResult(data ?? [], count ?? 0, page, limit);
}

export async function getClientById(clientId: string): Promise<ClientWithDetails> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  // Consolidated client profile: includes contacts, documents, interaction logs, and assigned property lots
  const { data, error } = await supabase
    .from("client")
    .select("*, contact_info(*), client_document(*), client_log(*), properties:property_lot(*)")
    .eq("client_id", clientId)
    .single<ClientWithDetails>();

  if (error || !data) {
    throw new Error(`Client not found: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const userId = await requirePermission("clients.create");
  const supabase = await createSupabaseServerClient();

  const { data: client, error: clientError } = await supabase
    .from("client")
    .insert({
      full_name: input.full_name.trim(),
      address: input.address?.trim() ?? null,
      tin_number: input.tin_number?.trim() ?? null,
      status: input.status?.trim() ?? "Active",
    })
    .select()
    .single<Client>();

  if (clientError || !client) {
    throw new Error(`Failed to create client: ${clientError?.message ?? "Unknown error"}`);
  }

  if (input.contacts && input.contacts.length > 0) {
    const contactRows = input.contacts.map((c) => ({
      client_id: client.client_id,
      type: c.type.trim(),
      value: c.value.trim(),
      is_primary: Boolean(c.is_primary),
    }));

    const { error: contactError } = await supabase
      .from("contact_info")
      .insert(contactRows);

    if (contactError) {
      throw new Error(`Client created but failed to add contacts: ${contactError.message}`);
    }
  }

  // Audit registration in client log
  await supabase.from("client_log").insert({
    client_id: client.client_id,
    event_type: "CLIENT_REGISTERED",
    description: "New client registered in system",
    performed_by: userId,
  });

  return client;
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput
): Promise<Client> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const updates: Record<string, unknown> = {};
  if (input.full_name !== undefined) updates.full_name = input.full_name.trim();
  if (input.address !== undefined) updates.address = input.address ? input.address.trim() : null;
  if (input.tin_number !== undefined) updates.tin_number = input.tin_number ? input.tin_number.trim() : null;
  if (input.status !== undefined) updates.status = input.status.trim();

  const { data, error } = await supabase
    .from("client")
    .update(updates)
    .eq("client_id", clientId)
    .select()
    .single<Client>();

  if (error || !data) {
    throw new Error(`Failed to update client: ${error?.message ?? "Unknown error"}`);
  }

  // Audit update in client log
  await supabase.from("client_log").insert({
    client_id: clientId,
    event_type: "CLIENT_UPDATED",
    description: `Client updated fields: ${Object.keys(updates).join(", ")}`,
    performed_by: userId,
  });

  return data;
}

export async function archiveClient(
  clientId: string,
  reason?: string
): Promise<Client> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client")
    .update({ status: "Archived" })
    .eq("client_id", clientId)
    .select()
    .single<Client>();

  if (error || !data) {
    throw new Error(`Failed to archive client: ${error?.message ?? "Unknown error"}`);
  }

  await supabase.from("client_log").insert({
    client_id: clientId,
    event_type: "CLIENT_ARCHIVED",
    description: reason ? `Archived: ${reason.trim()}` : "Client archived by admin staff",
    performed_by: userId,
  });

  return data;
}

export async function unarchiveClient(clientId: string): Promise<Client> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client")
    .update({ status: "Active" })
    .eq("client_id", clientId)
    .select()
    .single<Client>();

  if (error || !data) {
    throw new Error(`Failed to unarchive client: ${error?.message ?? "Unknown error"}`);
  }

  await supabase.from("client_log").insert({
    client_id: clientId,
    event_type: "CLIENT_RESTORED",
    description: "Client restored from archive to active status",
    performed_by: userId,
  });

  return data;
}

export async function getArchivedClients(
  params?: GetClientsParams
): Promise<PaginatedResult<Client>> {
  return getClients({
    ...params,
    status: "Archived",
    includeArchived: true,
  });
}

export async function deleteClient(clientId: string): Promise<void> {
  await requirePermission("clients.delete");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client")
    .delete()
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to delete client: ${error.message}`);
  }
}

export async function addContactInfo(
  clientId: string,
  input: CreateContactInfoInput
): Promise<ContactInfo> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  // Reset other contacts' primary flag if this contact is marked primary
  if (input.is_primary) {
    await supabase
      .from("contact_info")
      .update({ is_primary: false })
      .eq("client_id", clientId);
  }

  const { data, error } = await supabase
    .from("contact_info")
    .insert({
      client_id: clientId,
      type: input.type.trim(),
      value: input.value.trim(),
      is_primary: Boolean(input.is_primary),
    })
    .select()
    .single<ContactInfo>();

  if (error || !data) {
    throw new Error(`Failed to add contact info: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function getClientContacts(clientId: string): Promise<ContactInfo[]> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contact_info")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch contact details: ${error.message}`);
  }

  return data ?? [];
}

export async function updateContactInfo(
  contactId: string,
  input: UpdateContactInfoInput
): Promise<ContactInfo> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  // Reset sibling contacts if setting primary to true
  if (input.is_primary) {
    const { data: current } = await supabase
      .from("contact_info")
      .select("client_id")
      .eq("contact_id", contactId)
      .single<{ client_id: string }>();

    if (current?.client_id) {
      await supabase
        .from("contact_info")
        .update({ is_primary: false })
        .eq("client_id", current.client_id);
    }
  }

  const updates: Record<string, unknown> = {
    last_updated: new Date().toISOString(),
  };
  if (input.type !== undefined) updates.type = input.type.trim();
  if (input.value !== undefined) updates.value = input.value.trim();
  if (input.is_primary !== undefined) updates.is_primary = input.is_primary;

  const { data, error } = await supabase
    .from("contact_info")
    .update(updates)
    .eq("contact_id", contactId)
    .select()
    .single<ContactInfo>();

  if (error || !data) {
    throw new Error(`Failed to update contact info: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function deleteContactInfo(contactId: string): Promise<void> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("contact_info")
    .delete()
    .eq("contact_id", contactId);

  if (error) {
    throw new Error(`Failed to delete contact info: ${error.message}`);
  }
}

export async function createClientDocument(
  clientId: string,
  input: CreateClientDocumentInput
): Promise<ClientDocument> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_document")
    .insert({
      client_id: clientId,
      document_type: input.document_type,
      file_path: input.file_path.trim(),
      uploaded_by: userId,
    })
    .select()
    .single<ClientDocument>();

  if (error || !data) {
    throw new Error(`Failed to save document metadata: ${error?.message ?? "Unknown error"}`);
  }

  // Audit document upload in client log
  await supabase.from("client_log").insert({
    client_id: clientId,
    event_type: "DOCUMENT_UPLOADED",
    description: `Uploaded document of category '${input.document_type}'`,
    performed_by: userId,
  });

  return data;
}

export async function getClientDocuments(
  clientId: string,
  params?: { category?: DocType }
): Promise<ClientDocument[]> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("client_document")
    .select("*")
    .eq("client_id", clientId);

  if (params?.category) {
    query = query.eq("document_type", params.category);
  }

  const { data, error } = await query
    .order("uploaded_at", { ascending: false })
    .returns<ClientDocument[]>();

  if (error) {
    throw new Error(`Failed to fetch client documents: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteClientDocument(documentId: string): Promise<void> {
  await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client_document")
    .delete()
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to delete client document: ${error.message}`);
  }
}

/**
 * Checks whether all required documents are present for a given client.
 */
export async function checkClientDocumentStatus(
  clientId: string
): Promise<ClientDocumentChecklist> {
  await requirePermission("clients.read");
  const documents = await getClientDocuments(clientId);

  const presentTypes = Array.from(
    new Set(documents.map((doc) => doc.document_type))
  );

  const missingTypes = REQUIRED_CLIENT_DOCUMENTS.filter(
    (req) => !presentTypes.includes(req)
  );

  return {
    client_id: clientId,
    is_complete: missingTypes.length === 0,
    present_documents: presentTypes,
    missing_documents: missingTypes,
  };
}

/**
 * Returns all active clients that have missing required documents.
 */
export async function getClientsWithMissingDocuments(): Promise<ClientDocumentNotification[]> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { data: clients, error: clientErr } = await supabase
    .from("client")
    .select("client_id, full_name, contact_info(*), client_document(document_type)")
    .neq("status", "Archived");

  if (clientErr || !clients) {
    throw new Error(`Failed to check client documents: ${clientErr?.message}`);
  }

  const notifications: ClientDocumentNotification[] = [];

  for (const client of clients) {
    const presentTypes = new Set(
      (client.client_document ?? []).map((d: { document_type: DocType }) => d.document_type)
    );

    const missing = REQUIRED_CLIENT_DOCUMENTS.filter((req) => !presentTypes.has(req));

    if (missing.length > 0) {
      const primaryContact =
        client.contact_info?.find((c: ContactInfo) => c.is_primary) ??
        client.contact_info?.[0] ??
        null;

      notifications.push({
        client_id: client.client_id,
        full_name: client.full_name,
        missing_documents: missing,
        contact: primaryContact
          ? { type: primaryContact.type, value: primaryContact.value }
          : null,
      });
    }
  }

  return notifications;
}

/**
 * Staff notification alert helper for incomplete client paperwork files.
 */
export async function getClientDocumentNotifications(): Promise<ClientDocumentNotification[]> {
  return getClientsWithMissingDocuments();
}

/**
 * Logs a client communication or customer service interaction.
 */
export async function recordClientInteraction(
  clientId: string,
  input: ClientInteractionInput
): Promise<ClientLog> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const eventType = `INTERACTION_${input.interaction_type.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;

  const { data, error } = await supabase
    .from("client_log")
    .insert({
      client_id: clientId,
      event_type: eventType,
      description: input.notes.trim(),
      performed_by: userId,
    })
    .select()
    .single<ClientLog>();

  if (error || !data) {
    throw new Error(`Failed to record client interaction: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

/**
 * Retrieves past interactions and communications history for a client.
 */
export async function getClientInteractions(clientId: string): Promise<ClientLog[]> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_log")
    .select("*")
    .eq("client_id", clientId)
    .ilike("event_type", "INTERACTION_%")
    .order("time", { ascending: false })
    .returns<ClientLog[]>();

  if (error) {
    throw new Error(`Failed to fetch client interactions: ${error.message}`);
  }

  return data ?? [];
}

export async function createClientLog(
  clientId: string,
  input: CreateClientLogInput
): Promise<ClientLog> {
  const userId = await requirePermission("clients.update");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_log")
    .insert({
      client_id: clientId,
      event_type: input.event_type.trim(),
      description: input.description?.trim() ?? null,
      performed_by: userId,
    })
    .select()
    .single<ClientLog>();

  if (error || !data) {
    throw new Error(`Failed to create client log: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function getClientLogs(clientId: string): Promise<ClientLog[]> {
  await requirePermission("clients.read");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_log")
    .select("*")
    .eq("client_id", clientId)
    .order("time", { ascending: false })
    .returns<ClientLog[]>();

  if (error) {
    throw new Error(`Failed to fetch client logs: ${error.message}`);
  }

  return data ?? [];
}

