"""
NEXUS MBA Engine
Core Market Basket Analysis engine using FP-Growth with:
  - Auto-threshold tuning
  - Rule drift detection
  - Multi-metric rule scoring
  - Versioned iteration storage
"""

import json
import os
import math
import logging
from collections import defaultdict
from itertools import combinations
from datetime import datetime
from typing import List, Dict, Tuple, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("nexus.engine")


# ─── FP-Tree Implementation ────────────────────────────────────────────────────

class FPNode:
    def __init__(self, item, count=0, parent=None):
        self.item = item
        self.count = count
        self.parent = parent
        self.children: Dict[str, "FPNode"] = {}
        self.node_link: Optional["FPNode"] = None

    def increment(self, count):
        self.count += count


class FPTree:
    def __init__(self, transactions: List[List[str]], min_support: int):
        self.min_support = min_support
        self.header_table: Dict[str, List] = {}  # item -> [count, node_link_head]
        self.root = FPNode("null")
        self._build(transactions)

    def _build(self, transactions):
        # Count item frequencies
        freq = defaultdict(int)
        for transaction in transactions:
            for item in transaction:
                freq[item] += 1

        # Filter by min_support
        freq = {k: v for k, v in freq.items() if v >= self.min_support}

        # Build header table
        for item, count in freq.items():
            self.header_table[item] = [count, None]

        # Insert transactions
        for transaction in transactions:
            filtered = [item for item in transaction if item in freq]
            filtered.sort(key=lambda x: freq[x], reverse=True)
            if filtered:
                self._insert_tree(filtered, self.root)

    def _insert_tree(self, items, node):
        if not items:
            return
        first = items[0]
        if first in node.children:
            node.children[first].increment(1)
        else:
            new_node = FPNode(first, 1, node)
            node.children[first] = new_node
            # Update header table link
            if self.header_table[first][1] is None:
                self.header_table[first][1] = new_node
            else:
                current = self.header_table[first][1]
                while current.node_link is not None:
                    current = current.node_link
                current.node_link = new_node
        self._insert_tree(items[1:], node.children[first])

    def _ascend_tree(self, node) -> List[str]:
        path = []
        node = node.parent
        while node.item != "null":
            path.append(node.item)
            node = node.parent
        return path

    def mine_patterns(self, min_support: int) -> Dict[frozenset, int]:
        patterns = {}
        for item, (count, node) in self.header_table.items():
            if count < min_support:
                continue
            # Single item
            patterns[frozenset([item])] = count

            # Conditional pattern base
            cond_patterns = []
            current = node
            while current is not None:
                path = self._ascend_tree(current)
                if path:
                    cond_patterns.append((path, current.count))
                current = current.node_link

            # Build conditional transactions
            cond_transactions = []
            for path, cnt in cond_patterns:
                cond_transactions.extend([path] * cnt)

            if cond_transactions:
                cond_tree = FPTree(cond_transactions, min_support)
                sub_patterns = cond_tree.mine_patterns(min_support)
                for pattern, sub_count in sub_patterns.items():
                    combined = pattern | frozenset([item])
                    if combined in patterns:
                        patterns[combined] = max(patterns[combined], sub_count)
                    else:
                        patterns[combined] = sub_count

        return patterns


# ─── Rule Generation ───────────────────────────────────────────────────────────

def generate_rules(
    patterns: Dict[frozenset, int],
    transactions: List[List[str]],
    min_confidence: float,
) -> List[Dict]:
    """Generate association rules from frequent itemsets."""
    n = len(transactions)
    rules = []

    for itemset, itemset_count in patterns.items():
        if len(itemset) < 2:
            continue

        for size in range(1, len(itemset)):
            for antecedent in combinations(sorted(itemset), size):
                antecedent = frozenset(antecedent)
                consequent = itemset - antecedent

                ant_count = patterns.get(antecedent, 0)
                if ant_count == 0:
                    continue

                support = itemset_count / n
                confidence = itemset_count / ant_count
                if confidence < min_confidence:
                    continue

                # Consequent support
                cons_count = patterns.get(consequent, 0)
                cons_support = cons_count / n if cons_count > 0 else support

                # Metrics
                lift = confidence / cons_support if cons_support > 0 else 0
                leverage = support - (ant_count / n) * cons_support
                conviction = (
                    (1 - cons_support) / (1 - confidence)
                    if confidence < 1.0
                    else float("inf")
                )

                rules.append({
                    "antecedent": sorted(antecedent),
                    "consequent": sorted(consequent),
                    "support": round(support, 6),
                    "confidence": round(confidence, 6),
                    "lift": round(lift, 6),
                    "leverage": round(leverage, 6),
                    "conviction": round(min(conviction, 999.0), 6),
                    "itemset_count": itemset_count,
                })

    return rules


