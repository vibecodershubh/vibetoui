"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useCanvasStore } from "@/lib/store";
import { useInterviewStore } from "@/store/interview";
import { secondaryButton } from "./Popover";

/** What the user sees when the preview crashes. Their work is not lost: the canvas lives in the store. */
export function CanvasCrash({
  onReload,
  onUndo,
  onStartOver,
}: {
  onReload: () => void;
  /** Omitted when there is nothing to undo. */
  onUndo?: () => void;
  onStartOver: () => void;
}) {
  return (
    <div role="alert" className="mx-auto flex h-full max-w-md flex-col justify-center px-6 text-center">
      <h2 className="font-serif text-3xl text-ink">The preview hit a problem.</h2>
      <p className="mt-3 text-sm text-stone">
        Your work is safe. Try reloading the preview, or undo the last change if it started right after an edit.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" className={secondaryButton} onClick={onReload}>
          Reload preview
        </button>
        {onUndo && (
          <button type="button" className={secondaryButton} onClick={onUndo}>
            Undo last change
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={onStartOver}>
          Start over
        </button>
      </div>
    </div>
  );
}

interface State {
  error: Error | null;
}

/** Keeps a crash in the preview from taking down the whole studio (the conversation, top bar and panels stay up). */
export class CanvasBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[canvas] the preview crashed:", error, info.componentStack);
  }

  private reload = () => this.setState({ error: null });

  private undo = () => {
    useCanvasStore.getState().undo();
    this.reload();
  };

  private startOver = () => {
    useInterviewStore.getState().reset();
    this.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const canUndo = useCanvasStore.getState().history.length > 0;
    return <CanvasCrash onReload={this.reload} onUndo={canUndo ? this.undo : undefined} onStartOver={this.startOver} />;
  }
}
