import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "caution" | "ok";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "border aa-border bg-stone-900 text-stone-300",
  caution: "border-amber-800/80 bg-amber-950/40 text-amber-100",
  ok: "border-emerald-800 bg-emerald-950/30 text-emerald-100"
};

export function Badge({
  children,
  tone = "neutral",
  className = ""
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
