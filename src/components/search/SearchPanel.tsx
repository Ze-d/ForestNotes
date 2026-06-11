import { useEffect, useRef } from "react";
import { useAppStore } from "../../stores/appStore";

export function SearchPanel() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const searchTagFilter = useAppStore((s) => s.searchTagFilter);
  const setSearchTagFilter = useAppStore((s) => s.setSearchTagFilter);
  const searchResults = useAppStore((s) => s.searchResults);
  const isSearching = useAppStore((s) => s.isSearching);
  const hasSearched = useAppStore((s) => s.hasSearched);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const performSearch = useAppStore((s) => s.performSearch);
  const selectNote = useAppStore((s) => s.selectNote);
  const toggleSearch = useAppStore((s) => s.toggleSearch);
  const panelVisibility = useAppStore((s) => s.panelVisibility);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search: trigger 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) return;

    debounceRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchTagFilter, performSearch]);

  // Close panel with Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panelVisibility.search) {
        toggleSearch();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [panelVisibility.search, toggleSearch]);

  const handleResultClick = (path: string) => {
    selectNote(path);
    toggleSearch(); // close search panel after selection
  };

  const renderSnippet = (html: string) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="search-panel">
      {/* Header */}
      <div className="search-panel-header">
        <div className="search-panel-input-row">
          <span className="search-panel-icon">🔍</span>
          <input
            type="text"
            className="search-panel-input"
            placeholder="Search notes by title, body, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") performSearch();
            }}
          />
          {searchQuery && (
            <button
              className="search-panel-clear"
              onClick={() => {
                setSearchQuery("");
                setSearchTagFilter(null);
              }}
            >
              Clear
            </button>
          )}
          <button
            className="search-panel-close"
            onClick={toggleSearch}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
        <div className="search-panel-filters">
          <span className="search-panel-filter-label">Tag:</span>
          <input
            type="text"
            className="search-panel-filter-input"
            placeholder="Filter by tag (e.g. AI, React)..."
            value={searchTagFilter ?? ""}
            onChange={(e) =>
              setSearchTagFilter(e.target.value || null)
            }
          />
        </div>
      </div>

      {/* Results */}
      <div className="search-panel-results">
        {!vaultPath ? (
          <div className="search-panel-empty">
            <p>Open a vault to search your notes.</p>
          </div>
        ) : isSearching ? (
          <div className="search-panel-empty">
            <p>Searching...</p>
          </div>
        ) : !hasSearched ? (
          <div className="search-panel-empty">
            <p>Type a query and press Enter to search.</p>
            <p className="search-panel-hint">
              Searches title, body text, and tags using full-text search.
            </p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="search-panel-empty">
            <p>
              No results for "<strong>{searchQuery}</strong>".
            </p>
            {searchTagFilter && (
              <p className="search-panel-hint">
                Tag filter: <strong>{searchTagFilter}</strong>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="search-panel-result-count">
              {searchResults.length} result{searchResults.length > 1 ? "s" : ""}
              {searchTagFilter && (
                <span> — filtered by <strong>{searchTagFilter}</strong></span>
              )}
            </div>
            {searchResults.map((result) => (
              <button
                key={result.note_id}
                className="search-result-item"
                onClick={() => handleResultClick(result.path)}
              >
                <div className="search-result-title">
                  {renderSnippet(result.title_highlight || result.title)}
                </div>
                <div className="search-result-snippet">
                  {renderSnippet(result.body_snippet)}
                </div>
                <div className="search-result-path">{result.path}</div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
