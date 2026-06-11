import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ForestNotes Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>🌳 Something went wrong</h1>
            <p>ForestNotes encountered an unexpected error.</p>
            <pre className="error-boundary-detail">
              {this.state.error?.message ?? "Unknown error"}
            </pre>
            <button
              className="editor-btn editor-btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload ForestNotes
            </button>
            <p className="error-boundary-hint">
              Your Markdown files are safe — they are stored on your disk and
              can be opened with any text editor.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
