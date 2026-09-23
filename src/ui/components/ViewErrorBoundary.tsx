import { Component, type ReactNode } from "react";

export type ViewErrorBoundaryProps = {
  children: ReactNode;
  onHome: () => void;
};

type State = { failed: boolean };

/** Catches lazy Lab/Watch load or render failures. */
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  State
> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    /* plain fallback only */
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          data-testid="view-error-boundary"
          className="space-y-4 py-6"
        >
          <p className="text-stone-200">Couldn&apos;t load this screen.</p>
          <button
            type="button"
            className="min-h-11 rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
            onClick={() => {
              this.setState({ failed: false });
              this.props.onHome();
            }}
          >
            Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
