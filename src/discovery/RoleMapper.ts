import type { AuraCapability, AuraValueType } from "../models/AuraCapability";
import type { AuraDeviceType } from "../models/AuraDevice";
import type { IoBrokerCommon, IoBrokerObject } from "../iobroker/ObjectService";

export interface CapabilityMapping {
  capabilityId: string;
  deviceType: AuraDeviceType;
}

export class RoleMapper {
  public mapCapability(object: IoBrokerObject): CapabilityMapping | null {
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

    if (this.matches(role, ["level.dimmer", "level.brightness", "brightness"]) || this.isKnownBrightnessState(suffix)) {
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

    if (this.matches(role, ["value.battery", "battery"]) || suffix === "battery") {
      return { capabilityId: "battery", deviceType: "unknown" };
    }

    if (this.matches(role, ["value.rssi", "value.signal", "signal"]) || ["linkquality", "rssi", "signal"].includes(suffix)) {
      return { capabilityId: "signal", deviceType: "unknown" };
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
      name: this.getCapabilityName(object, mapping.capabilityId),
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

  private isSwitchLikeValue(type: string | undefined, suffix: string): boolean {
    return type === "boolean" || suffix === "state" || suffix === "power";
  }

  private isKnownSwitchState(
    role: string,
    type: string | undefined,
    suffix: string,
    adapter: string,
    id: string
  ): boolean {
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

  private isKnownBrightnessState(suffix: string): boolean {
    return ["brightness", "bri", "dimmer", "level"].includes(suffix);
  }

  private getSwitchDeviceType(adapter: string, id: string): AuraDeviceType {
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

  private getLightDeviceType(adapter: string): AuraDeviceType {
    return ["wled", "wifilight", "zigbee2mqtt"].includes(adapter) ? "light" : "dimmer";
  }

  private getMediaDeviceType(adapter: string): AuraDeviceType {
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

  private getCapabilityName(object: IoBrokerObject, capabilityId: string): string {
    const explicit = this.readLocalizedName(object.common?.name);

    if (explicit && !this.isGenericName(explicit)) {
      return explicit;
    }

    const suffix = object._id.split(".").at(-1)?.toLowerCase() ?? capabilityId;
    const labels: Record<string, string> = {
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

  private readLocalizedName(name: IoBrokerCommon["name"]): string | undefined {
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }

    if (name && typeof name === "object") {
      const values = name as Record<string, string>;
      return values.de ?? values.en ?? Object.values(values).find((value) => value.trim().length > 0);
    }

    return undefined;
  }

  private isGenericName(name: string): boolean {
    return ["state", "on", "on / off", "power", "switch", "brightness", "dimmer"].includes(name.trim().toLowerCase());
  }
}
