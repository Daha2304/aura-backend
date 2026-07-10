import { describe, expect, it } from "vitest";
import { StateService } from "../src/iobroker/StateService";

describe("StateService", () => {
  it("rejects writes to readonly states", () => {
    const service = new StateService({
      getForeignStateAsync: async () => null,
      setForeignStateAsync: async () => undefined
    });

    expect(
      service.validateWritableValue(
        {
          _id: "test.0.readonly",
          type: "state",
          common: {
            type: "boolean",
            write: false
          }
        },
        true
      )
    ).toBe("State is not writable");
  });

  it("rejects values with the wrong type", () => {
    const service = new StateService({
      getForeignStateAsync: async () => null,
      setForeignStateAsync: async () => undefined
    });

    expect(
      service.validateWritableValue(
        {
          _id: "test.0.switch",
          type: "state",
          common: {
            type: "boolean",
            write: true
          }
        },
        "on"
      )
    ).toBe("Value must be boolean");
  });
});
