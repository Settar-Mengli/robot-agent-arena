import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({
  children,
  className = "",
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={`rounded-lg border aa-border aa-surface px-4 py-4 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
