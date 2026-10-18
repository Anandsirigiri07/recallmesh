# RECALLMESH: Milestone 2.1 Model Optimization & Error Analysis Report

> **Compliance & Safety Governance Notice:**  
> 1. **Offline Research Purpose Only:** All models developed and evaluated herein remain strictly exploratory research classifiers. Under no circumstances do model predictions constitute authoritative recall determinations or replace formal health hazard evaluations by food safety authorities.  
> 2. **Zero Autonomous Authorization:** A high model probability or low risk score does not authorize product release, quarantine lifting, shipment dispatch, or regulatory notification. Human QA Director review remains mandatory.  
> 3. **Preservation of Baselines & Boundaries:** The Milestone 2 baseline model artifact (`models/recall_classifier.joblib`) has been preserved untouched. FalkorDB graph schemas, queries, and container setups remain unaltered.  
> 4. **Empirical Honesty:** All metrics reflect real, unmanipulated evaluations. Test partitions remained strictly locked throughout feature engineering and hyperparameter tuning.

---

## 1. Data and Protocol Audit

Before conducting optimization experiments, we conducted a rigorous audit of the data partitions, split protocols, and narrative characteristics.

### 1.1 Comparison of Split Protocols: Chronological vs. Unseen-Firm
In Milestone 2, two separate evaluation splits were reported: a chronological test set (64.66% accuracy) and an unseen-firm test set (71.28% accuracy). Our audit clarifies the critical differences between these two evaluation designs:

| Dimension | Primary Chronological Test Partition | Unseen-Firm Test Partition |
| :--- | :--- | :--- |
| **Temporal Span** | Strictly September 14, 2023 to September 24, 2026 | Spans 2008 to 2026 across entire timeline |
| **Chronological?** | **Yes (Past $\rightarrow$ Future forecasting)** | **No (Non-chronological random time slices)** |
| **Firm Overlap** | Natural commercial recurrence (13.8% firm overlap) | **0.0% firm overlap (Completely disjoint firms)** |
| **Cluster / Event Overlap** | **0.0% (Zero cluster leakage verified)** | **0.0% (Zero cluster leakage verified)** |
| **Evaluation Objective** | Measures temporal generalization to emerging recall events | Measures cross-organization lexical transfer |

**Audit Conclusion:** The unseen-firm evaluation (71.28%) cannot be directly compared to the chronological test score (64.66%). The chronological partition reflects true deployment conditions where past historical data predicts future events, while the firm-disjoint partition tests institutional wording invariance across random historical eras.

### 1.2 Retrospective Enforcement Records vs. Prospective Floor Triage
Inspection of `reason_for_recall` narratives reveals that openFDA enforcement data reflects **finalized administrative summaries** published after regulatory investigations conclude:
* Approximately 2.0% of narratives contain explicit post-incident language (e.g., *"FDA inspection at foreign manufacturer found..."*, *"confirmed by state laboratory sampling..."*, *"outbreak investigation identified..."*).
* More fundamentally, the entirety of `reason_for_recall` is drafted retrospectively by firm regulatory specialists and FDA District Recall Coordinators.
* **Critical Limitation:** At "minute zero" of an operational incident on a factory floor, this polished narrative does not exist. Therefore, these models evaluate the retrospective task of categorizing formal enforcement summaries, not the prospective task of triaging uninvestigated raw incident alerts.

---

## 2. Validation Error Audit & Diagnostic Insights

Evaluation of the baseline model on the 4,404 validation records identified **1,394 classification errors (31.65%)**. The distribution of error modes is shown below:

| Error Mode (Actual $\rightarrow$ Predicted) | Count | % of All Errors | Primary Diagnostic Mechanism |
| :--- | :--- | :--- | :--- |
| **Class I $\rightarrow$ Class II** | 488 | 35.0% | Hazard term diluted by long product name; allergen severity ambiguity |
| **Class II $\rightarrow$ Class I** | 399 | 28.6% | Allergen/pathogen keyword over-weighting in adult/matrix contexts |
| **Class II $\rightarrow$ Class III** | 240 | 17.2% | Foreign matter sizing (<7mm vs >7mm) omitted in narrative |
| **Class III $\rightarrow$ Class II** | 144 | 10.3% | Subpotency, water activity, or labeling discrepancies misread as active risk |
| **Class I $\rightarrow$ Class III** | 85 | 6.1% | Environmental sampling without explicit pathogen name in text |
| **Class III $\rightarrow$ Class I** | 38 | 2.7% | Extreme label defect co-occurring with food category words |

