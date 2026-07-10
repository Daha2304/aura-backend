"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRouter = void 0;
class MessageRouter {
    options;
    constructor(options) {
        this.options = options;
    }
    async route(session, rawMessage) {
        const message = this.parseMessage(rawMessage);
        if (!message) {
            this.sendError(session, "invalid_message", "Message must be a JSON object");
            return;
        }
        this.options.logger?.debug(`Received WebSocket message: ${message.type}${this.getOperationSuffix(message)}`);
        if (message.type === "hello" || message.type === "auth") {
            this.handleHello(session, message);
            return;
        }
        if (message.type === "ping") {
            session.send({ type: "pong", ts: message.ts });
            return;
        }
        if (!session.authenticated) {
            this.sendError(session, "not_authenticated", "Client is not authenticated", message.requestId);
            return;
        }
        try {
            await this.routeAuthenticated(session, message);
        }
        catch (error) {
            this.sendError(session, "internal_error", error instanceof Error ? error.message : "Internal error", message.requestId);
        }
    }
    async routeAuthenticated(session, message) {
        switch (message.type) {
            case "discover":
                session.send({ type: "discover", requestId: message.requestId, ...(await this.options.discoveryService.discover()) });
                return;
            case "snapshot":
                session.send({ requestId: message.requestId, ...(await this.options.discoveryService.createSnapshot()) });
                return;
            case "subscribe":
                await this.handleSubscribe(session, message);
                return;
            case "unsubscribe":
                await this.handleUnsubscribe(session, message);
                return;
            case "set_state":
                await this.handleSetState(session, message);
                return;
            case "request":
                await this.handleRequest(session, message);
                return;
            default:
                this.sendError(session, "unsupported_message", `Unsupported message type: ${message.type}`, message.requestId);
        }
    }
    handleHello(session, message) {
        const token = this.getAuthToken(message);
        const success = this.options.token.length > 0 && token === this.options.token;
        session.authenticated = success;
        if (message.type === "auth") {
            session.send({
                type: "auth_ack",
                success,
                authenticated: success,
                version: 1
            });
            return;
        }
        session.send({ type: "hello_ack", success, authenticated: success, version: 1 });
    }
    async handleRequest(session, message) {
        switch (message.op) {
            case "devices.list": {
                const discovery = await this.options.discoveryService.discover();
                this.options.logger?.debug(`Sending devices.list response with ${discovery.devices.length} devices`);
                session.send({
                    type: "response",
                    op: message.op,
                    requestId: message.requestId,
                    success: true,
                    ok: true,
                    payload: discovery,
                    data: discovery,
                    rooms: discovery.rooms,
                    devices: discovery.devices
                });
                return;
            }
            case "snapshot.get":
            case "snapshot": {
                const snapshot = await this.options.discoveryService.createSnapshot();
                this.options.logger?.debug(`Sending snapshot response with ${snapshot.devices.length} devices`);
                session.send({
                    type: "response",
                    op: message.op,
                    requestId: message.requestId,
                    success: true,
                    ok: true,
                    payload: snapshot,
                    data: snapshot,
                    rooms: snapshot.rooms,
                    devices: snapshot.devices
                });
                return;
            }
            case "state.set":
            case "states.set":
                await this.handleSetState(session, this.requestToSetStateMessage(message));
                return;
            default:
                this.sendError(session, "unsupported_operation", `Unsupported request operation: ${message.op}`, message.requestId);
        }
    }
    async handleSubscribe(session, message) {
        const ids = this.getIds(message);
        for (const id of ids) {
            await this.options.subscriptionService.subscribe(id);
            session.subscriptions.add(id);
        }
        session.send({ type: "subscribe", requestId: message.requestId, success: true, ids });
    }
    async handleUnsubscribe(session, message) {
        const ids = this.getIds(message);
        for (const id of ids) {
            if (session.subscriptions.has(id)) {
                await this.options.subscriptionService.unsubscribe(id);
                session.subscriptions.delete(id);
            }
        }
        session.send({ type: "unsubscribe", requestId: message.requestId, success: true, ids });
    }
    async handleSetState(session, message) {
        if (typeof message.id !== "string" || message.id.length === 0) {
            this.sendError(session, "invalid_state_id", "State id is required", message.requestId);
            return;
        }
        const object = await this.options.objectService.getObject(message.id);
        if (!object) {
            this.sendError(session, "state_not_found", "State does not exist", message.requestId);
            return;
        }
        const validationError = this.options.stateService.validateWritableValue(object, message.value);
        if (validationError) {
            this.sendError(session, "invalid_value", validationError, message.requestId);
            return;
        }
        await this.options.stateService.setState(message.id, message.value);
        session.send({ type: "set_state", requestId: message.requestId, success: true, id: message.id });
    }
    getIds(message) {
        return Array.isArray(message.ids) ? message.ids.filter((id) => typeof id === "string" && id.length > 0) : [];
    }
    getAuthToken(message) {
        if (typeof message.token === "string") {
            return message.token;
        }
        if (message.payload && typeof message.payload === "object" && "token" in message.payload) {
            const token = message.payload.token;
            return typeof token === "string" ? token : "";
        }
        return "";
    }
    requestToSetStateMessage(message) {
        const payload = message.payload ?? {};
        return {
            type: "set_state",
            requestId: message.requestId ?? "",
            id: typeof payload.id === "string" ? payload.id : "",
            value: payload.value
        };
    }
    parseMessage(rawMessage) {
        try {
            const text = Buffer.isBuffer(rawMessage) ? rawMessage.toString("utf8") : String(rawMessage);
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== "object" || !("type" in parsed) || typeof parsed.type !== "string") {
                return null;
            }
            return parsed;
        }
        catch {
            return null;
        }
    }
    sendError(session, code, message, requestId) {
        this.options.logger?.warn(`WebSocket error response: ${code} - ${message}`);
        session.send({
            type: "error",
            requestId,
            code,
            message
        });
    }
    getOperationSuffix(message) {
        if (message.type === "request" && typeof message.op === "string") {
            return `/${message.op}`;
        }
        return "";
    }
}
exports.MessageRouter = MessageRouter;
//# sourceMappingURL=MessageRouter.js.map