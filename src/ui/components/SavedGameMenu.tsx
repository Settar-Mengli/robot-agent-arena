import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";

export type SavedGameMenuProps = {
  saveAllowed: boolean;
  savePresent: boolean;
  clearConfirm: boolean;
  saveDisabledTitle: string;
  onSave: () => void;
  onLoad: () => void;
  onClearRequest: () => void;
  onClearConfirm: () => void;
  onClearCancel: () => void;
};

export function SavedGameMenu({
  saveAllowed,
  savePresent,
  clearConfirm,
  saveDisabledTitle,
  onSave,
  onLoad,
  onClearRequest,
  onClearConfirm,
  onClearCancel
}: SavedGameMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(e: MouseEvent) {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("click", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("click", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-testid="save-controls">
      <Button
        ref={triggerRef}
        variant="secondary"
        className="px-3 py-2 text-sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-testid="saved-game-trigger"
      >
        Saved game
      </Button>
      {open ? (
        <div
          id={panelId}
          className="mt-2 flex flex-col gap-2 rounded border aa-border bg-stone-900 p-3 sm:absolute sm:right-0 sm:z-40 sm:mt-1 sm:min-w-48"
        >
          {saveAllowed ? (
            <Button
              variant="secondary"
              className="px-3 py-2 text-sm text-stone-300"
              onClick={onSave}
              data-testid="save-slot"
            >
              Save
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="cursor-not-allowed px-3 py-2 text-sm text-stone-400 opacity-60"
              disabled
              title={saveDisabledTitle}
              data-testid="save-slot"
            >
              Save
            </Button>
          )}
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm text-stone-300"
            onClick={onLoad}
            data-testid="load-slot"
          >
            Load
          </Button>
          {clearConfirm ? (
            <span
              className="flex flex-wrap items-center gap-2 text-sm text-stone-300"
              data-testid="clear-slot-confirm"
            >
              Clear saved game?
              <Button
                variant="primary"
                className="px-3 py-2"
                onClick={onClearConfirm}
                data-testid="clear-slot-yes"
              >
                Yes
              </Button>
              <Button
                variant="secondary"
                className="px-3 py-2"
                onClick={onClearCancel}
                data-testid="clear-slot-cancel"
              >
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              variant="secondary"
              className="px-3 py-2 text-sm text-stone-400 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onClearRequest}
              disabled={!savePresent}
              data-testid="clear-slot"
            >
              Clear save
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
