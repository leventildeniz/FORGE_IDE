import React, { Component, ReactNode, ErrorInfo } from "react";

export class LocalErrorBoundary extends Component<{ children: ReactNode, name?: string }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode, name?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in ${this.props.name || "Component"}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 my-2 rounded-md border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-mono break-all whitespace-pre-wrap">
          <strong>UI Crash ({this.props.name || "Component"}):</strong><br />
          {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}