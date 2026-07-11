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
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 220;
      const top =
        rect.bottom + panelHeight + 12 > window.innerHeight
          ? Math.max(12, rect.top - panelHeight - 10)
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

    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
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
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 ${
          isOpen
            ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
            : "border-[var(--color-border-strong)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-brand)]"
        }`}
      >
        i
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="dialog"
              aria-label={label}
              aria-modal="false"
              tabIndex={-1}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
              }}
              className="fixed z-[1000] border border-[var(--color-border)] bg-white p-4 text-left text-sm leading-6 text-[var(--color-text)] shadow-[var(--shadow-feature)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                <p className="eyebrow">
                  Info
                </p>
                <button
                  type="button"
                  aria-label="Close info"
                  onClick={() => {
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-sm font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                >
                  ×
                </button>
              </div>
              <div className="text-[var(--color-text)]">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
