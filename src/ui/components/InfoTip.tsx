import { useId, useRef, useState, useEffect } from "react";
import { GLOSSARY, type GlossaryId } from "../copy/glossary";

export type InfoTipProps = {
  termId: GlossaryId;
  label?: string;
};

/** Compact inline "?" with ≥44px touch via padding; disclosure (no dialog). */
export function InfoTip({
  termId,
  label = "About this term"
}: InfoTipProps): React.JSX.Element {
  const entry = GLOSSARY[termId];
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (rootRef.current === null) return;
      if (!rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="info-tip-hit ml-0.5 inline-flex items-center justify-center rounded px-2 py-2 text-[0.7rem] leading-none text-stone-400 hover:text-stone-200"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        data-testid={`info-tip-${termId}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(ev) => {
          if (ev.key === "Escape" && open) {
            ev.preventDefault();
            setOpen(false);
            buttonRef.current?.focus();
          }
        }}
      >
        <span aria-hidden="true" className="font-medium">
          ?
        </span>
      </button>
      <span
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-20 mt-1 w-64 rounded border aa-border bg-stone-900 p-3 text-left text-sm text-stone-200 shadow-lg"
      >
        <span className="font-medium text-stone-50">{entry.term}</span>
        <span className="mt-1 block text-stone-300">{entry.short}</span>
        <span className="mt-2 block text-stone-400">{entry.long}</span>
      </span>
    </span>
  );
}
