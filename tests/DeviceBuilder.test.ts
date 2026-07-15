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

  it("uses zigbee2mqtt friendly parent names instead of ieee ids", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "zigbee2mqtt.0.0x50325ffffedc6251",
        type: "device",
        common: { name: "0x50325ffffedc6251" },
        native: { friendly_name: "Stehlampe" }
      },
      {
        _id: "zigbee2mqtt.0.0x50325ffffedc6251.state",
        type: "state",
        common: {
          role: "state",
          type: "string",
          read: true,
          write: true
        }
      },
      {
        _id: "zigbee2mqtt.0.0x50325ffffedc6251.brightness",
        type: "state",
        common: {
          role: "level.brightness",
          type: "number",
          read: true,
          write: true,
          min: 0,
          max: 254
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "zigbee2mqtt.0.0x50325ffffedc6251.state": { val: "ON", ack: true, ts: 1 },
      "zigbee2mqtt.0.0x50325ffffedc6251.brightness": { val: 144, ack: true, ts: 2 }
    });

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: "zigbee2mqtt.0.0x50325ffffedc6251",
      name: "Stehlampe",
      type: "light"
    });
    expect(devices[0]?.capabilities.map((capability) => capability.id)).toEqual(["switch", "brightness"]);
  });

  it("keeps trusted adapter devices even without parent objects or rooms", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "tuya.0.bf09ed5c3cfb398364fzzm.1",
        type: "state",
        common: {
          role: "state",
          type: "boolean",
          read: true,
          write: true
        }
      },
      {
        _id: "sonoff.0.Flur-Pflanze.POWER",
        type: "state",
        common: {
          role: "switch.light",
          type: "boolean",
          read: true,
          write: true
        }
      },
      {
        _id: "shelly.0.SHSW-1#8CAAB54BC3D3#1.Relay0.Switch",
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
      "tuya.0.bf09ed5c3cfb398364fzzm.1": { val: false, ack: true, ts: 1 },
      "sonoff.0.Flur-Pflanze.POWER": { val: true, ack: true, ts: 1 },
      "shelly.0.SHSW-1#8CAAB54BC3D3#1.Relay0.Switch": { val: false, ack: true, ts: 1 }
    });

    expect(devices.map((device) => device.id).sort()).toEqual([
      "shelly.0.SHSW-1#8CAAB54BC3D3#1",
      "sonoff.0.Flur-Pflanze",
      "tuya.0.bf09ed5c3cfb398364fzzm"
    ]);
  });

  it("discovers media devices from denon and sony adapters", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "denon.0.zoneMain",
        type: "channel",
        common: { name: "Marantz Wohnzimmer" }
      },
      {
        _id: "denon.0.zoneMain.powerZone",
        type: "state",
        common: {
          role: "state",
          type: "string",
          read: true,
          write: true
        }
      },
      {
        _id: "sony-bravia.0.info",
        type: "channel",
        common: { name: "Sony Bravia" }
      },
      {
        _id: "sony-bravia.0.info.powerStatusActive",
        type: "state",
        common: {
          role: "state",
          type: "boolean",
          read: true,
          write: false
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "denon.0.zoneMain.powerZone": { val: "ON", ack: true, ts: 1 },
      "sony-bravia.0.info.powerStatusActive": { val: true, ack: true, ts: 1 }
    });

    expect(devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "denon.0", name: "Marantz SR7010", type: "avr" }),
        expect.objectContaining({ id: "sony-bravia.0", name: "Sony Bravia", type: "tv" })
      ])
    );
  });

  it("groups alias states by alias room and device folders", () => {
    const objects: IoBrokerObject[] = [
      {
        _id: "alias.0.Wohnzimmer",
        type: "channel",
        common: { name: "Wohnzimmer" }
      },
      {
        _id: "alias.0.Wohnzimmer.Deckenlampe",
        type: "channel",
        common: { name: "Deckenlampe" }
      },
      {
        _id: "alias.0.Wohnzimmer.Deckenlampe.STATE",
        type: "state",
        common: {
          name: "Ein/Aus",
          role: "switch.light",
          type: "boolean",
          read: true,
          write: true
        }
      },
      {
        _id: "alias.0.Wohnzimmer.Deckenlampe.LEVEL",
        type: "state",
        common: {
          name: "Helligkeit",
          role: "level.dimmer",
          type: "number",
          min: 0,
          max: 100,
          read: true,
          write: true
        }
      }
    ];

    const devices = new DeviceBuilder().buildDevices(objects, {
      "alias.0.Wohnzimmer.Deckenlampe.STATE": { val: true, ack: true, ts: 1 },
      "alias.0.Wohnzimmer.Deckenlampe.LEVEL": { val: 42, ack: true, ts: 2 }
    });

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: "alias.0.Wohnzimmer.Deckenlampe",
      name: "Deckenlampe",
      type: "light",
      roomId: "alias.0.Wohnzimmer"
    });
    expect(devices[0]?.capabilities.map((capability) => capability.stateId)).toEqual([
      "alias.0.Wohnzimmer.Deckenlampe.STATE",
      "alias.0.Wohnzimmer.Deckenlampe.LEVEL"
    ]);
  });
});