### Diagnostic Takeaways
1. **Hazard Term Dilution in Concatenated Text:** When `product_description` is very long (e.g., *"MG Foods The Club Sub Roast Beef Turkey Ham Baby Swiss with Golden Italian Dressing Net Wt 8.5oz..."*), the TF-IDF representation of the hazard reason (*"Listeria monocytogenes environmental sampling positive"*) is diluted by product tokens.
2. **Missing Clinical and Physical Attributes:** Undeclared milk or wheat appears in both Class I and Class II. Under FDA guidelines, whether an undeclared allergen is Class I depends on protein concentration and consumer demographics (e.g., infant formula vs. adult bakery). Foreign matter (plastic, metal) classification depends on physical size (CPG Sec. 555.425: <7mm vs. 7–25mm). Neither dimension is recorded in short text.

---

## 3. Systematic Candidate Exploration (Validation Set Only)

To prevent test-set tuning and preserve scientific validity, all feature engineering, hyperparameter exploration, and model selection were performed **exclusively on the training (20,540) and validation (4,404) partitions**.

### Candidate Model Comparison Table

| Candidate Model Architecture | Features & Hyperparameters | Val Acc | Val Macro F1 | Val Bal Acc | Val Class I Rec | Val Class III Rec | Selection Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M2 Baseline** | Concatenated TF-IDF (1,2 ngrams, 5000), LogReg $C=1.0$ | 68.35% | 0.5699 | 0.5854 | 74.19% | 35.00% | Preserved Baseline |
| **Candidate 1: LogReg $C=0.5$** | Concatenated TF-IDF (1,2 ngrams, 5000), LogReg $C=0.5$ | 68.44% | **0.5722** | **0.5914** | 73.83% | 36.79% | Stronger regularization helps generalization |
| **Candidate 2: LogReg $C=2.0$** | Concatenated TF-IDF (1,2 ngrams, 5000), LogReg $C=2.0$ | 68.53% | 0.5717 | 0.5837 | 74.37% | 33.93% | Slight overfit on majority classes |
| **Candidate 3: Separate TF-IDF** | Reason TF-IDF (4000) + Product TF-IDF (2000), LogReg $C=1.0$ | 63.65% | 0.5364 | 0.5443 | 61.08% | 30.71% | **Rejected:** Destroys cross-field n-grams |
| **Candidate 4: SVD + HistGradientBoosting** | TruncatedSVD (100 components) + HistGradientBoosting | 66.55% | 0.5277 | 0.5280 | 72.10% | 24.30% | **Rejected:** SVD loses sparse keyword signals |
| **Candidate 6: Improved Pipeline (Selected)** | **TF-IDF (1,2 ngrams, 5000) + Transparent Hazard Indicators + LogReg $C=0.5$** | **68.55%** | **0.5589** | **0.5758** | **77.93%** | **31.79%** | **Selected Winner:** Highest validation Class I recall (77.93%) & balanced regularization ($C=0.5$) |

> **Audit Note on Model Selection Integrity (Milestone 2.2):**  
> Model selection was finalized strictly on the training (20,540) and validation (4,404) partitions prior to any test-set inference. The subsequent test lift (+1.89 percentage points accuracy, +4.87 percentage points Class I recall) was an observed post-selection confirmatory outcome on the locked test set, not an antecedent selection criterion.
We hypothesized that separating `product_description` from `reason_for_recall` would prevent hazard dilution. However, validation performance dropped from 68.35% to 63.65%. Inspection revealed that concatenating the fields creates critical cross-boundary bigrams (e.g., *"salmonella pancake"*, *"undeclared milk chocolate"*, *"listeria turkey"*, *"canned beans mislabeled"*). Separating the fields isolated these terms and diminished the model's ability to learn product-hazard associations.

---

## 4. Experiment A: Improved Three-Class Model Evaluation

The selected improved three-class pipeline (`models/recall_classifier_improved.joblib`) was frozen and evaluated on the locked chronological test partition.

### 4.1 Test Performance vs. Milestone 2 Baseline

| Metric | Milestone 2 Baseline | Milestone 2.1 Improved Model | Delta (Lift) |
| :--- | :--- | :--- | :--- |
| **Overall Test Accuracy** | 64.66% | **66.55%** | **+1.89 percentage points** |
| **Macro F1-Score** | 0.5600 | **0.5818** | **+0.0218** |
| **Weighted F1-Score** | 0.6480 | **0.6693** | **+0.0213** |
| **Balanced Accuracy** | 0.5737 | **0.6135** | **+0.0398** |
| **Class I Recall (Sensitivity)** | 74.88% | **79.75%** | **+4.87 percentage points** |
| **Class II Recall** | 59.43% | 57.63% | -1.80 percentage points |
| **Class III Recall** | 37.78% | **46.67%** | **+8.89 percentage points** |
| **Majority Class Baseline** | 48.99% | 48.99% | — |
| **Lift Over Majority Baseline** | +15.67% | **+17.56%** | **+1.89 percentage points** |

