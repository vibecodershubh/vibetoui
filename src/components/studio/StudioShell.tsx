"use client";

import { useEffect } from "react";
import { useStudioStore } from "@/store/studio";
import { ChatPanel } from "../ChatPanel";
import { CenterStage } from "./CenterStage";
import { RightPanel } from "./RightPanel";
import { TopBar } from "./TopBar";

/** Top bar + [conversation | canvas | design and code]. Below 1024px the columns stack. */
export function StudioShell() {
  const rightOpen = useStudioStore((s) => s.rightOpen);
  const hydrate = useStudioStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <TopBar />
      <div
        className="flex min-h-0 flex-1 flex-col lg:grid"
        style={{
          gridTemplateColumns: `320px minmax(0, 1fr) ${rightOpen ? 320 : 0}px`,
          transition: "grid-template-columns 200ms ease",
        }}
      >
        <aside aria-label="Conversation" className="order-2 min-h-0 overflow-y-auto border-line bg-paper lg:order-none lg:border-r">
          <ChatPanel />
        </aside>
        <CenterStage className="order-1 h-[75vh] lg:order-none lg:h-auto" />
        <aside
          id="right-panel"
          aria-label="Design and code"
          inert={!rightOpen}
          className={`order-3 min-h-0 overflow-y-auto overflow-x-hidden bg-paper lg:order-none ${
            rightOpen ? "border-line lg:border-l" : "hidden lg:block"
          }`}
        >
          <RightPanel />
        </aside>
      </div>
    </div>
  );
}
