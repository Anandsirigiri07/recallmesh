# RECALLMESH — Milestone 3: Strict Stitch UI Integration Plan

> **Authoritative Specification Document**  
> **Status:** Milestone 4A (FastAPI Backend), Milestone 4B.1 (Frontend Foundation), and Milestone 4B.1.1 (Live-Data Integrity & Persistent Workflows) Implemented & Verified  
> **Milestone:** 3 Complete (Planning) / 4A Complete (FastAPI Service Layer) / 4B.1 Complete (Overview Dashboard & Shell) / 4B.1.1 Complete (Live-Data Integrity Audit, Persistent Workflows & Functional Correction)  
> **Target Platform:** React + Vite + Vanilla CSS / Modern CSS Variables  
> **Design Source:** Google Stitch Export (`design-reference/stitch_recallmesh_food_traceability_platform/`)  
> **Backend & Data Foundation:** FalkorDB Property Graph + Offline Scikit-Learn ML Pipelines + FastAPI Service Layer  

---

## 1. Executive Summary & Design System Fidelity

### 1.1 Purpose and Scope
This document outlines the strict engineering blueprint for integrating the authoritative Google Stitch UI export into **RECALLMESH**, an enterprise-grade agentic food safety traceability platform built for the **Graph Hacks 2026** competition.

This plan enforces:
1. **Visual Strictness:** Exact adherence to the exported Google Stitch design system ("Serene Traceability") without replacing the warm, high-trust archival palette with a generic dark dashboard or arbitrary styling.
2. **Behavioral Integrity:** FalkorDB and the verified Python backend remain the authoritative source of truth. Frontend JavaScript handles rendering, navigation, and reactive state, but **never** fabricates graph traversals, mock metrics, or hardcoded containment outcomes.
3. **Model Transparency:** Offline machine learning models (`models/recall_classifier.joblib`, `models/recall_classifier_improved.joblib`, `models/recall_classifier_binary.joblib`) are integrated as advisory triage classifiers with mandatory research disclaimers, clear distinction between research predictions and confirmed evidence, and no exaggerated accuracy claims.
4. **Safety & Governance:** Traceability status (`VERIFIED`, `GAP_DETECTED`, `UNKNOWN`) is strictly decoupled from physical disposition (`AVAILABLE`, `QUARANTINED`). The absence of an evidence path is never interpreted as proof of safety. All containment actions (holds, carrier stops, consignee notices) are dry-run simulations gated by explicit human QA authorization.

---

### 1.2 Authoritative Design System: "Serene Traceability"

The Stitch design system (`serene_traceability/DESIGN.md`) establishes a clinical, high-trust editorial environment designed to counteract urgency-induced stress during high-stakes product recalls.

#### Color System Tokens
```css
:root {
  /* Canvas Substrate & Surfaces */
  --color-canvas-bg: #FAF6EC;           /* Warm archival parchment */
  --color-surface-card: #FFFFFF;         /* Pure white container surface */
  --color-surface-low: #E6F7F1;          /* Subtle tinted container low */
  --color-surface-dim: #CDDED8;          /* Surface dim border */
  --color-surface-high: #DBECE6;         /* Surface container high */

  /* Primary Accent & Typography */
  --color-primary: #337A68;              /* Deep sage / teal green accent */
  --color-primary-hover: #2B6758;        /* Darker primary hover */
  --color-primary-dark: #136150;         /* Primary container header / active */
  --color-text-primary: #24332F;         /* Deep spruce black (high contrast) */
  --color-text-secondary: #69736E;       /* Muted lichen slate */
  --color-border: #E7E3D9;               /* Hairline border framing token */
  --color-border-subtle: #bec9c4;        /* Outline variant */

  /* Status Tokens & 12% Lineage Tints */
  /* 1. Affected Path (Contaminated / Direct Blast Radius) */
  --color-status-affected-solid: #E77861;
  --color-status-affected-tint: rgba(231, 120, 97, 0.12);
  --color-status-affected-text: #B34732;

  /* 2. Record Verified (Certified Clean / Normal Lineage) */
  --color-status-verified-solid: #579779;
  --color-status-verified-tint: rgba(87, 151, 121, 0.12);
  --color-status-verified-text: #34654F;

  /* 3. Needs Review (Pending Action / Interrupted CTE) */
  --color-status-review-solid: #D9A638;
  --color-status-review-tint: rgba(217, 166, 56, 0.12);
  --color-status-review-text: #8F6617;

  /* 4. Unknown Link (Gap Detected / Missing Link / Unconfirmed) */
  --color-status-unknown-solid: #9682CE;
  --color-status-unknown-tint: rgba(150, 130, 206, 0.12);
  --color-status-unknown-text: #5F4B96;

  /* Typography & Spacing */
  --font-family-base: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px (Stitch Card Default) */
  --radius-full: 9999px;  /* Pill geometry for badges */
}
```

#### Typography Standards
- **Font:** Google Font **DM Sans** exclusively across all elements.
- **Headings:** Tightened letter-spacing (`-0.02em` to `-0.01em`) for high-density legibility.
- **Batch IDs, Timestamps, and GTIN Codes:** Styled with `font-variant-numeric: tabular-nums;` to guarantee alignment across tabular ledgers.

---

## 2. Inventory of Exported Stitch Screens & Layouts

Inspection of `design-reference/stitch_recallmesh_food_traceability_platform/stitch_recallmesh_food_traceability_platform/` revealed 8 distinct screens/variants plus the master design system:

| # | Screen Directory / Artifact | Screen Type | Target Viewport | Key Visual & Functional Role |
|---|-----------------------------|-------------|-----------------|------------------------------|
| **1** | `overview_recallmesh/` | Dashboard | Desktop (>=1024px) | Operational monitor, stat cards, current active case summary, "Waiting for you" decision cards, live activity audit timeline, autonomous agents monitor, and electronic sortable CTE ledger table. |
| **2** | `investigations_recallmesh/` | Investigation Workspace | Desktop (>=1024px) | Active case `INV-2026-088` 3-column layout: Left Case Reference + Provisional Model Estimate + Legend; Center 6-stage CTE graph canvas with SVG connectors + collapsible explainability drawer; Right Node Inspector showing affected finished lot `FL-SALSA-101`. |
| **3** | `investigation_fl_salsa_103_gap_recallmesh/` | Gap Investigation | Desktop (>=1024px) | Focused variation of the Investigation Workspace with `FL-SALSA-103` selected. Features floating "Missing link" badge, dashed lavender connector, "Gap detected" badge, and "Open QA evidence request" action. |
| **4** | `investigation_tablet_820x1180_recallmesh/` | Responsive Variant | Tablet (820x1180) | 8-column layout. Top collapsed hamburger navigation, horizontal swipeable graph canvas placed first for immediate triage, followed by vertically stacked Case Details, Model Estimate, and Node Inspector. |
| **5** | `investigation_phone_390x844_recallmesh/` | Responsive Variant | Mobile (390x844) | 4-column compact layout (390px width). Compact header with demo pill, horizontal swipeable 6-column graph canvas with swipe prompt, followed by stacked compact cards and full-width action buttons. |
| **6** | `traceability_graph_recallmesh/` | Dedicated Graph Explorer | Desktop (>=1024px) | Dedicated full-canvas graph exploration view. Filter toggle ("Affected paths only" vs "All records"), category chips (Lots, Shipments, Suppliers, Evidence, Locations), canvas zoom/reset toolbar, path breadcrumb bar, and empty-to-active inspector dock. |
| **7** | `action_plans_recallmesh/` | Governance & Containment | Desktop (>=1024px) | Dry-run containment staging. Simulation Guardrail Alert Banner ("Simulated actions only..."), proposed action cards queue, detailed review panel with 3-step approval pipeline (Proposed $\rightarrow$ Approved $\rightarrow$ Simulated), Before vs After comparison, and FSMA 204.145 action audit trail. |
| **8** | `agent_memory_company_brain_recallmesh/` | Memory & Knowledge Base | Desktop (>=1024px) | Persistent situational awareness view. Past investigations list, institutional fact cards ("What we remember"), active agent handover card (Tracer $\rightarrow$ Response Planner), connected entity matrix (People, Teams, Suppliers, Products, Procedures), and 3-step provenance trail. |
| **9** | `serene_traceability/DESIGN.md` | Design System Spec | Documentation | Master design specification detailing tokens, elevations, typography, border-radiuses, button states, and editorial philosophy. |

---

## 3. Comprehensive Control-by-Control Mapping Matrix

Every exported HTML element, interactive button, input field, and visual card is mapped below to its corresponding React component, state lifecycle, backend endpoint, FalkorDB/ML operation, and acceptance test.

### 3.1 Global Application Shell & Navigation

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **App Shell / Sidebar** | `overview_recallmesh/code.html:L4` | `<AppShell>`, `<Sidebar>` | `activeTab: 'overview' \| 'investigations' \| 'traceability-graph' \| 'action-plans' \| 'agent-memory' \| 'company-brain'` | Client-side routing / state | N/A (UI layout) | `test_navigation_routing` |
| **FSMA 204 Verified Node Badge** | Sidebar bottom | `<VerifiedNodeBadge>` | Static verification badge indicating local node state (`US-CENTRAL-01`) | `GET /api/system/status` | `graph.query("RETURN 1")` | `test_database_ping` |
| **Global Search Bar** | Header center | `<GlobalSearchBar>` | `searchQuery: string`, `onSearch()`, debounce 250ms | `GET /api/search?q={query}` | `MATCH (n) WHERE n.lot_code CONTAINS $q OR n.name CONTAINS $q RETURN n` | `test_global_search_lots` |
| **Demo Data Pill** | Header center right | `<DemoDataBadge>` | Visual indicator ("Demo data" pill) | Static config | Synthetic assurance banner | `test_demo_mode_guardrail` |
| **"New Investigation" Button** | Header top right | `<NewInvestigationModal>` | `isOpen: boolean`, modal form with `raw_lot_code`, `hazard_description` | `POST /api/cases` | Creates `:RecallCase` node linked to suspect lot in FalkorDB | `test_case_creation` |
| **User Profile Avatar** | Header right | `<UserAvatar>` | Displays current simulated role ("QA Food Safety Lead") | `GET /api/auth/current-user` | Reads simulated session context | `test_user_session_context` |

---

