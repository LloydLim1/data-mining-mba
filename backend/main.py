"""
NEXUS MBA — FastAPI Backend
Serves MBA results and controls self-learning iterations via REST API.
"""

import json
import os
import csv
import io
import random
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.mba_engine import NexusMBAEngine

app = FastAPI(title="NEXUS MBA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── State ────────────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
REGISTRY_PATH = os.path.join(DATA_DIR, "dataset_registry.json")
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "raw"), exist_ok=True)

engines: dict[str, NexusMBAEngine] = {}
datasets: dict[str, dict] = {}


def _load_registry() -> dict:
    """Load the dataset registry (id → name mapping)."""
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    return {}


def _save_registry(registry: dict):
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def load_dataset(dataset_id: str) -> dict:
    """Load transactions and metadata for a dataset."""
    if dataset_id in datasets:
        return datasets[dataset_id]

    raw_dir = os.path.join(DATA_DIR, "raw")
    txn_path = os.path.join(raw_dir, f"dataset_{dataset_id}_transactions.json")
    meta_path = os.path.join(raw_dir, f"games_metadata_{dataset_id}.json")

    if not os.path.exists(txn_path):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found. Run generate_datasets.py first.")

    with open(txn_path) as f:
        transactions_raw = json.load(f)

    with open(meta_path) as f:
        metadata = json.load(f)

    datasets[dataset_id] = {
        "transactions_raw": transactions_raw,
        "metadata": metadata,
    }
    return datasets[dataset_id]


def get_engine(dataset_id: str) -> NexusMBAEngine:
    if dataset_id not in engines:
        engines[dataset_id] = NexusMBAEngine(dataset_id, storage_dir=PROCESSED_DIR)
    return engines[dataset_id]


def transactions_to_lists(transactions_raw: list, limit: int = None) -> List[List[str]]:
    """Convert raw transaction objects to list-of-lists format."""
    txns = transactions_raw[:limit] if limit else transactions_raw
    return [t["items"] for t in txns]


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class RunIterationRequest(BaseModel):
    dataset_id: str
    label: Optional[str] = None
    transaction_limit: Optional[int] = None
    inject_viral_game: Optional[str] = None  # Simulate a viral game trend


class CrossSellRequest(BaseModel):
    dataset_id: str
    item: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "NEXUS MBA Engine is live", "version": "1.0.0"}


@app.get("/api/datasets")
def list_datasets():
    """List all available datasets (dynamically discovered)."""
    raw_dir = os.path.join(DATA_DIR, "raw")
    registry = _load_registry()
    result = []

    # Discover all dataset_*_transactions.json files
    if os.path.exists(raw_dir):
        for fname in sorted(os.listdir(raw_dir)):
            if fname.startswith("dataset_") and fname.endswith("_transactions.json"):
                ds_id = fname.replace("dataset_", "").replace("_transactions.json", "")
                txn_path = os.path.join(raw_dir, fname)
                meta_path = os.path.join(raw_dir, f"games_metadata_{ds_id}.json")

                with open(txn_path) as f:
                    txns = json.load(f)

                meta = {}
                if os.path.exists(meta_path):
                    with open(meta_path) as f:
                        meta = json.load(f)

                sizes = [len(t["items"]) for t in txns]
                result.append({
                    "id": ds_id,
                    "name": registry.get(ds_id, ds_id.upper()),
                    "n_transactions": len(txns),
                    "n_items": len(meta) if meta else len(set(item for t in txns for item in t["items"])),
                    "avg_basket_size": round(sum(sizes) / len(sizes), 2) if sizes else 0,
                    "min_basket": min(sizes) if sizes else 0,
                    "max_basket": max(sizes) if sizes else 0,
                })
    return result


