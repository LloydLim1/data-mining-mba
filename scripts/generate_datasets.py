"""
Dataset Generator for NEXUS MBA System
Generates two realistic video game transaction datasets:
  - Dataset A: Large storefront (Steam-like), 1500 transactions
  - Dataset B: Indie/niche storefront, 1200 transactions
"""

import pandas as pd
import numpy as np
import random
import json
from datetime import datetime, timedelta
import os

random.seed(42)
np.random.seed(42)

# ─── Dataset A: Large Storefront (Steam-like) ─────────────────────────────────
DATASET_A_GAMES = {
    # AAA Games
    "Elden Ring": {"genre": "RPG", "price": 59.99, "popularity": 0.35},
    "Cyberpunk 2077": {"genre": "RPG", "price": 49.99, "popularity": 0.30},
    "Red Dead Redemption 2": {"genre": "Action", "price": 39.99, "popularity": 0.28},
    "The Witcher 3": {"genre": "RPG", "price": 29.99, "popularity": 0.32},
    "God of War": {"genre": "Action", "price": 49.99, "popularity": 0.29},
    "Horizon Zero Dawn": {"genre": "Action", "price": 29.99, "popularity": 0.25},
    "Death Stranding": {"genre": "Adventure", "price": 39.99, "popularity": 0.22},
    "Ghost of Tsushima": {"genre": "Action", "price": 49.99, "popularity": 0.27},
    # FPS / Multiplayer
    "Counter-Strike 2": {"genre": "FPS", "price": 0.00, "popularity": 0.40},
    "Apex Legends": {"genre": "FPS", "price": 0.00, "popularity": 0.38},
    "Valorant": {"genre": "FPS", "price": 0.00, "popularity": 0.36},
    "Overwatch 2": {"genre": "FPS", "price": 0.00, "popularity": 0.33},
    "Call of Duty MW3": {"genre": "FPS", "price": 69.99, "popularity": 0.30},
    "Battlefield 2042": {"genre": "FPS", "price": 29.99, "popularity": 0.22},
    # Indie
    "Hollow Knight": {"genre": "Indie", "price": 14.99, "popularity": 0.28},
    "Celeste": {"genre": "Indie", "price": 19.99, "popularity": 0.24},
    "Hades": {"genre": "Indie", "price": 24.99, "popularity": 0.30},
    "Stardew Valley": {"genre": "Indie", "price": 14.99, "popularity": 0.32},
    "Terraria": {"genre": "Indie", "price": 9.99, "popularity": 0.29},
    "Among Us": {"genre": "Indie", "price": 4.99, "popularity": 0.26},
    # Strategy / Simulation
    "Civilization VI": {"genre": "Strategy", "price": 29.99, "popularity": 0.25},
    "Total War: Warhammer III": {"genre": "Strategy", "price": 49.99, "popularity": 0.22},
    "Cities: Skylines": {"genre": "Simulation", "price": 19.99, "popularity": 0.27},
    "Planet Coaster": {"genre": "Simulation", "price": 24.99, "popularity": 0.20},
    # DLC / Expansions
    "Elden Ring: Shadow of the Erdtree DLC": {"genre": "DLC", "price": 39.99, "popularity": 0.20},
    "Cyberpunk 2077: Phantom Liberty DLC": {"genre": "DLC", "price": 29.99, "popularity": 0.18},
    "The Witcher 3: Blood and Wine DLC": {"genre": "DLC", "price": 19.99, "popularity": 0.22},
    "Civilization VI: New Frontier Pass": {"genre": "DLC", "price": 39.99, "popularity": 0.17},
    # Soundtracks
    "Elden Ring OST": {"genre": "Soundtrack", "price": 9.99, "popularity": 0.12},
    "Cyberpunk 2077 OST": {"genre": "Soundtrack", "price": 9.99, "popularity": 0.11},
    "Hades OST": {"genre": "Soundtrack", "price": 7.99, "popularity": 0.13},
    "Stardew Valley OST": {"genre": "Soundtrack", "price": 7.99, "popularity": 0.14},
}

