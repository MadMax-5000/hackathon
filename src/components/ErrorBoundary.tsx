import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onReset: () => void;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-state" role="alert">
          <h2>Something went wrong</h2>
          <p>
            The workspace could not render this case. The supplied synthetic data was not changed.
          </p>
          <p className="error-detail">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            Reset demo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
