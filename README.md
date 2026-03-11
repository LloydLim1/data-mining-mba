# NEXUS MBA Engine
### Self-Learning Market Basket Analysis for a Video Game Digital Storefront

> *A fully automated MBA system that mines purchase patterns, detects trend drift, and generates live game bundle recommendations — inspired by platforms like Steam and PlayStation Store.*

---

## What Is This?

NEXUS is a **self-learning Market Basket Analysis system** built around a simulated video game digital storefront. It ingests transaction data, mines frequent game co-purchase patterns using **FP-Growth**, scores and ranks association rules, detects when player trends shift (drift detection), and auto-generates:

- 📦 Game bundles (e.g. "Ultimate RPG Starter Pack")
- 🏠 Homepage game rankings
- 🛒 Cart cross-sell suggestions
- 🎁 Promotional deal recommendations

The system **automatically updates** across iterations — no manual threshold tuning required.

---

## Project Structure

```
nexus-mba/
├── backend/
│   ├── engine/
│   │   └── mba_engine.py       # FP-Growth, rule generation, scoring, drift detection
│   └── main.py                 # FastAPI REST API
├── frontend/
│   ├── src/
│   │   ├── pages/              # Dashboard, Bundles, Rules, Homepage, Iterations, Promos
│   │   ├── components/         # NavBar
│   │   ├── utils/api.js        # API fetch utilities
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css           # Full dark gaming theme (Orbitron + Rajdhani)
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── scripts/
│   └── generate_datasets.py    # Generates Dataset A (1500 txns) and Dataset B (1200 txns)
├── data/
│   ├── raw/                    # Auto-populated by generate_datasets.py
│   └── processed/              # Auto-populated by the engine (versioned state JSON)
├── environment.yml
└── README.md
```

---

## Datasets

| | Dataset A | Dataset B |
|---|---|---|
| **Theme** | Large storefront (Steam-like) | Indie game storefront |
| **Transactions** | 1,500 | 1,200 |
| **Unique Items** | 32 | 25 |
| **Item Types** | AAA games, FPS, Indie, DLC, Soundtracks | Metroidvanias, Roguelikes, Platformers, DLC, OSTs |
| **Basket Size** | 1–7 items (avg ~2.8) | 1–7 items (avg ~2.7) |
| **Notable Patterns** | Elden Ring + DLC, Witcher + Cyberpunk, Hades + Hollow Knight | Undertale + Deltarune, Celeste + Cuphead, Hades + Dead Cells |

Datasets are generated synthetically using realistic co-purchase affinity rules. Run `generate_datasets.py` to create them.

---

## Self-Learning Mechanism

The system demonstrates three intelligent behaviors:

### 1. Auto-Threshold Tuning
Instead of manually setting `min_support` and `min_confidence`, the engine **automatically tunes them** to hit a target rule count range (15–60 rules). It adjusts thresholds up or down across up to 10 tuning iterations per run.

### 2. Rule Drift Detection
Between iterations, the engine compares rule support values. Any rule where support shifts by **≥15%** is flagged as a drift event with a `NEW`, `DROPPED`, or `DRIFTED` label. When a viral game is injected (Iteration 3+), this drives visible drift.

### 3. Viral Game Injection (Trend Simulation)
Iteration 3+ can inject a "viral game" into 30% of transactions, simulating a real-world event like a major release. The engine adapts: new rules appear, old rules drift, homepage rankings update.

### 4. Composite Rule Scoring
Rules are ranked by a weighted composite score:
```
score = 0.40 × lift_norm + 0.30 × confidence + 0.15 × support_norm + 0.15 × conviction_norm
```
This ensures recommendations reflect business value, not just raw frequency.

---

## Quick Start