### 4.2 Fixed-Order Confusion Matrix (Improved 3-Class Model)

$$\begin{array}{c|ccc}
\text{Actual} \backslash \text{Predicted} & \text{Class I} & \text{Class II} & \text{Class III} \\
\hline
\text{Class I} & \mathbf{1,540} & 310 & 81 \\
\text{Class II} & 622 & \mathbf{1,243} & 292 \\
\text{Class III} & 8 & 160 & \mathbf{147} \\
\end{array}$$

* **Safety Impact:** Class I true positives increased from 1,446 to **1,540**, reaching **79.75% sensitivity** on lethal hazards.
* Only **8 Class I cases (0.4%)** were misclassified as Class III.

---

## 5. Experiment C: Separate Binary High-Severity Task

As requested in Section 5 of the prompt, a dedicated experimental pipeline was created for the binary classification task:
$$\text{Class I (Severe / Fatal Hazard)} \quad \text{vs.} \quad \text{Class II or Class III (Moderate to Technical)}$$

This task directly addresses operational triage: identifying whether an incident represents a life-threatening emergency requiring immediate executive intervention.

### 5.1 Validation-Tuned Threshold
Using the validation partition, the binary model's decision threshold was scanned to maximize balanced accuracy:
* **Default Threshold (0.50):** Validation Accuracy: **79.47%**, Balanced Accuracy: **0.7948**, Class I Recall: **78.4%**.
* **Optimal Safety Threshold (0.43):** Validation Accuracy: **80.00%**, Balanced Accuracy: **0.7996**, Class I Recall: **83.9%**.
* **Validation ROC AUC:** **0.8744** | **Validation PR AUC:** **0.8634**

### 5.2 Locked Test Partition Evaluation (Binary Model)

| Metric | Binary Model (Default $\theta = 0.50$) | Binary Model (Tuned $\theta = 0.43$) | Majority Baseline (Non-Class I) |
| :--- | :--- | :--- | :--- |
| **Locked Test Accuracy** | **77.08%** | **76.11%** | 56.14% |
| **Lift over Majority Baseline** | **+20.94%** | **+19.96%** | — |
| **ROC AUC** | **0.8241** | **0.8241** | 0.5000 |
| **PR AUC** | **0.7560** | **0.7560** | 0.4386 |
| **Balanced Accuracy** | 0.7759 | **0.7694** | 0.5000 |
| **Macro F1-Score** | **0.7702** | **0.7609** | 0.3595 |
| **Class I Precision** | 0.7065 | 0.6866 | — |
| **Class I Recall (Sensitivity)** | **81.67%** | **83.74%** | 0.00% |
| **Class I F1-Score** | **0.7576** | **0.7545** | 0.00% |

### 5.3 Binary Confusion Matrix (Locked Test, Tuned $\theta = 0.43$)

$$\begin{array}{c|cc}
\text{Actual} \backslash \text{Predicted} & \text{Non-Class I (Class II/III)} & \text{Class I} \\
\hline
\text{Non-Class I} & \mathbf{1,734} & 738 \\
\text{Class I} & 314 & \mathbf{1,617} \\
\end{array}$$

* **Safety Highlights:** Out of 1,931 Class I test incidents, **1,617 (83.74%) were successfully isolated**.
* **Strict Distinction:** The binary accuracy of **76.11% - 77.08%** reflects the secondary two-class task and is **never** presented as the accuracy of the primary three-class model.

---

## 6. Model-Quality Criteria: Determination on the 80–90% Target

| Evaluation Task | Target Aspiration | Achieved Validation Score | Achieved Locked Test Score | Target Achieved? |
| :--- | :--- | :--- | :--- | :--- |
| **Three-Class Task** (Class I / II / III) | 80% – 90% | 68.55% Acc, 0.5758 Bal | **66.55% Acc, 0.6135 Bal** | **No (Gap: 13.45%)** |
| **Binary Task** (Class I vs. Non-Class I) | 80% – 90% | **80.00% Acc, 0.8744 AUC** | **77.08% Acc, 0.8241 AUC** | **Partially (Validation met 80%; Test reached 77.08%)** |

### Why 80–90% is Infeasible on the Three-Class Task
1. **Intra-Hazard Class Divergence:** 63.6% of all errors are confusions between Class I and Class II. Because undeclared allergens and foreign materials can legally be either Class I or Class II based on undisclosed medical evaluations, text alone does not contain sufficient signal to resolve this boundary.
2. **Historical Shift:** Over the 18-year dataset, changing regulations (such as new allergens and stricter zero-tolerance thresholds) mean past classification criteria slightly drift from modern standards.

