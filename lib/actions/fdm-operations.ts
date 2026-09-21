'use server';

import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAnyPermission } from '@/lib/actions/auth-guard';

const TITLE_REQUIREMENTS = [
  ['deed', 'Notarized deed of sale / transfer instrument', 'BIR'],
  ['tax_declaration', 'Latest certified tax declaration (land and improvements)', 'BIR'],
  ['title_copy', 'Owner’s copy / certified true copy of title', 'Registry of Deeds'],
  ['bir_ecar', 'BIR eCAR and tax-payment evidence', 'BIR'],
  ['transfer_tax', 'LGU transfer-tax receipt', 'LGU / Assessor'],
  ['rpt_clearance', 'Real-property-tax clearance / current receipt', 'LGU / Assessor'],
] as const;

async function logOperation(input: {
  recorded_by: string;
  module: 'Client' | 'Contract' | 'Title transfer' | 'Billing' | 'Payable' | 'Document' | 'Other';
  action: string;
  description: string;
  client_id?: string;
  property_id?: string;
  title_transaction_id?: string;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.from('operation_log').insert(input);
}

export async function getOperationsLog() {
  await requireAnyPermission(['clients.read', 'legal.read', 'billing.read', 'system.read']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('operation_log')
    .select('operation_log_id, occurred_at, module, action, description, client:client_id(full_name), property:property_id(location, block_number, lot_number)')
    .order('occurred_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load operations: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, client: row.client?.[0] ?? null, property: row.property?.[0] ?? null }));
}

export async function createOperationLog(input: { module: 'Client' | 'Contract' | 'Title transfer' | 'Billing' | 'Payable' | 'Document' | 'Other'; action: string; description: string }) {
  const userId = await requireAnyPermission(['clients.update', 'legal.create', 'billing.create', 'system.create']);
  if (!input.action.trim() || !input.description.trim()) throw new Error('Action and description are required.');
  await logOperation({ recorded_by: userId, module: input.module, action: input.action.trim(), description: input.description.trim() });
}

export async function getLegalWorkspace() {
  await requireAnyPermission(['legal.read', 'system.read']);
  const supabase = await createSupabaseServerClient();
  const [{ data: titles, error: titleError }, { data: clients }, { data: lots }, { data: contracts }] = await Promise.all([
    supabase.from('title_transaction').select('title_transaction_id, title_number, status, current_agency, started_on, target_completion_on, last_follow_up_on, client:client_id(client_id, full_name), property:property_id(property_id, location, block_number, lot_number), requirements:title_requirement(status)').order('updated_at', { ascending: false }),
    supabase.from('client').select('client_id, full_name').neq('status', 'Archived').order('full_name').limit(200),
    supabase.from('property_lot').select('property_id, location, block_number, lot_number').order('location').limit(200),
    supabase.from('contract_record').select('contract_id, contract_number, contract_type, status, signed_on, client:client_id(full_name), property:property_id(location, block_number, lot_number)').order('created_at', { ascending: false }).limit(50),
  ]);
  if (titleError) throw new Error(`Could not load title transactions: ${titleError.message}`);
  return {
    titles: (titles ?? []).map((row) => ({ ...row, client: row.client?.[0] ?? null, property: row.property?.[0] ?? null })),
    clients: clients ?? [],
    lots: lots ?? [],
    contracts: (contracts ?? []).map((row) => ({ ...row, client: row.client?.[0] ?? null, property: row.property?.[0] ?? null })),
  };
}

export async function createTitleTransaction(input: { clientId: string; propertyId: string; titleNumber?: string; targetCompletionOn?: string }) {
  const userId = await requireAnyPermission(['legal.create', 'system.create']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('title_transaction').insert({ client_id: input.clientId, property_id: input.propertyId, title_number: input.titleNumber?.trim() || null, target_completion_on: input.targetCompletionOn || null, created_by: userId }).select('title_transaction_id').single();
  if (error || !data) throw new Error(`Could not start title transaction: ${error?.message ?? 'Unknown error'}`);
  const { error: checklistError } = await supabase.from('title_requirement').insert(TITLE_REQUIREMENTS.map(([requirement_code, label, agency]) => ({ title_transaction_id: data.title_transaction_id, requirement_code, label, agency })));
  if (checklistError) throw new Error(`Title transaction was created, but the checklist failed: ${checklistError.message}`);
  await logOperation({ recorded_by: userId, module: 'Title transfer', action: 'Started title transfer', description: 'Created the BIR, LGU, and Registry of Deeds checklist.', client_id: input.clientId, property_id: input.propertyId, title_transaction_id: data.title_transaction_id });
}

export async function updateTitleRequirement(input: { requirementId: string; status: 'Missing' | 'Ready' | 'Submitted' | 'Verified' | 'Not applicable'; referenceNumber?: string }) {
  await requireAnyPermission(['legal.update', 'system.update']);
  const supabase = await createSupabaseServerClient();
  const patch = { status: input.status, reference_number: input.referenceNumber?.trim() || null, submitted_on: input.status === 'Submitted' ? new Date().toISOString().slice(0, 10) : null, verified_on: input.status === 'Verified' ? new Date().toISOString().slice(0, 10) : null };
  const { error } = await supabase.from('title_requirement').update(patch).eq('title_requirement_id', input.requirementId);
  if (error) throw new Error(`Could not update requirement: ${error.message}`);
}

export async function getBillingWorkspace() {
  await requireAnyPermission(['billing.read', 'accounting.read', 'system.read']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('ledger_account').select('account_id, total_contract_price, remaining_balance, status, property:property_id(location, block_number, lot_number), parties:account_party(is_primary, client:client_id(full_name)), payments:billing_payment(payment_id, received_on, amount, payment_method, reference_number)').in('status', ['Active', 'Delinquent']).order('updated_at', { ascending: false }).limit(100);
  if (error) throw new Error(`Could not load billing accounts: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    property: row.property?.[0] ?? null,
    parties: (row.parties ?? []).map((party) => ({ ...party, client: party.client?.[0] ?? null })),
  }));
}

export async function recordBillingPayment(input: { accountId: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string }) {
  const userId = await requireAnyPermission(['billing.create', 'accounting.create', 'system.create']);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Enter a payment amount greater than zero.');
  const supabase = await createSupabaseServerClient();
  const { data: account, error: accountError } = await supabase.from('ledger_account').select('remaining_balance, property_id').eq('account_id', input.accountId).single();
  if (accountError || !account) throw new Error('Ledger account was not found.');
  if (input.amount > Number(account.remaining_balance)) throw new Error('Payment cannot exceed the remaining balance. Record any excess payment separately for review.');
  const { error } = await supabase.from('billing_payment').insert({ account_id: input.accountId, amount: input.amount, payment_method: input.paymentMethod.trim() || 'Cash', reference_number: input.referenceNumber?.trim() || null, notes: input.notes?.trim() || null, recorded_by: userId });
  if (error) throw new Error(`Could not record payment: ${error.message}`);
  await logOperation({ recorded_by: userId, module: 'Billing', action: 'Recorded payment', description: `Recorded PHP ${input.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} payment.`, property_id: account.property_id });
}

export async function getPayables() {
  await requireAnyPermission(['accounting.read', 'billing.read', 'system.read']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('accounts_payable').select('payable_id, payee_name, category, description, amount, due_on, status, payment_reference, created_at').order('due_on', { ascending: true, nullsFirst: false }).limit(100);
  if (error) throw new Error(`Could not load payables: ${error.message}`);
  return data ?? [];
}

export async function createPayable(input: { payeeName: string; category: string; description: string; amount: number; dueOn?: string }) {
  const userId = await requireAnyPermission(['accounting.create', 'system.create']);
  if (!input.payeeName.trim() || !input.description.trim() || !Number.isFinite(input.amount) || input.amount < 0) throw new Error('Payee, description, and a valid amount are required.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('accounts_payable').insert({ payee_name: input.payeeName.trim(), category: input.category.trim() || 'Title processing', description: input.description.trim(), amount: input.amount, due_on: input.dueOn || null, created_by: userId });
  if (error) throw new Error(`Could not create payable: ${error.message}`);
  await logOperation({ recorded_by: userId, module: 'Payable', action: 'Recorded payable', description: `Created payable for ${input.payeeName.trim()}.` });
}
