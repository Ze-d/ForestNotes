import { useAppStore } from "../../stores/appStore";
import type { ViewMode } from "../../types";

export function TopBar() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const vaultName = useAppStore((s) => s.vaultName);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const panelVisibility = useAppStore((s) => s.panelVisibility);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleDetail = useAppStore((s) => s.toggleDetail);
  const toggleSearch = useAppStore((s) => s.toggleSearch);
  const performSearch = useAppStore((s) => s.performSearch);

  const tabs: { key: ViewMode; label: string }[] = [
    { key: "notes", label: "Notes" },
    { key: "forest", label: "Forest" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">🌳 ForestNotes</h1>
        {vaultName && (
          <span className="topbar-vault">— {vaultName}</span>
        )}
      </div>

      <div className="topbar-center">
        <div className="topbar-search">
          <span className="topbar-search-icon">🔍</span>
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (!panelVisibility.search) toggleSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!panelVisibility.search) toggleSearch();
                performSearch();
              }
            }}
          />
          {searchQuery && (
            <button
              className="topbar-search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <nav className="topbar-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`topbar-tab ${viewMode === tab.key ? "active" : ""}`}
              onClick={() => setViewMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="topbar-divider" />

        <button
          className={`topbar-btn ${panelVisibility.sidebar ? "active" : ""}`}
          onClick={toggleSidebar}
          title="Toggle sidebar"
        >
          📂
        </button>
        <button
          className={`topbar-btn ${panelVisibility.detail ? "active" : ""}`}
          onClick={toggleDetail}
          title="Toggle detail panel"
        >
          📋
        </button>
        <button
          className={`topbar-btn ${viewMode === "settings" ? "active" : ""}`}
          onClick={() => setViewMode("settings")}
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
