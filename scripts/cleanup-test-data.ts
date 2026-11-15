import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "tester@example.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = process.argv.includes("--dry-run");
const includeOrphans = process.argv.includes("--orphans") || process.argv.includes("--all");

const SAMPLE_PROJECT_AREAS = [
  "Barangay Limao",
  "Peñaplata Rotonda",
  "San Augustin",
  "Kaputian",
  "Caliclic",
  "Prime Lot Holdings",
];

const TEST_LOCATION_PATTERNS = [
  /prevention park/i,
  /guard palms/i,
  /closing palms/i,
  /assignment palms/i,
  /update estate/i,
  /reset estate/i,
  /co-ownership/i,
  /delete estate/i,
  /archive test estate/i,
  /unique village/i,
  /hills subdivision/i,
  /search hills/i,
  /forbidden location/i,
  /samal heights/i,
  /plat estate/i,
  /\[test\]/i,
  /test/i,
  /journal/i,
  /restructure/i,
  /penalty/i,
  /statement/i,
  /hold\s+estate/i,
  /pdc\s+estate/i,
  /forfeiture/i,
  /reassign/i,
  /^as$/i,
];

const TEST_PROJECT_AREA_PATTERNS = [
  /^test/i,
  /\[test\]/i,
  /\btest\b/i,
  /^plat estate/i,
  /^projectArea-/i,
  /^site-/i,
  /direct assign/i,
  /subdivision selector/i,
  /fgdfgdfg/i,
  /^projectArea name$/i,
  /^site name$/i,
  /^as$/i,
];

const TEST_CLIENT_PATTERNS = [
  /test auto client/i,
  /pdf-test/i,
  /lot-buyer/i,
  /testclient/i,
  /testing/i,
  /\[test\]/i,
  /fakertag/i,
  /\b(active|inactive)\s+[a-z0-9]{8,16}$/i,
  /\b(buyer|owner|client)\s+[a-z0-9]{8,16}$/i,
  /\b[a-z0-9]{12}$/i,
  /\b[a-j]{13}\b/,
];

// Clean all billing and ledger records associated with the given ledger account IDs
async function deleteLedgerAccountRecords(accountIds: string[]) {
  if (!accountIds || accountIds.length === 0) return;

  // 1. Review queue discrepancies
  await supabase.from("billing_import_discrepancy").delete().in("account_id", accountIds);

  // 2. Storage holding charges
  await supabase.from("billing_holding_charge").delete().in("account_id", accountIds);

  // 3. Penalty arrangements
  await supabase.from("billing_account_penalty_arrangement").delete().in("account_id", accountIds);

  // 4. Post-dated checks
  await supabase.from("billing_post_dated_check").delete().in("account_id", accountIds);

  // 5. Billing transactions & payments
  const { data: txns } = await supabase
    .from("billing_transaction")
    .select("transaction_id")
    .in("account_id", accountIds);

  if (txns && txns.length > 0) {
    const txnIds = txns.map((t) => t.transaction_id);

    // Payments linked to these transactions
    const { data: payments } = await supabase
      .from("billing_payment")
      .select("payment_id")
      .in("transaction_id", txnIds);

    if (payments && payments.length > 0) {
      const paymentIds = payments.map((p) => p.payment_id);
      await supabase.from("billing_payment_application").delete().in("payment_id", paymentIds);
      await supabase.from("billing_payment").delete().in("payment_id", paymentIds);
    }

    // Break self-referencing reverses_transaction_id foreign key constraint before deleting transactions
    await supabase
      .from("billing_transaction")
      .update({ reverses_transaction_id: null })
      .in("account_id", accountIds);

    // Delete transactions (unblocks RESTRICT foreign key on ledger_account)
    await supabase.from("billing_transaction").delete().in("account_id", accountIds);
  }

  // 6. Billing schedules & installments
  const { data: schedules } = await supabase
    .from("billing_schedule")
    .select("schedule_id")
    .in("account_id", accountIds);

  if (schedules && schedules.length > 0) {
    const scheduleIds = schedules.map((s) => s.schedule_id);
    await supabase.from("billing_schedule_installment").delete().in("schedule_id", scheduleIds);
    await supabase.from("billing_schedule").delete().in("account_id", accountIds);
  }

  // 7. Legacy billing tables
  await supabase.from("ledger_payment").delete().in("account_id", accountIds);
  await supabase.from("ledger_compromise").delete().in("account_id", accountIds);
  await supabase.from("ledger_account_notice").delete().in("account_id", accountIds);

  // 8. Account parties
  await supabase.from("account_party").delete().in("account_id", accountIds);

  // 9. Ledger accounts
  await supabase.from("ledger_account").delete().in("account_id", accountIds);
}

