import type { AuraDevice } from "../models/AuraDevice";
import type { IoBrokerObject } from "../iobroker/ObjectService";
import type { IoBrokerState } from "../iobroker/StateService";
import { RoleMapper } from "./RoleMapper";
export declare class DeviceBuilder {
    private readonly roleMapper;
    constructor(roleMapper?: RoleMapper);
    buildDevices(objects: IoBrokerObject[], states: Record<string, IoBrokerState | null>): AuraDevice[];
    private getOrCreateGroup;
    private getDeviceId;
    private getObjectName;
    private getRoomId;
    private selectDeviceType;
    private sortCapabilities;
}
