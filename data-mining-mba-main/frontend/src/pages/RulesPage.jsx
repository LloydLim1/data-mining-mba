import { useState, useEffect } from "react";
import { api } from "../utils/api";

export default function RulesPage({ dataset }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [minLift, setMinLift] = useState(1.0);
  const [sortBy, setSortBy] = useState("score");

  useEffect(() => { load(); }, [dataset, minLift]);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.getRules(dataset, minLift);
      setRules(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const sorted = [...rules].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "lift") return b.lift - a.lift;
    if (sortBy === "confidence") return b.confidence - a.confidence;
    if (sortBy === "support") return b.support - a.support;
    return 0;
  });

  if (error) return <EmptyState msg={error} />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="accent">Association</span> Rules</h1>
        <p className="page-subtitle">All generated rules with full metrics — Dataset {dataset.toUpperCase()}</p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Min Lift Filter
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range" min="1" max="5" step="0.1"
                value={minLift}
                onChange={(e) => setMinLift(parseFloat(e.target.value))}
                style={{ accentColor: "var(--neon-cyan)", width: 140 }}
              />
              <span className="mono glow-cyan" style={{ fontSize: "0.85rem", minWidth: 32 }}>{minLift.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Sort By
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {["score", "lift", "confidence", "support"].map((s) => (
                <button
                  key={s}
                  className={`ds-btn${sortBy === s ? " active" : ""}`}
                  onClick={() => setSortBy(s)}
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
            <span className="mono glow-green">{sorted.length}</span> rules shown
          </div>
        </div>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /><span>Mining rules...</span></div>
      ) : sorted.length === 0 ? (
        <EmptyState msg="No rules match current filters. Run an iteration first or lower the min lift." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Antecedent (If bought...)</th>
                  <th></th>
                  <th>Consequent (Also buy...)</th>
                  <th>Support</th>
                  <th>Confidence</th>
                  <th>Lift</th>
                  <th>Leverage</th>
                  <th>Conviction</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((rule, i) => (
                  <tr key={i}>
                    <td><span className="mono" style={{ color: "var(--text-muted)" }}>{i + 1}</span></td>
                    <td>
                      <div className="tag-list">
                        {rule.antecedent.map((a) => (
                          <span key={a} className="item-chip" style={{ fontSize: "0.72rem" }}>{a}</span>
                        ))}
                      </div>
                    </td>
                    <td><span className="arrow-chip" style={{ fontSize: "1.1rem" }}>→</span></td>
                    <td>
                      <div className="tag-list">
                        {rule.consequent.map((c) => (
                          <span key={c} className="item-chip" style={{ background: "rgba(191,95,255,0.07)", borderColor: "rgba(191,95,255,0.2)", color: "var(--neon-purple)", fontSize: "0.72rem" }}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td><MetricCell value={(rule.support * 100).toFixed(2) + "%"} bar={rule.support * 20} color="cyan" /></td>
                    <td><MetricCell value={(rule.confidence * 100).toFixed(1) + "%"} bar={rule.confidence} color="purple" /></td>
                    <td>
                      <span className={`mono ${rule.lift >= 3 ? "glow-green" : rule.lift >= 2 ? "glow-cyan" : ""}`}>
                        {rule.lift.toFixed(3)}×
                      </span>
                    </td>
                    <td><span className="mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{rule.leverage.toFixed(4)}</span></td>
                    <td><span className="mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{rule.conviction >= 99 ? "∞" : rule.conviction.toFixed(3)}</span></td>
                    <td>
                      <ScorePill score={rule.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ value, bar, color }) {
  return (
    <div>
      <div className="metric-bar-track" style={{ marginBottom: 3 }}>
        <div className={`metric-bar-fill bar-${color}`} style={{ width: `${Math.min(bar * 100, 100)}%` }} />
      </div>
      <span className="mono" style={{ fontSize: "0.75rem" }}>{value}</span>
    </div>
  );
}

function ScorePill({ score }) {
  const pct = score * 100;
  const color = pct >= 50 ? "var(--neon-green)" : pct >= 30 ? "var(--neon-cyan)" : "var(--text-secondary)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Share Tech Mono", fontSize: "0.65rem", color,
      }}>
        {pct.toFixed(0)}
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">📐</div>
      <h3>No Rules Available</h3>
      <p>{msg}</p>
    </div>
  );
}
