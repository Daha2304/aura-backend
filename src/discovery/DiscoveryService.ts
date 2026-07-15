import type { AuraDevice, AuraRoom, AuraSnapshot } from "../models/AuraDevice";
import type { IoBrokerCommon, ObjectService } from "../iobroker/ObjectService";
import type { StateService } from "../iobroker/StateService";
import { DeviceBuilder } from "./DeviceBuilder";

export class DiscoveryService {
  public constructor(
    private readonly objectService: ObjectService,
    private readonly stateService: StateService,
    private readonly deviceBuilder = new DeviceBuilder()
  ) {}

  public async discover(): Promise<{ rooms: AuraRoom[]; devices: AuraDevice[] }> {
    const objects = await this.objectService.getObjects();
    const discoveryObjects = this.getDiscoveryObjects(objects);
    const stateObjects = discoveryObjects.filter((object) => object.type === "state");
    const stateIds = stateObjects.map((object) => object._id);
    const states = await this.stateService.getValues(stateIds);
    const devices = this.deviceBuilder.buildDevices(discoveryObjects, states);
    const rooms = this.buildRooms(discoveryObjects, devices);

    return { rooms, devices };
  }

  public async createSnapshot(): Promise<AuraSnapshot> {
    const discovery = await this.discover();

    return {
      type: "snapshot",
      version: 1,
      rooms: discovery.rooms,
      devices: discovery.devices
    };
  }

  private buildRooms(objects: Awaited<ReturnType<ObjectService["getObjects"]>>, devices: AuraDevice[]): AuraRoom[] {
    const roomIds = new Set(devices.map((device) => device.roomId).filter((roomId): roomId is string => Boolean(roomId)));
    const rooms: AuraRoom[] = [];

    for (const roomId of roomIds) {
      const roomObject = objects.find((object) => object._id === roomId);
      const name = roomObject?.common?.name;

      rooms.push({
        id: roomId,
        name: this.readName(name) ?? this.humanizeRoomId(roomId)
      });
    }

    return rooms;
  }

  private getDiscoveryObjects(objects: Awaited<ReturnType<ObjectService["getObjects"]>>): Awaited<ReturnType<ObjectService["getObjects"]>> {
    const hasAliasStates = objects.some((object) => object.type === "state" && object._id.startsWith("alias."));

    if (!hasAliasStates) {
      return objects;
    }

    return objects.filter((object) => object._id.startsWith("alias."));
  }

  private readName(name: IoBrokerCommon["name"]): string | undefined {
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }

    if (name && typeof name === "object") {
      const values = name as Record<string, string>;
      return values.de ?? values.en ?? Object.values(values).find((value) => value.trim().length > 0);
    }

    return undefined;
  }

  private humanizeRoomId(roomId: string): string {
    if (roomId.startsWith("enum.rooms.")) {
      return roomId.replace("enum.rooms.", "");
    }

    const parts = roomId.split(".");
    const raw = roomId.startsWith("alias.") ? (parts[2] ?? roomId) : (parts.at(-1) ?? roomId);

    return raw.replace(/[_-]+/g, " ");
  }
}
