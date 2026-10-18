# RECALLMESH — 4-Minute Submission Video Demo Script
**Event:** Graph Hacks 2026 (FalkorDB Property Graph Hackathon)  
**Target Duration:** ~3:45 to 4:00 minutes (Speaking pace: ~135 words/minute)  
**Live URL:** `http://127.0.0.1:5173`

---

## Pre-Recording Checklist
1. Browser opened to `http://127.0.0.1:5173` in full screen (1080p or 1440p).
2. Active dataset set to: **Verdant Harvest Foods (Synthetic Demo)**.
3. Start on the **Overview Dashboard** tab (`#overview`).
4. Ensure your audio is crisp, microphone levels set, and notifications silenced.

---

## Video Timeline Overview
* **0:00 – 0:35 (35s):** The Food Recall Crisis & Graph-Native Vision
* **0:35 – 1:15 (40s):** Overview Dashboard, Live CTE Ledger & ML Advisory
* **1:15 – 2:00 (45s):** Investigation Workspace & Absence-of-Path Safety Principle
* **2:00 – 2:50 (50s):** Dedicated 6-Stage Graph Explorer & Forward Blast Radius
* **2:50 – 3:30 (40s):** Action Plans, Human Governance Gate & FSMA 204 Dossier
* **3:30 – 4:00 (30s):** Real-Data Ingestion, Dataset Isolation & Conclusion

---

## Detailed Script & On-Screen Actions

---

### Segment 1: The Food Recall Crisis & Graph-Native Vision (0:00 – 0:35)

#### 🖥️ [SCREEN ACTION]
* **Start on:** Overview Dashboard (`http://127.0.0.1:5173/#overview`).
* Hover mouse cursor over the header title: **RECALLMESH — Food Traceability & Incident Surveillance**.
* Point cursor to the active dataset pill: **Verdant Harvest Foods (Synthetic Demo)** with the `Demo` badge.

#### 🎙️ [SPOKEN SCRIPT]
> "Every year, foodborne contamination incidents like *Salmonella* and *Listeria* trigger high-stakes operational crises. Under the FDA’s FSMA Rule 204, food processors are legally accountable to trace affected ingredients and shipments within 24 hours.
>
> But relational ERPs fail under deep recursive joins, and LLMs alone hallucinate critical supply chain links.
>
> Meet **RECALLMESH**: a graph-native food safety intelligence and recall containment platform powered by **FalkorDB**. It turns Critical Tracking Events and Key Data Elements into an evidence-grounded property graph to calculate forward blast radius, detect broken custody chains, and govern emergency containment in milliseconds."

---

### Segment 2: Overview Dashboard, Live CTE Ledger & ML Advisory (0:35 – 1:15)

#### 🖥️ [SCREEN ACTION]
1. Slowly scroll through the Overview Dashboard metrics row (`Active Recall Cases`, `Shipments Traced`, `Open Traceability Gaps`, `Records Under Review`).
2. Click through the **Live FSMA 204 CTE Ledger** tabs:
   * Click **Receiving CTEs** (highlighting supplier and received lots).
   * Click **Transformation CTEs** (showing production batch events).
   * Click **Shipping CTEs** (showing outbound logistics).
3. Scroll down to show the **FDA Recall Risk Advisor** card on the right, pointing out the ML model prediction and statutory disclaimer.

#### 🎙️ [SPOKEN SCRIPT]
> "Here on the **Overview Dashboard**, every single metric is derived directly from live FalkorDB graph state—no hardcoded counters. 
>
> Below, our **Live FSMA 204 Ledger** extracts Critical Tracking Events in real time: Receiving from agricultural suppliers, facility Transformation events, and Shipping to retail distribution centers. 
>
> On the right, our offline Scikit-learn models—trained on historical openFDA recall enforcement data—provide advisory hazard severity predictions, complete with transparent regulatory disclaimers."

---

### Segment 3: Investigation Workspace & Absence-of-Path Safety Principle (1:15 – 2:00)

#### 🖥️ [SCREEN ACTION]
1. In the left sidebar, click **Investigation Workspace** (`#investigation`).
2. Show the active incident card: **Organic Cumin Salmonella Cross-Contamination** (Suspect Lot: `LOT-CUM-2026-088`).
3. In the 3-column triage board:
   * Point to Column 1 (`Affected Finished Lots` -> `FL-SALSA-101`).
   * Point to Column 2 (`Clean Control Lots` -> `FL-SALSA-102`, highlighted with an emerald checkmark).
   * Point to Column 3 (`Unlinked Lots / Traceability Gaps` -> `FL-SALSA-103`).
4. Click the **"Simulate Supplier Inquiry"** button on `FL-SALSA-103`.
5. In the modal, click **"Send Simulated Inquiry"** and watch the notification confirm audit logging.

#### 🎙️ [SPOKEN SCRIPT]
> "Now let’s enter the **Investigation Workspace**. An analytical COA assay detected *Salmonella enterica* in ground cumin lot `LOT-CUM-2026-088`.
>
> Immediately, RECALLMESH partitions our inventory into three distinct columns:
> First, **Affected Finished Lots**—showing `FL-SALSA-101`, which directly consumed the contaminated spice.
> Second, **Clean Control Lots**—`FL-SALSA-102` was produced in the same facility, but our openCypher traversal proves it used an independent clean lot, sparing it from costly destruction.
>
> And third, our cornerstone differentiator: the **Absence-of-Path Safety Principle**. `FL-SALSA-103` has no record linking it to a production run. Instead of dangerously assuming it’s safe, RECALLMESH tags it as a **Traceability Gap** and lets QA issue an instant digital twin supplier inquiry."

