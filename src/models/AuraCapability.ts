export type AuraValueType = "boolean" | "number" | "string";

export interface AuraCapability {
  id: string;
  stateId: string;
  name?: string;
  readable: boolean;
  writable: boolean;
  valueType: AuraValueType;
  min?: number;
  max?: number;
  unit?: string;
  value?: unknown;
}
