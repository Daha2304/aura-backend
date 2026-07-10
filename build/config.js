"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const DEFAULT_PORT = 8099;
const DEFAULT_NOTIFICATION_STATE_ID = "0_userdata.0.Aura.Benachrichtigung";
function loadConfig(nativeConfig) {
    const parsedPort = Number(nativeConfig.port ?? DEFAULT_PORT);
    const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : DEFAULT_PORT;
    return {
        port,
        token: nativeConfig.token ?? "",
        notificationStateId: nativeConfig.notificationStateId ?? DEFAULT_NOTIFICATION_STATE_ID
    };
}
//# sourceMappingURL=config.js.map