---

### Segment 4: Dedicated 6-Stage Graph Explorer & Forward Blast Radius (2:00 – 2:50)

#### 🖥️ [SCREEN ACTION]
1. In the left sidebar, click **Traceability Graph** (`#traceability-graph`).
2. Show the full 6-stage canvas:
   * Point across the top stage headers: `01. Supplier`, `02. Ingredient Lot`, `03. Production Event`, `04. Finished Lot`, `05. Shipment`, `06. Destination`.
3. Point out the glowing crimson path following `LOT-CUM-2026-088` -> `PROD-EVT-4401` -> `FL-SALSA-101` -> `SHIP-8821` & `SHIP-8822` -> Destination hubs.
4. Click on node **`FL-SALSA-101`** to trigger the **Node Inspector slideover**:
   * Show properties, verified incoming/outgoing relationships, and domain explainability text: *"Why is it included?"*.
5. Click on **`FL-SALSA-103`** (orange dashed border) to show the gap explanation.
6. Click the close button on the Inspector.

#### 🎙️ [SPOKEN SCRIPT]
> "Let’s open the dedicated **Traceability Graph Explorer**. RECALLMESH projects FalkorDB’s graph topology into a deterministic six-stage supply chain canvas.
>
> In red, you see the forward blast radius: contaminated raw lot `LOT-CUM-2026-088` flows into Production Event `4401`, yielding Salsa Lot `101`, which was packed into two outbound shipments headed for California and Nevada.
>
> Clicking any node opens our real-time **Node Inspector**. It queries FalkorDB for live stored properties, incoming and outgoing edges, and explainable lineage. 
>
> And notice `FL-SALSA-103` rendered with a distinct dashed gap indicator: RECALLMESH visually represents missing records without fabricating fictitious edges."

---

### Segment 5: Action Plans, Human Governance Gate & FSMA Dossier (2:50 – 3:30)

#### 🖥️ [SCREEN ACTION]
1. In the left sidebar, click **Action Plans** (`#action-plans`).
2. Point out the banner: **Human Authorization Required (Simulation Mode)**.
3. Review the proposed actions in the table (`Warehouse Quarantine Hold`, `Carrier Stop-Shipment`, `Consignee Recall Notice`).
4. Click **"Review & Approve"** on the first quarantine action item:
   * Enter actor name (e.g., `Morgan Bailey`).
   * Click **"Authorize Action Item"**. Watch status badge update from `PROPOSED` to `APPROVED`.
5. Click the top button **"Export FSMA Dossier"**:
   * Show the Markdown preview modal displaying the formal FDA Section 204 Containment Action Plan Dossier.
   * Click **"Download Dossier (.md)"** or close the modal.

#### 🎙️ [SPOKEN SCRIPT]
> "Now we move to **Action Plans**. Traceability findings are useless without governed response. 
>
> RECALLMESH synthesizes graph traversal paths and detected gaps into actionable containment proposals. Under our **Human Governance Gate**, every action—whether internal warehouse holds, carrier stop-shipments, or consignee notices—starts in `PROPOSED` status. 
>
> No action executes without authenticated human sign-off. When QA authorizes an action, an immutable Audit Event is recorded in FalkorDB.
>
> Finally, clicking **Export FSMA Dossier** instantly compiles an audit-ready, sortable containment dossier meeting all FDA 21 CFR Section 204 evidentiary requirements."

---

### Segment 6: Real-Data Ingestion, Dataset Isolation & Conclusion (3:30 – 4:00)

#### 🖥️ [SCREEN ACTION]
1. Click the **Dataset Selector** dropdown in the top header.
2. Click **"Import New Dataset"**:
   * Briefly show the modal with **FSMA 204 JSON** and **CTE Tabular CSV** tabs.
   * Point out the pre-validation safeguards and template download options.
   * Close the modal.
3. In the Dataset Selector dropdown, select **`E2E Midwest Broiler Stream`** (or poultry dataset).
   * Show the UI instantly update root lot to `LOT-PLT-2026-401`.
   * Click **Traceability Graph** to show poultry cutlet batches rendered with complete dataset isolation.
4. Switch back to **Verdant Harvest Foods (Synthetic Demo)** to show instant clean restoration.

#### 🎙️ [SPOKEN SCRIPT]
> "Crucially, RECALLMESH isn't a hardcoded demo. Using our **Dataset Ingestion Engine**, enterprises can import real-world FSMA 204 JSON or CTE Tabular CSV files with strict in-memory schema validation and atomic rollback protection.
>
> When we switch to an independent supply chain—like this commercial poultry facility—our graph traversals, gap detections, and action plans run strictly within their isolated dataset, with zero ID collisions or stale leakage.
>
> By uniting FalkorDB's millisecond graph traversals with strict absence-of-path safety and human-gated action governance, RECALLMESH turns food traceability from a 24-hour compliance panic into an instant, evidence-backed operational shield.
>
> Thank you for exploring RECALLMESH for Graph Hacks 2026!"

---

## Pro-Tips for Recording
* **Cursor Movement:** Move your cursor smoothly and intentionally. Point directly at badges, numbers, or nodes 1 second before talking about them.
* **Pacing:** If you finish a segment ahead of time, take a 1-second breath while lingering on the visualization.
* **Resolution:** Ensure your browser is zoomed to 100% or 110% so all fonts and badges are razor-sharp on camera.
