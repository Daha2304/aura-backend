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
            if (!this.isReadableState(object)) {
                continue;
            }
            const deviceId = this.getDeviceId(object._id, objects);
            const group = this.getOrCreateGroup(groups, deviceId, object, objects);
            group.states.push(this.createAuraState(object, states[object._id]?.val));
            if (!this.isDiscoverableState(object)) {
                continue;
            }
            const mapping = this.roleMapper.mapCapability(object);
            if (!mapping) {
                continue;
            }
            const capability = this.roleMapper.createCapability(object, states[object._id]?.val);
            if (!capability) {
                continue;
            }
            group.capabilities.push(capability);
            group.deviceTypes.push(mapping.deviceType);
        }
        return Array.from(groups.values())
            .filter((group) => this.isDiscoverableGroup(group))
            .map((group) => ({
            id: group.id,
            name: group.name,
            type: this.selectDeviceType(group.deviceTypes),
            roomId: group.roomId,
            capabilities: this.sortCapabilities(group.capabilities),
            states: this.sortStates(group.states)
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
            name: this.getDeviceName(deviceId, parent ?? object),
            roomId: this.getRoomId(object),
            hasStructuredParent: this.isAliasId(deviceId) || parent?.type === "device" || parent?.type === "channel",
            capabilities: [],
            states: [],
            deviceTypes: []
        };
        groups.set(deviceId, group);
        return group;
    }
    getDeviceId(stateId, objects) {
        const aliasDeviceId = this.getAliasDeviceId(stateId);
        if (aliasDeviceId) {
            return aliasDeviceId;
        }
        const parts = stateId.split(".");
        const adapterRoot = this.getAdapterRootDeviceId(stateId, objects);
        if (adapterRoot) {
            return adapterRoot;
        }
        for (let length = parts.length - 1; length > 1; length -= 1) {
            const candidateId = parts.slice(0, length).join(".");
            const candidate = objects.find((object) => object._id === candidateId);
            if (candidate?.type === "device" || candidate?.type === "channel") {
                return candidate._id;
            }
        }
        return parts.slice(0, -1).join(".");
    }
    getAdapterRootDeviceId(stateId, objects) {
        const parts = stateId.split(".");
        const adapter = parts[0]?.toLowerCase() ?? "";
        if (adapter === "shelly" && parts.length >= 3) {
            return parts.slice(0, 3).join(".");
        }
        if (adapter === "wled" && parts.length >= 3) {
            return parts.slice(0, 3).join(".");
        }
        if (adapter === "denon") {
            return "denon.0";
        }
        if (adapter === "sony-bravia") {
            return "sony-bravia.0";
        }
        if (adapter === "zidoo") {
            return "zidoo.0";
        }
        if (adapter === "mqtt") {
            return this.getMqttDeviceId(stateId);
        }
        if (adapter === "tuya" && parts.length >= 3) {
            return parts.slice(0, 3).join(".");
        }
        const directDeviceId = parts.slice(0, 3).join(".");
        const direct = objects.find((object) => object._id === directDeviceId);
        return direct?.type === "device" ? direct._id : undefined;
    }
    getAliasDeviceId(stateId) {
        const parts = stateId.split(".");
        if (!this.isAliasId(stateId) || parts.length < 4) {
            return undefined;
        }
        if (parts.length >= 5) {
            return parts.slice(0, -1).join(".");
        }
        return parts.slice(0, 3).join(".");
    }
    getMqttDeviceId(stateId) {
        const parts = stateId.split(".");
        if (parts[2] === "info" || parts[2] === "zigbee2mqtt" || parts[2] === "shellies") {
            return undefined;
        }
        if (parts[2] === "ld2410c" || parts[2] === "ld2450") {
            return parts.slice(0, 4).join(".");
        }
        if (parts[2] === "HyperHDR") {
            return "mqtt.0.HyperHDR";
        }
        return undefined;
    }
    getObjectName(object) {
        const nameCandidates = [
            this.readName(object.common?.name),
            this.readNativeString(object, "friendly_name"),
            this.readNativeString(object, "friendlyName"),
            this.readNativeString(object, "displayName"),
            this.readNativeString(object, "name"),
            this.readNestedNativeString(object, "info", "name"),
            this.readNestedNativeString(object, "device", "name")
        ];
        for (const candidate of nameCandidates) {
            if (candidate && !this.isTechnicalName(candidate, object._id)) {
                return candidate;
            }
        }
        return this.humanizeId(object._id);
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
    readNativeString(object, key) {
        const value = object.native?.[key];
        return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
    }
    readNestedNativeString(object, parentKey, key) {
        const parent = object.native?.[parentKey];
        if (!parent || typeof parent !== "object") {
            return undefined;
        }
        const value = parent[key];
        return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
    }
    isTechnicalName(name, id) {
        if (this.isAliasId(id)) {
            return false;
        }
        const normalizedName = name.trim().toLowerCase();
        const suffix = id.split(".").at(-1)?.toLowerCase() ?? "";
        if (normalizedName === suffix || normalizedName === id.toLowerCase()) {
            return true;
        }
        return /^0x[0-9a-f]+$/i.test(name.trim()) || /^group_\d+$/i.test(name.trim());
    }
    humanizeId(id) {
        const parts = id.split(".");
        const adapter = parts[0] ?? "";
        const primary = parts[2] ?? parts.at(-1) ?? id;
        if (adapter === "zigbee2mqtt") {
            if (primary.startsWith("group_")) {
                return `Zigbee Gruppe ${primary.slice(6)}`;
            }
            return `Zigbee ${primary}`;
        }
        if (adapter === "wled") {
            return `WLED ${primary}`;
        }
        if (id === "denon.0") {
            return "Marantz SR7010";
        }
        if (id === "sony-bravia.0") {
            return "Sony Bravia";
        }
        if (id === "zidoo.0") {
            return "Zidoo";
        }
        return primary.replace(/[_-]+/g, " ");
    }
    getDeviceName(deviceId, object) {
        if (this.isAliasId(deviceId)) {
            return this.getAliasDeviceName(deviceId);
        }
        if (deviceId === "denon.0") {
            return "Marantz SR7010";
        }
        if (deviceId === "sony-bravia.0") {
            return "Sony Bravia";
        }
        if (deviceId === "zidoo.0") {
            return "Zidoo";
        }
        return this.getObjectName(object);
    }
    getAliasDeviceName(deviceId) {
        const parts = deviceId.split(".");
        const raw = parts.slice(3).join(" ") || parts.at(-1) || deviceId;
        return raw.replace(/[_-]+/g, " ").trim();
    }
    getRoomId(object) {
        const aliasRoomId = this.getAliasRoomId(object._id);
        if (aliasRoomId) {
            return aliasRoomId;
        }
        const enumIds = Object.keys(object.enums ?? {});
        return enumIds.find((enumId) => enumId.startsWith("enum.rooms."));
    }
    getAliasRoomId(id) {
        const parts = id.split(".");
        if (!this.isAliasId(id) || parts.length < 4) {
            return undefined;
        }
        return parts.slice(0, 3).join(".");
    }
    selectDeviceType(types) {
        const priority = [
            "light",
            "dimmer",
            "tv",
            "avr",
            "mediaPlayer",
            "speaker",
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
        const priority = ["switch", "brightness", "volume", "media", "position", "temperature", "humidity", "motion", "presence", "contact"];
        return [...capabilities].sort((first, second) => priority.indexOf(first.id) - priority.indexOf(second.id));
    }
    sortStates(states) {
        return [...states].sort((first, second) => first.id.localeCompare(second.id));
    }
    createAuraState(object, value) {
        const state = {
            id: object._id,
            name: this.getObjectName(object),
            role: object.common?.role,
            type: object.common?.type,
            readable: object.common?.read === true,
            writable: object.common?.write === true,
            value
        };
        if (object.common?.unit) {
            state.unit = object.common.unit;
        }
        if (typeof object.common?.min === "number") {
            state.min = object.common.min;
        }
        if (typeof object.common?.max === "number") {
            state.max = object.common.max;
        }
        if (typeof object.common?.step === "number") {
            state.step = object.common.step;
        }
        if (object.common?.states !== undefined) {
            state.states = object.common.states;
        }
        return state;
    }
    isDiscoverableState(object) {
        const id = object._id;
        const role = object.common?.role?.toLowerCase() ?? "";
        if (this.isExcludedNamespace(id)) {
            return false;
        }
        if (role.startsWith("scriptenabled") || role === "indicator.connected" || role === "state") {
            if (!this.isAllowedGenericState(id)) {
                return false;
            }
        }
        if (role.startsWith("scriptenabled") || role === "indicator.connected") {
            return false;
        }
        if (!this.isReadableState(object)) {
            return false;
        }
        return true;
    }
    isReadableState(object) {
        if (this.isExcludedNamespace(object._id)) {
            return false;
        }
        if (this.getDeviceId(object._id, []) === undefined) {
            return false;
        }
        return object.common?.read === true;
    }
    isExcludedNamespace(id) {
        const excludedPrefixes = [
            "admin.",
            "alexa2.",
            "alexa2.0.History.",
            "backitup.",
            "discovery.",
            "history.",
            "iobroker.",
            "info.",
            "javascript.0.scriptEnabled.",
            "system.",
            "web.",
            "ws."
        ];
        return excludedPrefixes.some((prefix) => id.startsWith(prefix));
    }
    isDiscoverableGroup(group) {
        const capabilityIds = new Set(group.capabilities.map((capability) => capability.id));
        if (group.capabilities.length === 0) {
            return false;
        }
        if (group.roomId) {
            return true;
        }
        if (group.hasStructuredParent && this.hasDeviceLikeCapability(capabilityIds)) {
            return true;
        }
        if (this.isTrustedDeviceNamespace(group.id) && this.hasDeviceLikeCapability(capabilityIds)) {
            return true;
        }
        return this.hasActuatorCombination(capabilityIds);
    }
    hasDeviceLikeCapability(capabilityIds) {
        return ["switch", "brightness", "position", "temperature", "humidity", "motion", "presence", "contact", "volume", "media"].some((id) => capabilityIds.has(id));
    }
    hasActuatorCombination(capabilityIds) {
        if (capabilityIds.has("brightness") && capabilityIds.has("switch")) {
            return true;
        }
        if (capabilityIds.has("position")) {
            return true;
        }
        return false;
    }
    isAllowedGenericState(id) {
        const normalized = id.toLowerCase();
        const adapter = normalized.split(".")[0] ?? "";
        const suffix = normalized.split(".").at(-1) ?? "";
        if (["zigbee2mqtt", "wled", "wifilight", "tuya", "sonoff", "shelly", "denon", "sony-bravia", "zidoo", "mqtt"].includes(adapter)) {
            if (adapter === "tuya" && /^\d+$/.test(suffix)) {
                return true;
            }
            return ["state", "on", "power", "powerzone", "powerstatusactive"].includes(suffix);
        }
        return false;
    }
    isTrustedDeviceNamespace(id) {
        const adapter = id.toLowerCase().split(".")[0] ?? "";
        return ["alias", "zigbee2mqtt", "wled", "wifilight", "tuya", "sonoff", "shelly", "denon", "sony-bravia", "zidoo", "mqtt"].includes(adapter);
    }
    isAliasId(id) {
        return id.startsWith("alias.");
    }
}
exports.DeviceBuilder = DeviceBuilder;
//# sourceMappingURL=DeviceBuilder.js.map