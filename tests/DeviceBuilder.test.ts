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

  it("filters technical adapter progress states", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "discovery.0.devicesProgress",
        type: "state",
        common: {
          role: "value.humidity",
          type: "number",
          unit: "%",
          read: true,
          write: false
        }
      },
      {
        _id: "backitup.0.history.iobrokerSuccess",
        type: "state",
        common: {
          role: "switch",
          type: "boolean",
          read: true,
          write: true
        }
      },
      {
        _id: "javascript.0.scriptEnabled.Penthouse.Bad.Fenster",
        type: "state",
        common: {
          role: "switch",
          type: "boolean",
          read: true,
          write: true
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "discovery.0.devicesProgress": { val: 100, ack: true, ts: 1 },
      "backitup.0.history.iobrokerSuccess": { val: true, ack: true, ts: 1 },
      "javascript.0.scriptEnabled.Penthouse.Bad.Fenster": { val: true, ack: true, ts: 1 }
    });

    expect(devices).toEqual([]);
  });

  it("keeps structured sensor devices without rooms", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "zigbee2mqtt.0.0xa4c1387a5bf53da1",
        type: "device",
        common: { name: "Climate Sensor" }
      },
      {
        _id: "zigbee2mqtt.0.0xa4c1387a5bf53da1.temperature",
        type: "state",
        common: {
          role: "value.temperature",
          type: "number",
          unit: "°C",
          read: true,
          write: false
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "zigbee2mqtt.0.0xa4c1387a5bf53da1.temperature": { val: 22.4, ack: true, ts: 1 }
    });

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: "zigbee2mqtt.0.0xa4c1387a5bf53da1",
      type: "temperature"
    });
  });
});
