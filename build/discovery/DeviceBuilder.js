"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceBuilder = void 0;
const RoleMapper_1 = require("./RoleMapper");
class DeviceBuilder {
    roleMapper;
    constructor(roleMapper = new RoleMapper_1.RoleMapper()) {
        this.roleMapper = roleMapper;
    }
    buildDevices(objects, states) {
        const groups = new Map();
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
    getOrCreateGroup(groups, deviceId, object, objects) {
        const existing = groups.get(deviceId);
        if (existing) {
            return existing;
        }
        const parent = objects.find((candidate) => candidate._id === deviceId);
        const group = {
            id: deviceId,
            name: this.getObjectName(parent ?? object),
            roomId: this.getRoomId(object),
            capabilities: [],
            deviceTypes: []
        };
        groups.set(deviceId, group);
        return group;
    }
    getDeviceId(stateId, objects) {
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
    getObjectName(object) {
        const name = object.common?.name;
        if (typeof name === "string" && name.trim().length > 0) {
            return name;
        }
        if (name && typeof name === "object") {
            return name.en ?? name.de ?? Object.values(name)[0] ?? object._id;
        }
        return object._id.split(".").at(-1) ?? object._id;
    }
    getRoomId(object) {
        const enumIds = Object.keys(object.enums ?? {});
        return enumIds.find((enumId) => enumId.startsWith("enum.rooms."));
    }
    selectDeviceType(types) {
        const priority = [
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
    sortCapabilities(capabilities) {
        const priority = ["switch", "brightness", "position", "temperature", "humidity", "motion", "presence", "contact"];
        return [...capabilities].sort((first, second) => priority.indexOf(first.id) - priority.indexOf(second.id));
    }
}
exports.DeviceBuilder = DeviceBuilder;
//# sourceMappingURL=DeviceBuilder.js.map