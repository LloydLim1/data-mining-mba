const TABS = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "iterations", label: "Iterations" },
  { id: "rules",      label: "Rules" },
  { id: "bundles",    label: "Bundles" },
  { id: "homepage",   label: "Homepage" },
  { id: "promos",     label: "Promos" },
];

export default function NavBar({ activeTab, setActiveTab, activeDataset, setActiveDataset, datasetList }) {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        NEX<span>US</span>
        <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.6rem", marginLeft: 8 }}>
          MBA ENGINE
        </span>
      </div>

      <div className="navbar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dataset-switcher">
        {datasetList.length === 0 ? (
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "6px 10px" }}>
            No datasets
          </span>
        ) : (
          datasetList.map((ds) => (
            <button
              key={ds.id}
              className={`ds-btn${activeDataset === ds.id ? " active" : ""}`}
              onClick={() => setActiveDataset(ds.id)}
              title={`${ds.n_transactions} txns · ${ds.n_items} items`}
            >
              {ds.name}
            </button>
          ))
        )}
      </div>
    </nav>
  );
}
