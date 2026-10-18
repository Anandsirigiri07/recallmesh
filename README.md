# RECALLMESH: Graph-Native Food Traceability & Incident Surveillance Platform

> **Event:** Graph Hacks 2026  
> **Status:** Milestone 4B.5 Complete — Real-Data Ingestion Engine, Dataset Isolation, Interactive UI Workspaces, and Complete Submission Gate  
> **Target Database:** FalkorDB (Property Graph Engine)  
> **Frontend:** React 19 + TypeScript + Vite  
> **Backend:** FastAPI + Python 3.11  

RECALLMESH is an evidence-first, property-graph-native food safety traceability and recall containment system built on **FalkorDB**. It operationalizes FDA Food Safety Modernization Act (FSMA) Rule 204 requirements by transforming Key Data Elements (KDEs) and Critical Tracking Events (CTEs) into a connected property graph. The system provides instantaneous forward blast radius calculations, backward root-cause isolation, structural traceability gap detection, offline machine learning risk classification, human-gated digital twin containment actions, and isolated multi-supply-chain dataset management.

---

## Key System Capabilities

1. **Graph-Native Forward & Backward Traceability:** Powered by FalkorDB openCypher traversals, tracing contaminated ingredient lots forward to packaged consumer goods and distributor shipments in milliseconds, or tracing contaminated finished products backward to farm suppliers.
2. **Absence-of-Path Safety Principle:** Broken chains of custody (such as products missing transformation KDEs like `FL-SALSA-103` or `FL-CUTLET-503`) are detected and tagged as `GAP_DETECTED`. Under food safety principles, lack of records is never assumed safe.
3. **Multi-Dataset Provenance & Strict Isolation:** Supports both synthetic benchmark demonstrations and genuine, external supply chain imports (via FSMA 204 JSON or CTE Tabular CSV). Datasets are isolated in FalkorDB using dataset-scoped properties and queries, preventing ID collisions between independent supply chains.
4. **Human-in-the-Loop Governance Gate:** Containment action proposals (internal holds, stop-ship directives, consignee recalls) are created in `PROPOSED` status. They require explicit authenticated human signoff (`authorized_by`) before executing simulated digital twin containment.
5. **Offline Machine Learning Risk Advisory:** TF-IDF and Linear SVM/SGD classifiers trained on historical openFDA food enforcement reports provide recall hazard severity triage and Class I risk probabilities, accompanied by transparent statutory disclaimers.
6. **Regulatory Electronic Sortable Spreadsheets & Dossiers:** Instant generation of RFC 4180-compliant FSMA 204 CSV spreadsheets and formal Markdown containment dossiers for regulatory audit inspections.

---

## FalkorDB Property Graph Schema

### 1. Node Labels & Core Properties

