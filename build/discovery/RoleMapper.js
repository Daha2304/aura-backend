"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleMapper = void 0;
class RoleMapper {
    mapCapability(object) {
        const role = object.common?.role?.toLowerCase() ?? "";
        const type = object.common?.type;
        const unit = object.common?.unit?.toLowerCase() ?? "";
        const id = object._id.toLowerCase();
        const adapter = id.split(".")[0] ?? "";
        const suffix = id.split(".").at(-1) ?? "";
        if (this.matches(role, ["switch.light", "light"]) && this.isSwitchLikeValue(type, suffix)) {
            return { capabilityId: "switch", deviceType: "light" };
        }
        if (this.matches(role, ["switch.power", "switch"]) && this.isSwitchLikeValue(type, suffix)) {
            return { capabilityId: "switch", deviceType: this.getSwitchDeviceType(adapter, id) };
        }
        if (this.isKnownSwitchState(role, type, suffix, adapter, id)) {
            return { capabilityId: "switch", deviceType: this.getSwitchDeviceType(adapter, id) };
        }
        if (!this.isIlluminanceState(id, role) && (this.matches(role, ["level.dimmer", "level.brightness", "brightness"]) || this.isKnownBrightnessState(suffix))) {
            return { capabilityId: "brightness", deviceType: this.getLightDeviceType(adapter) };
        }
        if (this.matches(role, ["level.volume", "volume"])) {
            return { capabilityId: "volume", deviceType: this.getMediaDeviceType(adapter) };
        }
        if (this.matches(role, ["media", "button.play", "button.pause", "button.stop", "button.next", "button.prev"])) {
            return { capabilityId: "media", deviceType: this.getMediaDeviceType(adapter) };
        }
        if (this.matches(role, ["value.temperature", "temperature"]) || unit === "c" || unit === "degc" || unit === "°c") {
            return { capabilityId: "temperature", deviceType: "temperature" };
        }
        if (this.matches(role, ["value.humidity", "humidity"]) || unit === "%") {
            return { capabilityId: "humidity", deviceType: "humidity" };
        }
        if (this.matches(role, ["sensor.motion", "motion"])) {
            return { capabilityId: "motion", deviceType: "motion" };
        }
        if (this.matches(role, ["sensor.presence", "presence"])) {
            return { capabilityId: "presence", deviceType: "presence" };
        }
        if (this.matches(role, ["sensor.window", "sensor.door", "state.window", "state.door", "contact"])) {
            return { capabilityId: "contact", deviceType: "contact" };
        }
        if (this.matches(role, ["level.blind", "level.curtain", "level.shutter", "blind", "shutter"])) {
            return { capabilityId: "position", deviceType: "shutter" };
        }
        if (this.matches(role, ["button.open.blind", "button.close.blind", "button.stop.blind"])) {
            return { capabilityId: "control", deviceType: "shutter" };
        }
        return null;
    }
    createCapability(object, value) {
        const mapping = this.mapCapability(object);
        if (!mapping) {
            return null;
        }
        const capability = {
            id: mapping.capabilityId,
            stateId: object._id,
            name: this.getCapabilityName(object, mapping.capabilityId),
            role: object.common?.role,
            type: object.common?.type,
            readable: this.isReadable(object),
            writable: object.common?.write === true,
            valueType: this.getValueType(object),
            value
        };
        if (typeof object.common?.min === "number") {
            capability.min = object.common.min;
        }
        if (typeof object.common?.max === "number") {
            capability.max = object.common.max;
        }
        if (object.common?.unit) {
            capability.unit = object.common.unit;
        }
        return capability;
    }
    getValueType(object) {
        const type = object.common?.type;
        if (type === "boolean" || type === "number" || type === "string") {
            return type;
        }
        return "string";
    }
    isReadable(object) {
        if (object._id.startsWith("alias.")) {
            return object.common?.read !== false || object.common?.write === true;
        }
        return object.common?.read === true;
    }
    matches(role, candidates) {
        return candidates.some((candidate) => role === candidate || role.includes(candidate));
    }
    isSwitchLikeValue(type, suffix) {
        return type === "boolean" || suffix === "state" || suffix === "power";
    }
    isKnownSwitchState(role, type, suffix, adapter, id) {
        if (role !== "state" && role !== "indicator" && role !== "") {
            return false;
        }
        if (type === "boolean" && ["state", "on", "power", "powerstatusactive", "switch", "1"].includes(suffix)) {
            return true;
        }
        if (type === "string" && ["state", "power", "powerzone"].includes(suffix)) {
            return ["zigbee2mqtt", "zidoo", "denon", "sony-bravia", "mqtt"].includes(adapter);
        }
        return adapter === "tuya" && type === "boolean" && /^\d+$/.test(suffix) && id.split(".").length === 4;
    }
    isKnownBrightnessState(suffix) {
        return ["brightness", "bri", "dimmer", "level"].includes(suffix);
    }
    isIlluminanceState(id, role) {
        return id.includes("illuminance") || role.includes("illuminance");
    }
    getSwitchDeviceType(adapter, id) {
        if (adapter === "wled" || adapter === "wifilight" || adapter === "zigbee2mqtt") {
            return "light";
        }
        if (adapter === "denon") {
            return "avr";
        }
        if (adapter === "sony-bravia") {
            return "tv";
        }
        if (adapter === "zidoo") {
            return "mediaPlayer";
        }
        if (adapter === "shelly" && id.includes(".relay")) {
            return "outlet";
        }
        if (adapter === "tuya") {
            return "outlet";
        }
        return "switch";
    }
    getLightDeviceType(adapter) {
        return ["wled", "wifilight", "zigbee2mqtt"].includes(adapter) ? "light" : "dimmer";
    }
    getMediaDeviceType(adapter) {
        if (adapter === "denon") {
            return "avr";
        }
        if (adapter === "sony-bravia") {
            return "tv";
        }
        if (adapter === "zidoo") {
            return "mediaPlayer";
        }
        return "mediaPlayer";
    }
    getCapabilityName(object, capabilityId) {
        const explicit = this.readLocalizedName(object.common?.name);
        if (explicit && !this.isGenericName(explicit)) {
            return explicit;
        }
        const suffix = object._id.split(".").at(-1)?.toLowerCase() ?? capabilityId;
        const labels = {
            switch: "Schalter",
            brightness: "Helligkeit",
            volume: "Lautstärke",
            media: "Medien",
            position: "Position",
            temperature: "Temperatur",
            humidity: "Luftfeuchtigkeit",
            motion: "Bewegung",
            presence: "Anwesenheit",
            contact: "Kontakt",
            battery: "Batterie",
            signal: "Signal"
        };
        if (suffix === "ct" || suffix === "colortemp") {
            return "Farbtemperatur";
        }
        return labels[capabilityId] ?? suffix;
    }
    readLocalizedName(name) {
        if (typeof name === "string" && name.trim().length > 0) {
            return name.trim();
        }
        if (name && typeof name === "object") {
            const values = name;
            return values.de ?? values.en ?? Object.values(values).find((value) => value.trim().length > 0);
        }
        return undefined;
    }
    isGenericName(name) {
        return ["state", "on", "on / off", "power", "switch", "brightness", "dimmer"].includes(name.trim().toLowerCase());
    }
}
exports.RoleMapper = RoleMapper;
//# sourceMappingURL=RoleMapper.js.map