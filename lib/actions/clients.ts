"use server";

import { z } from "zod";
import { createScope } from "@/lib/actions/action-handler";
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
  getContactValueError,
} from "@/lib/validations/client";
import {
  buildClientPropertyBillingSummary,
  type RawAccountBillingData,
} from "@/lib/billing/client-property-billing";
import {
  type Client,
  type ClientProperty,
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
  PROPERTY_DOC_TYPES,
} from "@/lib/types/client";

import type { PropertyLot } from "@/lib/types/property";
import type { FileAttachment } from "@/lib/types/title";
import { toClientDocument, toClientDocuments, CLIENT_DOCUMENT_COLUMNS } from "@/lib/attachments";
import { deleteEntityIndex } from "@/lib/actions/search-index";
import {
  uploadClientDocumentObject,
  createClientDocumentUrl,
  removeClientDocumentObject,
} from "@/lib/storage/client-documents";
import { documentFileSchema } from "@/lib/validations/document";

import { getPaginationOffsets, buildPaginatedResult } from "@/lib/pagination";

const client = createScope(["clients.read"]);
const clientWrite = client.extend(["clients.update"]);
const clientDelete = client.extend(["clients.delete"]);

const uploadClientDocumentSchema = z
  .object({
    clientId: uuidSchema,
    document_type: docTypeSchema,
    file: documentFileSchema,
    // Optional lot the document belongs to. FormData gives null when absent.
    property_id: uuidSchema.nullish().transform((v) => v ?? null),
  })
  .superRefine((data, ctx) => {
    if (!data.property_id && (PROPERTY_DOC_TYPES as readonly string[]).includes(data.document_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document_type"],
        message: `${data.document_type} must be assigned to a property folder. Under personal documents, only Valid ID and custom files are accepted.`,
      });
    }
    if (data.property_id && data.document_type === "Valid ID") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document_type"],
        message: "Valid ID must be uploaded under personal documents, not a property folder.",
      });
    }
  });

