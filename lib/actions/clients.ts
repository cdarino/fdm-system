"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import type {
  Client,
  ClientWithDetails,
  ContactInfo,
  ClientDocument,
  ClientLog,
  CreateClientInput,
  UpdateClientInput,
  CreateContactInfoInput,
  UpdateContactInfoInput,
  CreateClientDocumentInput,
  CreateClientLogInput,
  GetClientsParams,
  PaginatedResult,
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
    query = query.or(`full_name.ilike.${term},tin_number.ilike.${term}`);
  }

  if (params?.status?.trim()) {
    query = query.eq("status", params.status.trim());
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

  const { data, error } = await supabase
    .from("client")
    .select("*, contact_info(*), client_document(*), client_log(*)")
    .eq("client_id", clientId)
    .single<ClientWithDetails>();

  if (error || !data) {
    throw new Error(`Client not found: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  await requirePermission("clients.create");
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

  return client;
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput
): Promise<Client> {
  await requirePermission("clients.update");
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

  return data;
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

  return data;
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
