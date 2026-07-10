import { describe, expect, it } from "vitest";
import { RoleMapper } from "../src/discovery/RoleMapper";

describe("RoleMapper", () => {
  it("maps switch light roles to light switch capabilities", () => {
    const mapper = new RoleMapper();
    const mapping = mapper.mapCapability({
      _id: "sonoff.0.Wohnzimmerlampe.POWER",
      type: "state",
      common: {
        role: "switch.light",
        type: "boolean",
        read: true,
        write: true
      }
    });

    expect(mapping).toEqual({
      capabilityId: "switch",
      deviceType: "light"
    });
  });

  it("maps temperature units to temperature capabilities", () => {
    const mapper = new RoleMapper();
    const mapping = mapper.mapCapability({
      _id: "hm.0.Sensor.ACTUAL_TEMPERATURE",
      type: "state",
      common: {
        type: "number",
        unit: "°C",
        read: true,
        write: false
      }
    });

    expect(mapping).toEqual({
      capabilityId: "temperature",
      deviceType: "temperature"
    });
  });
});