@app.post("/api/upload-dataset/{dataset_id}")
async def upload_dataset(dataset_id: str, file: UploadFile = File(...), name: Optional[str] = None):
    """
    Upload a CSV file to create/replace a dataset.
    Expected CSV columns: transaction_id, date, item
    (flat format — one row per item per transaction)
    """
    import re
    # Sanitize dataset_id: only allow alphanumeric, hyphens, underscores
    if not re.match(r'^[a-zA-Z0-9_-]+$', dataset_id) or len(dataset_id) > 64:
        raise HTTPException(status_code=400, detail="Dataset ID must be alphanumeric (a-z, 0-9, -, _) and max 64 chars.")

    # Read and validate CSV
    contents = await file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    fields = reader.fieldnames or []

    # Normalize column names: lowercase + strip whitespace
    fields_lower = [f.strip().lower() for f in fields]

    # Map possible column names
    col_map = {}
    for i, f in enumerate(fields_lower):
        if f in ("transaction_id", "transactionid", "txn_id", "txnid", "order_id", "orderid"):
            col_map["transaction_id"] = fields[i]
        elif f in ("item", "items", "product", "game", "product_name", "item_name", "game_name"):
            col_map["item"] = fields[i]
        elif f in ("date", "order_date", "transaction_date", "purchase_date"):
            col_map["date"] = fields[i]
        elif f in ("price", "cost", "item_price", "product_price", "amount", "price_php"):
            col_map["price"] = fields[i]
        elif f in ("genre", "category", "type", "product_type", "game_genre"):
            col_map["genre"] = fields[i]

    if "transaction_id" not in col_map or "item" not in col_map:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have columns for transaction ID and item. Found: {fields}. "
                   f"Expected columns like: transaction_id, item (and optionally date, price, genre)."
        )

    # Parse rows into transactions
    txn_map = {}  # transaction_id -> {date, items}
    unique_items = {}
    row_count = 0

    for row in reader:
        row_count += 1
        txn_id = row[col_map["transaction_id"]].strip()
        item = row[col_map["item"]].strip()
        date = row.get(col_map.get("date", ""), "2024-01-01").strip() or "2024-01-01"
        
        # Extract price if available
        price_str = row.get(col_map.get("price", ""), "0").strip()
        try:
            price = float(price_str) if price_str else 0
        except ValueError:
            price = 0
        
        # Extract genre if available
        genre = row.get(col_map.get("genre", ""), "Unknown").strip() or "Unknown"

        if not txn_id or not item:
            continue

        if txn_id not in txn_map:
            txn_map[txn_id] = {"date": date, "items": []}
        txn_map[txn_id]["items"].append(item)

        if item not in unique_items:
            unique_items[item] = {"genre": genre, "price": price, "popularity": 0}

    if not txn_map:
        raise HTTPException(status_code=400, detail="CSV contained no valid transaction rows.")

    # Build transaction list
    transactions = [
        {
            "transaction_id": tid,
            "date": data["date"],
            "items": data["items"],
            "basket_size": len(data["items"]),
        }
        for tid, data in txn_map.items()
    ]

    # Save to data/raw
    raw_dir = os.path.join(DATA_DIR, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    txn_path = os.path.join(raw_dir, f"dataset_{dataset_id}_transactions.json")
    meta_path = os.path.join(raw_dir, f"games_metadata_{dataset_id}.json")

    with open(txn_path, "w") as f:
        json.dump(transactions, f, indent=2)
    with open(meta_path, "w") as f:
        json.dump(unique_items, f, indent=2)

    # Clear cached state for this dataset
    datasets.pop(dataset_id, None)
    if dataset_id in engines:
        engines[dataset_id].reset()
        del engines[dataset_id]

    # Save name to registry
    registry = _load_registry()
    registry[dataset_id] = name or file.filename.replace(".csv", "").replace("_", " ").title()
    _save_registry(registry)

    sizes = [len(t["items"]) for t in transactions]
    return {
        "dataset_id": dataset_id,
        "message": f"Dataset '{registry[dataset_id]}' uploaded successfully",
        "filename": file.filename,
        "name": registry[dataset_id],
        "n_transactions": len(transactions),
        "n_items": len(unique_items),
        "avg_basket_size": round(sum(sizes) / len(sizes), 2),
        "rows_parsed": row_count,
    }


@app.delete("/api/dataset/{dataset_id}")
def delete_dataset(dataset_id: str):
    """Remove an uploaded dataset and all its iterations."""
    raw_dir = os.path.join(DATA_DIR, "raw")
    txn_path = os.path.join(raw_dir, f"dataset_{dataset_id}_transactions.json")
    meta_path = os.path.join(raw_dir, f"games_metadata_{dataset_id}.json")

    for p in [txn_path, meta_path]:
        if os.path.exists(p):
            os.remove(p)

    # Clear engine state
    datasets.pop(dataset_id, None)
    if dataset_id in engines:
        engines[dataset_id].reset()
        del engines[dataset_id]

    # Remove from registry
    registry = _load_registry()
    registry.pop(dataset_id, None)
    _save_registry(registry)

    return {"message": f"Dataset '{dataset_id}' deleted"}


@app.post("/api/run-iteration")
def run_iteration(req: RunIterationRequest):
    """Run one self-learning iteration on a dataset."""
    ds = load_dataset(req.dataset_id)
    engine = get_engine(req.dataset_id)

    txns_raw = ds["transactions_raw"]

    # Simulate viral game injection
    if req.inject_viral_game:
        viral_game = req.inject_viral_game
        # Add the viral game to 30% of transactions
        injected = []
        for t in txns_raw:
            new_t = dict(t)
            if random.random() < 0.30 and viral_game not in t["items"]:
                new_t["items"] = t["items"] + [viral_game]
            injected.append(new_t)
        txns_raw = injected
        # Add to metadata if not present
        if viral_game not in ds["metadata"]:
            ds["metadata"][viral_game] = {"genre": "Action", "price": 59.99, "popularity": 0.45}

    transactions = transactions_to_lists(txns_raw, req.transaction_limit)
    iteration = engine.run_iteration(transactions, ds["metadata"], label=req.label)

    # Return a summary (rules can be large)
    return {
        "iteration": iteration["iteration"],
        "label": iteration["label"],
        "timestamp": iteration["timestamp"],
        "n_transactions": iteration["n_transactions"],
        "minsup": iteration["minsup"],
        "minconf": iteration["minconf"],
        "tune_log": iteration["tune_log"],
        "n_frequent_itemsets": iteration["n_frequent_itemsets"],
        "n_rules": iteration["n_rules"],
        "avg_lift": iteration["avg_lift"],
        "avg_confidence": iteration["avg_confidence"],
        "n_drift_events": len(iteration["drift_events"]),
        "top_rule": iteration["top_rule"],
    }


@app.get("/api/iterations/{dataset_id}")
def get_iterations(dataset_id: str):
    """Get summary of all iterations for a dataset."""
    engine = get_engine(dataset_id)
    return engine.get_iteration_summary()


@app.get("/api/iterations/{dataset_id}/{iteration_num}")
def get_iteration_detail(dataset_id: str, iteration_num: int):
    """Get full detail for a specific iteration."""
    engine = get_engine(dataset_id)
    matches = [it for it in engine.iterations if it["iteration"] == iteration_num]
    if not matches:
        raise HTTPException(status_code=404, detail="Iteration not found")
    it = matches[0]
    return {
        "iteration": it["iteration"],
        "label": it["label"],
        "timestamp": it["timestamp"],
        "n_transactions": it["n_transactions"],
        "minsup": it["minsup"],
        "minconf": it["minconf"],
        "tune_log": it["tune_log"],
        "n_frequent_itemsets": it["n_frequent_itemsets"],
        "n_rules": it["n_rules"],
        "avg_lift": it["avg_lift"],
        "avg_confidence": it["avg_confidence"],
        "drift_events": it["drift_events"][:20],
        "top_rules": it["rules"][:20],
    }


@app.get("/api/recommendations/{dataset_id}")
def get_recommendations(dataset_id: str):
    """Get latest recommendations for a dataset."""
    engine = get_engine(dataset_id)
    recs = engine.get_current_recommendations()
    if not recs:
        raise HTTPException(status_code=404, detail="No iterations run yet. Run an iteration first.")
    return recs


@app.get("/api/homepage/{dataset_id}")
def get_homepage(dataset_id: str):
    """Homepage ranking — top games to show first."""
    engine = get_engine(dataset_id)
    recs = engine.get_current_recommendations()
    if not recs:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    return recs["homepage_ranking"]


@app.get("/api/bundles/{dataset_id}")
def get_bundles(dataset_id: str):
    """Top game bundles."""
    engine = get_engine(dataset_id)
    recs = engine.get_current_recommendations()
    if not recs:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    return recs["top_bundles"]


@app.get("/api/promos/{dataset_id}")
def get_promos(dataset_id: str):
    """Promo suggestions."""
    engine = get_engine(dataset_id)
    recs = engine.get_current_recommendations()
    if not recs:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    return recs["promo_suggestions"]


@app.post("/api/cross-sell")
def get_cross_sell(req: CrossSellRequest):
    """Get cross-sell suggestions when a user adds an item to cart."""
    engine = get_engine(req.dataset_id)
    recs = engine.get_current_recommendations()
    if not recs:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    
    # Case-insensitive lookup: normalize input to lowercase and match against lowercase keys
    item_lower = req.item.lower()
    cross_sell_map = recs["cross_sell_map"]
    
    # Try exact match first, then case-insensitive search
    suggestions = cross_sell_map.get(req.item)
    if suggestions is None:
        suggestions = next(
            (v for k, v in cross_sell_map.items() if k.lower() == item_lower),
            []
        )
    
    return {
        "item": req.item,
        "suggestions": suggestions,
    }


@app.delete("/api/reset/{dataset_id}")
def reset_engine(dataset_id: str):
    """Reset all iterations for a dataset (for demo/testing)."""
    engine = get_engine(dataset_id)
    engine.reset()
    return {"message": f"Reset complete for dataset {dataset_id}"}


@app.get("/api/drift/{dataset_id}")
def get_drift(dataset_id: str):
    """Get drift events from the latest iteration."""
    engine = get_engine(dataset_id)
    if not engine.iterations:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    latest = engine.iterations[-1]
    return {
        "iteration": latest["iteration"],
        "label": latest["label"],
        "drift_events": latest["drift_events"],
    }


@app.get("/api/rules/{dataset_id}")
def get_rules(dataset_id: str, min_lift: float = 1.0, limit: int = 50):
    """Get top association rules from latest iteration."""
    engine = get_engine(dataset_id)
    if not engine.iterations:
        raise HTTPException(status_code=404, detail="No iterations run yet.")
    rules = engine.iterations[-1]["rules"]
    filtered = [r for r in rules if r["lift"] >= min_lift]
    return filtered[:limit]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
