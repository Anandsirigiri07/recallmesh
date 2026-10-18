"""Domain-informed, leakage-safe hazard indicators for food recall text narratives.

Extracts transparent binary presence indicators for known food safety hazard categories
using strictly pre-classification terminology (pathogens, allergens, foreign materials,
labeling discrepancies, and spoilage indicators).
"""

import re
from typing import List, Tuple
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.base import BaseEstimator, TransformerMixin

# Transparent hazard pattern rules (strictly pre-classification terminology)
HAZARD_CATEGORY_RULES: List[Tuple[str, re.Pattern]] = [
    # 1. Severe Pathogens (Class I indicators)
    ("has_listeria", re.compile(r"\blisteria(?:\s+monocytogenes)?\b", re.IGNORECASE)),
    ("has_salmonella", re.compile(r"\bsalmonella\b", re.IGNORECASE)),
    ("has_ecoli", re.compile(r"\b(?:e\.?\s*coli|escherichia\s+coli|shiga|stec)\b", re.IGNORECASE)),
    ("has_botulinum", re.compile(r"\b(?:botulinum|botulism|clostridium\s+botulinum)\b", re.IGNORECASE)),
    ("has_pathogen_other", re.compile(r"\b(?:pathogen|clostridium|campylobacter|shigella|bacillus\s+cereus|norovirus)\b", re.IGNORECASE)),
    
    # 2. Major Food Allergens (FALCPA / FASTER Act)
    ("has_peanut", re.compile(r"\bpeanuts?\b", re.IGNORECASE)),
    ("has_treenut", re.compile(r"\b(?:tree\s*nuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?)\b", re.IGNORECASE)),
    ("has_milk", re.compile(r"\b(?:milk|dairy|butter|cheese|whey|casein)\b", re.IGNORECASE)),
    ("has_egg", re.compile(r"\beggs?\b", re.IGNORECASE)),
    ("has_wheat_gluten", re.compile(r"\b(?:wheat|gluten|flour)\b", re.IGNORECASE)),
    ("has_soy", re.compile(r"\b(?:soy|soya|soybean|lecithin)\b", re.IGNORECASE)),
    ("has_fish_shellfish", re.compile(r"\b(?:fish|crustacean|shellfish|shrimp|crab|lobster|salmon|tuna|cod)\b", re.IGNORECASE)),
    ("has_sesame", re.compile(r"\bsesame\b", re.IGNORECASE)),
    ("has_undeclared_general", re.compile(r"\bundeclared\b", re.IGNORECASE)),
    
    # 3. Foreign Materials (Physical Choking / Laceration Hazards)
    ("has_foreign_metal", re.compile(r"\b(?:metal|wire|shavings?)\b", re.IGNORECASE)),
    ("has_foreign_glass", re.compile(r"\bglass\b", re.IGNORECASE)),
    ("has_foreign_plastic", re.compile(r"\b(?:plastic|rubber)\b", re.IGNORECASE)),
    ("has_foreign_matter_general", re.compile(r"\b(?:foreign\s+material|foreign\s+object|stones?|insects?|rodents?)\b", re.IGNORECASE)),
    
    # 4. Labeling & Net Weight Deficiencies (Class III indicators)
    ("has_labeling_defect", re.compile(r"\b(?:labeling|label\s+claim|misbranded|net\s+weight|volume|subpotent|subpotency|omitted|mislabel)\b", re.IGNORECASE)),
    
    # 5. Spoilage & cGMP / Temperature Violations
    ("has_spoilage_gmp", re.compile(r"\b(?:spoilage|mold|yeast|water\s+activity|temperature\s+abuse|swollen|leaker)\b", re.IGNORECASE)),
    
    # 6. Chemical Contaminants & Unapproved Additives
    ("has_chemical_toxin", re.compile(r"\b(?:lead|aflatoxin|mycotoxin|histamine|unapproved\s+color|unapproved\s+additive|heavy\s+metal)\b", re.IGNORECASE)),
]


class HazardFeatureExtractor(BaseEstimator, TransformerMixin):
    """Transformer extracting binary presence indicators for transparent hazard categories."""

    def __init__(self) -> None:
        self.feature_names_ = [name for name, _ in HAZARD_CATEGORY_RULES]

    def fit(self, X: List[str], y=None):
        return self

    def transform(self, X: List[str]) -> csr_matrix:
        """Transforms an iterable of text strings into a sparse binary matrix."""
        mat = np.zeros((len(X), len(HAZARD_CATEGORY_RULES)), dtype=np.float32)
        for i, text in enumerate(X):
            t = str(text) if text else ""
            for j, (_, pattern) in enumerate(HAZARD_CATEGORY_RULES):
                if pattern.search(t):
                    mat[i, j] = 1.0
        return csr_matrix(mat)

    def get_feature_names_out(self, input_features=None) -> List[str]:
        return list(self.feature_names_)