# ─── Rule Scorer ──────────────────────────────────────────────────────────────

def score_rule(rule: Dict, weights: Dict = None) -> float:
    """
    Composite scoring model combining lift, confidence, support, conviction.
    Weights can be tuned per business need.
    """
    if weights is None:
        weights = {
            "lift": 0.40,
            "confidence": 0.30,
            "support": 0.15,
            "conviction": 0.15,
        }

    # Normalize conviction to 0-1 scale (cap at 10)
    conv_norm = min(rule["conviction"], 10.0) / 10.0

    score = (
        weights["lift"] * min(rule["lift"] / 10.0, 1.0)
        + weights["confidence"] * rule["confidence"]
        + weights["support"] * min(rule["support"] * 20, 1.0)
        + weights["conviction"] * conv_norm
    )
    return round(score, 6)


# ─── Auto-Threshold Tuner ─────────────────────────────────────────────────────

def auto_tune_thresholds(
    transactions: List[List[str]],
    target_rules: Tuple[int, int] = (15, 60),
    initial_minsup: float = 0.04,
    initial_minconf: float = 0.30,
    max_iterations: int = 10,
) -> Tuple[float, float, str]:
    """
    Automatically tune min_support and min_confidence to hit target rule count.
    Returns (best_minsup, best_minconf, tuning_log).
    """
    minsup = initial_minsup
    minconf = initial_minconf
    min_rules, max_rules = target_rules
    log_lines = []

    n = len(transactions)

    for iteration in range(max_iterations):
        min_sup_count = max(1, int(minsup * n))
        tree = FPTree(transactions, min_sup_count)
        patterns = tree.mine_patterns(min_sup_count)
        rules = generate_rules(patterns, transactions, minconf)
        rule_count = len(rules)

        log_lines.append(
            f"  Tune iter {iteration+1}: minsup={minsup:.4f}, minconf={minconf:.2f} → {rule_count} rules"
        )

        if min_rules <= rule_count <= max_rules:
            log_lines.append(f"  ✅ Target achieved at iteration {iteration+1}")
            break
        elif rule_count < min_rules:
            # Too few rules → lower thresholds
            minsup = max(0.005, minsup * 0.80)
            minconf = max(0.10, minconf * 0.90)
        else:
            # Too many rules → raise thresholds
            minsup = min(0.30, minsup * 1.15)
            minconf = min(0.95, minconf * 1.10)

    return minsup, minconf, "\n".join(log_lines)


# ─── Drift Detector ───────────────────────────────────────────────────────────

def detect_drift(
    prev_rules: List[Dict],
    curr_rules: List[Dict],
    drift_threshold: float = 0.15,
) -> List[Dict]:
    """
    Compare rule support between iterations.
    Flag rules where support shifted beyond drift_threshold.
    """
    prev_map = {
        (tuple(r["antecedent"]), tuple(r["consequent"])): r["support"]
        for r in prev_rules
    }
    curr_map = {
        (tuple(r["antecedent"]), tuple(r["consequent"])): r["support"]
        for r in curr_rules
    }

    drift_events = []
    all_keys = set(prev_map) | set(curr_map)

    for key in all_keys:
        prev_sup = prev_map.get(key, 0)
        curr_sup = curr_map.get(key, 0)
        delta = curr_sup - prev_sup
        pct_change = abs(delta) / max(prev_sup, 0.001)

        if pct_change >= drift_threshold:
            drift_events.append({
                "antecedent": list(key[0]),
                "consequent": list(key[1]),
                "prev_support": round(prev_sup, 6),
                "curr_support": round(curr_sup, 6),
                "delta": round(delta, 6),
                "pct_change": round(pct_change, 4),
                "status": "NEW" if prev_sup == 0 else "DROPPED" if curr_sup == 0 else "DRIFTED",
            })

    return sorted(drift_events, key=lambda x: abs(x["delta"]), reverse=True)


# ─── Recommendation Generator ─────────────────────────────────────────────────

