"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
const ws_1 = require("ws");
const node_crypto_1 = require("node:crypto");
const ClientSession_1 = require("./ClientSession");
class WebSocketServer {
    port;
    router;
    subscriptionService;
    server = null;
    sessions = new Map();
    constructor(port, router, subscriptionService) {
        this.port = port;
        this.router = router;
        this.subscriptionService = subscriptionService;
    }
    start() {
        this.server = new ws_1.WebSocketServer({ port: this.port });
        this.server.on("connection", (socket) => {
            const session = new ClientSession_1.ClientSession((0, node_crypto_1.randomUUID)(), socket);
            this.sessions.set(session.id, session);
            socket.on("message", (message) => {
                void this.router.route(session, message);
            });
            socket.on("close", () => {
                void this.removeSession(session);
            });
        });
    }
    async stop() {
        const server = this.server;
        this.server = null;
        for (const session of this.sessions.values()) {
            session.close();
            await this.removeSession(session);
        }
        if (!server) {
            return;
        }
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
    broadcastStateChanged(id, state) {
        for (const session of this.sessions.values()) {
            if (!session.authenticated || !session.subscriptions.has(id)) {
                continue;
            }
            session.send({
                type: "state_changed",
                stateId: id,
                id,
                value: state.val,
                val: state.val,
                ack: state.ack,
                ts: state.ts
            });
        }
    }
    broadcastNotification(stateId, message, timestamp) {
        for (const session of this.sessions.values()) {
            if (!session.authenticated) {
                continue;
            }
            session.send({
                type: "notification",
                stateId,
                message,
                timestamp
            });
        }
    }
    async removeSession(session) {
        this.sessions.delete(session.id);
        for (const id of session.subscriptions) {
            await this.subscriptionService.unsubscribe(id);
        }
        session.subscriptions.clear();
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=WebSocketServer.js.map