### 3.2 Screen 1: Overview Dashboard (`overview_recallmesh`)

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **Stat Card 1: Shipments Traced** | `overview_recallmesh/code.html:L26-47` | `<MetricCard>` | Value (`2`), label ("Shipments traced"), subtext ("Downstream nodes: 14", "Normal Velocity") | `GET /api/overview/metrics` | Counts `:Shipment` connected to active investigation lots | `test_downstream_tracing_affected_lot` |
| **Stat Card 2: Record Needs Review** | `overview_recallmesh/code.html:L49-67` | `<MetricCard>` | Value (`1`), badge ("Action Pending"), subtext ("Lot: LOT-MIX-41", "Interrupted CTE") | `GET /api/overview/metrics` | Queries lots with `traceability_status = 'NEEDS_REVIEW'` | `test_traceability_gap_detection_and_safety_rule` |
| **Stat Card 3: Gap Open in Chain** | `overview_recallmesh/code.html:L69-87` | `<MetricCard>` | Value (`1`), badge ("Missing TLC"), subtext ("Supplier CoA pending", "KDE unconfirmed") | `GET /api/overview/metrics` | `detect_traceability_gaps(graph)` count for orphan lots | `test_traceability_gap_detection_and_safety_rule` |
| **Current Case Card: Case Details** | `overview_recallmesh/code.html:L94-126` | `<CurrentCaseCard>` | Case ID (`INC-2026-0814`), suspect lot (`LOT-CUM-2026-088`), contaminant (*Salmonella enterica*), source facility | `GET /api/cases/current` | `MATCH (c:RecallCase)-[:INVESTIGATES]->(r:RawLot) ...` | `test_upstream_root_cause_isolation` |
| **Current Case: Evidence Progress Bar** | `overview_recallmesh/code.html:L128-152` | `<EvidenceProgressBar>` | Segmented progress bar (68% verified, 17% pending, 15% missing) based on KDE checklist | `GET /api/cases/{id}/evidence-progress` | Compares logged CTEs against FSMA 204 required Key Data Elements | `test_evidence_progress_tracking` |
| **"View Graph" Button** | `overview_recallmesh/code.html:L160-163` | `<Button>` | Navigates to `/traceability-graph` or `/investigations` with active case preselected | Client route transition | N/A | `test_navigation_routing` |
| **"Open Investigation" Button** | `overview_recallmesh/code.html:L164-168` | `<Button>` | Primary CTA navigating directly to `/investigations` with case loaded | Client route transition | N/A | `test_navigation_routing` |
| **"Waiting for You" Item 1: Hold SHIP-8821** | `overview_recallmesh/code.html:L183-210` | `<PendingDecisionCard>` | Action item, "Review & Approve" button, "Dismiss" button | `POST /api/actions/{id}/approve`, `POST /api/actions/{id}/dismiss` | `execute_containment_action_plan()` with human signature | `test_containment_action_plan_governance_gate` |
| **"Waiting for You" Item 2: QA Request FL-SALSA-103** | `overview_recallmesh/code.html:L213-240` | `<PendingDecisionCard>` | Action item for missing lab certificate, "Upload Certificate", "Request from Supplier" | `POST /api/evidence/request` | Creates pending `:EvidenceRequest` node in FalkorDB | `test_evidence_request_creation` |
| **Recent Activity Timeline** | `overview_recallmesh/code.html:L246-311` | `<ActivityTimeline>` | Chronological audit trail (Tracer mapped nodes, Supplier uploaded BOL, Discrepancy flagged) | `GET /api/audit/timeline` | `MATCH (a:ActionAudit) RETURN a ORDER BY a.timestamp DESC LIMIT 10` | `test_activity_audit_timeline` |
| **Active Autonomous Agents Card** | `overview_recallmesh/code.html:L313-367` | `<AgentsMonitorCard>` | Real-time agent status (Tracer Agent: Working, Memory Keeper: Idle, Response Planner: Waiting) | `GET /api/agents/status` | In-memory agent coordinator status | `test_agent_status_reflection` |
| **Active CTEs Sortable Table** | `overview_recallmesh/code.html:L371-461` | `<CTELedgerTable>` | Sortable table with TLC, Event Type, Facility, Timestamp, Status, Inspect action | `GET /api/cte/events` | `MATCH (e:CriticalTrackingEvent) ... RETURN e` | `test_cte_ledger_table_sorting` |
| **"Export Electronic Spreadsheet" Button** | `overview_recallmesh/code.html:L382-386` | `<Button>` | Triggers CSV/XLSX download conforming to FDA FSMA 204 24-hour electronic sortable spreadsheet requirement | `GET /api/export/fsma-204-spreadsheet` | Serializes graph CTEs into FDA sortable format | `test_fsma_sortable_export` |

---