def generate_recommendations(rules: List[Dict], games_metadata: Dict) -> Dict:
    """Generate all business-facing recommendations from rules."""
    scored = [dict(r, score=score_rule(r)) for r in rules]
    scored.sort(key=lambda x: x["score"], reverse=True)

    # ── Top Bundles ───────────────────────────────────────────────────────────
    bundle_candidates = [
        r for r in scored
        if len(r["antecedent"]) + len(r["consequent"]) >= 2
        and r["lift"] >= 1.5
    ]
    top_bundles = bundle_candidates[:10]

    bundles_formatted = []
    for i, b in enumerate(top_bundles):
        all_items = b["antecedent"] + b["consequent"]
        genres = [games_metadata.get(g, {}).get("genre", "Game") for g in all_items]
        genre_label = genres[0] if genres else "Game"
        prices = [games_metadata.get(g, {}).get("price", 0) for g in all_items]
        total_price = sum(prices)

        # Auto-generate bundle name
        if "DLC" in genres:
            name = f"Ultimate {genre_label} Bundle #{i+1}"
        elif "Soundtrack" in genres:
            name = f"Complete {genre_label} Experience Pack #{i+1}"
        elif "Roguelike" in genres or "Indie" in genres:
            name = f"Indie Essentials Bundle #{i+1}"
        else:
            name = f"Top Picks Bundle #{i+1}"

        bundles_formatted.append({
            "bundle_id": f"BUNDLE_{i+1:02d}",
            "name": name,
            "items": all_items,
            "support": b["support"],
            "confidence": b["confidence"],
            "lift": b["lift"],
            "score": b["score"],
            "total_price": round(total_price, 2),
            "suggested_discount": "15%" if total_price > 40 else "10%",
        })

    # ── Homepage Ranking ──────────────────────────────────────────────────────
    item_scores = defaultdict(list)
    for r in scored:
        for item in r["antecedent"] + r["consequent"]:
            item_scores[item].append(r["score"])

    homepage_ranking = []
    for item, scores in item_scores.items():
        avg_score = sum(scores) / len(scores)
        meta = games_metadata.get(item, {})
        homepage_ranking.append({
            "item": item,
            "genre": meta.get("genre", "Unknown"),
            "price": meta.get("price", 0),
            "popularity_score": round(avg_score, 6),
            "rule_appearances": len(scores),
        })
    homepage_ranking.sort(key=lambda x: x["popularity_score"], reverse=True)

    # ── Cross-Sell Map ────────────────────────────────────────────────────────
    cross_sell = defaultdict(list)
    for r in scored:
        for ant_item in r["antecedent"]:
            for cons_item in r["consequent"]:
                cross_sell[ant_item].append({
                    "suggest": cons_item,
                    "confidence": r["confidence"],
                    "lift": r["lift"],
                    "score": r["score"],
                })

    # Keep top 3 suggestions per item
    cross_sell_map = {}
    for item, suggestions in cross_sell.items():
        suggestions.sort(key=lambda x: x["score"], reverse=True)
        cross_sell_map[item] = suggestions[:3]

    # ── Promo Suggestions ─────────────────────────────────────────────────────
    promos = []
    for r in scored[:15]:
        all_items = r["antecedent"] + r["consequent"]
        if len(all_items) == 2 and r["lift"] >= 2.0:
            promos.append({
                "type": "BUY_TOGETHER",
                "items": all_items,
                "headline": f"Bundle & Save: {' + '.join(all_items)}",
                "discount": "20%",
                "trigger": "cart_add",
                "lift": r["lift"],
                "score": r["score"],
            })
        elif len(all_items) >= 3 and r["support"] >= 0.04:
            promos.append({
                "type": "BUNDLE_DEAL",
                "items": all_items,
                "headline": f"Complete the Set: Buy {r['antecedent'][0]}, unlock deals",
                "discount": "15%",
                "trigger": "checkout",
                "lift": r["lift"],
                "score": r["score"],
            })

    return {
        "top_bundles": bundles_formatted,
        "homepage_ranking": homepage_ranking[:20],
        "cross_sell_map": cross_sell_map,
        "promo_suggestions": promos[:10],
        "top_rules": scored[:20],
    }


# ─── Self-Learning Engine ─────────────────────────────────────────────────────

