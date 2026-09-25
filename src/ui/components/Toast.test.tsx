import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
  it("auto-clears success after 4s", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast message="Saved to this device." tone="success" onDismiss={onDismiss} />
    );
    expect(screen.getByTestId("persist-toast")).toHaveTextContent(
      "Saved to this device."
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("error persists until Dismiss", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        message="That save can't be read. Clear save, then try again."
        tone="error"
        onDismiss={onDismiss}
      />
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("persist-toast-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
