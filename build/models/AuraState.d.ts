export interface AuraState {
    id: string;
    name: string;
    role?: string;
    type?: string;
    readable: boolean;
    writable: boolean;
    unit?: string;
    min?: number;
    max?: number;
    value?: unknown;
}