async function resolveUserNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return userMap;

  const { data, error } = await supabase.rpc("get_user_names", {
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

      const userNames = await resolveUserNames(supabase, performerIds);

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
): Promise<ClientProperty[]> {
  const [partyResult, titleResult] = await Promise.all([
    supabase
      .from("account_party")
      .select("account_id")
      .eq("client_id", clientId),
    supabase
      .from("land_title")
      .select(`
        title_id,
        property_id,
        status,
        is_legacy_transferred,
        clearance_started_at,
        released_to_name,
        created_at,
        updated_at
      `)
      .eq("client_id", clientId),
  ]);

  if (partyResult.error) {
    console.error(`Failed to resolve account parties for client ${clientId}:`, partyResult.error.message);
  }
  if (titleResult.error) {
    console.error(`Failed to resolve titles for client ${clientId}:`, titleResult.error.message);
  }

  const accountIds = Array.from(
    new Set((partyResult.data ?? []).map((row) => row.account_id).filter(Boolean))
  );

  const accounts = new Map<
    string,
    { raw: RawAccountBillingData; summary: ReturnType<typeof buildClientPropertyBillingSummary> }
  >();

  if (accountIds.length > 0) {
    const { data: accountsData, error: accountsErr } = await supabase
      .from("ledger_account")
      .select(`
        account_id,
        property_id,
        total_contract_price,
        remaining_balance,
        downpayment,
        terms_months,
        monthly_amortization,
        amortization_day,
        penalty_rate_percent,
        first_due_date,
        status,
        created_at,
        cleared_at,
        cleared_by,
        forfeited_at,
        forfeiture_reason,
        contract_policies,
        overdue_notice_stage,
        payments:billing_payment(
          payment_id,
          payment_date,
          amount,
          receipt_number,
          payment_method,
          waive_penalty,
          notes
        ),
        notices:billing_notice_event(
          notice_id,
          stage,
          notice_number,
          notice_date,
          title,
          tracking_number,
          notes,
          overdue_amount,
          arrears_principal,
          penalty_due
        )
      `)
      .in("account_id", accountIds);

    if (accountsErr) {
      console.error(`Failed to fetch ledger accounts for client ${clientId}:`, accountsErr.message);
    } else {
      for (const row of (accountsData ?? []) as unknown as RawAccountBillingData[]) {
        if (row.property_id) {
          const summary = buildClientPropertyBillingSummary(row);
          accounts.set(row.property_id, { raw: row, summary });
        }
      }
    }
  }

  type TitleRef = {
    title_id: string;
    property_id: string;
    status: string;
    is_legacy_transferred?: boolean | null;
    clearance_started_at?: string | null;
    released_to_name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  const titleMap = new Map<string, TitleRef>();
  for (const row of (titleResult.data ?? []) as TitleRef[]) {
    if (row.property_id) titleMap.set(row.property_id, row);
  }

  const propertyIds = Array.from(new Set([...accounts.keys(), ...titleMap.keys()]));

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

  return (data ?? []).map((lot) => {
    const accEntry = accounts.get(lot.property_id);
    const account = accEntry?.raw;
    const summary = accEntry?.summary;
    const title = titleMap.get(lot.property_id);
    return {
      ...lot,
      account_id: account?.account_id ?? null,
      account_status: account?.status ?? null,
      cleared_at: account?.cleared_at ?? null,
      total_contract_price: account ? Number(account.total_contract_price) : null,
      remaining_balance: summary ? summary.remainingBalance : account ? Number(account.remaining_balance) : null,
      billing_summary: summary ?? null,
      has_title: Boolean(title),
      title_id: title?.title_id ?? null,
      title_status: title?.status ?? null,
      is_legacy_transferred: title?.is_legacy_transferred ?? false,
      clearance_started_at: title?.clearance_started_at ?? null,
      released_to_name: title?.released_to_name ?? null,
      title_created_at: title?.created_at ?? null,
      title_updated_at: title?.updated_at ?? null,
    };
  });
}

export async function getClientById(clientId: string): Promise<ClientWithDetails> {
  return client.query({
    schema: uuidSchema,
    input: clientId,
    handler: async (validId, { supabase }) => {
      const { data: row, error } = await supabase
        .from("client")
        .select(
          "*, contact_info(*), documents:file_attachment!client_id(attachment_id, client_id, file_category, file_path, property_id, uploaded_by, uploaded_at), client_log(*)"
        )
        .eq("client_id", validId)
        .single<ClientWithDetails & { documents: FileAttachment[] }>();

      if (error || !row) {
        throw new Error(`Client not found: ${error?.message ?? "Unknown error"}`);
      }

      const { documents, ...data } = row;
      const names = await resolveUserNames(supabase, data.client_log.flatMap(log => log.performed_by ? [log.performed_by] : []));
      return {
        ...data,
        client_document: toClientDocuments(documents),
        client_log: data.client_log
          .map(log => ({ ...log, performer_name: log.performed_by ? names.get(log.performed_by) ?? 'Staff member' : 'System' }))
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
        properties: await resolveClientProperties(supabase, validId),
      };
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
          civil_status: validatedInput.civil_status ?? null,
          spouse_name: validatedInput.spouse_name ?? null,
          gender: validatedInput.gender ?? null,
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
      if (data.value !== undefined && data.type === undefined) {
        const { data: stored } = await supabase
          .from("contact_info")
          .select("type")
          .eq("contact_id", validId)
          .single<{ type: string }>();

        const message = stored ? getContactValueError(stored.type, data.value) : null;
        if (message) {
          throw new Error(message);
        }
      }

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
      property_id: formData.get("property_id") || null,
    },
    handler: async ({ clientId: validId, file, document_type, property_id }, { supabase, userId }) => {
      const filePath = await uploadClientDocumentObject(validId, file);

      const { data, error } = await supabase
        .from("file_attachment")
        .insert({
          entity_type: "client",
          entity_id: validId,
          client_id: validId,
          property_id,
          file_category: document_type,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: userId,
        })
        .select(CLIENT_DOCUMENT_COLUMNS)
        .single<FileAttachment>();

      if (error || !data) {
        await removeClientDocumentObject(filePath).catch((cleanupError) => {
          console.error(`Orphaned object ${filePath} after failed insert:`, cleanupError);
        });
        throw new Error(`Failed to save document metadata: ${error?.message ?? "Unknown error"}`);
      }

      return toClientDocument(data);
    },
  });
}

export async function getClientDocumentUrl(documentId: string): Promise<string> {
  return client.query({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data, error } = await supabase
        .from("file_attachment")
        .select("file_path")
        .eq("attachment_id", validId)
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
        .from("file_attachment")
        .insert({
          entity_type: "client",
          entity_id: validId,
          client_id: validId,
          property_id: data.property_id ?? null,
          file_category: data.document_type,
          file_path: data.file_path,
          uploaded_by: userId,
        })
        .select(CLIENT_DOCUMENT_COLUMNS)
        .single<FileAttachment>();

      if (error || !created) {
        throw new Error(`Failed to save document metadata: ${error?.message ?? "Unknown error"}`);
      }

      return toClientDocument(created);
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
        .from("file_attachment")
        .select(CLIENT_DOCUMENT_COLUMNS)
        .eq("client_id", validId);

      if (category) {
        query = query.eq("file_category", category);
      }

      const { data, error } = await query
        .order("uploaded_at", { ascending: false })
        .returns<FileAttachment[]>();

      if (error) {
        throw new Error(`Failed to fetch client documents: ${error.message}`);
      }

      return toClientDocuments(data);
    },
  });
}

