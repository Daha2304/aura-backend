"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryService = void 0;
const DeviceBuilder_1 = require("./DeviceBuilder");
class DiscoveryService {
    objectService;
    stateService;
    deviceBuilder;
    constructor(objectService, stateService, deviceBuilder = new DeviceBuilder_1.DeviceBuilder()) {
        this.objectService = objectService;
        this.stateService = stateService;
        this.deviceBuilder = deviceBuilder;
    }
    async discover() {
        const objects = await this.objectService.getObjects();
        const stateObjects = objects.filter((object) => object.type === "state");
        const stateIds = stateObjects.map((object) => object._id);
        const states = await this.stateService.getValues(stateIds);
        const devices = this.deviceBuilder.buildDevices(objects, states);
        const rooms = this.buildRooms(objects, devices);
        return { rooms, devices };
    }
    async createSnapshot() {
        const discovery = await this.discover();
        return {
            type: "snapshot",
            version: 1,
            rooms: discovery.rooms,
            devices: discovery.devices
        };
    }
    buildRooms(objects, devices) {
        const roomIds = new Set(devices.map((device) => device.roomId).filter((roomId) => Boolean(roomId)));
        const rooms = [];
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
exports.DiscoveryService = DiscoveryService;
//# sourceMappingURL=DiscoveryService.js.map