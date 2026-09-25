import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40",
  secondary:
    "rounded border aa-border text-stone-200 hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40 px-4 py-2",
  ghost:
    "rounded px-4 py-2 text-stone-300 hover:bg-stone-900 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40",
  destructive:
    "rounded border border-red-800 bg-red-950/40 px-4 py-2 text-red-200 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      className = "",
      type = "button",
      children,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`min-h-11 ${VARIANT_CLASS[variant]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
