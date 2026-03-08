import { useState, useEffect } from "react";
import { api } from "../utils/api";

const GENRE_COLORS = {
  RPG: "purple", FPS: "orange", Indie: "cyan", Strategy: "green",
  Simulation: "green", Action: "orange", Adventure: "cyan", DLC: "pink",
  Soundtrack: "purple", Metroidvania: "cyan", Platformer: "green",
  Roguelike: "orange", Sandbox: "green",
};

export default function HomepagePage({ dataset }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("grid"); // grid | list

  useEffect(() => { load(); }, [dataset]);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.getHomepage(dataset);
      setItems(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /><span>Ranking homepage...</span></div>;
  if (error) return <EmptyState msg={error} />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="accent">Homepage</span> Ranking</h1>
        <p className="page-subtitle">Games ranked by MBA popularity score — what users see first · Dataset {dataset.toUpperCase()}</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginRight: 8 }}>View:</span>
          <button className={`ds-btn${view === "grid" ? " active" : ""}`} onClick={() => setView("grid")}>Grid</button>
          <button className={`ds-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>List</button>
          <span style={{ marginLeft: "auto", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <span className="mono glow-cyan">{items.length}</span> items ranked
          </span>
        </div>
      </div>

      {view === "grid" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}>
          {items.slice(0, 20).map((item, i) => (
            <GameCard key={item.item} item={item} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Title</th>
                <th>Genre</th>
                <th>Price</th>
                <th>Pop. Score</th>
                <th>Rule Appearances</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const color = GENRE_COLORS[item.genre] || "cyan";
                return (
                  <tr key={item.item}>
                    <td>
                      <span className="mono" style={{ color: i < 3 ? "var(--neon-cyan)" : "var(--text-muted)" }}>
                        {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.item}</td>
                    <td><span className={`badge badge-${color}`}>{item.genre}</span></td>
                    <td><span className="mono glow-green">{item.price === 0 ? "Free" : `₱${item.price}`}</span></td>
                    <td>
                      <div className="metric-bar-wrap">
                        <div className="metric-bar-track">
                          <div className="metric-bar-fill bar-cyan" style={{ width: `${Math.min(item.popularity_score * 200, 100)}%` }} />
                        </div>
                        <span className="metric-val">{item.popularity_score.toFixed(4)}</span>
                      </div>
                    </td>
                    <td><span className="mono">{item.rule_appearances}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GameCard({ item, rank }) {
  const color = GENRE_COLORS[item.genre] || "cyan";
  const isTop3 = rank <= 3;

  return (
    <div className="card" style={{
      position: "relative", padding: "16px",
      border: isTop3 ? "1px solid rgba(0,245,255,0.35)" : undefined,
      boxShadow: isTop3 ? "0 0 20px rgba(0,245,255,0.1)" : undefined,
    }}>
      <div style={{
        position: "absolute", top: 10, left: 12,
        fontFamily: "Orbitron", fontSize: "0.65rem",
        color: isTop3 ? "var(--neon-cyan)" : "var(--text-muted)",
      }}>
        {isTop3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
      </div>

      <div style={{ marginTop: 20, marginBottom: 10 }}>
        <div style={{
          fontSize: "0.85rem", fontWeight: 600,
          color: "var(--text-primary)", lineHeight: 1.3,
          marginBottom: 6,
        }}>{item.item}</div>
        <span className={`badge badge-${color}`} style={{ fontSize: "0.68rem" }}>{item.genre}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Score</div>
        <div className="metric-bar-track" style={{ marginBottom: 3 }}>
          <div className={`metric-bar-fill bar-${color}`} style={{ width: `${Math.min(item.popularity_score * 200, 100)}%` }} />
        </div>
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{item.popularity_score.toFixed(4)}</span>
      </div>

      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono glow-green" style={{ fontSize: "0.8rem" }}>
          {item.price === 0 ? "Free" : `₱${item.price}`}
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{item.rule_appearances} rules</span>
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">🏠</div>
      <h3>No Ranking Available</h3>
      <p>{msg}</p>
    </div>
  );
}
