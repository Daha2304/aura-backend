import { describe, expect, it } from "vitest";
import { DeviceBuilder } from "../src/discovery/DeviceBuilder";
import type { IoBrokerObject } from "../src/iobroker/ObjectService";

describe("DeviceBuilder", () => {
  it("groups states by parent device and creates Aura capabilities", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "sonoff.0.Wohnzimmerlampe",
        type: "device",
        common: { name: "Wohnzimmerlampe" }
      },
      {
        _id: "sonoff.0.Wohnzimmerlampe.POWER",
        type: "state",
        common: {
          role: "switch.light",
          type: "boolean",
          read: true,
          write: true
        },
        enums: {
          "enum.rooms.Wohnzimmer": "Wohnzimmer"
        }
      },
      {
        _id: "sonoff.0.Wohnzimmerlampe.Dimmer",
        type: "state",
        common: {
          role: "level.dimmer",
          type: "number",
          read: true,
          write: true,
          min: 0,
          max: 100
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "sonoff.0.Wohnzimmerlampe.POWER": { val: true, ack: true, ts: 1 },
      "sonoff.0.Wohnzimmerlampe.Dimmer": { val: 55, ack: true, ts: 2 }
    });

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: "sonoff.0.Wohnzimmerlampe",
      name: "Wohnzimmerlampe",
      type: "light"
    });
    expect(devices[0]?.capabilities.map((capability) => capability.id)).toEqual(["switch", "brightness"]);
  });
});
