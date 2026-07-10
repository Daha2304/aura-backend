import type { IoBrokerObject } from "./ObjectService";
import type { AuraValueType } from "../models/AuraCapability";
export interface IoBrokerState {
    val: unknown;
    ack: boolean;
    ts: number;
    lc?: number;
    from?: string;
}
export interface StateAdapter {
    getForeignStateAsync(id: string): Promise<IoBrokerState | null | undefined>;
    setForeignStateAsync(id: string, value: unknown, ack?: boolean): Promise<unknown>;
}
export declare class StateService {
    private readonly adapter;
    constructor(adapter: StateAdapter);
    getState(id: string): Promise<IoBrokerState | null>;
    getValues(ids: string[]): Promise<Record<string, IoBrokerState | null>>;
    validateWritableValue(object: IoBrokerObject, value: unknown): string | null;
    getValueType(object: IoBrokerObject): AuraValueType;
    setState(id: string, value: unknown): Promise<void>;
}
