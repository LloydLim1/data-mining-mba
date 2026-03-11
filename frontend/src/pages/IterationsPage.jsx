import { useState, useEffect } from "react";
import { api } from "../utils/api";

export default function IterationsPage({ dataset }) {
  const [iterations, setIterations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, [dataset]);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.getIterations(dataset);
      setIterations(data);
      if (data.length > 0) selectIteration(data[data.length - 1].iteration);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function selectIteration(num) {
    setSelected(num);
    setDetailLoading(true);
    try {
      const d = await api.getIterationDetail(dataset, num);
      setDetail(d);
    } catch (e) { setDetail(null); }
    finally { setDetailLoading(false); }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /><span>Loading iterations...</span></div>;
  if (error || iterations.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">⚙</div>
      <h3>No Iterations Found</h3>
      <p>Go to Dashboard and run at least 3 iterations to see the self-learning loop here.</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="accent">Self-Learning</span> Iterations</h1>
        <p className="page-subtitle">Version history, auto-tuning log, and drift detection — Dataset {dataset.toUpperCase()}</p>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* Left: iteration list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {iterations.map((it) => (
            <div
              key={it.iteration}
              className="card"
              onClick={() => selectIteration(it.iteration)}
              style={{
                cursor: "pointer",
                border: selected === it.iteration ? "1px solid var(--neon-cyan)" : undefined,
                boxShadow: selected === it.iteration ? "0 0 16px rgba(0,245,255,0.15)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "Orbitron", fontSize: "0.8rem", color: "var(--neon-cyan)" }}>
                  Iteration {it.iteration}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {new Date(it.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: "0.9rem" }}>{it.label}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge badge-cyan">{it.n_transactions} txns</span>
                <span className="badge badge-green">{it.n_rules} rules</span>
                <span className="badge badge-purple">Lift {it.avg_lift}</span>
                {it.n_drift_events > 0 && (
                  <span className="badge badge-orange">{it.n_drift_events} drift</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail panel */}
        <div>
          {detailLoading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : detail ? (
            <IterationDetail detail={detail} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IterationDetail({ detail }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary card */}
      <div className="card">
        <div className="card-title">Iteration {detail.iteration} — {detail.label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "Minsup", value: (detail.minsup * 100).toFixed(2) + "%" },
            { label: "Minconf", value: (detail.minconf * 100).toFixed(0) + "%" },
            { label: "Itemsets", value: detail.n_frequent_itemsets },
            { label: "Rules", value: detail.n_rules },
            { label: "Avg Lift", value: detail.avg_lift },
            { label: "Avg Conf", value: detail.avg_confidence },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{m.label}</div>
              <div className="mono glow-cyan" style={{ fontSize: "1rem" }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div className="card-title" style={{ marginBottom: 8 }}>Auto-Tune Log</div>
        <div className="log-box">{detail.tune_log || "No tuning log."}</div>
      </div>

      {/* Drift events */}
      {detail.drift_events?.length > 0 && (
        <div className="card">
          <div className="card-title">⚠ Drift Events ({detail.drift_events.length})</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Prev Support</th>
                <th>Curr Support</th>
                <th>Δ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.drift_events.slice(0, 10).map((d, i) => (
                <tr key={i}>
                  <td style={{ fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--neon-cyan)" }}>{d.antecedent.join(", ")}</span>
                    <span style={{ color: "var(--text-muted)" }}> → </span>
                    <span style={{ color: "var(--neon-purple)" }}>{d.consequent.join(", ")}</span>
                  </td>
                  <td><span className="mono">{(d.prev_support * 100).toFixed(2)}%</span></td>
                  <td><span className="mono">{(d.curr_support * 100).toFixed(2)}%</span></td>
                  <td>
                    <span className={`mono ${d.delta > 0 ? "glow-green" : "glow-orange"}`}>
                      {d.delta > 0 ? "+" : ""}{(d.delta * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.status === "NEW" ? "badge-green" : d.status === "DROPPED" ? "badge-pink" : "badge-orange"}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top rules */}
      <div className="card">
        <div className="card-title">Top Rules This Iteration</div>
        <table className="data-table">
          <thead>
            <tr><th>Antecedent → Consequent</th><th>Conf</th><th>Lift</th><th>Score</th></tr>
          </thead>
          <tbody>
            {(detail.top_rules || []).slice(0, 10).map((r, i) => (
              <tr key={i}>
                <td style={{ fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--neon-cyan)" }}>{r.antecedent.join(", ")}</span>
                  <span style={{ color: "var(--text-muted)" }}> → </span>
                  <span style={{ color: "var(--neon-purple)" }}>{r.consequent.join(", ")}</span>
                </td>
                <td><span className="mono">{(r.confidence * 100).toFixed(0)}%</span></td>
                <td><span className="mono glow-green">{r.lift.toFixed(2)}×</span></td>
                <td>
                  <span className="mono" style={{ fontSize: "0.78rem", color: "var(--neon-orange)" }}>
                    {r.score.toFixed(3)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
