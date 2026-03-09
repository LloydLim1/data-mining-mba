import { useState, useEffect } from "react";
import { api } from "../utils/api";

const PROMO_ICONS = { BUY_TOGETHER: "🤝", BUNDLE_DEAL: "📦" };
const PROMO_COLORS = { BUY_TOGETHER: "cyan", BUNDLE_DEAL: "purple" };

export default function PromosPage({ dataset }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, [dataset]);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.getPromos(dataset);
      setPromos(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /><span>Generating promos...</span></div>;
  if (error || promos.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">🎁</div>
      <h3>No Promos Available</h3>
      <p>{error || "Run at least one iteration to generate promo suggestions."}</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="accent">Promo</span> Generator</h1>
        <p className="page-subtitle">
          Auto-generated promotions from high-lift rule pairs — Dataset {dataset.toUpperCase()}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {promos.map((promo, i) => (
          <PromoCard key={i} promo={promo} index={i} />
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">How Promos Are Generated</div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          The system identifies rule pairs where <strong style={{ color: "var(--neon-cyan)" }}>Lift ≥ 2.0</strong> — 
          meaning customers are at least 2× more likely to buy both items together than by chance. 
          Rules with 2 items become "Buy Together" deals. Rules with 3+ items trigger "Bundle Deals." 
          Discount percentages are assigned based on total bundle price and lift strength. 
          All promos are triggered automatically — no manual curation required.
        </p>
      </div>
    </div>
  );
}

function PromoCard({ promo, index }) {
  const color = PROMO_COLORS[promo.type] || "cyan";
  const icon = PROMO_ICONS[promo.type] || "🎮";

  return (
    <div className="card" style={{
      border: `1px solid rgba(${color === "cyan" ? "0,245,255" : "191,95,255"},0.3)`,
      position: "relative", overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, var(--neon-${color}), transparent)`,
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span className={`badge badge-${color}`}>{icon} {promo.type.replace("_", " ")}</span>
        <span style={{ fontFamily: "Orbitron", fontSize: "0.7rem", color: "var(--text-muted)" }}>#{index + 1}</span>
      </div>

      <div style={{ fontFamily: "Orbitron", fontSize: "0.95rem", fontWeight: 700, marginBottom: 10, color: "var(--text-primary)", lineHeight: 1.3 }}>
        {promo.headline}
      </div>

      <div className="tag-list" style={{ marginBottom: 14 }}>
        {promo.items.map((item) => (
          <span key={item} className="item-chip" style={{ fontSize: "0.72rem" }}>{item}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{
          background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)",
          borderRadius: 5, padding: "6px 14px",
          fontFamily: "Orbitron", fontSize: "0.85rem", color: "var(--neon-green)", fontWeight: 700,
        }}>
          {promo.discount} OFF
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Trigger: <span style={{ color: "var(--neon-orange)" }}>{promo.trigger.replace("_", " ")}</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.75rem" }}>
          Lift: <span className="mono glow-green">{promo.lift.toFixed(2)}×</span>
        </div>
      </div>
    </div>
  );
}