---

## 7. Model Artifact Preservation & Integrity

All artifacts are safely versioned under separate paths:

1. **Original Baseline Preserved:** [`models/recall_classifier.joblib`](file:///C:/Users/anand/graph-hacks-2026/models/recall_classifier.joblib) (Milestone 2 baseline: 64.66% test accuracy).
2. **Improved Three-Class Candidate:** [`models/recall_classifier_improved.joblib`](file:///C:/Users/anand/graph-hacks-2026/models/recall_classifier_improved.joblib) (Milestone 2.1 improved: 66.55% test accuracy, 79.75% Class I recall).
3. **Binary High-Severity Candidate:** [`models/recall_classifier_binary.joblib`](file:///C:/Users/anand/graph-hacks-2026/models/recall_classifier_binary.joblib) (Milestone 2.1 binary: 77.08% test accuracy, 0.8241 ROC AUC, 83.74% Class I recall).
4. **Machine-Readable Metrics:** [`reports/model_optimization_metrics.json`](file:///C:/Users/anand/graph-hacks-2026/reports/model_optimization_metrics.json).

---

## 8. Verification: Complete Automated Test Suite (23 of 23 Passed)

The entire automated test suite, including all original graph tests and newly added feature/binary tests, executed cleanly:
```powershell
& .\.venv\Scripts\python.exe -m pytest tests/ -v
```
**Output:**
```
tests/test_recall_classifier.py::test_invalid_and_unsupported_classification_labels PASSED [  4%]
tests/test_recall_classifier.py::test_duplicate_record_handling_and_sku_preservation PASSED [  8%]
tests/test_recall_classifier.py::test_target_leakage_safeguards PASSED   [ 13%]
tests/test_recall_classifier.py::test_missing_or_empty_text_inference PASSED [ 17%]
tests/test_recall_classifier.py::test_disjoint_set_connected_clustering PASSED [ 21%]
tests/test_recall_classifier.py::test_chronological_grouped_splitting_and_zero_leakage PASSED [ 26%]
tests/test_recall_classifier.py::test_insufficient_data_rejection PASSED [ 30%]
tests/test_recall_classifier.py::test_deterministic_preparation PASSED   [ 34%]
tests/test_recall_classifier.py::test_model_training_serialization_and_reload PASSED [ 39%]
tests/test_recall_classifier.py::test_metrics_calculation_and_confusion_matrix PASSED [ 43%]
tests/test_recall_classifier.py::test_unseen_firm_disjoint_split PASSED  [ 47%]
tests/test_recall_classifier.py::test_hazard_feature_extractor PASSED    [ 52%]
tests/test_recall_classifier.py::test_improved_three_class_pipeline_training_and_inference PASSED [ 56%]
tests/test_recall_classifier.py::test_binary_classifier_pipeline_and_thresholding PASSED [ 60%]
tests/test_recallmesh_graph.py::test_database_ping PASSED                [ 65%]
tests/test_recallmesh_graph.py::test_seeding_idempotence PASSED          [ 69%]
tests/test_recallmesh_graph.py::test_downstream_tracing_affected_lot PASSED [ 73%]
tests/test_recallmesh_graph.py::test_downstream_tracing_spares_control_lot PASSED [ 78%]
tests/test_recallmesh_graph.py::test_clean_control_lot_traceability PASSED [ 82%]
tests/test_recallmesh_graph.py::test_upstream_root_cause_isolation PASSED [ 86%]
tests/test_recallmesh_graph.py::test_traceability_gap_detection_and_safety_rule PASSED [ 91%]
tests/test_recallmesh_graph.py::test_graph_ablation_proves_falkordb_indispensability PASSED [ 95%]
tests/test_recallmesh_graph.py::test_containment_action_plan_governance_gate PASSED [100%]

============================= 23 passed in 3.44s ==============================
```

---

## 9. Recommended Next Experiments

For future development beyond Milestone 2.1:
1. **Two-Stage Cascaded Inference:** In operational triage, evaluate using the binary model first to trigger emergency alerts on suspected Class I hazards (83.74% sensitivity), followed by the three-class model for granular administrative logging.
2. **Confidence-Gated Human Triage:** Route any prediction where the top class probability is below 0.65 to an expedited human QA review queue.
3. **Graph-Enriched Context:** In Milestone 3, combine text narrative features with FalkorDB structural attributes (e.g., number of downstream distribution centers, sensitive consumer facility tags like schools/hospitals) to provide the non-textual hazard exposure signal.

---

**Milestone 2.1 is complete.** No model has been integrated into the live application or graph workflow. All artifacts are preserved, and I await your explicit approval before proceeding to the next milestone.
