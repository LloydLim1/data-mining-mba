import { useState, useEffect, useCallback } from "react";
import Dashboard from "./pages/Dashboard";
import BundlesPage from "./pages/BundlesPage";
import RulesPage from "./pages/RulesPage";
import HomepagePage from "./pages/HomepagePage";
import IterationsPage from "./pages/IterationsPage";
import PromosPage from "./pages/PromosPage";
import NavBar from "./components/NavBar";
import Sidebar from "./components/Sidebar";
import { api } from "./utils/api";
import "./theme.css";
import "./index.css";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeDataset, setActiveDataset] = useState(null);
  const [datasetList, setDatasetList] = useState([]);

  const refreshDatasets = useCallback(async () => {
    try {
      const list = await api.getDatasets();
      setDatasetList(list);
      // If active dataset was deleted or nothing selected, pick first available
      setActiveDataset((prev) => {
        if (list.length === 0) return null;
        if (prev && list.some((d) => d.id === prev)) return prev;
        return list[0].id;
      });
    } catch {
      setDatasetList([]);
    }
  }, []);

  useEffect(() => { refreshDatasets(); }, [refreshDatasets]);

  const renderPage = () => {
    const props = { dataset: activeDataset, refreshDatasets, setActiveDataset };
    switch (activeTab) {
      case "dashboard":    return <Dashboard {...props} />;
      case "bundles":      return <BundlesPage {...props} />;
      case "rules":        return <RulesPage {...props} />;
      case "homepage":     return <HomepagePage {...props} />;
      case "iterations":   return <IterationsPage {...props} />;
      case "promos":       return <PromosPage {...props} />;
      default:             return <Dashboard {...props} />;
    }
  };

  return (
    <div className="app-root">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="content-wrapper">
        <NavBar
          activeDataset={activeDataset}
          setActiveDataset={setActiveDataset}
          datasetList={datasetList}
        />
        <main className="main-content fade-in-up" key={activeTab}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
