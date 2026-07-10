import type { AuraDevice, AuraRoom, AuraSnapshot } from "../models/AuraDevice";
import type { ObjectService } from "../iobroker/ObjectService";
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
    const stateObjects = objects.filter((object) => object.type === "state");
    const stateIds = stateObjects.map((object) => object._id);
    const states = await this.stateService.getValues(stateIds);
    const devices = this.deviceBuilder.buildDevices(objects, states);
    const rooms = this.buildRooms(objects, devices);

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
        name: typeof name === "string" ? name : roomId.replace("enum.rooms.", "")
      });
    }

    return rooms;
  }
}
