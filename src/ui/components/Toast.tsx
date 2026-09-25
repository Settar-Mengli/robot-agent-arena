import { useEffect, useRef } from "react";
import { Button } from "./Button";

export type ToastTone = "success" | "error";

export type ToastProps = {
  message: string | null;
  tone: ToastTone;
  onDismiss: () => void;
};

const SUCCESS_MS = 4000;

export function Toast({
  message,
  tone,
  onDismiss
}: ToastProps): React.JSX.Element | null {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (message === null || tone !== "success") return;
    const id = globalThis.setTimeout(() => {
      onDismissRef.current();
    }, SUCCESS_MS);
    return () => globalThis.clearTimeout(id);
  }, [message, tone]);

  if (message === null) return null;

  const isError = tone === "error";

  return (
    <div
      className={
        isError
          ? "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded border border-red-800 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-lg sm:left-auto sm:right-6"
          : "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded border aa-border bg-stone-900 px-4 py-3 text-sm text-stone-200 shadow-lg sm:left-auto sm:right-6"
      }
      role={isError ? "alert" : "status"}
      aria-live="polite"
      data-testid="persist-toast"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        {isError ? (
          <Button
            variant="secondary"
            className="shrink-0 px-3 py-1 text-sm"
            onClick={onDismiss}
            data-testid="persist-toast-dismiss"
          >
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
