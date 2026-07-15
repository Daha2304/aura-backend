import type { AuraDevice, AuraRoom, AuraSnapshot } from "../models/AuraDevice";
import type { ObjectService } from "../iobroker/ObjectService";
import type { StateService } from "../iobroker/StateService";
import { DeviceBuilder } from "./DeviceBuilder";
export declare class DiscoveryService {
    private readonly objectService;
    private readonly stateService;
    private readonly deviceBuilder;
    constructor(objectService: ObjectService, stateService: StateService, deviceBuilder?: DeviceBuilder);
    discover(): Promise<{
        rooms: AuraRoom[];
        devices: AuraDevice[];
    }>;
    createSnapshot(): Promise<AuraSnapshot>;
    private buildRooms;
    private getDiscoveryObjects;
    private readName;
    private humanizeRoomId;
}
