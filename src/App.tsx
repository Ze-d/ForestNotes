import { useAppStore } from "./stores/appStore";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { TopBar } from "./components/layout/TopBar";
import { NotesView } from "./components/layout/NotesView";
import { ForestView } from "./components/forest/ForestView";
import { SettingsPanel } from "./components/settings/SettingsPanel";

function App() {
  const viewMode = useAppStore((s) => s.viewMode);

  return (
    <ErrorBoundary>
      <div className="app">
        <TopBar />
        {viewMode === "notes" && <NotesView />}
        {viewMode === "forest" && <ForestView />}
        {viewMode === "settings" && <SettingsPanel />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
