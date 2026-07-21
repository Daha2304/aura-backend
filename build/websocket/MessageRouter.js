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
            case "bridge.objects.list":
                await this.handleObjectsList(session, message);
                return;
            case "objects.get":
                await this.handleObjectsGet(session, message);
                return;
            case "states.get":
                await this.handleStatesGet(session, message);
                return;
            case "aliases.inspect":
                await this.handleAliasesInspect(session, message);
                return;
            case "rooms.list":
                await this.handleRoomsList(session, message);
                return;
            case "instances.list":
                await this.handleInstancesList(session, message);
                return;
            case "adapter.status":
                await this.handleAdapterStatus(session, message);
                return;
            case "bridge.info":
                this.sendBridgeResponse(session, message, {
                    name: "aura-backend-bridge",
                    version: 1,
                    mode: "token-protected",
                    operations: [
                        "bridge.info",
                        "bridge.objects.list",
                        "objects.get",
                        "states.get",
                        "states.set",
                        "aliases.inspect",
                        "rooms.list",
                        "instances.list",
                        "adapter.status"
                    ]
                });
                return;
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
    async handleObjectsList(session, message) {
        const objects = await this.options.objectService.getObjects();
        const payload = message.payload ?? {};
        const prefix = typeof payload.prefix === "string" ? payload.prefix : undefined;
        const type = typeof payload.type === "string" ? payload.type : undefined;
        const limit = typeof payload.limit === "number" && Number.isInteger(payload.limit) && payload.limit > 0 ? payload.limit : 1000;
        const matching = objects
            .filter((object) => !prefix || object._id.startsWith(prefix))
            .filter((object) => !type || object.type === type)
            .sort((first, second) => first._id.localeCompare(second._id));
        const filtered = matching.slice(0, limit);
        this.sendBridgeResponse(session, message, {
            count: filtered.length,
            total: matching.length,
            truncated: filtered.length < matching.length,
            objects: filtered
        });
    }
    async handleObjectsGet(session, message) {
        const id = this.getPayloadString(message, "id");
        if (!id) {
            this.sendError(session, "invalid_object_id", "Object id is required", message.requestId);
            return;
        }
        const object = await this.options.objectService.getObject(id);
        this.sendBridgeResponse(session, message, { object });
    }
    async handleStatesGet(session, message) {
        const ids = this.getPayloadIds(message);
        if (ids.length === 0) {
            this.sendError(session, "invalid_state_id", "At least one state id is required", message.requestId);
            return;
        }
        const states = await this.options.stateService.getValues(ids);
        this.sendBridgeResponse(session, message, { states });
    }
    async handleAliasesInspect(session, message) {
        const objects = await this.options.objectService.getObjects();
        const payload = message.payload ?? {};
        const prefix = typeof payload.prefix === "string" ? payload.prefix : "alias.";
        const aliases = objects
            .filter((object) => object.type === "state" && object._id.startsWith(prefix))
            .sort((first, second) => first._id.localeCompare(second._id))
            .map((object) => this.toAliasInspection(object));
        this.sendBridgeResponse(session, message, {
            count: aliases.length,
            aliases
        });
    }
    async handleRoomsList(session, message) {
        const discovery = await this.options.discoveryService.discover();
        this.sendBridgeResponse(session, message, {
            count: discovery.rooms.length,
            rooms: discovery.rooms
        });
    }
    async handleInstancesList(session, message) {
        const objects = await this.options.objectService.getObjects({ includeSystem: true, pattern: "system.adapter.*" });
        const instances = objects
            .filter((object) => object._id.startsWith("system.adapter.") && object.type === "instance")
            .sort((first, second) => first._id.localeCompare(second._id));
        const statusIds = instances.flatMap((instance) => [
            `${instance._id}.alive`,
            `${instance._id}.connected`,
            `${instance._id}.memRss`,
            `${instance._id}.uptime`
        ]);
        const states = await this.options.stateService.getValues(statusIds);
        this.sendBridgeResponse(session, message, {
            count: instances.length,
            instances: instances.map((instance) => ({
                id: instance._id,
                name: instance.common?.name,
                native: instance.native,
                status: this.pickStates(states, [
                    `${instance._id}.alive`,
                    `${instance._id}.connected`,
                    `${instance._id}.memRss`,
                    `${instance._id}.uptime`
                ])
            }))
        });
    }
    async handleAdapterStatus(session, message) {
        const adapterId = this.getPayloadString(message, "id");
        if (!adapterId) {
            this.sendError(session, "invalid_adapter_id", "Adapter id is required, e.g. denon.0", message.requestId);
            return;
        }
        const instanceId = adapterId.startsWith("system.adapter.") ? adapterId : `system.adapter.${adapterId}`;
        const object = await this.options.objectService.getObject(instanceId);
        const statusIds = [
            `${instanceId}.alive`,
            `${instanceId}.connected`,
            `${instanceId}.memRss`,
            `${instanceId}.uptime`,
            `${instanceId}.cpu`,
            `${instanceId}.cputime`
        ];
        const states = await this.options.stateService.getValues(statusIds);
        this.sendBridgeResponse(session, message, {
            id: instanceId,
            object,
            status: this.pickStates(states, statusIds)
        });
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
    sendBridgeResponse(session, message, payload) {
        session.send({
            type: "response",
            op: message.op,
            requestId: message.requestId,
            success: true,
            ok: true,
            payload,
            data: payload
        });
    }
    getPayloadString(message, key) {
        const value = message.payload?.[key];
        return typeof value === "string" && value.length > 0 ? value : undefined;
    }
    getPayloadIds(message) {
        const payload = message.payload ?? {};
        const ids = [
            ...(typeof payload.id === "string" ? [payload.id] : []),
            ...(typeof payload.stateId === "string" ? [payload.stateId] : []),
            ...(Array.isArray(payload.ids) ? payload.ids : []),
            ...(Array.isArray(payload.stateIds) ? payload.stateIds : [])
        ];
        return ids.filter((id) => typeof id === "string" && id.length > 0);
    }
    pickStates(states, ids) {
        return Object.fromEntries(ids.map((id) => [id.split(".").at(-1) ?? id, states[id]?.val ?? null]));
    }
    toAliasInspection(object) {
        const parts = object._id.split(".");
        const target = object.common?.alias?.id;
        const readTarget = typeof target === "string" ? target : target?.read ?? object.common?.alias?.read;
        const writeTarget = typeof target === "string" ? target : target?.write ?? object.common?.alias?.write;
        return {
            id: object._id,
            roomId: parts.length >= 3 ? parts.slice(0, 3).join(".") : undefined,
            room: parts[2],
            deviceId: parts.length >= 5 ? parts.slice(0, -1).join(".") : undefined,
            device: parts.length >= 5 ? parts.slice(3, -1).join(".") : undefined,
            state: parts.at(-1),
            name: object.common?.name,
            role: object.common?.role,
            type: object.common?.type,
            read: object.common?.read,
            write: object.common?.write,
            unit: object.common?.unit,
            min: object.common?.min,
            max: object.common?.max,
            states: object.common?.states,
            readTarget,
            writeTarget,
            hasReadTarget: typeof readTarget === "string" && readTarget.length > 0,
            hasWriteTarget: typeof writeTarget === "string" && writeTarget.length > 0,
            native: object.native
        };
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
            const state = await this.options.stateService.getState(id);
            if (state) {
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