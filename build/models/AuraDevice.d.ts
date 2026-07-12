import type { AuraCapability } from "./AuraCapability";
import type { AuraState } from "./AuraState";
export type AuraDeviceType = "switch" | "outlet" | "light" | "dimmer" | "tv" | "avr" | "speaker" | "mediaPlayer" | "temperature" | "humidity" | "motion" | "presence" | "contact" | "shutter" | "unknown";
export interface AuraRoom {
    id: string;
    name: string;
}
export interface AuraDevice {
    id: string;
    name: string;
    type: AuraDeviceType;
    roomId?: string;
    capabilities: AuraCapability[];
    states?: AuraState[];
}
export interface AuraSnapshot {
    type: "snapshot";
    version: 1;
    rooms: AuraRoom[];
    devices: AuraDevice[];
}
