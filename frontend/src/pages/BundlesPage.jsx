import { useState, useEffect } from "react";
import { api } from "../utils/api";

export default function BundlesPage({ dataset }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartItem, setCartItem] = useState("");
  const [crossSell, setCrossSell] = useState(null);
  const [csLoading, setCsLoading] = useState(false);

  useEffect(() => { load(); }, [dataset]);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.getBundles(dataset);
      setBundles(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function lookupCrossSell() {
    if (!cartItem.trim()) return;
    setCsLoading(true); setCrossSell(null);
    try {
      const data = await api.getCrossSell(dataset, cartItem.trim());
      setCrossSell(data);
    } catch (e) { setCrossSell({ error: e.message }); }
    finally { setCsLoading(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <NeedIterations msg={error} />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="accent">Game</span> Bundles</h1>
        <p className="page-subtitle">Top recommended bundles generated from association rules — Dataset {dataset.toUpperCase()}</p>
      </div>

      {/* Cross-sell widget */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">🛒 Cart Cross-Sell Simulator</div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 12 }}>
          Enter a game title to simulate adding it to cart and see what the engine recommends next.
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input
            value={cartItem}
            onChange={(e) => setCartItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupCrossSell()}
            placeholder="e.g. Elden Ring"
            style={{
              flex: 1, background: "var(--bg-panel)", border: "1px solid var(--border-bright)",
              color: "var(--text-primary)", padding: "9px 14px", borderRadius: 5,
              fontFamily: "Rajdhani", fontSize: "0.9rem",
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={lookupCrossSell} disabled={csLoading}>
            {csLoading ? "..." : "Add to Cart →"}
          </button>
        </div>
        {crossSell && !crossSell.error && (
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 8 }}>
              Players who added <strong style={{ color: "var(--neon-cyan)" }}>{crossSell.item}</strong> also bought:
            </div>
            {crossSell.suggestions.length === 0 ? (
              <span className="badge badge-orange">No suggestions found — try another title</span>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {crossSell.suggestions.map((s, i) => (
                  <div key={i} className="card" style={{ padding: "10px 14px", minWidth: 200 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.suggest}</div>
                    <div style={{ display: "flex", gap: 8, fontSize: "0.75rem" }}>
                      <span className="badge badge-cyan">Conf {(s.confidence * 100).toFixed(0)}%</span>
                      <span className="badge badge-green">Lift {s.lift.toFixed(2)}×</span>
                      <span className="badge badge-purple">Score {s.score.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {crossSell?.error && <div className="alert alert-error">{crossSell.error}</div>}
      </div>

      {/* Bundles grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {bundles.map((b, i) => (
          <BundleCard key={b.bundle_id} bundle={b} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function BundleCard({ bundle, rank }) {
  const rankColors = ["cyan", "purple", "green", "orange", "pink"];
  const color = rankColors[rank % rankColors.length];

  return (
    <div className="card" style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: 12, right: 14,
        fontFamily: "Orbitron", fontSize: "0.65rem", color: "var(--text-muted)",
      }}>#{rank}</div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div className="score-circle">{(bundle.score * 100).toFixed(0)}</div>
        <div>
          <div style={{ fontFamily: "Orbitron", fontSize: "0.85rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
            {bundle.name}
          </div>
          <span className={`badge badge-${color}`}>{bundle.suggested_discount} off</span>
        </div>
      </div>

      <div className="tag-list" style={{ marginBottom: 14 }}>
        {bundle.items.map((item) => (
          <span key={item} className="item-chip">{item}</span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="Support" value={(bundle.support * 100).toFixed(2) + "%"} bar={bundle.support * 20} barClass="bar-cyan" />
        <Metric label="Confidence" value={(bundle.confidence * 100).toFixed(1) + "%"} bar={bundle.confidence} barClass="bar-purple" />
        <Metric label="Lift" value={bundle.lift.toFixed(2) + "×"} bar={Math.min(bundle.lift / 8, 1)} barClass="bar-green" />
        <Metric label="Total Price" value={"$" + bundle.total_price} bar={null} barClass="" />
      </div>
    </div>
  );
}

function Metric({ label, value, bar, barClass }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {bar !== null ? (
        <div className="metric-bar-wrap">
          <div className="metric-bar-track"><div className={`metric-bar-fill ${barClass}`} style={{ width: `${Math.min(bar * 100, 100)}%` }} /></div>
          <span className="metric-val">{value}</span>
        </div>
      ) : (
        <div style={{ fontFamily: "Share Tech Mono", fontSize: "0.8rem", color: "var(--neon-green)" }}>{value}</div>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="spinner-wrap"><div className="spinner" /><span>Loading bundles...</span></div>;
}

function NeedIterations({ msg }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">📦</div>
      <h3>No Data Available</h3>
      <p>{msg}</p>
    </div>
  );
}
