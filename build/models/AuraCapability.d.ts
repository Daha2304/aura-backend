export type AuraValueType = "boolean" | "number" | "string";
export interface AuraCapability {
    id: string;
    stateId: string;
    name?: string;
    role?: string;
    type?: string;
    readable: boolean;
    writable: boolean;
    valueType: AuraValueType;
    min?: number;
    max?: number;
    unit?: string;
    value?: unknown;
}
