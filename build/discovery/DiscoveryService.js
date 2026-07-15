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
        const discoveryObjects = this.getDiscoveryObjects(objects);
        const stateObjects = discoveryObjects.filter((object) => object.type === "state");
        const stateIds = stateObjects.map((object) => object._id);
        const states = await this.stateService.getValues(stateIds);
        const devices = this.deviceBuilder.buildDevices(discoveryObjects, states);
        const rooms = this.buildRooms(discoveryObjects, devices);
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
                name: this.readName(name) ?? this.humanizeRoomId(roomId)
            });
        }
        return rooms;
    }
    getDiscoveryObjects(objects) {
        const hasAliasStates = objects.some((object) => object.type === "state" && object._id.startsWith("alias."));
        if (!hasAliasStates) {
            return objects;
        }
        return objects.filter((object) => object._id.startsWith("alias."));
    }
    readName(name) {
        if (typeof name === "string" && name.trim().length > 0) {
            return name.trim();
        }
        if (name && typeof name === "object") {
            const values = name;
            return values.de ?? values.en ?? Object.values(values).find((value) => value.trim().length > 0);
        }
        return undefined;
    }
    humanizeRoomId(roomId) {
        if (roomId.startsWith("enum.rooms.")) {
            return roomId.replace("enum.rooms.", "");
        }
        const parts = roomId.split(".");
        const raw = roomId.startsWith("alias.") ? (parts[2] ?? roomId) : (parts.at(-1) ?? roomId);
        return raw.replace(/[_-]+/g, " ");
    }
}
exports.DiscoveryService = DiscoveryService;
//# sourceMappingURL=DiscoveryService.js.map