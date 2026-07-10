"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSession = void 0;
class ClientSession {
    id;
    socket;
    authenticated = false;
    subscriptions = new Set();
    constructor(id, socket) {
        this.id = id;
        this.socket = socket;
    }
    send(message) {
        if (this.socket.readyState !== this.socket.OPEN) {
            return;
        }
        this.socket.send(JSON.stringify(message));
    }
    close() {
        this.socket.close();
    }
}
exports.ClientSession = ClientSession;
//# sourceMappingURL=ClientSession.js.map