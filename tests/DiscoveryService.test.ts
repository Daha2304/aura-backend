import { describe, expect, it } from "vitest";
import { DiscoveryService } from "../src/discovery/DiscoveryService";
import type { IoBrokerObject, ObjectReaderAdapter } from "../src/iobroker/ObjectService";
import { ObjectService } from "../src/iobroker/ObjectService";
import { StateService, type StateAdapter } from "../src/iobroker/StateService";

describe("DiscoveryService", () => {
  it("prefers alias objects when alias states exist", async () => {
    const objects: Record<string, IoBrokerObject> = {
      "alias.0.Wohnzimmer": {
        _id: "alias.0.Wohnzimmer",
        type: "channel",
        common: { name: "Wohnzimmer" }
      },
      "alias.0.Wohnzimmer.Deckenlampe": {
        _id: "alias.0.Wohnzimmer.Deckenlampe",
        type: "channel",
        common: { name: "Deckenlampe" }
      },
      "alias.0.Wohnzimmer.Deckenlampe.STATE": {
        _id: "alias.0.Wohnzimmer.Deckenlampe.STATE",
        type: "state",
        common: {
          role: "switch.light",
          type: "boolean",
          read: true,
          write: true
        }
      },
      "sonoff.0.RawLamp.POWER": {
        _id: "sonoff.0.RawLamp.POWER",
        type: "state",
        common: {
          role: "switch.light",
          type: "boolean",
          read: true,
          write: true
        }
      }
    };

    const objectAdapter: ObjectReaderAdapter = {
      getForeignObjectsAsync: async () => objects,
      getForeignObjectAsync: async (id) => objects[id]
    };
    const stateAdapter: StateAdapter = {
      getForeignStateAsync: async (id) => ({ val: id.startsWith("alias."), ack: true, ts: 1 }),
      setForeignStateAsync: async () => undefined
    };

    const discovery = await new DiscoveryService(new ObjectService(objectAdapter), new StateService(stateAdapter)).discover();

    expect(discovery.rooms).toEqual([{ id: "alias.0.Wohnzimmer", name: "Wohnzimmer" }]);
    expect(discovery.devices).toHaveLength(1);
    expect(discovery.devices[0]).toMatchObject({
      id: "alias.0.Wohnzimmer.Deckenlampe",
      name: "Deckenlampe",
      roomId: "alias.0.Wohnzimmer"
    });
  });
});
