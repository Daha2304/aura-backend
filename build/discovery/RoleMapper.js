"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleMapper = void 0;
class RoleMapper {
    mapCapability(object) {
        const role = object.common?.role?.toLowerCase() ?? "";
        const type = object.common?.type;
        const unit = object.common?.unit?.toLowerCase() ?? "";
        if (this.matches(role, ["switch.light", "light"]) && type === "boolean") {
            return { capabilityId: "switch", deviceType: "light" };
        }
        if (this.matches(role, ["switch.power", "switch"]) && type === "boolean") {
            return { capabilityId: "switch", deviceType: "switch" };
        }
        if (this.matches(role, ["level.dimmer", "level.brightness", "brightness"])) {
            return { capabilityId: "brightness", deviceType: "dimmer" };
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
            readable: object.common?.read === true,
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
    matches(role, candidates) {
        return candidates.some((candidate) => role === candidate || role.includes(candidate));
    }
}
exports.RoleMapper = RoleMapper;
//# sourceMappingURL=RoleMapper.js.map