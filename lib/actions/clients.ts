"use server";

import { z } from "zod";
import { createScope } from "@/lib/actions/action-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/action-result";
import {
  uuidSchema,
  docTypeSchema,
  createClientSchema,
  updateClientSchema,
  createContactInfoSchema,
  updateContactInfoSchema,
  getClientsParamsSchema,
  createClientDocumentSchema,
  getClientDocumentsParamsSchema,
  clientInteractionSchema,
  createClientLogSchema,
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
const clientDelete = client.extend(["clients.delete"]);

const uploadClientDocumentSchema = z.object({
  clientId: uuidSchema,
  document_type: docTypeSchema,
  file: z
    .custom<File>((val) => val instanceof File && val.size > 0, "No file was provided.")
    .refine((file) => file.size <= MAX_DOCUMENT_BYTES, "File is larger than the 10MB limit.")
    .refine(
      (file) => ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number]),
      "Only PDF, JPEG and PNG files are accepted."
    ),
});

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
  return client.query({
    schema: getClientsParamsSchema,
    input: params ?? {},
    handler: async (validatedParams, { supabase }) => {
      const { page, limit, from, to } = getPaginationOffsets(validatedParams);

      let query = supabase
        .from("client")
        .select("*, contact_info(*), client_log(*)", { count: "exact" });

      if (validatedParams.search) {
        const term = `%${validatedParams.search}%`;
        query = query.or(`full_name.ilike.${term},tin_number.ilike.${term},address.ilike.${term}`);
      }

      if (validatedParams.status) {
        query = query.eq("status", validatedParams.status);
      } else if (!validatedParams.includeArchived) {
        query = query.neq("status", "Archived");
      }

      if (validatedParams.area) {
        query = query.ilike("address", `%${validatedParams.area}%`);
      }

      const sortBy = validatedParams.sortBy;
      const ascending = validatedParams.sortOrder === "asc";
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
          archived_at: item.archived_at ?? null,
          is_archived: item.status === "Archived" || Boolean(item.archived_at),
          contact_info: item.contact_info ?? [],
          latest_activity: latestActivity,
        };
      });

      return buildPaginatedResult(clients, count ?? 0, page, limit);
    },
  });
}

// Resolves lots via active ledger account party or land_title
async function resolveClientProperties(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clientId: string
): Promise<PropertyLot[]> {
  const [partyResult, titleResult] = await Promise.all([
    supabase
      .from("account_party")
      .select("ledger_account!inner(property_id, status)")
      .eq("client_id", clientId)
      .eq("ledger_account.status", "Active"),
    supabase
      .from("land_title")
      .select("property_id")
      .eq("client_id", clientId),
  ]);

  if (partyResult.error) {
    console.error(`Failed to resolve properties for client ${clientId}:`, partyResult.error.message);
  }
  if (titleResult.error) {
    console.error(`Failed to resolve titles for client ${clientId}:`, titleResult.error.message);
  }

  const partyPropertyIds = (partyResult.data ?? [])
    .map((row) => (row.ledger_account as { property_id?: string } | null)?.property_id)
    .filter((id): id is string => Boolean(id));
  const titlePropertyIds = (titleResult.data ?? [])
    .map((row) => row.property_id)
    .filter((id): id is string => Boolean(id));

  const propertyIds = Array.from(new Set([...partyPropertyIds, ...titlePropertyIds]));

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
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .select("*, contact_info(*), client_document(*), client_log(*)")
        .eq("client_id", validId)
        .single<ClientWithDetails>();

      if (error || !data) {
        throw new Error(`Client not found: ${error?.message ?? "Unknown error"}`);
      }

      return { ...data, properties: await resolveClientProperties(supabase, validId) };
    },
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
          type: c.type,
          value: c.value,
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
    input: { clientId, ...(input as object) },
    handler: async ({ clientId: validId, ...fields }, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update(fields)
        .eq("client_id", validId)
        .select()
        .single<Client>();

      if (error || !data) {
        throw new Error(`Failed to update client: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function archiveClient(clientId: string): Promise<ActionResult<Client>> {
  return clientWrite.run({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update({ status: "Archived", archived_at: new Date().toISOString() })
        .eq("client_id", validId)
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
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client")
        .update({ status: "Active", archived_at: null })
        .eq("client_id", validId)
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
): Promise<PaginatedResult<ClientListItem>> {
  return getClients({
    ...params,
    status: "Archived",
    includeArchived: true,
  });
}

export async function deleteClient(clientId: string): Promise<ActionResult<void>> {
  return client.run({
    permissions: ["clients.delete"],
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { error } = await supabase
        .from("client")
        .delete()
        .eq("client_id", validId);

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
    input: { clientId, ...input },
    handler: async ({ clientId: validId, ...data }, { supabase }) => {
      if (data.is_primary) {
        await supabase
          .from("contact_info")
          .update({ is_primary: false })
          .eq("client_id", validId);
      }

      const { data: created, error } = await supabase
        .from("contact_info")
        .insert({
          client_id: validId,
          type: data.type,
          value: data.value,
          is_primary: Boolean(data.is_primary),
        })
        .select()
        .single<ContactInfo>();

      if (error || !created) {
        throw new Error(`Failed to add contact info: ${error?.message ?? "Unknown error"}`);
      }

      return created;
    },
  });
}

export async function getClientContacts(clientId: string): Promise<ContactInfo[]> {
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("contact_info")
        .select("*")
        .eq("client_id", validId)
        .order("is_primary", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch contact details: ${error.message}`);
      }

      return data ?? [];
    },
  });
}

