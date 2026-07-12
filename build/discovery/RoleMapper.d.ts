import type { AuraCapability } from "../models/AuraCapability";
import type { AuraDeviceType } from "../models/AuraDevice";
import type { IoBrokerObject } from "../iobroker/ObjectService";
export interface CapabilityMapping {
    capabilityId: string;
    deviceType: AuraDeviceType;
}
export declare class RoleMapper {
    mapCapability(object: IoBrokerObject): CapabilityMapping | null;
    createCapability(object: IoBrokerObject, value?: unknown): AuraCapability | null;
    private getValueType;
    private matches;
    private isSwitchLikeValue;
    private isKnownSwitchState;
    private isKnownBrightnessState;
    private isIlluminanceState;
    private getSwitchDeviceType;
    private getLightDeviceType;
    private getMediaDeviceType;
    private getCapabilityName;
    private readLocalizedName;
    private isGenericName;
}