# Define co-purchase affinities for Dataset A (realistic bundles)
AFFINITIES_A = [
    (["Elden Ring", "Elden Ring: Shadow of the Erdtree DLC"], 0.55),
    (["Elden Ring", "Elden Ring OST"], 0.30),
    (["Elden Ring", "The Witcher 3"], 0.40),
    (["Elden Ring", "Cyberpunk 2077"], 0.35),
    (["Cyberpunk 2077", "Cyberpunk 2077: Phantom Liberty DLC"], 0.58),
    (["Cyberpunk 2077", "Cyberpunk 2077 OST"], 0.28),
    (["The Witcher 3", "The Witcher 3: Blood and Wine DLC"], 0.60),
    (["The Witcher 3", "Cyberpunk 2077"], 0.45),
    (["Hades", "Hades OST"], 0.35),
    (["Hades", "Hollow Knight"], 0.42),
    (["Hades", "Celeste"], 0.38),
    (["Stardew Valley", "Stardew Valley OST"], 0.32),
    (["Stardew Valley", "Terraria"], 0.36),
    (["Stardew Valley", "Among Us"], 0.28),
    (["Counter-Strike 2", "Valorant"], 0.30),
    (["Civilization VI", "Civilization VI: New Frontier Pass"], 0.52),
    (["Civilization VI", "Total War: Warhammer III"], 0.38),
    (["Cities: Skylines", "Planet Coaster"], 0.35),
    (["God of War", "Ghost of Tsushima"], 0.40),
    (["God of War", "Horizon Zero Dawn"], 0.38),
]

# ─── Dataset B: Indie/Niche Storefront ────────────────────────────────────────
DATASET_B_GAMES = {
    "Hollow Knight": {"genre": "Metroidvania", "price": 14.99, "popularity": 0.38},
    "Celeste": {"genre": "Platformer", "price": 19.99, "popularity": 0.35},
    "Hades": {"genre": "Roguelike", "price": 24.99, "popularity": 0.40},
    "Dead Cells": {"genre": "Roguelike", "price": 24.99, "popularity": 0.32},
    "Cuphead": {"genre": "Platformer", "price": 19.99, "popularity": 0.30},
    "Shovel Knight": {"genre": "Platformer", "price": 14.99, "popularity": 0.28},
    "Axiom Verge": {"genre": "Metroidvania", "price": 19.99, "popularity": 0.22},
    "Ori and the Blind Forest": {"genre": "Platformer", "price": 19.99, "popularity": 0.27},
    "Disco Elysium": {"genre": "RPG", "price": 29.99, "popularity": 0.25},
    "Undertale": {"genre": "RPG", "price": 9.99, "popularity": 0.34},
    "Deltarune": {"genre": "RPG", "price": 0.00, "popularity": 0.28},
    "Omori": {"genre": "RPG", "price": 19.99, "popularity": 0.26},
    "Stardew Valley": {"genre": "Simulation", "price": 14.99, "popularity": 0.42},
    "Terraria": {"genre": "Sandbox", "price": 9.99, "popularity": 0.36},
    "Risk of Rain 2": {"genre": "Roguelike", "price": 24.99, "popularity": 0.30},
    "Enter the Gungeon": {"genre": "Roguelike", "price": 14.99, "popularity": 0.28},
    "Binding of Isaac: Rebirth": {"genre": "Roguelike", "price": 14.99, "popularity": 0.32},
    "Nuclear Throne": {"genre": "Roguelike", "price": 11.99, "popularity": 0.22},
    # DLC
    "Dead Cells: Fatal Falls DLC": {"genre": "DLC", "price": 4.99, "popularity": 0.18},
    "Cuphead: The Delicious Last Course DLC": {"genre": "DLC", "price": 7.99, "popularity": 0.22},
    "Binding of Isaac: Afterbirth+ DLC": {"genre": "DLC", "price": 9.99, "popularity": 0.20},
    # Soundtracks
    "Hades OST": {"genre": "Soundtrack", "price": 7.99, "popularity": 0.18},
    "Celeste OST": {"genre": "Soundtrack", "price": 7.99, "popularity": 0.20},
    "Hollow Knight OST": {"genre": "Soundtrack", "price": 5.99, "popularity": 0.16},
    "Undertale OST": {"genre": "Soundtrack", "price": 9.99, "popularity": 0.22},
    "Cuphead OST": {"genre": "Soundtrack", "price": 9.99, "popularity": 0.15},
}

AFFINITIES_B = [
    (["Hollow Knight", "Hollow Knight OST"], 0.38),
    (["Hollow Knight", "Celeste"], 0.45),
    (["Hollow Knight", "Ori and the Blind Forest"], 0.40),
    (["Hollow Knight", "Axiom Verge"], 0.35),
    (["Celeste", "Celeste OST"], 0.42),
    (["Celeste", "Cuphead"], 0.38),
    (["Hades", "Hades OST"], 0.40),
    (["Hades", "Dead Cells"], 0.42),
    (["Hades", "Risk of Rain 2"], 0.38),
    (["Dead Cells", "Dead Cells: Fatal Falls DLC"], 0.55),
    (["Cuphead", "Cuphead: The Delicious Last Course DLC"], 0.60),
    (["Cuphead", "Cuphead OST"], 0.30),
    (["Undertale", "Deltarune"], 0.65),
    (["Undertale", "Undertale OST"], 0.40),
    (["Undertale", "Omori"], 0.42),
    (["Binding of Isaac: Rebirth", "Binding of Isaac: Afterbirth+ DLC"], 0.58),
    (["Stardew Valley", "Terraria"], 0.40),
    (["Risk of Rain 2", "Enter the Gungeon"], 0.38),
    (["Enter the Gungeon", "Nuclear Throne"], 0.32),
    (["Disco Elysium", "Undertale"], 0.30),
]


