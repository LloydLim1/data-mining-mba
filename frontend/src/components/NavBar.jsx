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
      <div className="navbar-brand">
        <div className="navbar-logo">NEXUS</div>
        <div className="navbar-caption">
          <span className="status-dot" />
          MBA engine live workspace
        </div>
      </div>

      <div className="nav-section-label">Views</div>
      <div className="navbar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="nav-tab-indicator" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="nav-section-label">Datasets</div>
      <div className="dataset-switcher">
        {datasetList.length === 0 ? (
          <span className="dataset-empty">
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
