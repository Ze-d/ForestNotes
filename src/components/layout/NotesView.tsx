import { useAppStore } from "../../stores/appStore";
import { Sidebar } from "./Sidebar";
import { EditorPanel } from "../editor/EditorPanel";
import { DetailPanel } from "./DetailPanel";
import { SearchPanel } from "../search/SearchPanel";

export function NotesView() {
  const panelVisibility = useAppStore((s) => s.panelVisibility);

  return (
    <div className="notes-view-wrapper">
      <div className="notes-view">
        {panelVisibility.sidebar && <Sidebar />}
        <EditorPanel />
        {panelVisibility.detail && <DetailPanel />}
      </div>
      {panelVisibility.search && <SearchPanel />}
    </div>
  );
}