### 3.3 Screens 2 & 3: Investigation Workspace (`investigations_recallmesh` & `investigation_fl_salsa_103_gap_recallmesh`)

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **Investigation Breadcrumb & Session Ribbon** | `investigations_recallmesh/code.html:L7-21` | `<InvestigationHeader>` | Breadcrumb (`INV-2026-088`), active session badge, Export and Alert Protocol buttons | `GET /api/cases/{id}` | Fetches case metadata from FalkorDB | `test_case_metadata_retrieval` |
| **Card 1: Case Details Panel** | `investigations_recallmesh/code.html:L38-66` | `<CaseDetailsCard>` | Suspect lot code (`LOT-CUM-2026-088`), contaminant, opened timestamp, lead, impact area | `GET /api/cases/{id}` | `MATCH (c:RecallCase) RETURN c` | `test_case_details_display` |
| **Card 2: Provisional Model Estimate Card** | `investigations_recallmesh/code.html:L68-96` | `<ModelEstimateCard>` | Predicted category (e.g. `Class I`), confidence (e.g. `78.4%`), status badge (`Provisional`), legal disclaimer | `POST /api/ml/predict-risk` | `predict_recall_risk()` using `models/recall_classifier_improved.joblib` | `test_model_inference_endpoint` |
| **Model Disclaimer Notice** | `investigations_recallmesh/code.html:L90-95` | `<DisclaimerNotice>` | Mandatory statutory text: "This estimate does not decide recall scope, product safety or approval. Final sign-off required by designated QA Manager." | Model output disclaimer | `RESEARCH_DISCLAIMER` constant from `src/recallmesh/ml/pipeline.py` | `test_model_disclaimer_presence` |
| **Card 3: Path Legend** | `investigations_recallmesh/code.html:L98-128` | `<PathLegendCard>` | 4 pill indicators: Affected path (Coral), Record verified (Sage), Needs review (Marigold), Unknown link (Lavender) | Static component | Visual tokens matching `DESIGN.md` | `test_legend_color_tokens` |
| **Graph Toolbar: Zoom In / Out / Reset** | `investigations_recallmesh/code.html:L135-148` | `<GraphControls>` | `scale: number` (0.7 to 1.4), `onZoomIn()`, `onZoomOut()`, `onFitScreen()` | SVG canvas transform | Local component viewport scaling | `test_graph_zoom_transform` |
| **Graph Toolbar: Node Filter Dropdown** | `investigations_recallmesh/code.html:L150-156` | `<Dropdown>` | Filter nodes by stage or status (e.g. "All nodes (7 of 7)") | Client-side filter | Graph node visibility filtering | `test_graph_node_filter` |
| **Graph Canvas: 6-Stage Column Headers** | `investigations_recallmesh/code.html:L166-185` | `<StageHeaders>` | Column labels: 01. Supplier, 02. Ing. Lot, 03. Production, 04. Finished Lot, 05. Shipment, 06. Destination | Layout scaffold | 6-stage FSMA 204 progression | `test_stage_headers_alignment` |
| **Graph Canvas: SVG Connector Layer** | `investigations_recallmesh/code.html:L188-214` | `<SvgConnectors>` | Dynamic SVG `<path>` and `<marker>` definitions. Solid coral for affected paths, dashed lavender for missing links, muted dashed grey for unaffected | `GET /api/trace/graph/{lot_code}` | Serialized edge array from `trace_downstream(graph)` | `test_downstream_tracing_affected_lot` |
| **Supply Mesh Node: Supplier** | `investigations_recallmesh/code.html:L215-228` | `<SupplyMeshNode>` | Sunrise Spice Co., Facility TX-4, green left strip, clickable | `onClick(nodeId)` | `MATCH (s:Supplier) ...` | `test_upstream_root_cause_isolation` |
| **Supply Mesh Node: Raw Lot** | `investigations_recallmesh/code.html:L229-242` | `<SupplyMeshNode>` | LOT-CUM-2026-088, coral border, "Tainted", clickable | `onClick(nodeId)` | `MATCH (r:RawLot) ...` | `test_downstream_tracing_affected_lot` |
| **Supply Mesh Node: Production Event** | `investigations_recallmesh/code.html:L243-256` | `<SupplyMeshNode>` | Salsa blend run, Batch PR-9042, coral border, clickable | `onClick(nodeId)` | `MATCH (p:ProductionEvent) ...` | `test_downstream_tracing_affected_lot` |
| **Supply Mesh Node: Finished Lot FL-101** | `investigations_recallmesh/code.html:L259-273` | `<SupplyMeshNode>` | FL-SALSA-101, affected coral border, ring-2 ring-primary when selected | `selectedNodeId === 'FL-SALSA-101'` | `MATCH (f:FinishedLot {lot_code: 'FL-SALSA-101'})` | `test_downstream_tracing_affected_lot` |
| **Supply Mesh Node: Unaffected FL-102** | `investigations_recallmesh/code.html:L274-289` | `<SupplyMeshNode>` | FL-SALSA-102, muted, "Outside recorded path. Not safe." | `onClick(nodeId)` | Spared control lot query | `test_downstream_tracing_spares_control_lot` |
| **Supply Mesh Node: Gap Node FL-103** | `investigation_fl_salsa_103_gap_recallmesh/code.html:L290-310` | `<SupplyMeshNode>` | FL-SALSA-103, tertiary marigold/lavender border, floating "Missing link" badge | `selectedNodeId === 'FL-SALSA-103'` | `detect_traceability_gaps(graph)` | `test_traceability_gap_detection_and_safety_rule` |
| **Supply Mesh Nodes: Shipments (8821, 8822)** | `investigations_recallmesh/code.html:L312-339` | `<SupplyMeshNode>` | SHIP-8821 (420 cases), SHIP-8822 (180 cases), coral borders | `onClick(nodeId)` | `MATCH (s:Shipment) ...` | `test_downstream_tracing_affected_lot` |
| **Supply Mesh Nodes: Destinations** | `investigations_recallmesh/code.html:L341-368` | `<SupplyMeshNode>` | Northgate DC (Regional Hub), Lakeside Retail (Direct Market) | `onClick(nodeId)` | `MATCH (l:Location) ...` | `test_downstream_tracing_affected_lot` |
| **Collapsible Agent Explainability Drawer** | `investigations_recallmesh/code.html:L372-394` | `<AgentExplainabilityDrawer>` | `isExpanded: boolean`, toggle chevron, text explaining how agent correlated BOL with MES log | `GET /api/agent/explain/{case_id}` | Heuristic synthesis of verified CTEs | `test_agent_explainability_content` |
| **Node Inspector: Affected Finished Lot** | `investigations_recallmesh/code.html:L398-456` | `<NodeInspector>` | ID, Title, affected badge, source record, type, linked from, linked to, "Why it is included", "View evidence" button | `GET /api/nodes/{id}/inspector` | Detail query for selected node | `test_node_inspector_affected_lot` |
| **Node Inspector: Gap Node FL-103** | `investigation_fl_salsa_103_gap_recallmesh/code.html:L398-456` | `<NodeInspector>` | Title (`FL-SALSA-103`), "Gap detected" badge, "Missing WMS Link", "Why it is included: We could not find a record linking this lot to a production run", "Open QA evidence request" button | `GET /api/nodes/FL-SALSA-103/inspector` | Gap inspection query | `test_node_inspector_gap_node` |

---

### 3.4 Screen 4: Containment Action Plans & Approval Gate (`action_plans_recallmesh`)

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **Simulation Guardrail Banner** | `action_plans_recallmesh/code.html:L25-31` | `<SimulationAlertBanner>` | High-visibility amber banner: "Simulated actions only. Nothing real is stopped or sent. Production warehouse management systems (WMS) remain unaffected." | Static banner | Demonstrates safety compliance guardrail | `test_simulation_guardrail_present` |
| **Proposed Actions Queue (Left Col)** | `action_plans_recallmesh/code.html:L36-135` | `<ActionQueueList>`, `<ActionQueueCard>` | `selectedActionId: string`, list of proposed actions (`ACT-0019`, `ACT-0020`, `ACT-0021`, `ACT-0022`) | `GET /api/actions/plan?raw_lot_code=...` | `build_containment_action_plan(graph, raw_lot_code)` | `test_containment_action_plan_governance_gate` |
| **Selected Action Detail: Header & Meta** | `action_plans_recallmesh/code.html:L140-157` | `<ActionReviewHeader>` | Action title, status badge ("Proposed"), trigger ID, initiator, target facility, "Export Plan" button | `GET /api/actions/{id}` | Fetches individual action details | `test_action_detail_retrieval` |
| **Section 1: Why - Evidence Lineage** | `action_plans_recallmesh/code.html:L158-203` | `<ActionEvidenceLineage>` | 3-step visual chain: Origin (Sunrise Spice) $\rightarrow$ Contaminant (LOT-CUM-2026-088) $\rightarrow$ Interception (PR-9042) | Graph path serialization | `trace_downstream()` evidence references | `test_downstream_tracing_affected_lot` |
| **Section 2: Now vs After Approval** | `action_plans_recallmesh/code.html:L204-274` | `<StateComparisonCard>` | 2-column comparative panel: "Now (Current State)" vs "After Approval (Simulation Impact)" | Dynamic delta computation | Computes projected containment diff | `test_containment_state_comparison` |
| **Section 3: 3-Step Approval Pipeline** | `action_plans_recallmesh/code.html:L276-321` | `<ApprovalPipelineStepper>` | Stepper: 1. Proposed (Active) $\rightarrow$ 2. Approved (Gate) $\rightarrow$ 3. Simulated (Digital Twin Run) | Step status indicator (`1 \| 2 \| 3`) | Transitions upon execution | `test_containment_action_plan_governance_gate` |
| **Action Control: "Approve Simulated Action"** | `action_plans_recallmesh/code.html:L325-328` | `<Button>` (Primary) | Opens signature modal; calls execution endpoint with QA Lead name | `POST /api/actions/{id}/execute` | `execute_containment_action_plan(graph, plan, authorized_by)` | `test_containment_action_plan_governance_gate` |
| **Action Control: "Request Changes"** | `action_plans_recallmesh/code.html:L329-332` | `<Button>` (Secondary) | Opens change request drawer, adds comment to action | `POST /api/actions/{id}/request-changes` | Updates action note in FalkorDB | `test_action_request_changes` |
| **Action Control: "Block"** | `action_plans_recallmesh/code.html:L334-337` | `<Button>` (Destructive/Red) | Marks action as `BLOCKED_BY_POLICY` with mandatory rationale | `POST /api/actions/{id}/block` | Sets action status to `BLOCKED` | `test_action_block_execution` |
| **Section 5: Action Audit Trail** | `action_plans_recallmesh/code.html:L339-374` | `<ActionAuditTrail>` | Immutable timestamped audit log conforming to FSMA Section 204.145 | `GET /api/actions/{id}/audit` | `MATCH (d:Decision)-[:AUTHORIZES]->(a:Action) ...` | `test_containment_action_plan_governance_gate` |

