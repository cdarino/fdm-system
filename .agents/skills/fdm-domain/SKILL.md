---
name: fdm-domain
description: Operational reality, business invariants, and realistic system goals for FDM (First Davao Millennium) raw-lot property operations in wind-down. Use this skill when implementing client validations, property/lot assignment, receivables and billing, penalty and SOA computation, notice/forfeiture handling, or title release workflows.
---

# FDM Domain & Operational Reality

FDM sold raw land on Samal Island (IGACOS, Davao del Norte) for roughly 26 years across 100+ project areas. **It has stopped selling.** What remains is a wind-down with exactly two jobs:

1. **Collect** what is owed on accounts that matured without full payment.
2. **Release** the individual titles and Deeds of Absolute Sale it already contracted to deliver.

Everything in this skill follows from that. This is not a growing sales business that needs a CRM, a marketing funnel, or a lot-inventory optimiser. It is a **closing operation** that needs an archive, a ledger, and a release pipeline — and it needs them to work for a handful of people who are already doing three jobs each.

> [!IMPORTANT]
> Before adding a feature, ask which of the two jobs above it serves. If it serves neither, it is out of scope — see §3.

---

## 1. Who Uses This System

Roles only. Refer to stakeholders by function, never by name, in code, comments, UI copy, seeds, fixtures, test data, or documentation.

| Role | What they actually do |
|---|---|
| **Owner / top management** | Final sign-off on every release. Waivers and compromise amounts. Also oversees Legal. Rarely encodes anything herself. |
| **Executive / auditor (CPA)** | All statutory finance: salaries, ITR, financial statements. Installed the original accounting software. Owner's spouse. |
| **Billing head** | Accounts receivable, aging, SOA, penalty and compromise negotiation. Oversees the cashier, the field collector, and the notices team. |
| **Legal in-charge** | Assembles the release packet, drafts the deed, chases missing requirements. |
| **Legal supervisor / head** | Verifies the packet the in-charge assembled. Rejects incomplete files back to preparation. |
| **Operations / admin lead** | Cross-department generalist covering Billing, Legal, and Admin simultaneously. |
| **Cashier / field collector** | Takes payments; does physical site visits and buyer tracing. |
| **Reception / records staff** | Front counter, subdivision plans, the paper logbook, encoding into the accounting software. |

### Capacity is the binding constraint

- Headcount is **single digits**, down from roughly 30 before the pandemic. The work did not shrink with it.
- Staff routinely **cover two or three departments at once**, and are explicit that they are untrained for some of it — a marketing-background employee absorbing Billing, Legal, and Admin is the normal case, not an emergency.
- **Two single points of failure.** Title processing rests on one person's knowledge. Statutory finance rests on one other. Neither is documented.
- Some of the team is at the office part-time, splitting attention with an unrelated retail business that shares the building and the staff.

**What this means for implementation:**

- **Prefer fewer fields.** Every additional required input is a field someone skips at 5pm while covering another department.
- **Never require dual entry.** If the system asks for a number the staff already wrote in the ledger or the accounting software, it will not be maintained. Read §3 before designing an "of course we need that" field.
- **Get the defaults right.** The operator is not an accountant. A wrong default that looks plausible will be trusted and will silently corrupt a balance.
- **Assume interruption.** Long multi-step wizards that lose state are hostile to this environment.
- **Design for print.** Staff work from paper at the counter, hand buyers physical documents, and maintain physical evidence files.
- **Low interaction frequency.** This team touches the system weekly, not hourly. Do not build features whose value depends on daily habitual use.

---

## 2. Conditions & Resources

These constrain design as hard as any business rule.

