export interface AuraBackendConfig {
    port: number;
    token: string;
    notificationStateId: string;
}
interface AdapterNativeConfig {
    port?: number | string;
    token?: string;
    notificationStateId?: string;
}
export declare function loadConfig(nativeConfig: AdapterNativeConfig): AuraBackendConfig;
export {};
