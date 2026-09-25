import { useId, useRef, type KeyboardEvent } from "react";

export type TabItem = { id: string; label: string };

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Prefix for tab/panel ids (defaults to react useId). */
  idPrefix?: string;
};

export function tabId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

export function panelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

export function Tabs({
  items,
  value,
  onChange,
  className = "",
  idPrefix
}: TabsProps): React.JSX.Element {
  const reactId = useId().replace(/:/g, "");
  const prefix = idPrefix ?? `tabs-${reactId}`;
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(id: string) {
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(tabId(prefix, id))}`
    );
    el?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return;
    const idx = items.findIndex((t) => t.id === value);
    if (idx < 0) return;
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = (idx + 1) % items.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = (idx - 1 + items.length) % items.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      next = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      next = items.length - 1;
    } else {
      return;
    }
    const id = items[next]!.id;
    onChange(id);
    focusTab(id);
  }

  return (
    <div
      ref={listRef}
      className={`flex flex-wrap gap-1 border-b aa-border ${className}`.trim()}
      role="tablist"
      onKeyDown={onKeyDown}
      data-tabs-prefix={prefix}
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            id={tabId(prefix, t.id)}
            role="tab"
            aria-selected={active}
            aria-controls={panelId(prefix, t.id)}
            tabIndex={active ? 0 : -1}
            className={
              active
                ? "min-h-11 border-b-2 border-amber-500 px-3 py-2 text-sm font-medium text-amber-100"
                : "min-h-11 border-b-2 border-transparent px-3 py-2 text-sm text-stone-400 hover:text-stone-200"
            }
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