export async function deleteClientDocument(documentId: string): Promise<ActionResult<void>> {
  return clientDelete.run({
    schema: uuidSchema,
    input: documentId,
    handler: async (validId, { supabase }) => {
      const { data: deleted, error } = await supabase
        .from("file_attachment")
        .delete()
        .eq("attachment_id", validId)
        .select("file_path")
        .maybeSingle<{ file_path: string }>();

      if (error) {
        throw new Error(`Failed to delete client document: ${error.message}`);
      }
      if (!deleted) {
        throw new Error("Document not found or you do not have permission to remove it.");
      }

      await deleteEntityIndex("client_document", validId).catch((indexError) => {
        console.error(`Failed to clear search index for ${validId}:`, indexError);
      });

      await removeClientDocumentObject(deleted.file_path).catch((storageError) => {
        console.error(`Failed to remove storage object ${deleted.file_path}:`, storageError);
      });
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
        .from("file_attachment")
        .select("file_category")
        .eq("client_id", validId)
        .returns<Array<{ file_category: string }>>();

      if (error) {
        throw new Error(`Failed to fetch client documents: ${error.message}`);
      }

      const presentTypes = Array.from(
        new Set((documents ?? []).map((doc) => doc.file_category as DocType))
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
      .select("client_id, full_name, contact_info(*), documents:file_attachment!client_id(file_category)")
      .neq("status", "Archived");

    if (clientErr || !clients) {
      throw new Error(`Failed to check client documents: ${clientErr?.message}`);
    }

    const notifications: ClientDocumentNotification[] = [];

    for (const item of clients) {
      const presentTypes = new Set(
        (item.documents ?? []).map((d: { file_category: string }) => d.file_category as DocType)
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

      const names = await resolveUserNames(supabase, userId ? [userId] : []);
      return { ...data, performer_name: userId ? names.get(userId) ?? 'Staff member' : 'System' };
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

      const logs = data ?? [];
      const names = await resolveUserNames(supabase, logs.flatMap(log => log.performed_by ? [log.performed_by] : []));
      return logs.map(log => ({ ...log, performer_name: log.performed_by ? names.get(log.performed_by) ?? 'Staff member' : 'System' }));
    },
  });
}