| Label | Primary Key | Key Stored Properties | Description |
| :--- | :--- | :--- | :--- |
| `:Dataset` | `dataset_id` | `name`, `description`, `facility_id`, `suspect_root_lot`, `ingested_at`, `is_demo`, `ingested_by` | Registry of imported or demo supply chains. |
| `:Supplier` | `supplier_id` | `name`, `facility_type`, `gln`, `country`, `traceability_status`, `disposition`, `dataset_id`, `is_demo` | Upstream farm or raw ingredient supplier. |
| `:Ingredient` | `ingredient_id` | `common_name`, `scientific_name`, `ftl_category`, `is_food_traceability_list`, `dataset_id`, `is_demo` | Food Traceability List commodity specification. |
| `:RawLot` | `lot_code` | `received_date`, `initial_quantity_kg`, `current_quantity_kg`, `traceability_status`, `disposition`, `hazard_detected`, `pathogen_species`, `dataset_id`, `is_demo` | Received harvest or spice lot. |
| `:ProductionEvent` | `event_id` | `event_date`, `facility_id`, `production_line`, `event_type`, `dataset_id`, `is_demo` | Transformation event where raw lots are processed. |
| `:FinishedLot` | `lot_code` | `product_name`, `package_size`, `upc`, `production_date`, `expiration_date`, `traceability_status`, `disposition`, `dataset_id`, `is_demo` | Final consumer packaged goods batch. |
| `:Shipment` | `shipment_id` | `ship_date`, `carrier_name`, `tracking_number`, `shipping_disposition`, `traceability_status`, `dataset_id`, `is_demo` | Outbound logistics movement. |
| `:Location` | `location_id` | `name`, `location_type`, `gln`, `city`, `state`, `country`, `dataset_id`, `is_demo` | Distribution center or retail destination. |
| `:Evidence` | `evidence_id` | `evidence_type`, `title`, `issued_date`, `hash_sha256`, `verified_by`, `status`, `dataset_id`, `is_demo` | Analytical Certificate of Analysis (CoA) or audit proof. |
| `:EvidenceDocument` | `document_id` | `file_name`, `document_type`, `lot_code`, `file_size_bytes`, `sha256_hash`, `stored_path`, `uploaded_at` | Uploaded local PDF or image verification file. |
| `:EvidenceRequest` | `request_id` | `target_lot`, `supplier_name`, `evidence_type`, `instructions`, `requested_at`, `status`, `is_simulation` | Simulated QA supplier audit inquiry. |
| `:RecallCase` | `case_id` | `title`, `suspect_raw_lot`, `pathogen_or_hazard`, `source_facility`, `lead_investigator`, `opened_at`, `status`, `lifecycle_status`, `provisional_class`, `dataset_id` | Persistent incident docket in FalkorDB. |
| `:AuditEvent` | `audit_id` | `event_id`, `timestamp`, `actor`, `action_type`, `entity_id`, `outcome`, `details`, `is_simulation` | Immutable audit log node. |
| `:Action` | `action_id` | `action_type`, `target_id`, `status`, `initiator`, `instructions`, `authorized`, `requires_authorization`, `dataset_id` | Governed containment task item. |

### 2. Relationship Topology

```text
(:Supplier) ──[:SUPPLIES]──> (:RawLot)
(:Ingredient) ──[:ORIGINATED]──> (:RawLot)
(:RawLot) ──[:CONSUMED_IN]──> (:ProductionEvent) ──[:PRODUCED]──> (:FinishedLot)
(:FinishedLot) ──[:PACKAGED_INTO]──> (:Shipment) ──[:SHIPPED_TO]──> (:Location)
(:Evidence) ──[:SUPPORTS]──> (:RawLot | :FinishedLot)
(:RecallCase) ──[:INVESTIGATES]──> (:RawLot)
```

### 3. Production openCypher Queries

#### Forward Blast Radius Traversal
```cypher
MATCH (raw:RawLot {lot_code: $raw_lot_code})
WHERE ($clean_ds IS NULL OR raw.dataset_id = $clean_ds OR (raw.dataset_id IS NULL AND $clean_ds = 'demo'))
MATCH (raw)-[:CONSUMED_IN]->(pe:ProductionEvent)-[:PRODUCED]->(fl:FinishedLot)
WHERE ($clean_ds IS NULL OR pe.dataset_id = $clean_ds OR (pe.dataset_id IS NULL AND $clean_ds = 'demo'))
MATCH (fl)-[:PACKAGED_INTO]->(s:Shipment)-[:SHIPPED_TO]->(dest:Location)
WHERE ($clean_ds IS NULL OR s.dataset_id = $clean_ds OR (s.dataset_id IS NULL AND $clean_ds = 'demo'))
RETURN fl.lot_code AS finished_lot,
       fl.product_name AS product_name,
       s.shipment_id AS shipment_id,
       dest.name AS destination,
       s.shipping_disposition AS shipment_status
```

