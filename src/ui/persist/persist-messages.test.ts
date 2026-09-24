import { describe, expect, it } from "vitest";
import {
  plainLoadMessage,
  plainSaveMessage
} from "./persist-messages";

describe("persist-messages", () => {
  it("maps save failures to plain copy", () => {
    expect(plainSaveMessage({ ok: false, reason: "quota" })).toBe(
      "Couldn't save on this device."
    );
    expect(plainSaveMessage({ ok: false, reason: "serialize" })).toBe(
      "Couldn't save on this device."
    );
    expect(plainSaveMessage({ ok: false, reason: "in_flight" })).toBe(
      "Cannot save while a turn is resolving."
    );
  });

  it("maps load failures to plain copy", () => {
    expect(
      plainLoadMessage({ ok: false, reason: "empty", message: "no save" })
    ).toBe("No save yet.");
    expect(
      plainLoadMessage({
        ok: false,
        reason: "corrupt",
        message: "invalid JSON"
      })
    ).toBe("That save can't be read. Clear save, then try again.");
    expect(
      plainLoadMessage({
        ok: false,
        reason: "schema",
        message: "schema assert failed"
      })
    ).toBe("That save can't be read. Clear save, then try again.");
    expect(
      plainLoadMessage({
        ok: false,
        reason: "version",
        message: "unsupported"
      })
    ).toBe("That save can't be read. Clear save, then try again.");
  });
});