---

### 3.5 Screen 5: Agent Memory & Company Brain (`agent_memory_company_brain_recallmesh`)

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **Top Workspace Context & Breadcrumbs** | `agent_memory_company_brain_recallmesh/code.html:L5-25` | `<MemoryWorkspaceHeader>` | Header: "Agent Memory & Company Brain", subtext, "FSMA 204 Audit Ready" badge | Static layout | System persistence indicator | `test_memory_workspace_header` |
| **Block 1: Past Investigations List** | `agent_memory_company_brain_recallmesh/code.html:L31-90` | `<PastInvestigationsList>` | 3 historical cards: `INV-2026-088` (Active), `INV-2025-042` (Closed/Resolved), `INV-2025-019` (Closed/Resolved) | `GET /api/memory/investigations` | `MATCH (c:RecallCase) RETURN c ORDER BY c.opened_at DESC` | `test_past_investigations_retrieval` |
| **Block 2: "What We Remember" Facts** | `agent_memory_company_brain_recallmesh/code.html:L92-150` | `<InstitutionalMemoryList>` | Institutional facts verified by audit trails (Austin DC bays, Sunrise Spice 48h CoA, PR-9042 yield, Northgate DC schedule) | `GET /api/memory/facts` | `MATCH (m:InstitutionalFact)-[:VERIFIED_BY]->(e:Evidence) RETURN m` | `test_institutional_memory_facts` |
| **Block 3: Highlighted Handover Card** | `agent_memory_company_brain_recallmesh/code.html:L154-196` | `<AgentHandoverCard>` | Active Agent Handover: Tracer $\rightarrow$ Response Planner, "Next step: approve the simulated hold", "Continue investigation" button | `GET /api/memory/active-handover` | Fetches active agent handover state | `test_agent_handover_persistence` |
| **Block 4: "Who and What is Connected"** | `agent_memory_company_brain_recallmesh/code.html:L198-262` | `<EntityRelationshipsList>` | 6 categorical lists: People, Teams, Suppliers, Products, Procedures, Previous Cases | `GET /api/company-brain/entities` | Cross-graph relationship query aggregating distinct labels | `test_company_brain_entities` |
| **Block 5: "How Was This Answer Found?"** | `agent_memory_company_brain_recallmesh/code.html:L264-300` | `<ProvenanceTrailCard>` | 3-step provenance flow: 1. Raw Manifest (EDI 856), 2. Batch Mixing (MES Log #4892), 3. Carrier Geofence | `GET /api/memory/provenance/{case_id}` | Traceability lineage supporting agent reasoning | `test_provenance_trail_verification` |

---

### 3.6 Screen 6: Dedicated Traceability Graph Explorer (`traceability_graph_recallmesh`)

| UI Element / Control | Stitch Reference Location | Proposed React Component | Required State & Interaction | Backend / API Endpoint | FalkorDB / ML Operation | Acceptance Test |
|---|---|---|---|---|---|---|
| **Path Filter Toggle** | `traceability_graph_recallmesh/code.html:L12-20` | `<PathFilterToggle>` | `filterMode: 'affected' \| 'all'`, toggles between highlighting affected blast radius and viewing full graph | Canvas filter state | Cypher path filtering | `test_graph_path_filter_toggle` |
| **Entity Filter Chips Row** | `traceability_graph_recallmesh/code.html:L24-42` | `<FilterChipGroup>` | Active chip toggles: Lots, Shipments, Suppliers, Evidence, Locations | `activeFilters: Set<string>` | Cypher node label filter | `test_graph_entity_chips` |
| **In-Canvas Search Input** | `traceability_graph_recallmesh/code.html:L44-47` | `<Input>` | "Find a lot or shipment...", highlights matching node in canvas | `nodeSearchQuery: string` | Matches node properties | `test_graph_node_search` |
| **Slim Coral Path Breadcrumb Bar** | `traceability_graph_recallmesh/code.html:L252-271` | `<PathBreadcrumbBar>` | Clickable breadcrumb chain: `LOT-CUM-2026-088` $\rightarrow$ `Salsa blend run` $\rightarrow$ `FL-SALSA-101` $\rightarrow$ `SHIP-8821` $\rightarrow$ `Northgate DC` | Active selected path array | Serialized trace path from `trace_downstream()` | `test_path_breadcrumb_chain` |
| **Inspector Dock (Empty & Active States)** | `traceability_graph_recallmesh/code.html:L274-321` | `<GraphInspectorDock>` | Defaults to empty state ("Click any card to see its details here."); transitions to node metadata attributes on click | `selectedNode: Node \| null` | Fetches node properties from graph | `test_graph_inspector_dock_transition` |

---

### 3.7 Responsive Compositions: Tablet & Mobile Variants

| UI Element / Control | Stitch Reference Location | Proposed React Component | Responsive Adaptation Rules | Acceptance Test |
|---|---|---|---|---|
| **Tablet Top App Bar** | `investigation_tablet_820x1180_recallmesh/code.html:L84-116` | `<TabletHeader>` | Collapses 240px sidebar into slide-over drawer triggered by hamburger `<button>`. Retains DEMO DATA badge, New Investigation CTA, and QA avatar. | `test_tablet_drawer_navigation` |
| **Tablet Graph First Placement** | `investigation_tablet_820x1180_recallmesh/code.html:L144-173` | `<InvestigationView>` (Tablet) | At `768px <= viewport < 1024px`, the 6-stage graph canvas is rendered **above** case details with horizontal scroll enabled (`no-scrollbar`). | `test_tablet_graph_priority_layout` |
| **Mobile Top Bar & Case Ribbon** | `investigation_phone_390x844_recallmesh/code.html:L76-116` | `<MobileHeader>` | Clamped 390px layout. Compact hamburger button, logo, mini DEMO badge. Sticky breadcrumb ribbon with case ID and pulsing active indicator. | `test_mobile_header_composition` |
| **Mobile Graph with Swipe Cue** | `investigation_phone_390x844_recallmesh/code.html:L122-147` | `<InvestigationView>` (Mobile) | Graph canvas placed at very top with explicit "Swipe to explore $\rightarrow$" visual cue and compact node tiles. | `test_mobile_swipeable_graph` |
| **Mobile Stacked Cards Flow** | `investigation_phone_390x844_recallmesh/code.html:L272-350` | `<MobileStackedCards>` | Inspector, Case Summary, Model Estimate, and Legend stack vertically in 100% width cards with touch-friendly 44px hit targets. | `test_mobile_stacked_flow` |

---

## 4. Backend Service Architecture & Proposed API Layer

To bridge the existing Python backend modules (`src/recallmesh/tracer.py`, `src/recallmesh/loader.py`, `src/recallmesh/ml/pipeline.py`) with the proposed React frontend, a lightweight REST API service (FastAPI) will be added under `src/recallmesh/api/`.

```mermaid
graph LR
    subgraph Frontend [React + Vite SPA (Port 5173)]
        UI[Stitch-Compliant Views]
        Store[Zustand / TanStack Query Store]
    end

    subgraph API [FastAPI Backend Service (Port 8000)]
        Router[API Router]
        TraceEP["/api/trace/*"]
        ActionEP["/api/actions/*"]
        MLEP["/api/ml/*"]
        MemoryEP["/api/memory/*"]
    end

    subgraph Backend Core [Existing Modules]
        Tracer["src/recallmesh/tracer.py"]
        MLPipe["src/recallmesh/ml/pipeline.py"]
        Connection["src/recallmesh/connection.py"]
    end

    subgraph Data Stores
        FalkorDB[(FalkorDB Docker :6379)]
        JoblibArtifacts["models/*.joblib"]
    end

    UI --> Store
    Store --> Router
    Router --> TraceEP --> Tracer --> Connection --> FalkorDB
    Router --> ActionEP --> Tracer --> FalkorDB
    Router --> MLEP --> MLPipe --> JoblibArtifacts
    Router --> MemoryEP --> Connection --> FalkorDB
```

### 4.1 REST API Endpoint Specifications

#### 1. Graph Tracing & Inspection
- `GET /api/trace/downstream/{raw_lot_code}`
  - **Handler:** Calls `trace_downstream(graph, raw_lot_code)`.
  - **Response:**
    ```json
    {
      "suspect_raw_lot": "LOT-CUM-2026-088",
      "evidence": [{ "evidence_id": "EVID-LAB-904", "title": "COA Lab Report" }],
      "affected_finished_lots": [
        { "lot_code": "FL-SALSA-101", "product_name": "Artisan Roasted Salsa 16oz", "disposition": "QUARANTINED", "traceability_status": "VERIFIED" }
      ],
      "affected_shipments": [
        { "shipment_id": "SHIP-8821", "finished_lot": "FL-SALSA-101", "shipping_disposition": "IN_TRANSIT", "destination_name": "LOC-RETAIL-ALPHA" },
        { "shipment_id": "SHIP-8822", "finished_lot": "FL-SALSA-101", "shipping_disposition": "DELIVERED", "destination_name": "LOC-RETAIL-BETA" }
      ],
      "trace_paths": [...],
      "total_affected_finished_lots": 1,
      "total_affected_shipments": 2
    }
    ```

- `GET /api/trace/upstream/{finished_lot_code}`
  - **Handler:** Calls `trace_upstream(graph, finished_lot_code)`.
  - **Response:** Lineage path isolating ingredient lots, supplier GLNs, and sibling lots.

- `GET /api/trace/gaps`
  - **Handler:** Calls `detect_traceability_gaps(graph)`.
  - **Response:**
    ```json
    {
      "gap_detected_finished_lots": [
        {
          "lot_code": "FL-SALSA-103",
          "product_name": "Artisan Roasted Salsa 16oz",
          "disposition": "AVAILABLE",
          "traceability_status": "GAP_DETECTED",
          "defect_type": "MISSING_TRANSFORMATION_LINK"
        }
      ],
      "total_gaps_found": 1,
      "review_tasks": [
        { "task_id": "TASK-GAP-FL-SALSA-103", "target_id": "FL-SALSA-103", "status": "OPEN" }
      ]
    }
    ```

- `GET /api/trace/graph-vis`
  - **Handler:** Serializes the complete active scenario into 6-column coordinates with node properties, statuses, and SVG bezier connections matching Stitch layout.

#### 2. Machine Learning Inference & Evaluation Benchmarks
- `POST /api/ml/predict-risk`
  - **Handler:** Calls `predict_recall_risk()` using `models/recall_classifier_improved.joblib`.
  - **Request Body:**
    ```json
    {
      "product_description": "Artisan Roasted Salsa 16oz",
      "reason_for_recall": "Potential Salmonella enterica contamination in cumin extract"
    }
    ```
  - **Response:**
    ```json
    {
      "predicted_class": "Class I",
      "confidence": 0.7975,
      "class_probabilities": {
        "Class I": 0.7975,
        "Class II": 0.1625,
        "Class III": 0.0400
      },
      "top_explanatory_features": ["salmonella", "enterica", "cumin", "extract"],
      "status": "PREDICTED_ADVISORY",
      "disclaimer": "NOTICE: Offline research classifier prediction only. This advisory output is not an authoritative recall determination, does not declare any product safe, and does not authorize quarantine, shipment hold, or regulatory notifications without human QA review."
    }
    ```

- `GET /api/ml/benchmark-metrics`
  - **Handler:** Returns the true documented evaluation metrics from `reports/model_optimization_metrics.json` without fabrication:
    - Baseline 3-class test accuracy: 64.66%
    - Improved 3-class chronological test accuracy: 66.55% (Class I recall: 79.75%)
    - Binary test accuracy (0.50 threshold): 77.08%
    - Binary test accuracy (0.43 threshold): 76.11% (Class I recall: 83.74%, ROC AUC: 0.8241)

#### 3. Containment Action Plans & Approval Gate
- `GET /api/actions/plan`
  - **Handler:** Calls `build_containment_action_plan(graph, raw_lot_code, case_id)`.
  - **Response:** Structured list of proposed containment actions (`ACT-QUARANTINE-01`, `ACT-STOP-SHIP-01`, `ACT-CONSIGNEE-01`, `ACT-AUDIT-01`), all with `status: "PROPOSED"` and `requires_authorization: true`.

- `POST /api/actions/execute`
  - **Handler:** Calls `execute_containment_action_plan(graph, action_plan, authorized_by, rationale)`.
  - **Request Body:**
    ```json
    {
      "action_plan": { ... },
      "authorized_by": "Morgan Bailey",
      "rationale": "Authorized QA Director containment signoff"
    }
    ```
  - **Governance Enforcement:** If `authorized_by` is omitted, returns HTTP 403 Forbidden with `GovernanceException` message. When authorized, creates `:Decision` and `:Action` nodes in FalkorDB and returns `decision_id` and execution timestamp.

#### 4. Agent Memory & Company Brain
- `GET /api/memory/investigations`: Lists historical cases (`INV-2026-088`, `INV-2025-042`, `INV-2025-019`).
- `GET /api/memory/facts`: Returns verified institutional facts linked to supporting evidence.
- `GET /api/memory/active-handover`: Returns active handover payload between Tracer and Response Planner.
- `GET /api/company-brain/entities`: Aggregates people, teams, suppliers, products, and standard operating procedures.

---

## 5. Frontend Architecture & Component Hierarchy

### 5.1 Project Directory Structure (Proposed for Milestone 4)
```text
frontend/
├── index.html                       # HTML entry point loading Google DM Sans & Material Symbols
├── package.json                     # Vite + React 18 + Lucide/Material Symbols
├── vite.config.ts                   # Vite configuration with proxy to FastAPI backend :8000
├── src/
│   ├── main.tsx                     # Application mount
│   ├── App.tsx                      # Root shell & navigation state router
│   ├── styles/
│   │   ├── tokens.css               # Exact Serene Traceability CSS custom properties
│   │   ├── typography.css           # DM Sans scale & tabular number utilities
│   │   ├── layout.css               # 12-col desktop, 8-col tablet, 4-col mobile grids
│   │   └── components.css           # Reusable button, card, chip, and badge styles
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx         # Responsive wrapper (desktop sidebar + mobile drawer)
│   │   │   ├── Sidebar.tsx          # 240px fixed navigation sidebar
│   │   │   ├── TopHeader.tsx        # Search, demo pill, new investigation button, avatar
│   │   │   └── TabletDrawer.tsx     # Slide-over navigation drawer for tablet/mobile
│   │   ├── common/
│   │   │   ├── Button.tsx           # Primary (#337A68), Outline (#E7E3D9), Ghost
│   │   │   ├── StatusBadge.tsx      # Pill badge with 12% tint background and dot
│   │   │   ├── Card.tsx             # 12px rounded white container with #E7E3D9 border
│   │   │   └── SimulationBanner.tsx # Amber simulation guardrail alert banner
│   │   ├── graph/
│   │   │   ├── GraphCanvas.tsx      # 6-column dot-grid canvas with pan/zoom
│   │   │   ├── SvgConnectors.tsx    # SVG bezier connectors (solid coral, dashed lavender)
│   │   │   ├── SupplyMeshNode.tsx   # White 12px card with 4px left status accent strip
│   │   │   ├── PathBreadcrumbs.tsx  # Red/coral path breadcrumbs bar
│   │   │   └── GraphControls.tsx    # Zoom in, zoom out, fit to screen buttons
│   │   ├── inspector/
│   │   │   ├── NodeInspector.tsx    # Right dock displaying selected node properties
│   │   │   └── GapInspector.tsx     # Specialized inspector for FL-SALSA-103 gap node
│   │   └── decision/
│   │   │   ├── ApprovalModal.tsx    # Human-in-the-loop authorization modal with signature
│   │   │   └── StepperPipeline.tsx  # 3-step pipeline (Proposed -> Approved -> Simulated)
│   ├── views/
│   │   ├── OverviewView.tsx         # Dashboard: stat cards, current case, CTE table
│   │   ├── InvestigationView.tsx    # 3-column workspace with graph & node inspector
│   │   ├── GraphExplorerView.tsx    # Standalone graph canvas with filter chips
│   │   ├── ActionPlansView.tsx      # Containment queue, comparison, and approval gate
│   │   └── MemoryBrainView.tsx      # Past cases, institutional memory, and handovers
│   └── api/
│       ├── client.ts                # Typed fetch wrapper with error handling
│       ├── trace.ts                 # Tracing & gap API hooks
│       ├── actions.ts               # Action plan & approval hooks
│       └── ml.ts                    # Model inference & evaluation metrics hooks
```

---

## 6. Gap Analysis: Missing Backend Capabilities & Resolutions

| # | Current Backend State | Required by Stitch UI | Engineering Resolution |
|---|-----------------------|-----------------------|------------------------|
| **1** | **No HTTP API Layer:** Functions in `tracer.py` and `pipeline.py` are callable only via Python SDK or CLI. | Frontend React SPA requires REST endpoints to fetch data and trigger actions. | Create `src/recallmesh/api/` using FastAPI, wrapping `tracer.py`, `loader.py`, and `pipeline.py`. Provide CORS configuration for local Vite development. |
| **2** | **Graph Coordinate Serialization:** `trace_downstream()` returns raw node/edge lists without 2D stage positioning. | Stitch requires 6-stage column alignment (01. Supplier $\rightarrow$ 02. Ing Lot $\rightarrow$ 03. Production $\rightarrow$ 04. Finished Lot $\rightarrow$ 05. Shipment $\rightarrow$ 06. Destination) with exact bezier curves. | Implement a graph layout transformer in `src/recallmesh/api/serializers.py` that maps FalkorDB entity labels and relationships directly to column coordinates (X: stages 1–6, Y: stacked ranks). |
| **3** | **Company Brain & Memory Persistence:** Scenario fixture seeds raw lots and shipments, but `:InstitutionalFact` and agent handover states are not yet formalized as graph nodes. | Stitch Screen 8 displays 4 verified institutional memory cards and an active Tracer $\rightarrow$ Response Planner handover card. | Add an idempotent `seed_agent_memory()` function in `loader.py` that seeds `:InstitutionalFact` nodes and `:AgentHandover` records linked to supporting evidence. |
| **4** | **Electronic Sortable Spreadsheet Export:** `tracer.py` computes CTEs, but does not format them as a downloadable CSV/XLSX file. | Stitch Screen 1 features a prominent "Export Electronic Sortable Spreadsheet" button for FDA Rule 204 compliance. | Add a route `GET /api/export/fsma-204-spreadsheet` that converts FalkorDB CTE records into a 24-hour FDA-compliant downloadable CSV spreadsheet. |
| **5** | **Dynamic Case Search:** Current graph query matches specific hardcoded lot codes. | Stitch top header features a global search bar (`Search lots, shipments, facilities...`). | Add a Cypher full-text or parameterized index search endpoint across `RawLot`, `FinishedLot`, `Shipment`, and `Supplier`. |

---

## 7. Visual Compliance & Screenshot Verification Protocol

To verify that the eventual implementation matches the authoritative Stitch exports, each screen will be audited against its companion screenshot using the visual compliance checklist below:

### Visual Compliance Checklist
- [ ] **Background Canvas:** Exact `#FAF6EC` parchment background visible across desktop gutters and main workspace.
- [ ] **Surface Containers:** Cards render on pure white `#FFFFFF` with hairline `1px solid #E7E3D9` border and `12px` border radius.
- [ ] **Drop Shadows:** Restricted to ambient low-opacity shadow `0 1px 3px rgba(36, 51, 47, 0.02)` or `0 4px 16px rgba(36, 51, 47, 0.06)` for modals; heavy cast shadows and neon blurs strictly excluded.
- [ ] **Typography Rhythm:** Headings and body copy exclusively in **DM Sans**. Batch codes and lot numbers use tabular numerals (`tabular-nums`).
- [ ] **Accent Strip on Mesh Nodes:** Canvas graph nodes feature a crisp 4px solid left border in the appropriate status color (Coral for affected, Sage for verified, Marigold for review, Lavender for unknown).
- [ ] **SVG Bezier Connectors:** Directional trace arrows use smooth cubic bezier curves (`C x1 y1, x2 y2, x3 y3`) with markers matching path status.
- [ ] **Pill Geometry:** Status chips, demo data badge, and category filters use `border-radius: 9999px` with uppercase `11px` bold text and low-saturation 12% tinted backgrounds.
- [ ] **Simulation Guardrails:** Prominent amber alert banner rendered in Action Plans view with exact copy: *"Simulated actions only. Nothing real is stopped or sent. Production warehouse management systems (WMS) remain unaffected."*
- [ ] **Research Disclaimer:** Model estimate card contains the full mandatory research notice with zero claims of autonomous recall declaration.
- [ ] **Responsive Integrity:**
  - Desktop (>=1024px): 12-column grid with fixed 240px sidebar and 320px node inspector.
  - Tablet (820x1180): Graph canvas positioned first with swipeable horizontal overflow; sidebar collapses to slide-over drawer.
  - Mobile (390x844): 390px clamped width, swipeable graph, vertical card cascade with touch-friendly 44px buttons.

---

## 8. Preserved System Assets & Test Baseline

The implementation must preserve all previously completed milestone assets:
1. **FalkorDB Graph Container:** Running on `127.0.0.1:6379`. Existing graph schema (`src/recallmesh/schema.py`) and loader (`src/recallmesh/loader.py`) remain intact.
2. **Offline ML Models:**
   - Baseline Classifier: `models/recall_classifier.joblib` (64.66% test accuracy)
   - Improved 3-Class Classifier: `models/recall_classifier_improved.joblib` (66.55% test accuracy, 79.75% Class I recall)
   - Binary Classifier: `models/recall_classifier_binary.joblib` (77.08% / 76.11% accuracy, 83.74% Class I recall, 0.8241 ROC AUC)
3. **Automated Test Suite:** All **23 existing automated tests** (`tests/test_recallmesh_graph.py` and `tests/test_recall_classifier.py`) must continue to pass with zero regressions.

---

## 9. Next Implementation Steps (Milestone 4 Preview)

Upon explicit user review and approval of this integration plan:
1. **Phase 1: Backend API Service (`src/recallmesh/api/`)**
   - Initialize FastAPI service exposing graph query, containment action, model inference, and audit trail endpoints.
   - Add unit tests verifying API responses match the schemas specified in Section 4.
2. **Phase 2: React Frontend Initialization (`frontend/`)**
   - Initialize Vite React project.
   - Configure Stitch CSS design tokens (`tokens.css`, `typography.css`, `components.css`).
   - Implement common reusable UI components (`AppShell`, `Sidebar`, `Button`, `StatusBadge`, `Card`).
3. **Phase 3: Screen-by-Screen Implementation & Visual Verification**
   - Implement `OverviewView`, `InvestigationView`, `GraphExplorerView`, `ActionPlansView`, and `MemoryBrainView`.
   - Implement tablet and phone responsive breakpoints.
   - Execute browser screenshot verification against the authoritative Stitch reference images.
4. **Phase 4: Full End-to-End Acceptance Validation**
   - Run end-to-end user flows verifying graph tracing, gap detection, model inference, and containment approval gates.