#### Backward Provenance Traversal
```cypher
MATCH (fl:FinishedLot {lot_code: $finished_lot_code})
WHERE ($clean_ds IS NULL OR fl.dataset_id = $clean_ds OR (fl.dataset_id IS NULL AND $clean_ds = 'demo'))
OPTIONAL MATCH (pe:ProductionEvent)-[:PRODUCED]->(fl)
WHERE ($clean_ds IS NULL OR pe.dataset_id = $clean_ds OR (pe.dataset_id IS NULL AND $clean_ds = 'demo'))
OPTIONAL MATCH (raw:RawLot)-[:CONSUMED_IN]->(pe)
WHERE ($clean_ds IS NULL OR raw.dataset_id = $clean_ds OR (raw.dataset_id IS NULL AND $clean_ds = 'demo'))
OPTIONAL MATCH (sup:Supplier)-[:SUPPLIES]->(raw)
WHERE ($clean_ds IS NULL OR sup.dataset_id = $clean_ds OR (sup.dataset_id IS NULL AND $clean_ds = 'demo'))
OPTIONAL MATCH (ing:Ingredient)-[:ORIGINATED]->(raw)
RETURN fl.lot_code AS finished_lot,
       pe.event_id AS event_id,
       raw.lot_code AS raw_lot,
       sup.name AS supplier_name,
       ing.common_name AS ingredient
```

#### Absence-of-Path Traceability Gap Detection
```cypher
MATCH (fl:FinishedLot)
WHERE ($clean_ds IS NULL OR fl.dataset_id = $clean_ds OR (fl.dataset_id IS NULL AND $clean_ds = 'demo'))
  AND NOT ( (:ProductionEvent)-[:PRODUCED]->(fl) )
RETURN fl.lot_code AS unlinked_finished_lot,
       fl.product_name AS product_name,
       fl.disposition AS disposition
```

#### Multi-Statement Rollback on Ingestion Failure
```cypher
MATCH (n {dataset_id: $dataset_id})
DETACH DELETE n
```

---

## Real-Data Ingestion & Safety Engine

RECALLMESH is built to ingest and investigate real-world supply chain datasets alongside the default synthetic demo.

### 1. Ingestion Formats
- **FSMA 204 JSON:** Structured object containing `dataset_metadata`, `suppliers`, `ingredients`, `raw_lots`, `production_events`, `finished_lots`, `locations`, `shipments`, and optional `evidence`.
- **CTE Tabular CSV:** FSMA 204 Critical Tracking Events in spreadsheet format (`RECEIVING`, `TRANSFORMATION`, `SHIPPING`) containing TLC lot codes, source/destination GLNs, and quantities.

### 2. Pre-Ingestion In-Memory Validation
Before writing a single record to FalkorDB, the ingestion engine enforces strict rules:
- Mandatory metadata: `dataset_id` and `name`.
- Entity identifier uniqueness: Rejects duplicate supplier IDs, ingredient IDs, raw lot codes, or event IDs.
- Referential integrity: Confirms every raw lot references an existing supplier and ingredient, every production event references declared raw lots, and every shipment references declared finished lots and locations.
- Rejection: Fails cleanly with HTTP 422 Unprocessable Content and an array of specific, actionable error messages.

### 3. Import Safety & Idempotency
- **Zero-Write on Validation Failure:** If in-memory validation fails, zero nodes or relationships are created.
- **Rollback on Socket/DB Disruption:** If a database error occurs partway through writing, an automated rollback executes `MATCH (n {dataset_id: $id}) DETACH DELETE n`, restoring the database to a clean pre-import state.
- **Idempotent Upsert:** Re-importing identical records uses Cypher `MERGE` semantics with scoped `dataset_id`, preventing duplicate nodes and relationships.
- **Audit Deduplication:** Repeated imports of the same dataset update or reuse the existing `AuditEvent` node rather than polluting the ledger.

---

## Tested Windows Setup & Quickstart

### 1. Prerequisites
- **OS:** Windows 10/11
- **Python:** 3.11+ (virtual environment located at `.venv`)
- **Node.js:** v18+ and npm
- **Docker Desktop:** Installed and running