// Clean dependent records before deleting a property lot
async function deletePropertyLotRecord(propertyId: string) {
  await supabase.from("land_title").delete().eq("property_id", propertyId);
  await supabase.from("file_attachment").delete().filter("metadata->>property_id", "eq", propertyId);
  const { data: accounts } = await supabase.from("ledger_account").select("account_id").eq("property_id", propertyId);
  if (accounts && accounts.length > 0) {
    const accIds = accounts.map((a) => a.account_id);
    await deleteLedgerAccountRecords(accIds);
  }
  await supabase.from("property_lot").delete().eq("property_id", propertyId);
}

// Clean dependent records before deleting a client
async function deleteClientRecord(clientId: string) {
  await supabase.from("land_title").delete().eq("client_id", clientId);
  await supabase.from("account_party").delete().eq("client_id", clientId);
  await supabase.from("file_attachment").delete().eq("client_id", clientId);
  await supabase.from("client_log").delete().eq("client_id", clientId);
  await supabase.from("contact_info").delete().eq("client_id", clientId);
  await supabase.from("search_index").delete().eq("entity_type", "client_document").eq("entity_id", clientId);
  await supabase.from("client").delete().eq("client_id", clientId);
}

// Clean subdivisions and detached lots before deleting a projectArea
async function deleteProjectAreaRecord(projectAreaId: string) {
  await supabase.from("project_area_subdivision").delete().eq("project_area_id", projectAreaId);
  const { data: lots } = await supabase.from("property_lot").select("property_id").eq("project_area_id", projectAreaId);
  if (lots && lots.length > 0) {
    for (const lot of lots) {
      await deletePropertyLotRecord(lot.property_id);
    }
  }
  await supabase.from("project_area").delete().eq("project_area_id", projectAreaId);
}