- **No cloud storage.** Scans live on a local NAS appliance. The backup is in the same building. Assume no off-site redundancy and treat the database as the system of record, not the NAS.
- **Unreliable mobile data** in the office; signal is poor on upper floors and staff resort to phone hotspots. Do not design flows that require a fast, stable connection, and do not assume mobile-first is a win.
- **Constrained budget.** No new recurring paid services. Cost-sensitive decisions (per-scan, per-SMS, per-seat) need justification.
- **Paper is not going away.** The physical logbook, hard-copy lot plans per project area, client folders, and wet-signature receipts all persist. The system supplements the archive; it does not replace it.
- **Legacy tooling is 3 overlapping records of the same number:** a broken/historical QuickBooks install, spreadsheets, and a handwritten ledger. They disagree. Reconciliation is the user's real job.
- **No scanner workflow in the app.** Scanning happens outside, slowly, folder by folder. Bulk import of a scanned archive is not a thing they can execute.
- **Satellite imagery runs about a year stale**, lots carry no survey pins, and units are identified manually. Do not present coordinates as authoritative.
- **The builders leave.** This is delivered by a student team and handed to non-developers. Prefer boring, well-commented, self-explanatory code over clever abstraction.

---

## 3. Realistic Goals, and Explicit Non-Goals

Ranked. When effort is scarce, work down this list.

**Goals**

1. **Get the title backlog released.** This is the main job. Fully-paid buyers are waiting on titles the company already holds. Release throughput is the metric that matters.
2. **Know what each account actually owes, right now.** Outstanding receivable, months in arrears, and aging. The billing head's stated core need: *"pila na ang iyahang ma-receivable... pila ka monthly installment"* overdue.
3. **Never sell a lot twice.** Duplicate assignment is called out as a routine failure, and it is the failure that produces lawsuits.
4. **Make buyers findable.** Incomplete legacy addresses are the root cause of unclaimed titles. Address quality is a first-class domain requirement, not a nice-to-have.
5. **Replace manual penalty and SOA computation.** Hand-computing and printing statements for hundreds of accounts is the single largest recurring manual burden.
6. **Preserve proof of due process.** Notices must be recorded with dispatch and delivery evidence, because the paper trail is the company's legal defence.
7. **Speed up archive lookup.** Staff currently walk to a cabinet or a server folder. Any reliable lookup is an improvement.

**Non-goals — do not build these**

- **BIR eCAR, Registry of Deeds registration, capital gains tax, documentary stamp tax.** These are the buyer's obligations and are explicitly outside company scope. See §6.
- **Sales, lead tracking, marketing, commission computation.** Marketing is gone.
- **Client-facing self-service portals or client data entry.** Explicitly rejected — buyers are not trusted to type their own records.
- **Automated client outreach** (email/SMS campaigns). Legacy buyers were onboarded around 2000 and generally have no email at all; the company reaches people by courier and phone.
- **Cloud sync, offline-first sync engines, mobile apps.** See §2.
- **Client account codes.** No such identifier exists in the business. Do not invent one and make it mandatory. See §4.

---

## 4. Client & Contract Invariants

- **Civil status and spouse.** When `civil_status` is `married`, `spouse_name` is **strictly mandatory** — it is required on the Contract to Sell and the Deed of Absolute Sale. Staff called this out as a missing demo field with unusual force. Do not treat it as optional metadata.
- **TIN** is required for contracts and for title turnover clearance.
- **Contact quality is the point.** Historical records frequently list a city and nothing else (e.g. a city name alone), because the original sales agents were paid on commission and had no incentive to capture detail. Buyers moved, boarded, or worked abroad and were never re-contacted.
  - Require street/sitio/barangay granularity; a bare city or province must not be accepted as a complete address.
  - Support multiple contact channels: mobile, landline, email, plus at least one alternative contact.
  - Treat "no usable contact on file" as a state worth surfacing, not a blank field.
- **No account code exists.** The identity key is **the lot(s) a buyer holds**, and a single buyer commonly holds several. Do not introduce an account-number concept as the primary identifier.
- **Exactly one principal buyer per account.** A co-buyer or representative may share the account. Two principals on one lot is the double-sale bug; it is guarded in application code and by a database trigger.
- **Deceased buyers and sellers.** Historical titles are frequently blocked because the original owner died before signing, or because a buyer died before release. Record the condition and route to estate/extrajudicial settlement; do not attempt to model the settlement itself.

---

## 5. Lot & Inventory Invariants