### 2. Environment Configuration
Copy `.env.example` to `.env` in the project root:
```dotenv
# Select Target: 'local' (Docker) or 'cloud' (FalkorDB Cloud)
FALKORDB_TARGET=local

# 1. Local Docker FalkorDB Configuration
FALKORDB_HOST=127.0.0.1
FALKORDB_PORT=6379
FALKORDB_GRAPH_NAME=recallmesh
FALKORDB_SSL=false

# 2. FalkorDB Cloud Configuration (Active when FALKORDB_TARGET=cloud)
FALKORDB_CLOUD_HOST=your-instance.falkordb.cloud
FALKORDB_CLOUD_PORT=61068
FALKORDB_CLOUD_USERNAME=falkordb
FALKORDB_CLOUD_PASSWORD=your_password_here
FALKORDB_CLOUD_SSL=false
FALKORDB_CLOUD_GRAPH=recallmesh

# Storage & API Settings
UPLOAD_DIR=./uploads
EVIDENCE_MAX_FILE_SIZE_MB=10
FASTAPI_HOST=127.0.0.1
FASTAPI_PORT=8000
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### 3. Start Local FalkorDB Container (for Local mode)
```powershell
docker compose up -d
docker ps --filter "name=recallmesh-falkordb"
```

### 4. Launch Backend API Server
```powershell
.\.venv\Scripts\python.exe -m uvicorn src.recallmesh.api.app:app --host 127.0.0.1 --port 8000 --env-file .env
```
Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)  
Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 5. Launch Frontend Dev Server
In a second PowerShell terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open your browser to: [http://127.0.0.1:5173](http://127.0.0.1:5173)

### 6. Loading the Synthetic Demo Scenario
To populate or refresh the baseline demonstration scenario into your FalkorDB instance:
```powershell
.\.venv\Scripts\python.exe -m src.recallmesh.cli seed --fixture data/demo/recall_scenario.json
```

---

## Interactive Demo Walkthrough (Root Lot: LOT-CUM-2026-088)

RECALLMESH includes a deterministic, verified demonstration scenario modeled around FSMA 204 critical tracking events:

1. **Supply-Chain Receipt:** Salinas Processing Facility (`FAC-SALINAS-01`) receives two ingredient lots:
   - **`LOT-CUM-2026-088` (Suspect Lot):** Organic ground cumin from Apex Spice Co. (`SUP-APEX-01`), flagged with positive *Salmonella enterica* PCR evidence (`EV-PCR-SAL-2026-088`).
   - **`LOT-CUM-2026-090` (Clean Control Lot):** Clean cumin lot from Summit Organics (`SUP-SUMMIT-02`).
2. **Forward Blast Radius Traversal:** In the **Investigation Workspace**, selecting `LOT-CUM-2026-088` traverses downstream through transformation event `PROD-EVT-4401` to packaged finished goods `FL-SALSA-101` (*Artisan Roasted Salsa 16oz*), and onward to outbound distributor shipments `SHIP-2026-901` and `SHIP-2026-902`.
3. **Surgical Precision (Zero False Positives):** The clean control lot `LOT-CUM-2026-090` was transformed under `PROD-EVT-4402` into `FL-SALSA-102`. RECALLMESH traces the graph boundary and completely excludes `FL-SALSA-102` from containment plans, preventing unnecessary food waste and unwarranted supply chain disruption.
4. **Absence-of-Path Gap Detection:** Finished lot `FL-SALSA-103` is discovered in the warehouse without recorded transformation CTE links to any ingredient lot. Under RECALLMESH's food safety principles, missing records are never assumed safe; it is automatically flagged as `GAP_DETECTED` with an urgent QA triage hold task.
5. **Governance Containment Execution:** The **Action Plans Workspace** generates structured containment directives (`INTERNAL_HOLD`, `CARRIER_STOP_SHIP`, `CONSIGNEE_RECALL_NOTICE`). Under human-in-the-loop governance gates, actions remain `PROPOSED` until an authorized QA Lead provides authenticated signoff.

---

## Verification & Test Results

### 1. Backend Test Suite (91 Passing Tests)
```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```
```text
======================= 91 passed, 4 warnings in 5.28s ========================
```
Covers:
- `tests/test_connection_config.py`: Local defaults, Cloud mode resolution, TLS parsing, driver argument passing, dependency injection, and health ping behavior.
- `tests/test_dataset_ingestion.py`: In-memory schema validation, duplicate ID rejection, referential integrity blocks, poultry sample ingestion, CSV CTE parsing, rollback verification, audit deduplication, and cross-dataset isolation with identical lot IDs.
- `tests/test_persistent_workflows.py`: Live CTE extraction, investigation docket creation, PDF/image magic-byte upload validation, supplier request simulation, and audit trail persistence.
- `tests/test_api.py`: REST routes, health checks, downstream/upstream tracing, node inspector, 6-stage serialization, ML inference, and governance execution gates.
- `tests/test_recallmesh_graph.py`: Graph foundation, idempotent seeding, blast radius, control lot protection, gap detection, and graph ablation tests.
- `tests/test_recall_classifier.py`: Offline ML pipeline, disjoint-set grouping, zero-leakage chronological evaluation, and binary thresholding.

### 2. Frontend Test Suite (43 Passing Tests across 6 Suites)
```powershell
cd frontend
npm test -- --run
```
```text
Test Files  6 passed (6)
     Tests  43 passed (43)
