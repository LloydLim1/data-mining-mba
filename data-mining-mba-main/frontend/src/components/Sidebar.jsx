import { 
  LayoutDashboard, 
  Network, 
  GitMerge, 
  Package, 
  Home, 
  Tag 
} from "lucide-react";
import "./Sidebar.css";

const TABS = [
  { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { id: "iterations", label: "Iterations", icon: GitMerge },
  { id: "rules",      label: "Rules",      icon: Network },
  { id: "bundles",    label: "Bundles",    icon: Package },
  { id: "homepage",   label: "Homepage",   icon: Home },
  { id: "promos",     label: "Promos",     icon: Tag },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          NEX<span>US</span>
        </div>
        <div className="sidebar-subtitle">MBA ENGINE</div>
      </div>
      
      <nav className="sidebar-nav">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <div className="sidebar-icon-wrapper">
                <Icon size={20} className="sidebar-icon" />
              </div>
              <span className="sidebar-label">{tab.label}</span>
              {isActive && <div className="sidebar-indicator" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
