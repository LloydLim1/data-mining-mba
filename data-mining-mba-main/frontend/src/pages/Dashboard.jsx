import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";

const ITER_LABELS = [
  "Initial Baseline",
  "Post-Sale Surge",
  "Viral Release Drop",
  "Holiday Season",
  "Community Event",
];

export default function Dashboard({ dataset, refreshDatasets, setActiveDataset }) {
  const [iterations, setIterations] = useState([]);
  const [dsInfo, setDsInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runLog, setRunLog] = useState("");
  const [error, setError] = useState("");
  const [injectViral, setInjectViral] = useState(false);
  const [viralName, setViralName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [checking, setChecking] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [newDsName, setNewDsName] = useState("");
  const newFileRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [runLog]);

  useEffect(() => {
    setUploadMsg("");
    setError("");
    setRunLog("");
    if (dataset) loadData();
    else { setDsInfo(null); setIterations([]); setChecking(false); }
  }, [dataset]);

  async function loadData() {
    setChecking(true);
    try {
      const [iters, dsList] = await Promise.all([
        api.getIterations(dataset).catch(() => []),
        api.getDatasets(),
      ]);
      setIterations(iters);
      const found = dsList.find((d) => d.id === dataset);
      setDsInfo(found || null);
    } catch (e) {
      setDsInfo(null);
      setIterations([]);
    } finally {
      setChecking(false);
    }
  }

  // Replace CSV for the current dataset
  async function handleUpload(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setUploadMsg(""); setError("Please upload a .csv file");
      return;
    }
    setUploading(true); setError(""); setUploadMsg("");
    try {
      const result = await api.uploadDataset(dataset, file, dsInfo?.name || dataset);
      setUploadMsg(
        `✅ ${result.filename} imported — ${result.n_transactions} transactions, ${result.n_items} unique items, avg basket ${result.avg_basket_size}`
      );
      await refreshDatasets();
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  // Upload a brand new dataset
  async function handleNewUpload(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file"); return;
    }
    const name = newDsName.trim();
    if (!name) { setError("Please enter a dataset name first"); return; }
    // Generate a safe ID from the name
    const dsId = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").substring(0, 30) || "dataset";
    setUploading(true); setError(""); setUploadMsg("");
    try {
      const result = await api.uploadDataset(dsId, file, name);
      setUploadMsg(
        `✅ ${result.filename} imported — ${result.n_transactions} transactions, ${result.n_items} unique items`
      );
      setNewDsName("");
      await refreshDatasets();
      setActiveDataset(dsId);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function onFileSelect(e) {
    handleUpload(e.target.files[0]);
    e.target.value = "";
  }

  function onNewFileSelect(e) {
    handleNewUpload(e.target.files[0]);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleNewUpload(file);
  }

  async function removeDataset() {
    if (!confirm(`Remove dataset "${dsInfo?.name || dataset}" and all its iterations?`)) return;
    try {
      await api.deleteDataset(dataset);
      await refreshDatasets();
    } catch (e) {
      setError(e.message);
    }
  }

  async function runIteration() {
    setLoading(true);
    setError("");
    setRunLog("");
    try {
      const iterNum = iterations.length + 1;
      const label = ITER_LABELS[Math.min(iterNum - 1, ITER_LABELS.length - 1)];
      const payload = {
        dataset_id: dataset,
        label,
        inject_viral_game: injectViral && iterNum >= 3 && viralName.trim() ? viralName.trim() : null,
      };
      const result = await api.runIteration(payload);
      setRunLog(
        `✅ ${result.label} complete\n` +
        `   Transactions: ${result.n_transactions}\n` +
        `   Minsup: ${(result.minsup * 100).toFixed(2)}%  Minconf: ${(result.minconf * 100).toFixed(0)}%\n` +
        `   Frequent itemsets: ${result.n_frequent_itemsets}\n` +
        `   Rules generated: ${result.n_rules}\n` +
        `   Avg lift: ${result.avg_lift}  Avg conf: ${result.avg_confidence}\n` +
        `   Drift events: ${result.n_drift_events}\n` +
        (result.tune_log ? `\nAuto-tune log:\n${result.tune_log}` : "")
      );
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetEngine() {
    if (!confirm("Reset all iterations for this dataset?")) return;
    await api.reset(dataset);
    setIterations([]);
    setRunLog("");
    setError("");
  }

  const latestIter = iterations[iterations.length - 1];
  const dsLabel = dsInfo?.name || dataset || "—";

  if (checking) {
    return <div className="spinner-wrap"><div className="spinner" /><span>Checking dataset...</span></div>;
  }

  // ── No dataset selected or no dataset uploaded — show upload screen ──
  if (!dataset || !dsInfo) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">
            <span className="accent">NEXUS</span> MBA Engine
          </h1>
          <p className="page-subtitle">
            Self-learning Market Basket Analysis
          </p>
        </div>

        <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
          <div className="card-title">Import New Dataset</div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.7 }}>
            Upload a CSV file containing transaction data.
            The CSV should have these columns:
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <span className="badge badge-cyan">transaction_id</span>
            <span className="badge badge-purple">item</span>
            <span className="badge badge-green">date (optional)</span>
          </div>

          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 20 }}>
            Flat format — one row per item per transaction.
          </p>

          {/* Dataset name input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Dataset Name
            </label>
            <input
              type="text"
              value={newDsName}
              onChange={(e) => setNewDsName(e.target.value)}
              placeholder='e.g. "DS-A · Steam Games" or "Q1 Sales"'
              style={{
                width: "100%", padding: "8px 12px", background: "var(--bg-panel)",
                border: "1px solid var(--border-bright)", borderRadius: 6,
                color: "var(--text-primary)", fontFamily: "Rajdhani", fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => newFileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--neon-cyan)" : "var(--border-bright)"}`,
              borderRadius: 8,
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(0,245,255,0.05)" : "var(--bg-panel)",
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            <input
              ref={newFileRef}
              type="file"
              accept=".csv"
              onChange={onNewFileSelect}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "2.5rem", marginBottom: 10, opacity: 0.4 }}>📁</div>
            {uploading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span style={{ color: "var(--neon-cyan)" }}>Importing dataset...</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  Drop CSV file here or click to browse
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Accepts .csv files
                </div>
              </>
            )}
          </div>

          {uploadMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{uploadMsg}</div>}
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}

          <div style={{
            background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6,
            padding: "12px 16px", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.8,
            fontFamily: "Share Tech Mono, monospace",
          }}>
            <div style={{ color: "var(--text-secondary)", marginBottom: 4, fontFamily: "Rajdhani", fontWeight: 600, fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              CSV Example
            </div>
            transaction_id,date,item<br />
            TXN_001,2024-03-15,Elden Ring<br />
            TXN_001,2024-03-15,The Witcher 3<br />
            TXN_002,2024-03-16,Hades<br />
            TXN_002,2024-03-16,Hollow Knight<br />
            TXN_002,2024-03-16,Celeste
          </div>
        </div>
      </div>
    );
  }

  // ── Dataset loaded — show main dashboard ──
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">NEXUS</span> MBA Engine
        </h1>
        <p className="page-subtitle">
          Self-learning Market Basket Analysis — {dsLabel}
        </p>
      </div>

      {/* Dataset stats */}
      <div className="stat-grid">
        <div className="fade-in-up stagger-1"><StatCard label="Transactions" value={dsInfo.n_transactions.toLocaleString()} color="cyan" /></div>
        <div className="fade-in-up stagger-2"><StatCard label="Unique Items" value={dsInfo.n_items} color="purple" /></div>
        <div className="fade-in-up stagger-3"><StatCard label="Avg Basket Size" value={dsInfo.avg_basket_size} color="green" /></div>
        <div className="fade-in-up stagger-4"><StatCard label="Iterations Run" value={iterations.length} color="orange" /></div>
        {latestIter && (
          <>
            <div className="fade-in-up stagger-5"><StatCard label="Rules (Latest)" value={latestIter.n_rules} color="cyan" /></div>
            <div className="fade-in-up stagger-6"><StatCard label="Avg Lift" value={latestIter.avg_lift} color="green" /></div>
          </>
        )}
      </div>

      {/* Upload / Replace section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>{dsLabel} — Loaded</div>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              {dsInfo.n_transactions} transactions · {dsInfo.n_items} items · avg basket {dsInfo.avg_basket_size}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
              ↑ Replace CSV
              <input type="file" accept=".csv" onChange={onFileSelect} style={{ display: "none" }} />
            </label>
            <button className="btn btn-danger btn-sm" onClick={removeDataset}>Remove</button>
          </div>
        </div>
        {uploadMsg && <div className="alert alert-success" style={{ marginTop: 12 }}>{uploadMsg}</div>}
      </div>

      <div className="grid-2 fade-in-up stagger-6" style={{ marginBottom: 24 }}>
        {/* Run Control */}
        <div className="card">
          <div className="card-title">Self-Learning Control</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 8 }}>
              Each iteration auto-tunes thresholds, mines new patterns, and detects rule drift.
              Run at least 3 iterations for the full self-learning loop.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={injectViral}
                  onChange={(e) => setInjectViral(e.target.checked)}
                  style={{ accentColor: "var(--neon-cyan)" }}
                />
                Inject viral game (Iteration 3+)
              </label>
            </div>
            {injectViral && (
              <input
                type="text"
                value={viralName}
                onChange={(e) => setViralName(e.target.value)}
                placeholder="Enter viral item name"
                style={{
                  background: "var(--bg-panel)", border: "1px solid var(--border-bright)",
                  color: "var(--text-primary)", padding: "6px 10px", borderRadius: 4,
                  fontFamily: "Rajdhani", fontSize: "0.85rem", marginBottom: 12, width: "100%",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={runIteration} disabled={loading}>
              {loading ? "⟳ Running..." : `▶ Run Iteration ${iterations.length + 1}`}
            </button>
            {iterations.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={resetEngine}>
                Reset
              </button>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>⚠ {error}</div>
          )}
          {runLog && (
            <div className="log-box" ref={logRef} style={{ marginTop: 14 }}>{runLog}</div>
          )}
        </div>

        {/* Iteration History */}
        <div className="card">
          <div className="card-title">Iteration History</div>
          {iterations.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 0" }}>
              <div className="empty-icon">⚙</div>
              <h3>No Iterations Yet</h3>
              <p>Run your first iteration to start the self-learning loop.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Label</th>
                  <th>Txns</th>
                  <th>Rules</th>
                  <th>Lift</th>
                  <th>Drift</th>
                </tr>
              </thead>
              <tbody>
                {iterations.map((it) => (
                  <tr key={it.iteration}>
                    <td><span className="mono glow-cyan">{it.iteration}</span></td>
                    <td style={{ fontSize: "0.8rem" }}>{it.label}</td>
                    <td><span className="mono">{it.n_transactions}</span></td>
                    <td><span className="mono glow-green">{it.n_rules}</span></td>
                    <td><span className="mono">{it.avg_lift}</span></td>
                    <td>
                      {it.n_drift_events > 0
                        ? <span className="badge badge-orange">{it.n_drift_events}</span>
                        : <span className="badge badge-cyan">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="card-title">System Architecture</div>
        <div style={{ display: "flex", gap: 0, alignItems: "center", flexWrap: "wrap", padding: "8px 0" }}>
          {[
            { label: "CSV Import", color: "orange" },
            { label: "Transactions", color: "cyan" },
            { label: "FP-Growth Mining", color: "green" },
            { label: "Rule Generation", color: "cyan" },
            { label: "Auto-Tuning", color: "orange" },
            { label: "Scoring", color: "purple" },
            { label: "Drift Detection", color: "pink" },
            { label: "Recommendations", color: "green" },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
              <span className={`badge badge-${step.color}`} style={{ fontSize: "0.72rem" }}>
                {step.label}
              </span>
              {i < arr.length - 1 && (
                <span style={{ color: "var(--text-muted)", margin: "0 6px", fontSize: "0.8rem" }}>→</span>
              )}
            </div>
          ))}
          <span style={{ color: "var(--text-muted)", margin: "0 6px", fontSize: "0.8rem" }}>↩ Loop</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card">
      <div className="card-title" style={{ fontFamily: "var(--font-primary)", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>{label}</div>
      <div className={`card-value glow-${color}`} style={{ fontSize: "1.8rem" }}>
        {value}
      </div>
    </div>
  );
}
