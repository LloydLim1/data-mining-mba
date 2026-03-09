import { Layers } from "lucide-react";

export default function NavBar({ activeDataset, setActiveDataset, datasetList }) {
  return (
    <nav className="navbar">
      <div className="navbar-title">
        <Layers size={18} className="navbar-icon" />
        <span>Datasets</span>
      </div>

      <div className="dataset-switcher">
        {datasetList.length === 0 ? (
          <span className="no-datasets">
            No datasets available
          </span>
        ) : (
          datasetList.map((ds) => (
            <button
              key={ds.id}
              className={`ds-btn ${activeDataset === ds.id ? "active" : ""}`}
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
