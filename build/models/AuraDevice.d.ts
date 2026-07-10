import type { AuraCapability } from "./AuraCapability";
export type AuraDeviceType = "switch" | "outlet" | "light" | "dimmer" | "temperature" | "humidity" | "motion" | "presence" | "contact" | "shutter" | "unknown";
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
}
export interface AuraSnapshot {
    type: "snapshot";
    version: 1;
    rooms: AuraRoom[];
    devices: AuraDevice[];
}
