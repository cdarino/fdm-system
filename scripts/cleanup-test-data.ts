import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = process.argv.includes("--dry-run");

async function cleanupTestData() {
  console.log(`\n🧹 Starting test data cleanup${isDryRun ? " (DRY RUN)" : ""}...\n`);

  // 1. Clean up temporary test auth users
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
        (u.email.includes("test-user-") ||
          u.email.includes("@example.com") ||
          u.user_metadata?.first_name === "Temp" ||
          u.user_metadata?.last_name?.startsWith("User-"))
    );

    console.log(`Found ${testUsers.length} temporary test user(s).`);
    for (const u of testUsers) {
      if (!isDryRun) {
        await supabase.schema("rbac").from("user_role").delete().eq("user_id", u.id);
        await supabase.auth.admin.deleteUser(u.id);
      }
      console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} auth user: ${u.email} (${u.id})`);
    }
  }

  // 2. Clean up test clients and their relations
  const { data: clientList, error: clientListErr } = await supabase
    .from("client")
    .select("client_id, full_name");

  if (!clientListErr && clientList) {
    const testClients = clientList.filter((c) => {
      const name = c.full_name.toLowerCase();
      return (
        name.includes("test auto client") ||
        name.includes("pdf-test") ||
        name.includes("lot-buyer") ||
        name.includes("testclient") ||
        name.includes("testing") ||
        name.startsWith("[test]")
      );
    });

    if (testClients.length > 0) {
      console.log(`Found ${testClients.length} test client(s) to purge.`);
      for (const tc of testClients) {
        if (!isDryRun) {
          await supabase.from("account_party").delete().eq("client_id", tc.client_id);
          await supabase.from("client_document").delete().eq("client_id", tc.client_id);
          await supabase.from("client_log").delete().eq("client_id", tc.client_id);
          await supabase.from("contact_info").delete().eq("client_id", tc.client_id);
          await supabase.from("search_index").delete().eq("entity_type", "client_document").eq("entity_id", tc.client_id);
          await supabase.from("client").delete().eq("client_id", tc.client_id);
        }
        console.log(`  - ${isDryRun ? "[DRY-RUN] Would delete" : "Deleted"} test client: ${tc.full_name} (${tc.client_id})`);
      }
    }
  }

  // 3. Clean up orphaned search index entries
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

  // 4. Clean up orphaned account parties
  const { data: allClients } = await supabase.from("client").select("client_id");
  const validClientIds = new Set((allClients ?? []).map((c) => c.client_id));

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

  // 5. Clean up orphaned ledger accounts
  const { data: allLots } = await supabase.from("property_lot").select("property_id");
  const validLotIds = new Set((allLots ?? []).map((l) => l.property_id));

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
