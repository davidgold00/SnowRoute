"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type InfoTooltipProps = {
  label: string;
  children: ReactNode;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320 });

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(
        Math.max(12, rect.right - width),
        window.innerWidth - width - 12,
      );
      const estimatedHeight = 168;
      const top =
        rect.bottom + estimatedHeight + 12 > window.innerHeight
          ? Math.max(12, rect.top - estimatedHeight - 10)
          : rect.bottom + 10;

      setPosition({ left, top, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? tooltipId : undefined}
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 ${
          isOpen
            ? "border-cyan-100/55 bg-cyan-200/[0.16] text-cyan-50 shadow-[0_0_0_4px_rgba(125,211,252,0.1)]"
            : "border-white/16 bg-white/[0.06] text-slate-100 hover:border-cyan-100/35 hover:bg-cyan-200/[0.1]"
        }`}
      >
        i
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
              }}
              className="fixed z-[1000] rounded-2xl border border-cyan-100/20 bg-[#0b1724]/98 p-4 text-left text-sm leading-6 text-slate-100 shadow-[0_24px_70px_rgba(1,8,16,0.72)] backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/80">
                  Info
                </p>
                <button
                  type="button"
                  aria-label="Close info"
                  onClick={() => {
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
                >
                  ×
                </button>
              </div>
              <div className="text-slate-100">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
