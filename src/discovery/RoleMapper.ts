import type { AuraCapability, AuraValueType } from "../models/AuraCapability";
import type { AuraDeviceType } from "../models/AuraDevice";
import type { IoBrokerObject } from "../iobroker/ObjectService";

export interface CapabilityMapping {
  capabilityId: string;
  deviceType: AuraDeviceType;
}

export class RoleMapper {
  public mapCapability(object: IoBrokerObject): CapabilityMapping | null {
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

  public createCapability(object: IoBrokerObject, value?: unknown): AuraCapability | null {
    const mapping = this.mapCapability(object);

    if (!mapping) {
      return null;
    }

    const capability: AuraCapability = {
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

  private getValueType(object: IoBrokerObject): AuraValueType {
    const type = object.common?.type;

    if (type === "boolean" || type === "number" || type === "string") {
      return type;
    }

    return "string";
  }

  private matches(role: string, candidates: string[]): boolean {
    return candidates.some((candidate) => role === candidate || role.includes(candidate));
  }
}