class NexusMBAEngine:
    """
    Self-learning MBA engine that:
    1. Auto-tunes thresholds per iteration
    2. Detects rule drift between iterations
    3. Versions and stores all iterations
    4. Generates ranked business recommendations
    """

    def __init__(self, dataset_name: str, storage_dir: str = "data/processed"):
        self.dataset_name = dataset_name
        self.storage_dir = storage_dir
        self.iterations: List[Dict] = []
        self.current_iteration = 0
        os.makedirs(storage_dir, exist_ok=True)

        # Load existing state if available
        state_path = self._state_path()
        if os.path.exists(state_path):
            with open(state_path) as f:
                state = json.load(f)
                self.iterations = state.get("iterations", [])
                self.current_iteration = len(self.iterations)
            logger.info(f"Loaded existing state: {self.current_iteration} iteration(s)")

    def _state_path(self):
        return os.path.join(self.storage_dir, f"{self.dataset_name}_state.json")

    def run_iteration(
        self,
        transactions: List[List[str]],
        games_metadata: Dict,
        label: str = "",
        force_minsup: float = None,
        force_minconf: float = None,
    ) -> Dict:
        """Run one full learning iteration."""
        self.current_iteration += 1
        iter_label = label or f"Iteration {self.current_iteration}"
        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 {self.dataset_name} | {iter_label}")
        logger.info(f"   Transactions: {len(transactions)}")

        # Auto-tune thresholds (or use forced values)
        if force_minsup and force_minconf:
            minsup, minconf = force_minsup, force_minconf
            tune_log = f"  Manual override: minsup={minsup}, minconf={minconf}"
        else:
            logger.info("   Auto-tuning thresholds...")
            minsup, minconf, tune_log = auto_tune_thresholds(transactions)

        logger.info(f"   Final: minsup={minsup:.4f}, minconf={minconf:.2f}")
        logger.info(tune_log)

        # Mine patterns
        n = len(transactions)
        min_sup_count = max(1, int(minsup * n))
        tree = FPTree(transactions, min_sup_count)
        patterns = tree.mine_patterns(min_sup_count)
        logger.info(f"   Frequent itemsets found: {len(patterns)}")

        # Generate rules
        rules = generate_rules(patterns, transactions, minconf)
        logger.info(f"   Association rules generated: {len(rules)}")

        # Score rules
        scored_rules = [dict(r, score=score_rule(r)) for r in rules]
        scored_rules.sort(key=lambda x: x["score"], reverse=True)

        # Drift detection
        drift_events = []
        if self.iterations:
            prev_rules = self.iterations[-1]["rules"]
            drift_events = detect_drift(prev_rules, scored_rules)
            logger.info(f"   Drift events detected: {len(drift_events)}")

        # Generate recommendations
        recommendations = generate_recommendations(scored_rules, games_metadata)

        # Build iteration record
        iteration_data = {
            "iteration": self.current_iteration,
            "label": iter_label,
            "timestamp": datetime.now().isoformat(),
            "dataset": self.dataset_name,
            "n_transactions": n,
            "minsup": round(minsup, 6),
            "minconf": round(minconf, 6),
            "tune_log": tune_log,
            "n_frequent_itemsets": len(patterns),
            "n_rules": len(rules),
            "rules": scored_rules,
            "drift_events": drift_events,
            "recommendations": recommendations,
            "top_rule": scored_rules[0] if scored_rules else None,
            "avg_lift": round(sum(r["lift"] for r in rules) / len(rules), 4) if rules else 0,
            "avg_confidence": round(sum(r["confidence"] for r in rules) / len(rules), 4) if rules else 0,
        }

        self.iterations.append(iteration_data)
        self._save_state()

        logger.info(f"   ✅ Iteration complete. Top rule score: {scored_rules[0]['score'] if scored_rules else 'N/A'}")
        return iteration_data

    def _save_state(self):
        """Persist all iterations to disk."""
        state = {
            "dataset": self.dataset_name,
            "last_updated": datetime.now().isoformat(),
            "total_iterations": len(self.iterations),
            "iterations": self.iterations,
        }
        with open(self._state_path(), "w") as f:
            json.dump(state, f, indent=2)

    def get_current_recommendations(self) -> Optional[Dict]:
        """Return latest iteration's recommendations."""
        if not self.iterations:
            return None
        return self.iterations[-1]["recommendations"]

    def get_iteration_summary(self) -> List[Dict]:
        """Summary of all iterations for comparison."""
        return [
            {
                "iteration": it["iteration"],
                "label": it["label"],
                "timestamp": it["timestamp"],
                "n_transactions": it["n_transactions"],
                "minsup": it["minsup"],
                "minconf": it["minconf"],
                "n_rules": it["n_rules"],
                "avg_lift": it["avg_lift"],
                "avg_confidence": it["avg_confidence"],
                "n_drift_events": len(it["drift_events"]),
            }
            for it in self.iterations
        ]

    def reset(self):
        """Clear all stored state."""
        self.iterations = []
        self.current_iteration = 0
        if os.path.exists(self._state_path()):
            os.remove(self._state_path())
        logger.info(f"State reset for {self.dataset_name}")