def generate_transactions(games_dict, affinities, n_transactions, dataset_name):
    """Generate realistic transaction data with affinity-based co-purchases."""
    game_names = list(games_dict.keys())
    popularities = [games_dict[g]["popularity"] for g in game_names]
    
    transactions = []
    start_date = datetime(2023, 1, 1)
    
    for i in range(n_transactions):
        basket = set()
        
        # Basket size: weighted toward 1-4 items (realistic)
        basket_size = np.random.choice(
            [1, 2, 3, 4, 5, 6, 7],
            p=[0.20, 0.28, 0.22, 0.15, 0.08, 0.04, 0.03]
        )
        
        # Pick a seed item based on popularity
        probs = np.array(popularities) / sum(popularities)
        seed = np.random.choice(game_names, p=probs)
        basket.add(seed)
        
        # Add affinity-based items
        for items, strength in affinities:
            if seed in items and random.random() < strength:
                for item in items:
                    if item != seed:
                        basket.add(item)
        
        # Fill remaining slots randomly
        while len(basket) < basket_size:
            item = np.random.choice(game_names, p=probs)
            basket.add(item)
        
        # Generate transaction metadata
        date = start_date + timedelta(days=random.randint(0, 364))
        transactions.append({
            "transaction_id": f"{dataset_name}_TXN_{i+1:04d}",
            "date": date.strftime("%Y-%m-%d"),
            "items": list(basket),
            "basket_size": len(basket),
        })
    
    return transactions


def save_datasets():
    """Generate and save both datasets."""
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating Dataset A (Large Storefront)...")
    txns_a = generate_transactions(DATASET_A_GAMES, AFFINITIES_A, 1500, "A")
    
    print("Generating Dataset B (Indie Storefront)...")
    txns_b = generate_transactions(DATASET_B_GAMES, AFFINITIES_B, 1200, "B")
    
    # Save as JSON (full transaction objects)
    with open(os.path.join(output_dir, "dataset_a_transactions.json"), "w") as f:
        json.dump(txns_a, f, indent=2)
    
    with open(os.path.join(output_dir, "dataset_b_transactions.json"), "w") as f:
        json.dump(txns_b, f, indent=2)
    
    # Save as CSV (flat format for inspection)
    rows_a = []
    for txn in txns_a:
        for item in txn["items"]:
            rows_a.append({"transaction_id": txn["transaction_id"], "date": txn["date"], "item": item})
    pd.DataFrame(rows_a).to_csv(os.path.join(output_dir, "dataset_a_flat.csv"), index=False)
    
    rows_b = []
    for txn in txns_b:
        for item in txn["items"]:
            rows_b.append({"transaction_id": txn["transaction_id"], "date": txn["date"], "item": item})
    pd.DataFrame(rows_b).to_csv(os.path.join(output_dir, "dataset_b_flat.csv"), index=False)
    
    # Save game metadata
    with open(os.path.join(output_dir, "games_metadata_a.json"), "w") as f:
        json.dump(DATASET_A_GAMES, f, indent=2)
    with open(os.path.join(output_dir, "games_metadata_b.json"), "w") as f:
        json.dump(DATASET_B_GAMES, f, indent=2)
    
    # Stats
    print(f"\n✅ Dataset A: {len(txns_a)} transactions, {len(DATASET_A_GAMES)} unique items")
    sizes_a = [t["basket_size"] for t in txns_a]
    print(f"   Basket size: min={min(sizes_a)}, max={max(sizes_a)}, avg={sum(sizes_a)/len(sizes_a):.2f}")
    
    print(f"✅ Dataset B: {len(txns_b)} transactions, {len(DATASET_B_GAMES)} unique items")
    sizes_b = [t["basket_size"] for t in txns_b]
    print(f"   Basket size: min={min(sizes_b)}, max={max(sizes_b)}, avg={sum(sizes_b)/len(sizes_b):.2f}")
    
    return txns_a, txns_b


if __name__ == "__main__":
    save_datasets()
