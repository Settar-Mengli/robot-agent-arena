import { useEffect, useState } from "react";

export type RobotFigureProps = {
  side: "player" | "cpu";
  motion?: "idle" | "hit" | "defend";
};

function prefersReducedMotion(): boolean {
  try {
    return (
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ===
      true
    );
  } catch {
    return false;
  }
}

export function RobotFigure({
  side,
  motion = "idle"
}: RobotFigureProps): React.JSX.Element {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq === undefined) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const fill = side === "player" ? "#d97706" : "#78716c";
  const motionClass =
    reduced || motion === "idle"
      ? ""
      : motion === "hit"
        ? "robot-motion-hit"
        : motion === "defend"
          ? "robot-motion-defend"
          : "";

  return (
    <svg
      viewBox="0 0 80 96"
      className={`mx-auto h-24 w-20 ${motionClass}`}
      aria-hidden="true"
      data-testid={`robot-${side}`}
      data-motion={motion}
      data-reduced-motion={reduced ? "true" : "false"}
    >
      <rect x="18" y="28" width="44" height="40" rx="6" fill={fill} />
      <rect x="28" y="12" width="24" height="18" rx="4" fill={fill} />
      <circle cx="34" cy="20" r="3" fill="#1c1917" />
      <circle cx="46" cy="20" r="3" fill="#1c1917" />
      <rect x="8" y="34" width="10" height="24" rx="3" fill={fill} />
      <rect x="62" y="34" width="10" height="24" rx="3" fill={fill} />
      <rect x="26" y="68" width="10" height="22" rx="3" fill={fill} />
      <rect x="44" y="68" width="10" height="22" rx="3" fill={fill} />
    </svg>
  );
}