async function cleanupTestData() {
  console.log(`\n🧹 Starting test data cleanup${isDryRun ? " (DRY RUN)" : ""}...\n`);

  // 1. Clean up temporary test auth users
  const testUserIds = new Set<string>();
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersError) {
    console.error("Failed to list auth users:", usersError.message);
  } else {
    const testUsers = (usersData?.users ?? []).filter(
      (u) =>
        u.email &&
        u.email !== ADMIN_EMAIL &&
        u.email !== TEST_ADMIN_EMAIL &&
        (u.email.includes("test-user-") ||
          /-\d{10,}(-[a-z0-9]+)?@example\.com$/i.test(u.email) ||
          u.user_metadata?.first_name === "Temp" ||
          u.user_metadata?.last_name?.startsWith("User-") ||
          u.email.startsWith("temp_") ||
          u.email.endsWith("@fdm.local"))
    );

    for (const u of testUsers) {
      testUserIds.add(u.id);
    }

    const testerAccount = (usersData?.users ?? []).find((u) => u.email === TEST_ADMIN_EMAIL);
    if (testerAccount) {
      testUserIds.add(testerAccount.id);
    }

    console.log(`Found ${testUsers.length} temporary test user(s).`);
    for (const u of testUsers) {
      if (!isDryRun) {
        await supabase.schema("rbac").from("user_role").delete().eq("user_id", u.id);
        await supabase.auth.admin.deleteUser(u.id);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} auth user: ${u.email} (${u.id})`);
    }
  }

  // 2. Clean up test ledger accounts used in automated testing
  const { data: allLedgers } = await supabase
    .from("ledger_account")
    .select(`
      account_id,
      property_id,
      baseline_notes,
      forfeiture_reason,
      property:property_lot(
        property_id,
        location,
        project_area_id,
        project_area:project_area(name)
      ),
      parties:account_party(
        client_id,
        client:client(client_id, full_name)
      )
    `);

  const testLedgers = (allLedgers ?? []).filter((la) => {
    // Cast property and parties from join
    const prop = la.property as unknown as {
      property_id?: string;
      location?: string;
      project_area_id?: string;
      project_area?: { name?: string };
    } | null;

    const parties = la.parties as unknown as Array<{
      client_id?: string;
      client?: { client_id?: string; full_name?: string };
    }> | null;

    // If property lot is missing, it's an orphaned test ledger
    if (!prop) return true;

    // Check location pattern
    const propLoc = prop.location;
    if (propLoc && TEST_LOCATION_PATTERNS.some((p) => p.test(propLoc))) return true;

    // Check project area pattern
    const paName = prop.project_area?.name;
    if (paName && TEST_PROJECT_AREA_PATTERNS.some((p) => p.test(paName))) return true;

    // Check baseline notes or forfeiture reason
    if (la.baseline_notes && /test/i.test(la.baseline_notes)) return true;
    if (la.forfeiture_reason && /test/i.test(la.forfeiture_reason)) return true;

    // Check party clients
    const hasTestParty = parties?.some((p) => {
      const clientName = p.client?.full_name;
      return (
        (clientName && TEST_CLIENT_PATTERNS.some((tcp) => tcp.test(clientName))) ||
        (p.client_id && testUserIds.has(p.client_id))
      );
    });
    if (hasTestParty) return true;

    // Not in sample project areas and has no legitimate client
    const isSample =
      (paName && SAMPLE_PROJECT_AREAS.includes(paName)) ||
      (propLoc && SAMPLE_PROJECT_AREAS.includes(propLoc));

    if (!isSample) {
      const hasLegitClient = parties?.some((p) => {
        const clientName = p.client?.full_name;
        return clientName && !TEST_CLIENT_PATTERNS.some((tcp) => tcp.test(clientName));
      });
      if (!hasLegitClient) return true;
    }

    return false;
  });

  if (testLedgers.length > 0) {
    console.log(`Found ${testLedgers.length} test ledger account(s) used in automated testing.`);
    const testAccountIds = testLedgers.map((l) => l.account_id);
    if (!isDryRun) {
      await deleteLedgerAccountRecords(testAccountIds);
    }
    for (const tl of testLedgers) {
      const prop = tl.property as unknown as { location?: string; block_number?: number; lot_number?: number } | null;
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} test ledger account: ${tl.account_id} (${prop?.location ?? "orphan"})`);
    }
  }

  // 3. Clean up test projectAreas and test property lots
  const { data: allProjectAreas } = await supabase.from("project_area").select("project_area_id, name");
  const testProjectAreas = (allProjectAreas ?? []).filter((s) => TEST_PROJECT_AREA_PATTERNS.some((p) => p.test(s.name)));
  const testProjectAreaIds = new Set(testProjectAreas.map((s) => s.project_area_id));

  const { data: allLots } = await supabase
    .from("property_lot")
    .select("property_id, location, project_area_id, block_number, lot_number");

  const testLots = (allLots ?? []).filter(
    (l) =>
      (l.project_area_id && testProjectAreaIds.has(l.project_area_id)) ||
      (l.location && TEST_LOCATION_PATTERNS.some((p) => p.test(l.location)))
  );

  if (testLots.length > 0) {
    console.log(`Found ${testLots.length} test property lot(s) to purge.`);
    for (const tl of testLots) {
      if (!isDryRun) {
        await deletePropertyLotRecord(tl.property_id);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} property lot: ${tl.location} Blk ${tl.block_number} Lot ${tl.lot_number} (${tl.property_id})`);
    }
  }

  if (testProjectAreas.length > 0) {
    console.log(`Found ${testProjectAreas.length} test projectArea(s) to purge.`);
    for (const ts of testProjectAreas) {
      if (!isDryRun) {
        await deleteProjectAreaRecord(ts.project_area_id);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} test projectArea: ${ts.name} (${ts.project_area_id})`);
    }
  }

  // 4. Clean up test clients and their relations
  const { data: clientList, error: clientListErr } = await supabase
    .from("client")
    .select("client_id, full_name, created_at");

  if (!clientListErr && clientList) {
    const { data: allParties } = await supabase.from("account_party").select("client_id");
    const { data: allTitles } = await supabase.from("land_title").select("client_id");
    const { data: allLogs } = await supabase.from("client_log").select("client_id, performed_by");
    const { data: allContacts } = await supabase.from("contact_info").select("client_id, type, value");

    const assignedClientIds = new Set([
      ...(allParties ?? []).map((p) => p.client_id),
      ...(allTitles ?? []).map((t) => t.client_id),
    ]);

    const testLoggedClientIds = new Set(
      (allLogs ?? [])
        .filter((l) => l.performed_by && testUserIds.has(l.performed_by))
        .map((l) => l.client_id)
    );

    const testContactClientIds = new Set(
      (allContacts ?? [])
        .filter(
          (c) =>
            c.type === "Email" &&
            c.value &&
            (c.value.endsWith("@example.com") ||
              c.value.endsWith("@test.com") ||
              c.value.endsWith("@fdm.local"))
        )
        .map((c) => c.client_id)
    );

    const testClients = clientList.filter((c) => {
      if (assignedClientIds.has(c.client_id)) return false;
      const isPatternMatch = TEST_CLIENT_PATTERNS.some((p) => p.test(c.full_name));
      const isTestLogged = testLoggedClientIds.has(c.client_id);
      const isTestContact = testContactClientIds.has(c.client_id);
      return isPatternMatch || isTestLogged || isTestContact || includeOrphans;
    });

    const unpurgedOrphans = clientList.filter(
      (c) => !assignedClientIds.has(c.client_id) && !testClients.some((tc) => tc.client_id === c.client_id)
    );

    if (unpurgedOrphans.length > 0) {
      console.log(`Found ${unpurgedOrphans.length} unassigned client(s) with no lot assignments. (Run with --orphans to purge them).`);
    }

    if (testClients.length > 0) {
      console.log(`Found ${testClients.length} test client(s) to purge.`);
      for (const tc of testClients) {
        if (!isDryRun) {
          await deleteClientRecord(tc.client_id);
        }
        console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} test client: ${tc.full_name} (${tc.client_id})`);
      }
    }
  }

  // 5. Clean up test and orphaned import discrepancies
  const { data: testDiscrepancies } = await supabase
    .from("billing_import_discrepancy")
    .select("discrepancy_id, source_filename, account_id");

  if (testDiscrepancies && testDiscrepancies.length > 0) {
    const toPurge = testDiscrepancies.filter(
      (d) =>
        /test/i.test(d.source_filename) ||
        d.source_filename.startsWith("test-soa-") ||
        d.account_id === null
    );

    if (toPurge.length > 0) {
      console.log(`Found ${toPurge.length} test billing discrepancy record(s) to purge.`);
      if (!isDryRun) {
        const ids = toPurge.map((d) => d.discrepancy_id);
        await supabase.from("billing_import_discrepancy").delete().in("discrepancy_id", ids);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would purge" : "Purged"} ${toPurge.length} test billing discrepancy record(s).`);
    }
  }

  // 6. Clean up orphaned search index entries
  const { data: orphanedIndexes } = await supabase
    .from("search_index")
    .select("index_id, entity_type, entity_id");

  if (orphanedIndexes && orphanedIndexes.length > 0) {
    const { data: allDocs } = await supabase.from("file_attachment").select("attachment_id");
    const validDocIds = new Set((allDocs ?? []).map((d) => d.attachment_id));

    const indicesToDelete = orphanedIndexes.filter(
      (idx) => idx.entity_type === "client_document" && !validDocIds.has(idx.entity_id)
    );

    if (indicesToDelete.length > 0) {
      console.log(`Found ${indicesToDelete.length} orphaned search index entries.`);
      if (!isDryRun) {
        for (const idx of indicesToDelete) {
          await supabase.from("search_index").delete().eq("index_id", idx.index_id);
        }
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would purge" : "Purged"} ${indicesToDelete.length} search index record(s).`);
    }
  }

  // 7. Clean up orphaned account parties
  const { data: currentClients } = await supabase.from("client").select("client_id");
  const validClientIds = new Set((currentClients ?? []).map((c) => c.client_id));

  const { data: parties } = await supabase.from("account_party").select("account_id, client_id");
  const orphanedParties = (parties ?? []).filter((p) => !validClientIds.has(p.client_id));

  if (orphanedParties.length > 0) {
    console.log(`Found ${orphanedParties.length} orphaned account_party entries.`);
    if (!isDryRun) {
      for (const p of orphanedParties) {
        await supabase
          .from("account_party")
          .delete()
          .match({ account_id: p.account_id, client_id: p.client_id });
      }
    }
    console.log(`  - ${isDryRun ? "[DRY-RUN] Would purge" : "Purged"} ${orphanedParties.length} orphaned party entry/entries.`);
  }

  // 8. Clean up orphaned ledger accounts
  const { data: currentLots } = await supabase.from("property_lot").select("property_id");
  const validLotIds = new Set((currentLots ?? []).map((l) => l.property_id));

  const { data: ledgers } = await supabase.from("ledger_account").select("account_id, property_id");
  const orphanedLedgers = (ledgers ?? []).filter((l) => !validLotIds.has(l.property_id));

  if (orphanedLedgers.length > 0) {
    console.log(`Found ${orphanedLedgers.length} orphaned ledger accounts.`);
    if (!isDryRun) {
      const orphanedIds = orphanedLedgers.map((l) => l.account_id);
      await deleteLedgerAccountRecords(orphanedIds);
    }
    console.log(`  - ${isDryRun ? "[DRY-RUN] Would purge" : "Purged"} ${orphanedLedgers.length} orphaned ledger account(s).`);
  }

  console.log(`\n✨ Cleanup process completed successfully.`);
}

cleanupTestData().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