- Properties are **raw lots** (*yuta lang jud*), demarcated by concrete monuments (*muhon*) per approved geodetic subdivision plans. There is no developer obligation for roads, drainage, or housing — sales are **as-is-where-is**, and buyers do litigate the condition of unbuilt roads.
- Lots are referenced by **Block and Lot** within a named **project area** (the company's own term, and the schema now uses it too).
- **Status lifecycle**

  ```
  [Open] ──> [Reserved] ──> [Sold] ──> [Released]
     ▲            │            │
     │            ▼            ▼
     └──────── [Forfeited] ◄───┘
  ```

- **Double-selling is the critical guard.** Block and Lot inputs must be validated against existing active assignments, and the guard must reject rather than warn. It is enforced at the database level as well, so that stale clients cannot reintroduce the bug.
- **Forfeiture returns a lot to inventory.** A forfeited lot must be reopenable for sale — but only once its documents are complete. Implement both directions of this transition.
- **Project areas are named after the original landowners**, and subdivision of a mother title into individual titles is company work. See §6.

---

## 6. The Titling Boundary — Two Stages

This is the most commonly misunderstood part of the domain. There are **two distinct title operations** and they belong to different parties.

**Stage 1 — FDM's own title production (company responsibility).**
The company subdivides the mother title into individual lot titles. This involves survey, geodetic work, agency processing, and produces the individual title FDM contracted to deliver. The **titling fee is collected from the buyer at claim** and belongs to the company.

**Stage 2 — Transfer into the buyer's name (buyer responsibility).**
Once FDM hands over the individual title and the executed Deed of Absolute Sale, **the company is done**. The buyer shoulders, on their own account and at their own cost:

- BIR eCAR and capital gains tax
- Documentary stamp tax
- Registry of Deeds registration (Tagum City)

Staff stated the boundary repeatedly and unambiguously: *"Wala na namo gi-process. Up to deed of sale lang mi"*, *"gawas na mi"*, and — of the downstream costs — *"ilaha na 'to nga account."*

**Implementation consequences:**

- **Do not build** BIR status tracking, Registry of Deeds monitoring, title-transfer progress, or "delayed processing" flags. These were proposed in a demo and rejected outright.
- `eCAR` is explicitly excluded from standard document types and must not be modelled as a company workflow or standard upload option.
- The internal **30-day clearance period is entirely internal** — no agency is involved.
- The company's obligation ends at: verified full payment, executed Deed of Absolute Sale, and physical handover of the title and documents.

> Historical note: FDM once transferred titles into buyers' names before full payment, at roughly 80–90% paid. That practice has stopped and must not be modelled as current behaviour.

---

## 7. Money: Terms, Penalties, Compromise

**Terms.** Original contracts ran **up to 5–6 years** of straight monthly installments. **Restructured or post-default accounts are capped at one year.** These are different numbers; do not conflate them.

**Penalty.** The standard is **3%–3.5% per month, applied to the overdue monthly installment amount — not to the total contract price, and not compounding.** Staff compared it to appliance financing. The rate is per-account, so store it on the account rather than hardcoding it.

**Waivers are gone; compromise replaced them.** A penalty is no longer simply waived. The current arrangement is a negotiated **compromise agreement**: the accrued penalty is presented, then a reduced agreed amount is set, typically with a fixed processing fee, and cash settlement improves the odds of a deeper reduction. The system must therefore accept a **free-entry agreed amount** — never a fixed discount percentage, and never a computed "standard" discount.

Presenting the client's choices side by side is the owner's actual workflow: show what they owe under the contract, and what they would save by compromising. **Support that comparison directly.**

**Storage fee.** ₱540 per month applies to a title left unclaimed beyond a **one-year grace period** after it is ready for claim. Staff sometimes refer to this loosely as a penalty; it is a separate charge.

**Default and forfeiture trigger.** Three months of default is the point at which forfeiture should be monitored. In practice enforcement has been lax for years — accounts have run far past their terms, so treat long-overdue accounts as the **normal** state of the legacy book, not as corruption in the data.

**Account states are distinct — do not collapse them:**

| State | Meaning |
|---|---|
| **Active** | Still paying installments within term. |
| **Matured** | Contract term ended **with a balance still outstanding**. Not fully paid. |
| **Fully paid, unclaimed** | Zero balance; title sits in the office awaiting pickup. This is a large and operationally urgent bucket. |
| **Forfeited** | Written off after notices; lot returns to inventory. |

**Settlement modes.** A buyer may settle in full (which proceeds directly to release) or continue on installments.

**Payment modes accepted:** cash, check / post-dated check, and bank transfer. **GCash is not accepted.** The `PaymentMode` union allows an online-deposit variant; confirm before relying on it.

---

## 8. Notices, Due Process & Forfeiture

To satisfy due process before forfeiture, the company issues **three notices**, escalating to a final demand letter. This is a legal instrument, not a courtesy reminder — the paper trail exists to defeat future lawsuits, and staff keep courier receipts for years for exactly that reason.

**Protocol:**

1. **1st Notice** — invitation / reminder.
2. **2nd Notice** — formal reminder with accrued installments and penalties.
3. **Final Demand** — final deadline before escalation.
4. **Dispatch** — by courier (LBC). If **returned to sender**, re-dispatch by post office. Record tracking number, dispatch date, and delivery outcome.
5. **Escalation** — at final notice the account is endorsed to an **external lawyer acting as a collection agency**, at which point **attorney's fees are added**.
6. **Redemption period** — a further grace window for the buyer before the lot is resold.
7. **Resale** — only after documents are complete.

**Ownership:** the notices team sits under **Billing**, not Legal. Legal takes over only at escalation.

**Implementation consequences:**

- Notices must be **recordable and generatable from templates**, and evidence (courier receipt, RTS documentation) must be attachable.
- The system must never imply it performed outreach. It records that the company did.
- Attach the delivery outcome faithfully; return-to-sender is a routine and expected state, not an error.

---

## 9. The Release Workflow

Release is a **strict, internally-gated pipeline**. Billing clearance is a hard precondition — Legal cannot begin without it.

1. **Billing cleared** — settlement confirmed and payment history reconciled. This is the gate.
2. **Document preparation** — Legal assembles the packet: clearance, SOA, payment history, Certificate of Ownership, title copy, Deed of Absolute Sale, and the Contract to Sell when one is on file.
3. **Legal verification** — the Legal head checks the packet. Incomplete files return to step 2 with a reason.
4. **Management signature** — top management signs. **This is the hard gate.** Underpayment or missing supporting documents means no signature and an immediate return.
5. **30-day clearance period** — internal only.
6. **Ready for claim** — client is contacted and issued a claim notice; delivery and follow-ups are recorded.
7. **Released** — release date, receiver identity, and scanned proof of handover are recorded.

**The document set matters more than the status label.** The Contract to Sell in particular is a recurring gap — copies go missing, and the company retains its copy. `Certificate of Ownership` is the document staff report relying on when other records are lost, so treat it as authoritative.

---

## 10. Legacy Data Reality

The archive spans records from around **2004** onward, and is **deliberately incomplete: files for claimed transactions were physically pulled out and moved to storage**, so "find this client's file" has two different backends. Full historical reconstruction is not achievable and should not be attempted.

**Model legacy accounts as a baseline snapshot, not a reconstructed history.** Each migrated account carries a cutover date, principal paid to date, and penalties accrued to date, with a free-text note explaining the baseline. The application already supports this pattern; extend it rather than rebuilding ledgers from raw payment rows.

**Known data defects to expect:** city-only addresses, missing contact numbers, buyers who were boarders or overseas workers, addresses captured under a since-departed agent's name, photos stored separately from the matching contact details, deceased owners, unsigned or expired deeds, and multiple form versions across years.

**A CSV import path for legacy statement-of-account spreadsheets exists.** Prefer extending it over manual re-entry — encoding this book by hand is precisely the burden the system is meant to remove.

---

## 11. Working Rules for Changes in This Domain

- **Ask which of the two jobs (§ top) a change serves.** If it serves neither, push back before building.
- **Money maths is the highest-risk change in this codebase.** A wrong penalty or balance is not a cosmetic bug; it propagates into statements handed to buyers and into compromise negotiations. When touching penalty or balance computation, state the rule you are implementing and cite it.
- **Do not silently "fix" legacy oddities.** An account 17 years past term is a business fact, not a data error.
- **Prefer adding a nullable field with a clear note over a migration that rewrites balances.**
- **Never put a person's name in code, seeds, fixtures, tests, or UI copy.** This skill is referenced by teammates and by AI tooling; roles only.
