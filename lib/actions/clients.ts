"use server";

import { createScope } from "@/lib/actions/action-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/action-result";
import {
  createClientSchema,
  updateClientSchema,
  createContactInfoSchema,
  updateContactInfoSchema,
} from "@/lib/validations/client";
import {
  type Client,
  type ClientListItem,
  type ClientWithDetails,
  type ContactInfo,
  type ClientDocument,
  type ClientLog,
  type DocType,
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

import type { PropertyLot } from "@/lib/types/property";
import { deleteEntityIndex } from "@/lib/actions/search-index";
import {
  uploadClientDocumentObject,
  createClientDocumentUrl,
  removeClientDocumentObject,
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_TYPES,
} from "@/lib/storage/client-documents";

import { getPaginationOffsets, buildPaginatedResult } from "@/lib/pagination";

const client = createScope(["clients.read"]);
const clientWrite = client.extend(["clients.update"]);

async function resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return userMap;

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("get_user_names", {
    p_user_ids: uniqueIds,
  });

  if (error) {
    console.error("Failed to resolve user names:", error.message);
    return userMap;
  }

  const users = (data ?? []) as Array<{ id: string; full_name: string }>;
  for (const user of users) {
    if (user.id && user.full_name) {
      userMap.set(user.id, user.full_name);
    }
  }

  return userMap;
}

export async function getClients(
  params?: GetClientsParams
): Promise<PaginatedResult<ClientListItem>> {
  return client.query(async ({ supabase }) => {
    const { page, limit, from, to } = getPaginationOffsets(params);

    let query = supabase
      .from("client")
      .select("*, contact_info(*), client_log(*)", { count: "exact" });

    if (params?.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`full_name.ilike.${term},tin_number.ilike.${term},address.ilike.${term}`);
    }

    if (params?.status?.trim()) {
      query = query.eq("status", params.status.trim());
    } else if (!params?.includeArchived) {
      query = query.neq("status", "Archived");
    }

    if (params?.area?.trim()) {
      query = query.ilike("address", `%${params.area.trim()}%`);
    }

    const sortBy = params?.sortBy ?? "created_at";
    const ascending = params?.sortOrder === "asc";
    query = query.order(sortBy, { ascending }).range(from, to);

    type ClientWithRelations = Client & {
      contact_info: ContactInfo[];
      client_log: ClientLog[];
    };

    const { data, error, count } = await query.returns<ClientWithRelations[]>();
    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    const rawClients = data ?? [];
    const performerIds: string[] = [];
    for (const item of rawClients) {
      if (item.client_log && item.client_log.length > 0) {
        item.client_log.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const latest = item.client_log[0];
        if (latest.performed_by) {
          performerIds.push(latest.performed_by);
        }
      }
    }

    const userNames = await resolveUserNames(performerIds);

    const clients: ClientListItem[] = rawClients.map((item) => {
      let latestActivity = null;
      if (item.client_log && item.client_log.length > 0) {
        const latest = item.client_log[0];
        const performerName = latest.performed_by ? (userNames.get(latest.performed_by) ?? "System") : "System";
        latestActivity = {
          description: latest.description,
          time: latest.time,
          performer_name: performerName,
        };
      }

      return {
        client_id: item.client_id,
        full_name: item.full_name,
        address: item.address,
        tin_number: item.tin_number,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        contact_info: item.contact_info ?? [],
        latest_activity: latestActivity,
      };
    });

    return buildPaginatedResult(clients, count ?? 0, page, limit);
  });
}

// Resolves lots via active ledger account party
async function resolveClientProperties(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clientId: string
): Promise<PropertyLot[]> {
  const { data: partyRows, error: partyError } = await supabase
    .from("account_party")
    .select("ledger_account!inner(property_id, status)")
    .eq("client_id", clientId)
    .eq("ledger_account.status", "Active");

  if (partyError) {
    console.error(`Failed to resolve properties for client ${clientId}:`, partyError.message);
    return [];
  }

  const propertyIds = (partyRows ?? [])
    .map((row) => (row.ledger_account as { property_id?: string } | null)?.property_id)
    .filter((id): id is string => Boolean(id));

  if (propertyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("property_lot")
    .select("*")
    .in("property_id", propertyIds)
    .returns<PropertyLot[]>();

  if (error) {
    console.error(`Failed to fetch property lots for client ${clientId}:`, error.message);
    return [];
  }

  return data ?? [];
}

export async function getClientById(clientId: string): Promise<ClientWithDetails> {
  return client.query(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("client")
      .select("*, contact_info(*), client_document(*), client_log(*)")
      .eq("client_id", clientId)
      .single<ClientWithDetails>();

    if (error || !data) {
      throw new Error(`Client not found: ${error?.message ?? "Unknown error"}`);
    }

    return { ...data, properties: await resolveClientProperties(supabase, clientId) };
  });
}

