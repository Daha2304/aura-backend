import type { AuraCapability } from "../models/AuraCapability";
import type { AuraDevice, AuraDeviceType } from "../models/AuraDevice";
import type { IoBrokerObject } from "../iobroker/ObjectService";
import type { IoBrokerState } from "../iobroker/StateService";
import { RoleMapper } from "./RoleMapper";

interface DeviceGroup {
  id: string;
  name: string;
  roomId?: string;
  capabilities: AuraCapability[];
  deviceTypes: AuraDeviceType[];
}

export class DeviceBuilder {
  public constructor(private readonly roleMapper = new RoleMapper()) {}

  public buildDevices(objects: IoBrokerObject[], states: Record<string, IoBrokerState | null>): AuraDevice[] {
    const groups = new Map<string, DeviceGroup>();

    for (const object of objects) {
      if (object.type !== "state") {
        continue;
      }

      const mapping = this.roleMapper.mapCapability(object);

      if (!mapping) {
        continue;
      }

      const deviceId = this.getDeviceId(object._id, objects);
      const group = this.getOrCreateGroup(groups, deviceId, object, objects);
      const capability = this.roleMapper.createCapability(object, states[object._id]?.val);

      if (!capability) {
        continue;
      }

      group.capabilities.push(capability);
      group.deviceTypes.push(mapping.deviceType);
    }

    return Array.from(groups.values()).map((group) => ({
      id: group.id,
      name: group.name,
      type: this.selectDeviceType(group.deviceTypes),
      roomId: group.roomId,
      capabilities: this.sortCapabilities(group.capabilities)
    }));
  }

  private getOrCreateGroup(
    groups: Map<string, DeviceGroup>,
    deviceId: string,
    object: IoBrokerObject,
    objects: IoBrokerObject[]
  ): DeviceGroup {
    const existing = groups.get(deviceId);

    if (existing) {
      return existing;
    }

    const parent = objects.find((candidate) => candidate._id === deviceId);
    const group: DeviceGroup = {
      id: deviceId,
      name: this.getObjectName(parent ?? object),
      roomId: this.getRoomId(object),
      capabilities: [],
      deviceTypes: []
    };

    groups.set(deviceId, group);

    return group;
  }

  private getDeviceId(stateId: string, objects: IoBrokerObject[]): string {
    const parts = stateId.split(".");

    for (let length = parts.length - 1; length > 1; length -= 1) {
      const candidateId = parts.slice(0, length).join(".");
      const candidate = objects.find((object) => object._id === candidateId);

      if (candidate?.type === "device" || candidate?.type === "channel") {
        return candidate._id;
      }
    }

    return parts.slice(0, -1).join(".");
  }

  private getObjectName(object: IoBrokerObject): string {
    const name = object.common?.name;

    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }

    if (name && typeof name === "object") {
      return name.en ?? name.de ?? Object.values(name)[0] ?? object._id;
    }

    return object._id.split(".").at(-1) ?? object._id;
  }

  private getRoomId(object: IoBrokerObject): string | undefined {
    const enumIds = Object.keys(object.enums ?? {});

    return enumIds.find((enumId) => enumId.startsWith("enum.rooms."));
  }

  private selectDeviceType(types: AuraDeviceType[]): AuraDeviceType {
    const priority: AuraDeviceType[] = [
      "light",
      "dimmer",
      "shutter",
      "outlet",
      "switch",
      "temperature",
      "humidity",
      "motion",
      "presence",
      "contact"
    ];

    return priority.find((type) => types.includes(type)) ?? types[0] ?? "unknown";
  }

  private sortCapabilities(capabilities: AuraCapability[]): AuraCapability[] {
    const priority = ["switch", "brightness", "position", "temperature", "humidity", "motion", "presence", "contact"];

    return [...capabilities].sort((first, second) => priority.indexOf(first.id) - priority.indexOf(second.id));
  }
}