### Prerequisites
- [Anaconda or Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- [Node.js 18+](https://nodejs.org/)
- Python 3.11

---

### Step 1 — Create the Python Environment

```bash
conda env create -f environment.yml
conda activate nexus-mba
```

### Windows PowerShell Note (What We Actually Ran)

If `conda` is not recognized in VS Code PowerShell, use `conda.bat` directly:

```powershell
& "$env:USERPROFILE\anaconda3\condabin\conda.bat" env create -f environment.yml
```

If activation is not available yet, run backend without activation:

```powershell
cd backend
& "$env:USERPROFILE\anaconda3\condabin\conda.bat" run -n nexus-mba uvicorn main:app --reload --port 8000
```

Optional one-time setup so `conda activate` works in PowerShell:

```powershell
& "$env:USERPROFILE\anaconda3\condabin\conda.bat" init powershell
```

Then close and reopen terminal, and the usual commands work:

```powershell
conda activate nexus-mba
cd backend
uvicorn main:app --reload --port 8000
```

---

### Step 2 — Generate the Datasets

```bash
cd scripts
python generate_datasets.py
```

This creates `data/raw/dataset_a_transactions.json`, `dataset_b_transactions.json`, and metadata files.

---

### Step 3 — Start the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API is live at: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

### Step 4 — Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend is live at: `http://localhost:5173`

---

## Running the Self-Learning Demo (3 Iterations)

1. Open `http://localhost:5173`
2. Select **DS-A · Steam** or **DS-B · Indie** from the top-right switcher
3. On the **Dashboard** tab:
   - Click **▶ Run Iteration 1** → Baseline patterns are mined
   - Click **▶ Run Iteration 2** → System updates, first drift detection runs
   - Enable **"Inject viral game"**, select a title, click **▶ Run Iteration 3** → Viral trend shifts patterns, drift events appear
4. Explore tabs: **Bundles**, **Rules**, **Homepage**, **Promos**, **Iterations**

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/datasets` | List available datasets with stats |
| POST | `/api/run-iteration` | Run one self-learning iteration |
| GET | `/api/iterations/{ds}` | Get iteration history summary |
| GET | `/api/iterations/{ds}/{n}` | Get full detail for iteration N |
| GET | `/api/recommendations/{ds}` | All recommendations (latest iteration) |
| GET | `/api/bundles/{ds}` | Top game bundles |
| GET | `/api/homepage/{ds}` | Homepage ranking |
| GET | `/api/promos/{ds}` | Promo suggestions |
| POST | `/api/cross-sell` | Cross-sell suggestions for a cart item |
| GET | `/api/rules/{ds}` | Association rules (filterable by min_lift) |
| GET | `/api/drift/{ds}` | Drift events from latest iteration |
| DELETE | `/api/reset/{ds}` | Reset all state for a dataset |

---

## MBA Algorithm: Why FP-Growth?

We use **FP-Growth** instead of Apriori for the following reasons:

| Criterion | Apriori | FP-Growth (NEXUS) |
|-----------|---------|-------------------|
| Database scans | Multiple (per level) | 2 only |
| Candidate generation | Yes (expensive) | No (tree-based) |
| Memory for dense data | High | Compact (prefix sharing) |
| Speed on 1000+ transactions | Slower | 3–10× faster |
| Handles varied basket sizes | Yes | Yes (better) |

Gaming baskets (1–7 items, dense item co-occurrence) are ideal for FP-Growth's prefix-tree compression. Apriori would generate excessive candidates for items like "Elden Ring" which appear in many baskets together with multiple DLC and companion titles.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| MBA Engine | Python (pure implementation — no mlxtend dependency) |
| API | FastAPI + Uvicorn |
| Frontend | React 18 + Vite |
| Styling | Custom CSS (Orbitron + Rajdhani fonts, dark gaming theme) |
| State Storage | JSON files (versioned per dataset) |
| Data Generation | Python (pandas, numpy) |

---

## Troubleshooting

**"Dataset not found" error from the API**
→ Run `python scripts/generate_datasets.py` first.

**"No iterations run yet" on Bundles/Rules/Homepage/Promos**
→ Go to Dashboard and run at least 1 iteration.

**CORS errors in browser**
→ Make sure backend is running on port 8000 and frontend on 5173.

**Frontend won't start**
→ Run `npm install` inside the `frontend/` directory first.

**`conda` is not recognized in PowerShell**
→ Use `& "$env:USERPROFILE\anaconda3\condabin\conda.bat" ...` commands, or run `conda.bat init powershell`, then restart terminal.

**`uvicorn` is not recognized**
→ The `nexus-mba` environment is not active. Either run `conda activate nexus-mba` first, or use:
`& "$env:USERPROFILE\anaconda3\condabin\conda.bat" run -n nexus-mba uvicorn main:app --reload --port 8000`

---

## Team

NEXUS MBA Engine — Video Game Storefront Track  
Market Basket Analysis Machine Learning Program

---

*Built with Python + React. Data is synthetically generated to simulate realistic video game purchase behavior.*