export async function updateContactInfo(
  contactId: string,
  input: UpdateContactInfoInput
): Promise<ActionResult<ContactInfo>> {
  return clientWrite.run({
    schema: updateContactInfoSchema,
    input: { contactId, ...input },
    handler: async ({ contactId: validId, ...data }, { supabase }) => {
      if (data.is_primary) {
        const { data: current } = await supabase
          .from("contact_info")
          .select("client_id")
          .eq("contact_id", validId)
          .single<{ client_id: string }>();

        if (current?.client_id) {
          await supabase
            .from("contact_info")
            .update({ is_primary: false })
            .eq("client_id", current.client_id);
        }
      }

      const updates: Record<string, unknown> = {
        ...data,
        last_updated: new Date().toISOString(),
      };

      const { data: updated, error } = await supabase
        .from("contact_info")
        .update(updates)
        .eq("contact_id", validId)
        .select()
        .single<ContactInfo>();

      if (error || !updated) {
        throw new Error(`Failed to update contact info: ${error?.message ?? "Unknown error"}`);
      }

      return updated;
    },
  });
}

export async function deleteContactInfo(contactId: string): Promise<ActionResult<void>> {
  return clientDelete.run({
    schema: uuidSchema,
    input: contactId,
    handler: async (validId, { supabase }) => {
      const { error } = await supabase
        .from("contact_info")
        .delete()
        .eq("contact_id", validId);

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
    schema: uploadClientDocumentSchema,
    input: {
      clientId,
      file: formData.get("file"),
      document_type: formData.get("document_type"),
    },
    handler: async ({ clientId: validId, file, document_type }, { supabase, userId }) => {
      const filePath = await uploadClientDocumentObject(validId, file);

      const { data, error } = await supabase
        .from("client_document")
        .insert({
          client_id: validId,
          document_type,
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
  return client.query({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client_document")
        .select("file_path")
        .eq("document_id", validId)
        .single<{ file_path: string }>();

      if (error || !data) {
        throw new Error(`Document not found: ${error?.message ?? "Unknown error"}`);
      }

      return createClientDocumentUrl(data.file_path);
    },
  });
}

export async function createClientDocument(
  clientId: string,
  input: CreateClientDocumentInput
): Promise<ClientDocument> {
  return clientWrite.execute({
    schema: createClientDocumentSchema,
    input: { clientId, ...input },
    handler: async ({ clientId: validId, ...data }, { supabase, userId }) => {
      const { data: created, error } = await supabase
        .from("client_document")
        .insert({
          client_id: validId,
          document_type: data.document_type,
          file_path: data.file_path,
          uploaded_by: userId,
        })
        .select()
        .single<ClientDocument>();

      if (error || !created) {
        throw new Error(`Failed to save document metadata: ${error?.message ?? "Unknown error"}`);
      }

      return created;
    },
  });
}

export async function getClientDocuments(
  clientId: string,
  params?: { category?: DocType }
): Promise<ClientDocument[]> {
  return client.query({
    schema: getClientDocumentsParamsSchema,
    input: { clientId, ...params },
    handler: async ({ clientId: validId, category }, { supabase }) => {
      let query = supabase
        .from("client_document")
        .select("*")
        .eq("client_id", validId);

      if (category) {
        query = query.eq("document_type", category);
      }

      const { data, error } = await query
        .order("uploaded_at", { ascending: false })
        .returns<ClientDocument[]>();

      if (error) {
        throw new Error(`Failed to fetch client documents: ${error.message}`);
      }

      return data ?? [];
    },
  });
}

export async function deleteClientDocument(documentId: string): Promise<ActionResult<void>> {
  return clientDelete.run({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data: existing } = await supabase
        .from("client_document")
        .select("file_path")
        .eq("document_id", validId)
        .single<{ file_path: string }>();

      const { error } = await supabase
        .from("client_document")
        .delete()
        .eq("document_id", validId);

      if (error) {
        throw new Error(`Failed to delete client document: ${error.message}`);
      }

      await deleteEntityIndex("client_document", validId).catch((indexError) => {
        console.error(`Failed to clear search index for ${validId}:`, indexError);
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
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data: documents, error } = await supabase
        .from("client_document")
        .select("document_type")
        .eq("client_id", validId)
        .returns<Array<{ document_type: DocType }>>();

      if (error) {
        throw new Error(`Failed to fetch client documents: ${error.message}`);
      }

      const presentTypes = Array.from(
        new Set((documents ?? []).map((doc) => doc.document_type))
      );

      const missingTypes = REQUIRED_CLIENT_DOCUMENTS.filter(
        (req) => !presentTypes.includes(req)
      );

      return {
        client_id: validId,
        is_complete: missingTypes.length === 0,
        present_documents: presentTypes,
        missing_documents: missingTypes,
      };
    },
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
  return clientWrite.execute({
    schema: clientInteractionSchema,
    input: { clientId, ...input },
    handler: async ({ clientId: validId, interaction_type, notes }, { supabase, userId }) => {
      const eventType = `INTERACTION_${interaction_type.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;

      const { data, error } = await supabase
        .from("client_log")
        .insert({
          client_id: validId,
          event_type: eventType,
          description: notes,
          performed_by: userId,
        })
        .select()
        .single<ClientLog>();

      if (error || !data) {
        throw new Error(`Failed to record client interaction: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function getClientInteractions(clientId: string): Promise<ClientLog[]> {
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client_log")
        .select("*")
        .eq("client_id", validId)
        .ilike("event_type", "INTERACTION_%")
        .order("time", { ascending: false })
        .returns<ClientLog[]>();

      if (error) {
        throw new Error(`Failed to fetch client interactions: ${error.message}`);
      }

      return data ?? [];
    },
  });
}

export async function createClientLog(
  clientId: string,
  input: CreateClientLogInput
): Promise<ClientLog> {
  return clientWrite.execute({
    schema: createClientLogSchema,
    input: { clientId, ...input },
    handler: async ({ clientId: validId, event_type, description }, { supabase, userId }) => {
      const { data, error } = await supabase
        .from("client_log")
        .insert({
          client_id: validId,
          event_type,
          description: description ?? null,
          performed_by: userId,
        })
        .select()
        .single<ClientLog>();

      if (error || !data) {
        throw new Error(`Failed to create client log: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function getClientLogs(clientId: string): Promise<ClientLog[]> {
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("client_log")
        .select("*")
        .eq("client_id", validId)
        .order("time", { ascending: false })
        .returns<ClientLog[]>();

      if (error) {
        throw new Error(`Failed to fetch client logs: ${error.message}`);
      }

      return data ?? [];
    },
  });
}
