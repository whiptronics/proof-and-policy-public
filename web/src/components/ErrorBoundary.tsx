import { Component, type ReactNode } from "react";

/** Keeps one broken view from blanking the whole page, and says what failed. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    if (this.state.error) {
      return (
        <div className="warn" role="alert">
          <strong>This view failed to render.</strong> {this.state.error.message}. Other views still work; reloading may help.
          This is a dashboard bug, not a data finding.
        </div>
      );
    }
    return this.props.children;
  }
}
