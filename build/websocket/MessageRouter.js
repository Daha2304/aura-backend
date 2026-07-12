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
                await this.handleDiscover(session, message);
                return;
            case "snapshot":
                await this.handleSnapshot(session, message);
                return;
            case "subscribe":
                await this.handleSubscribe(session, message);
                return;
            case "unsubscribe":
                await this.handleUnsubscribe(session, message);
                return;
            case "set_state":
            case "setState":
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
                    type: "discover_result",
                    op: message.op,
                    requestId: message.requestId,
                    success: true,
                    ok: true,
                    payload: {
                        rooms: discovery.rooms,
                        devices: this.toAppsocketDevices(discovery.devices)
                    },
                    data: {
                        rooms: discovery.rooms,
                        devices: this.toAppsocketDevices(discovery.devices)
                    },
                    rooms: discovery.rooms,
                    devices: this.toAppsocketDevices(discovery.devices)
                });
                return;
            }
            case "snapshot.get":
            case "snapshot": {
                const snapshot = await this.options.discoveryService.createSnapshot();
                this.options.logger?.debug(`Sending snapshot response with ${snapshot.devices.length} devices`);
                session.send({
                    type: "snapshot",
                    op: message.op,
                    requestId: message.requestId,
                    success: true,
                    ok: true,
                    payload: {
                        rooms: snapshot.rooms,
                        devices: this.toAppsocketDevices(snapshot.devices)
                    },
                    data: {
                        rooms: snapshot.rooms,
                        devices: this.toAppsocketDevices(snapshot.devices)
                    },
                    rooms: snapshot.rooms,
                    devices: this.toAppsocketDevices(snapshot.devices)
                });
                return;
            }
            case "objects.list":
            case "objects.tree":
            case "object_tree": {
                const tree = await this.options.objectService.getObjectTree();
                const stateIds = this.collectStateIds(tree);
                const states = await this.options.stateService.getValues(stateIds);
                this.applyStateValues(tree, states);
                this.options.logger?.debug(`Sending object tree with ${tree.length} root nodes`);
                session.send({
                    type: "object_tree",
                    op: message.op,
                    requestId: message.requestId,
                    success: true,
                    ok: true,
                    payload: {
                        tree
                    },
                    data: {
                        tree
                    },
                    tree
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
    collectStateIds(nodes) {
        const ids = [];
        for (const node of nodes) {
            if (node.type === "state") {
                ids.push(node.id);
            }
            ids.push(...this.collectStateIds(node.children));
        }
        return ids;
    }
    applyStateValues(nodes, states) {
        for (const node of nodes) {
            const id = typeof node.id === "string" ? node.id : "";
            const state = states[id];
            if (state) {
                node.value = state.val;
                node.ack = state.ack;
                node.ts = state.ts;
            }
            if (Array.isArray(node.children)) {
                this.applyStateValues(node.children, states);
            }
        }
    }
    async handleDiscover(session, message) {
        const discovery = await this.options.discoveryService.discover();
        this.options.logger?.debug(`Sending discover_result with ${discovery.devices.length} devices`);
        session.send({
            type: "discover_result",
            requestId: message.requestId,
            rooms: discovery.rooms,
            devices: this.toAppsocketDevices(discovery.devices)
        });
    }
    async handleSnapshot(session, message) {
        const snapshot = await this.options.discoveryService.createSnapshot();
        this.options.logger?.debug(`Sending snapshot with ${snapshot.devices.length} devices`);
        session.send({
            type: "snapshot",
            requestId: message.requestId,
            rooms: snapshot.rooms,
            devices: this.toAppsocketDevices(snapshot.devices)
        });
    }
    async handleSubscribe(session, message) {
        const ids = this.getIds(message);
        for (const id of ids) {
            if (session.subscriptions.has(id)) {
                continue;
            }
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
        const stateId = this.getStateId(message);
        if (stateId.length === 0) {
            this.sendError(session, "invalid_state_id", "State id is required", message.requestId);
            return;
        }
        const object = await this.options.objectService.getObject(stateId);
        if (!object) {
            this.sendError(session, "state_not_found", "State does not exist", message.requestId);
            return;
        }
        const validationError = this.options.stateService.validateWritableValue(object, message.value);
        if (validationError) {
            this.sendError(session, "invalid_value", validationError, message.requestId);
            return;
        }
        await this.options.stateService.setState(stateId, message.value);
        session.send({ type: "set_state", requestId: message.requestId, success: true, id: stateId, stateId, value: message.value });
    }
    getIds(message) {
        const candidates = [
            ...(Array.isArray(message.ids) ? message.ids : []),
            ...(Array.isArray(message.stateIds) ? message.stateIds : []),
            ...(typeof message.topic === "string" ? [message.topic] : [])
        ];
        return candidates.filter((id) => typeof id === "string" && id.length > 0);
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
            stateId: typeof payload.stateId === "string" ? payload.stateId : "",
            value: payload.value
        };
    }
    getStateId(message) {
        if (typeof message.stateId === "string") {
            return message.stateId;
        }
        if (typeof message.id === "string") {
            return message.id;
        }
        return "";
    }
    toAppsocketDevices(devices) {
        return devices.map((device) => ({
            id: device.id,
            deviceId: device.id,
            name: device.name,
            type: this.toAppsocketDeviceType(device.type),
            roomId: device.roomId,
            online: true,
            capabilities: device.capabilities.map((capability) => this.toAppsocketCapability(capability)),
            states: (device.states ?? []).map((state) => this.toAppsocketState(state))
        }));
    }
    toAppsocketCapability(capability) {
        const role = this.toIoBrokerRole(capability);
        return {
            id: capability.stateId,
            stateId: capability.stateId,
            name: capability.name ?? capability.id,
            role,
            value: capability.value,
            unit: capability.unit,
            min: capability.min,
            max: capability.max,
            writable: capability.writable,
            common: {
                name: capability.name ?? capability.id,
                role,
                write: capability.writable,
                unit: capability.unit,
                min: capability.min,
                max: capability.max
            }
        };
    }
    toAppsocketState(state) {
        return {
            id: state.id,
            stateId: state.id,
            name: state.name,
            role: state.role,
            value: state.value,
            unit: state.unit,
            min: state.min,
            max: state.max,
            writable: state.writable,
            common: {
                name: state.name,
                role: state.role,
                type: state.type,
                read: state.readable,
                write: state.writable,
                unit: state.unit,
                min: state.min,
                max: state.max
            }
        };
    }
    toAppsocketDeviceType(type) {
        const mapping = {
            switch: "outlet",
            outlet: "outlet",
            light: "light",
            dimmer: "dimmer",
            tv: "tv",
            avr: "avr",
            speaker: "speaker",
            mediaPlayer: "mediaPlayer",
            temperature: "temperature",
            humidity: "humidity",
            motion: "motion",
            presence: "motion",
            contact: "window",
            shutter: "shutter",
            unknown: "custom"
        };
        return mapping[type];
    }
    toIoBrokerRole(capability) {
        const mapping = {
            switch: "switch",
            brightness: "level.dimmer",
            position: "level.blind",
            control: "button",
            temperature: "value.temperature",
            humidity: "value.humidity",
            motion: "sensor.motion",
            presence: "sensor.presence",
            contact: "sensor.window",
            volume: "level.volume",
            media: "media",
            battery: "value.battery",
            signal: "value.signal"
        };
        return mapping[capability.id] ?? "state";
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