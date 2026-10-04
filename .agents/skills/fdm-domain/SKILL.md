---
name: fdm-domain
description: Core business logic, operational workflows, titling lifecycle, and billing rules for FDM (First Davao Millennium) raw lot property operations. Use this skill when implementing client validations, property/lot assignments, billing computations, SOA generation, or title turnover workflows.
---

# FDM Domain & Business Architecture

This skill defines the operational realities, legal constraints, billing algorithms, and approval lifecycles for the First Davao Millennium (FDM) property management system. All backend logic, Zod validations, and domain views must adhere to these invariants.

---

## 1. Operational Reality & Business Scope

* **Core Function**: FDM operates raw land subdivisions across the Island Garden City of Samal (IGACOS), Davao del Norte (spanning 106 project areas such as Babak, Peñaplata, Kaputian, Sabang, and Talikud).
* **Closed Active Marketing**: Active marketing of new land subdivisions has ceased. Current business operations are strictly focused on:
  1. **Accounts Receivable collection** and delinquent account management.
  2. **Backlog title turnover** (~800+ titles pending claim/release).
  3. **Deed of Absolute Sale (DOAS)** drafting and turnover upon full settlement.
* **Physical Land Nature**: Properties are strictly **raw lots** (*yuta lang jud*) demarcated by concrete monuments (*muhon*) based on approved geodetic subdivision plans. There is no developer obligation for paved roads, drainage, or housing development ("as-is-where-is").

---

## 2. Titling Lifecycle & System Boundary

> [!IMPORTANT]
> **FDM does NOT process BIR eCAR or Registry of Deeds (ROD) transfers for buyers.**
> A common misconception is that FDM handles external government title transfers. The FDM system scope stops at physical turnover of the individual title and executed Deed of Absolute Sale.

### Turnover Process Boundary
1. **Full Payment & Reconciled SOA**: Buyer achieves zero balance on lot and titling fees.
2. **30-Day Internal Clearance**: File verification by Billing and Legal departments.
3. **DOAS Execution**: Legal generates the Deed of Absolute Sale; signed by authorized executives.
4. **Physical Document Release**: Buyer receives:
   * Original Transfer Certificate of Title (individual title).
   * Original notarized Deed of Absolute Sale (DOAS).
   * Official receipts and clearance certificate.
5. **Buyer's Responsibility**: All downstream processing—payment of Capital Gains Tax, Documentary Stamp Tax, BIR Electronic Certificate Authorizing Registration (eCAR), and Registry of Deeds (Tagum City) registration fees—is shouldered directly by the buyer.

---

## 3. Client & Contract Validation Invariants

* **Civil Status & Mandatory Spouse**: In Philippine property law, when a buyer's `civil_status` is `married`, `spouse_name` is **strictly mandatory** for the Contract to Sell and Deed of Absolute Sale.
* **Tax Identification Number (TIN)**: Mandatory for all buyers before finalizing contracts and title turnover clearances.
* **Granular Contact Data**: Historical records frequently suffered from lost contact with buyers (OFWs, tenant boarders). Client intake must enforce:
  * Strict address validation (require street/sitio/barangay; prevent bare city/province entries).
  * Multi-channel contacts (mobile, landline, email, emergency contact).
* **Deceased Owners**: If an original titleholder or buyer is deceased, title transfer requires extrajudicial estate settlement / BIR estate tax clearance before DOAS execution.

---

## 4. Property & Subdivision Lot Invariants

* **Lot Status Lifecycle**:
  ```
  [Open] ──> [Reserved] ──> [Sold] ──> [Turned Over / Released]
     ▲           │           │
     │           ▼           ▼
     └─────── [Forfeited] ◄──┘ (Default after 3 Notices)
  ```
* **Double-Selling Prevention (Critical Guard)**:
  * The system must strictly block lot assignments if a lot is already in `reserved` or `sold` status.
  * Form inputs for Block and Lot numbers must validate against existing active contracts to prevent collision from encoder typos.
* **Boundary Markers**: Lots are referenced by Block and Lot numbers tied to registered Subdivision Plans, with corners marked by *muhon* (concrete monuments).

---

## 5. Billing, Penalties & Settlement Compromises

* **Contract Terms**: Standard historical contracts were 3 to 6 years straight monthly installments. Matured/overdue restructuring is capped at 1 year max.
* **Penalty Calculation Formula**:
  * Default penalty is **3.0% to 3.5% monthly**, calculated **strictly on the overdue monthly installment amount**, NOT compounding on the total remaining principal balance.
  * Formula: `penalty_amount = overdue_installment_amount * monthly_penalty_rate * overdue_months`
* **Compromise / Waiver Agreements**:
  * Executive management (Owner/Auditor) frequently approves compromise settlements to clear legacy matured accounts.
  * The billing system must support **custom compromise waiver amounts** (e.g. waiving ₱50,000 in accrued penalties down to ₱20,000 lump sum upon executive approval). Do not hardcode fixed discount percentages.
* **Storage Fees**: Contractual storage fee of ₱540/month applies to titles left unclaimed beyond the 1-year grace period following title release readiness.

---

## 6. The 3-Notice Forfeiture Protocol

To satisfy legal due process (under the Maceda / Recto Law) before declaring a delinquent account forfeited:
1. **1st Notice**: Friendly statement invitation / reminder of matured account.
2. **2nd Notice**: Formal reminder detailing accrued installments and penalties.
3. **3rd Notice**: Final Demand Letter giving a final settlement deadline before legal escalation.
4. **Notice Dispatch**: Sent via LBC Express registered mail (or Philippine Postal Corp if returned to sender) to maintain verifiable proof of delivery before external legal or forfeiture action.

---

## 7. Four-Tier Internal Clearance Workflow

For generating Statements of Account (SOA), drafting DOAS, and releasing titles:
1. **Step 1 - Billing / Collections** (Sir Rey / Cashier): Verifies receipt history against QuickBooks/manual ledgers, reconciles balance, issues SOA.
2. **Step 2 - Legal Staff** (Cristina): Compiles 201 buyer file (TIN, valid IDs, Contract to Sell, clearance), drafts Deed of Absolute Sale.
3. **Step 3 - Legal Supervisor** (Jeff): Quality-checks DOAS legal descriptions, lot boundaries, and 30-day clearance conditions.
4. **Step 4 - Top Management / Executive** (Ma'am Jet / Sir Alex): Final sign-off and notarization of the Deed of Absolute Sale prior to document handover.