export async function createClient(input: unknown): Promise<ActionResult<Client>> {
  return client.run({
    permissions: ["clients.create"],
    schema: createClientSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data: createdClient, error: clientError } = await supabase
        .from("client")
        .insert({
          full_name: validatedInput.full_name,
          address: validatedInput.address ?? null,
          tin_number: validatedInput.tin_number ?? null,
          status: validatedInput.status ?? "Active",
        })
        .select()
        .single<Client>();

      if (clientError || !createdClient) {
        throw new Error(`Failed to create client: ${clientError?.message ?? "Unknown error"}`);
      }

      if (validatedInput.contacts && validatedInput.contacts.length > 0) {
        const contactRows = validatedInput.contacts.map((c) => ({
          client_id: createdClient.client_id,
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

      return createdClient;
    },
  });
}

export async function updateClient(
  clientId: string,
  input: unknown
): Promise<ActionResult<Client>> {
  return clientWrite.run({
    schema: updateClientSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update(validatedInput)
        .eq("client_id", clientId)
        .select()
        .single<Client>();

      if (error || !data) {
        throw new Error(`Failed to update client: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function archiveClient(
  clientId: string
): Promise<ActionResult<Client>> {
  return clientWrite.run({
    handler: async (_, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update({ status: "Archived" })
        .eq("client_id", clientId)
        .select()
        .single<Client>();

      if (error || !data) {
        throw new Error(`Failed to archive client: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function unarchiveClient(clientId: string): Promise<ActionResult<Client>> {
  return clientWrite.run({
    handler: async (_, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update({ status: "Active" })
        .eq("client_id", clientId)
        .select()
        .single<Client>();

      if (error || !data) {
        throw new Error(`Failed to unarchive client: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
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

export async function deleteClient(clientId: string): Promise<ActionResult<void>> {
  return client.run({
    permissions: ["clients.delete"],
    handler: async (_, { supabase }) => {
      const { error } = await supabase
        .from("client")
        .delete()
        .eq("client_id", clientId);

      if (error) {
        throw new Error(`Failed to delete client: ${error.message}`);
      }
    },
  });
}

export async function addContactInfo(
  clientId: string,
  input: CreateContactInfoInput
): Promise<ActionResult<ContactInfo>> {
  return clientWrite.run({
    schema: createContactInfoSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      if (validatedInput.is_primary) {
        await supabase
          .from("contact_info")
          .update({ is_primary: false })
          .eq("client_id", clientId);
      }

      const { data, error } = await supabase
        .from("contact_info")
        .insert({
          client_id: clientId,
          type: validatedInput.type.trim(),
          value: validatedInput.value.trim(),
          is_primary: Boolean(validatedInput.is_primary),
        })
        .select()
        .single<ContactInfo>();

      if (error || !data) {
        throw new Error(`Failed to add contact info: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function getClientContacts(clientId: string): Promise<ContactInfo[]> {
  return client.query(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("contact_info")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch contact details: ${error.message}`);
    }

    return data ?? [];
  });
}

export async function updateContactInfo(
  contactId: string,
  input: UpdateContactInfoInput
): Promise<ActionResult<ContactInfo>> {
  return clientWrite.run({
    schema: updateContactInfoSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      if (validatedInput.is_primary) {
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
        ...validatedInput,
        last_updated: new Date().toISOString(),
      };

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
    },
  });
}

export async function deleteContactInfo(contactId: string): Promise<ActionResult<void>> {
  return clientWrite.run({
    handler: async (_, { supabase }) => {
      const { error } = await supabase
        .from("contact_info")
        .delete()
        .eq("contact_id", contactId);

      if (error) {
        throw new Error(`Failed to delete contact info: ${error.message}`);
      }
    },
  });
}

export async function uploadClientDocument(
  clientId: string,
  formData: FormData
): Promise<ActionResult<ClientDocument>> {
  return clientWrite.run({
    handler: async (_, { supabase, userId }) => {
      const file = formData.get("file");
      const documentType = formData.get("document_type");

      if (!(file instanceof File) || file.size === 0) {
        throw new Error("No file was provided.");
      }
      if (typeof documentType !== "string" || !documentType) {
        throw new Error("A document category is required.");
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        throw new Error("File is larger than the 10MB limit.");
      }
      if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
        throw new Error("Only PDF, JPEG and PNG files are accepted.");
      }

      const filePath = await uploadClientDocumentObject(clientId, file);

      const { data, error } = await supabase
        .from("client_document")
        .insert({
          client_id: clientId,
          document_type: documentType,
          file_path: filePath,
          uploaded_by: userId,
        })
        .select()
        .single<ClientDocument>();

      if (error || !data) {
        await removeClientDocumentObject(filePath).catch((cleanupError) => {
          console.error(`Orphaned object ${filePath} after failed insert:`, cleanupError);
        });
        throw new Error(`Failed to save document metadata: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function getClientDocumentUrl(documentId: string): Promise<string> {
  return client.query(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("client_document")
      .select("file_path")
      .eq("document_id", documentId)
      .single<{ file_path: string }>();

    if (error || !data) {
      throw new Error(`Document not found: ${error?.message ?? "Unknown error"}`);
    }

    return createClientDocumentUrl(data.file_path);
  });
}

export async function createClientDocument(
  clientId: string,
  input: CreateClientDocumentInput
): Promise<ClientDocument> {
  return clientWrite.execute(async ({ supabase, userId }) => {
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

    return data;
  });
}

export async function getClientDocuments(
  clientId: string,
  params?: { category?: DocType }
): Promise<ClientDocument[]> {
  return client.query(async ({ supabase }) => {
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
  });
}

export async function deleteClientDocument(documentId: string): Promise<ActionResult<void>> {
  return clientWrite.run({
    handler: async (_, { supabase }) => {
      const { data: existing } = await supabase
        .from("client_document")
        .select("file_path")
        .eq("document_id", documentId)
        .single<{ file_path: string }>();

      const { error } = await supabase
        .from("client_document")
        .delete()
        .eq("document_id", documentId);

      if (error) {
        throw new Error(`Failed to delete client document: ${error.message}`);
      }

      await deleteEntityIndex("client_document", documentId).catch((indexError) => {
        console.error(`Failed to clear search index for ${documentId}:`, indexError);
      });

      if (existing?.file_path) {
        await removeClientDocumentObject(existing.file_path).catch((storageError) => {
          console.error(`Failed to remove storage object ${existing.file_path}:`, storageError);
        });
      }
    },
  });
}

export async function checkClientDocumentStatus(
  clientId: string
): Promise<ClientDocumentChecklist> {
  return client.query(async () => {
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
  });
}

export async function getClientsWithMissingDocuments(): Promise<ClientDocumentNotification[]> {
  return client.query(async ({ supabase }) => {
    const { data: clients, error: clientErr } = await supabase
      .from("client")
      .select("client_id, full_name, contact_info(*), client_document(document_type)")
      .neq("status", "Archived");

    if (clientErr || !clients) {
      throw new Error(`Failed to check client documents: ${clientErr?.message}`);
    }

    const notifications: ClientDocumentNotification[] = [];

    for (const item of clients) {
      const presentTypes = new Set(
        (item.client_document ?? []).map((d: { document_type: DocType }) => d.document_type)
      );

      const missing = REQUIRED_CLIENT_DOCUMENTS.filter((req) => !presentTypes.has(req));

      if (missing.length > 0) {
        const primaryContact =
          item.contact_info?.find((c: ContactInfo) => c.is_primary) ??
          item.contact_info?.[0] ??
          null;

        notifications.push({
          client_id: item.client_id,
          full_name: item.full_name,
          missing_documents: missing,
          contact: primaryContact
            ? { type: primaryContact.type, value: primaryContact.value }
            : null,
        });
      }
    }

    return notifications;
  });
}

export async function getClientDocumentNotifications(): Promise<ClientDocumentNotification[]> {
  return getClientsWithMissingDocuments();
}

export async function recordClientInteraction(
  clientId: string,
  input: ClientInteractionInput
): Promise<ClientLog> {
  return clientWrite.execute(async ({ supabase, userId }) => {
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
  });
}

export async function getClientInteractions(clientId: string): Promise<ClientLog[]> {
  return client.query(async ({ supabase }) => {
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
  });
}

export async function createClientLog(
  clientId: string,
  input: CreateClientLogInput
): Promise<ClientLog> {
  return clientWrite.execute(async ({ supabase, userId }) => {
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
  });
}

export async function getClientLogs(clientId: string): Promise<ClientLog[]> {
  return client.query(async ({ supabase }) => {
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
  });
}
