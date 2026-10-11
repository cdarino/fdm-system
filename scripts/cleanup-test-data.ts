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

const TEST_LOCATION_PATTERNS = [
  /prevention park/i,
  /guard palms/i,
  /closing palms/i,
  /assignment palms/i,
  /update estate/i,
  /reset estate/i,
  /co-ownership estate/i,
  /delete estate/i,
  /archive test estate/i,
  /unique village/i,
  /hills subdivision/i,
  /search hills/i,
  /forbidden location/i,
  /samal heights/i,
  /plat estate/i,
  /\[test\]/i,
  /\btest\b/i,
];

const TEST_SITE_PATTERNS = [
  /^test site/i,
  /^plat estate/i,
  /^site-/i,
  /^direct assign site/i,
  /^subdivision selector site/i,
  /fgdfgdfg/i,
  /^site name$/i,
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
];

// Clean dependent records before deleting a property lot
async function deletePropertyLotRecord(propertyId: string) {
  await supabase.from("land_title").delete().eq("property_id", propertyId);
  await supabase.from("file_attachment").delete().filter("metadata->>property_id", "eq", propertyId);
  const { data: accounts } = await supabase.from("ledger_account").select("account_id").eq("property_id", propertyId);
  if (accounts && accounts.length > 0) {
    const accIds = accounts.map((a) => a.account_id);
    await supabase.from("account_party").delete().in("account_id", accIds);
    await supabase.from("ledger_account").delete().eq("property_id", propertyId);
  }
  await supabase.from("property_lot").delete().eq("property_id", propertyId);
}

// Clean dependent records before deleting a client
async function deleteClientRecord(clientId: string) {
  await supabase.from("land_title").delete().eq("client_id", clientId);
  await supabase.from("account_party").delete().eq("client_id", clientId);
  await supabase.from("client_document").delete().eq("client_id", clientId);
  await supabase.from("file_attachment").delete().eq("entity_type", "client").eq("entity_id", clientId);
  await supabase.from("client_log").delete().eq("client_id", clientId);
  await supabase.from("contact_info").delete().eq("client_id", clientId);
  await supabase.from("search_index").delete().eq("entity_type", "client_document").eq("entity_id", clientId);
  await supabase.from("client").delete().eq("client_id", clientId);
}

// Clean subdivisions and detached lots before deleting a site
async function deleteSiteRecord(siteId: string) {
  await supabase.from("site_subdivision").delete().eq("site_id", siteId);
  const { data: lots } = await supabase.from("property_lot").select("property_id").eq("site_id", siteId);
  if (lots && lots.length > 0) {
    for (const lot of lots) {
      await deletePropertyLotRecord(lot.property_id);
    }
  }
  await supabase.from("site").delete().eq("site_id", siteId);
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

  // 2. Clean up test sites and test property lots
  const { data: allSites } = await supabase.from("site").select("site_id, name");
  const testSites = (allSites ?? []).filter((s) => TEST_SITE_PATTERNS.some((p) => p.test(s.name)));
  const testSiteIds = new Set(testSites.map((s) => s.site_id));

  const { data: allLots } = await supabase
    .from("property_lot")
    .select("property_id, location, site_id, block_number, lot_number");

  const testLots = (allLots ?? []).filter(
    (l) =>
      (l.site_id && testSiteIds.has(l.site_id)) ||
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

  if (testSites.length > 0) {
    console.log(`Found ${testSites.length} test site(s) to purge.`);
    for (const ts of testSites) {
      if (!isDryRun) {
        await deleteSiteRecord(ts.site_id);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} test site: ${ts.name} (${ts.site_id})`);
    }
  }

  // 3. Clean up test clients and their relations
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

  // 4. Clean up orphaned search index entries
  const { data: orphanedIndexes } = await supabase
    .from("search_index")
    .select("index_id, entity_type, entity_id");

  if (orphanedIndexes && orphanedIndexes.length > 0) {
    const { data: allDocs } = await supabase.from("client_document").select("document_id");
    const validDocIds = new Set((allDocs ?? []).map((d) => d.document_id));

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

  // 5. Clean up orphaned account parties
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

  // 6. Clean up orphaned ledger accounts
  const { data: currentLots } = await supabase.from("property_lot").select("property_id");
  const validLotIds = new Set((currentLots ?? []).map((l) => l.property_id));

  const { data: ledgers } = await supabase.from("ledger_account").select("account_id, property_id");
  const orphanedLedgers = (ledgers ?? []).filter((l) => !validLotIds.has(l.property_id));

  if (orphanedLedgers.length > 0) {
    console.log(`Found ${orphanedLedgers.length} orphaned ledger accounts.`);
    if (!isDryRun) {
      for (const l of orphanedLedgers) {
        await supabase.from("account_party").delete().eq("account_id", l.account_id);
        await supabase.from("ledger_account").delete().eq("account_id", l.account_id);
      }
    }
    console.log(`  - ${isDryRun ? "[DRY-RUN] Would purge" : "Purged"} ${orphanedLedgers.length} orphaned ledger account(s).`);
  }

  console.log(`\n✨ Cleanup process completed successfully.`);
}

cleanupTestData().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
