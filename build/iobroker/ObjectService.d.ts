export interface IoBrokerCommon {
    name?: string | Record<string, string>;
    role?: string;
    type?: string;
    read?: boolean;
    write?: boolean;
    unit?: string;
    min?: number;
    max?: number;
    states?: unknown;
}
export interface IoBrokerObject {
    _id: string;
    type: string;
    common?: IoBrokerCommon;
    native?: Record<string, unknown>;
    enums?: Record<string, unknown>;
}
export interface IoBrokerObjectTreeNode {
    id: string;
    name: string;
    type: string;
    role?: string;
    valueType?: string;
    readable?: boolean;
    writable?: boolean;
    unit?: string;
    min?: number;
    max?: number;
    value?: unknown;
    ack?: boolean;
    ts?: number;
    children: IoBrokerObjectTreeNode[];
}
export interface ObjectReaderAdapter {
    getForeignObjectsAsync(pattern: string, options?: unknown): Promise<Record<string, IoBrokerObject>>;
    getForeignObjectAsync(id: string): Promise<IoBrokerObject | null | undefined>;
}
export declare class ObjectService {
    private readonly adapter;
    constructor(adapter: ObjectReaderAdapter);
    getObjects(): Promise<IoBrokerObject[]>;
    getObject(id: string): Promise<IoBrokerObject | null>;
    getStateObjects(): Promise<IoBrokerObject[]>;
    getObjectTree(): Promise<IoBrokerObjectTreeNode[]>;
    private createTreeNode;
    private getName;
    private sortTree;
}