```
Covers:
- `DatasetIngestionFlow.test.tsx`: Dataset dropdown selector, switching active datasets, loading templates, modal import submission, and 422 actionable validation error chips.
- `InvestigationWorkspace.test.tsx`: 3-column triage layout, unlinked gap indicator on `FL-SALSA-103`, and supplier request modal.
- `TraceabilityGraphExplorer.test.tsx`: Deterministic 6-stage canvas, category filter chips, and interactive node inspector slideover.
- `ActionPlansWorkspace.test.tsx`: Proposed containment actions, governance signoff gate, and FSMA dossier markdown export.
- `OverviewDashboard.test.tsx`: Graph metrics, CTE ledger tabs, audit timeline, and ML risk advisory panel.
- `AppShell.test.tsx`: Navigation shell, global search modal, and persistent layouts.

### 3. Production Build
```powershell
cd frontend
npm run build
```
```text
✓ 44 modules transformed.
dist/index.html                   1.04 kB │ gzip:   0.54 kB
dist/assets/index-Ckht5Kxk.css    6.07 kB │ gzip:   1.74 kB
dist/assets/index-D4zberLj.js   439.89 kB │ gzip: 108.59 kB
✓ built in 4.65s with 0 errors
```

---

## Safety Limitations & Disclaimers

1. **Digital Twin Simulation Only:** Containment commands (`INTERNAL_HOLD`, `CARRIER_STOP_SHIP`, `CONSIGNEE_RECALL_NOTICE`) and supplier evidence requests are digital twin dry-run simulations. No live external warehouse WMS locks, logistics reroutes, or external emails/webhooks are transmitted.
2. **Offline ML Advisory Tool:** Machine learning risk scores provide exploratory decision support based on historical openFDA recall patterns. They are not automated recall orders or definitive microbiological diagnoses. Every ML response includes statutory research disclaimers.
3. **Research Prototype Notice:** RECALLMESH is a research and hackathon prototype submitted to Graph Hacks 2026. It is not certified by the FDA, USDA, or EFSA.

---

## AI Tool Disclosure

In compliance with Graph Hacks 2026 submission guidelines:
- **Antigravity AI Assistant:** Used as an interactive pair-programming companion for architecture design, unit test authoring, TypeScript interface validation, and frontend component composition.
- **FalkorDB Cypher & Graph Algorithms:** All graph algorithms, openCypher queries, and data models were designed, implemented, and verified against the live local FalkorDB Docker engine.
- **Machine Learning Models:** Trained offline on historical openFDA enforcement reports using Scikit-learn pipelines with explicit disjoint-set grouped evaluation to ensure zero target leakage.
