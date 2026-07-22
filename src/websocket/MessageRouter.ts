import type { DiscoveryService } from "../discovery/DiscoveryService";
import type { IoBrokerObject, ObjectService } from "../iobroker/ObjectService";
import type { StateService } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
import type { AuraCapability } from "../models/AuraCapability";
import type { AuraDevice, AuraDeviceType } from "../models/AuraDevice";
import type { AuraState } from "../models/AuraState";
import type { ProtocolMessage, RequestMessage, SetStateMessage, SubscriptionMessage } from "../models/ProtocolMessage";
import type { ClientSession } from "./ClientSession";

interface MessageRouterOptions {
  token: string;
  discoveryService: DiscoveryService;
  objectService: ObjectService;
  stateService: StateService;
  subscriptionService: SubscriptionService;
  logger?: {
    debug(message: string): void;
    warn(message: string): void;
  };
}

export class MessageRouter {
  public constructor(private readonly options: MessageRouterOptions) {}

  public async route(session: ClientSession, rawMessage: unknown): Promise<void> {
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
    } catch (error) {
      this.sendError(session, "internal_error", error instanceof Error ? error.message : "Internal error", message.requestId);
    }
  }

  private async routeAuthenticated(session: ClientSession, message: ProtocolMessage): Promise<void> {
    switch (message.type) {
      case "discover":
        await this.handleDiscover(session, message);
        return;
      case "snapshot":
        await this.handleSnapshot(session, message);
        return;
      case "subscribe":
        await this.handleSubscribe(session, message as SubscriptionMessage);
        return;
      case "unsubscribe":
        await this.handleUnsubscribe(session, message as SubscriptionMessage);
        return;
      case "set_state":
      case "setState":
        await this.handleSetState(session, message as SetStateMessage);
        return;
      case "request":
        await this.handleRequest(session, message as RequestMessage);
        return;
      default:
        this.sendError(session, "unsupported_message", `Unsupported message type: ${message.type}`, message.requestId);
    }
  }

  private handleHello(session: ClientSession, message: ProtocolMessage): void {
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

  private async handleRequest(session: ClientSession, message: RequestMessage): Promise<void> {
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
        this.applyStateValues(tree as unknown as Array<Record<string, unknown>>, states);
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

  private async handleObjectsList(session: ClientSession, message: RequestMessage): Promise<void> {
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

  private async handleObjectsGet(session: ClientSession, message: RequestMessage): Promise<void> {
    const id = this.getPayloadString(message, "id");

    if (!id) {
      this.sendError(session, "invalid_object_id", "Object id is required", message.requestId);
      return;
    }

    const object = await this.options.objectService.getObject(id);
    this.sendBridgeResponse(session, message, { object });
  }

  private async handleStatesGet(session: ClientSession, message: RequestMessage): Promise<void> {
    const ids = this.getPayloadIds(message);

    if (ids.length === 0) {
      this.sendError(session, "invalid_state_id", "At least one state id is required", message.requestId);
      return;
    }

    const states = await this.options.stateService.getValues(ids);
    this.sendBridgeResponse(session, message, { states });
  }

  private async handleAliasesInspect(session: ClientSession, message: RequestMessage): Promise<void> {
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

  private async handleRoomsList(session: ClientSession, message: RequestMessage): Promise<void> {
    const discovery = await this.options.discoveryService.discover();
    this.sendBridgeResponse(session, message, {
      count: discovery.rooms.length,
      rooms: discovery.rooms
    });
  }

  private async handleInstancesList(session: ClientSession, message: RequestMessage): Promise<void> {
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

  private async handleAdapterStatus(session: ClientSession, message: RequestMessage): Promise<void> {
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

  private collectStateIds(nodes: Array<{ id: string; type: string; children: unknown[] }>): string[] {
    const ids: string[] = [];

    for (const node of nodes) {
      if (node.type === "state") {
        ids.push(node.id);
      }

      ids.push(...this.collectStateIds(node.children as Array<{ id: string; type: string; children: unknown[] }>));
    }

    return ids;
  }

  private applyStateValues(
    nodes: Array<Record<string, unknown>>,
    states: Record<string, { val: unknown; ack: boolean; ts: number } | null>
  ): void {
    for (const node of nodes) {
      const id = typeof node.id === "string" ? node.id : "";
      const state = states[id];

      if (state) {
        node.value = state.val;
        node.ack = state.ack;
        node.ts = state.ts;
      }

      if (Array.isArray(node.children)) {
        this.applyStateValues(node.children as Array<Record<string, unknown>>, states);
      }
    }
  }

  private sendBridgeResponse(session: ClientSession, message: RequestMessage, payload: Record<string, unknown>): void {
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

  private getPayloadString(message: RequestMessage, key: string): string | undefined {
    const value = message.payload?.[key];

    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private getPayloadIds(message: RequestMessage): string[] {
    const payload = message.payload ?? {};
    const ids = [
      ...(typeof payload.id === "string" ? [payload.id] : []),
      ...(typeof payload.stateId === "string" ? [payload.stateId] : []),
      ...(Array.isArray(payload.ids) ? payload.ids : []),
      ...(Array.isArray(payload.stateIds) ? payload.stateIds : [])
    ];

    return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  private pickStates(
    states: Record<string, { val: unknown; ack: boolean; ts: number } | null>,
    ids: string[]
  ): Record<string, unknown> {
    return Object.fromEntries(ids.map((id) => [id.split(".").at(-1) ?? id, states[id]?.val ?? null]));
  }

  private toAliasInspection(object: IoBrokerObject): Record<string, unknown> {
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

  private async handleDiscover(session: ClientSession, message: ProtocolMessage): Promise<void> {
    const discovery = await this.options.discoveryService.discover();
    this.options.logger?.debug(`Sending discover_result with ${discovery.devices.length} devices`);
    session.send({
      type: "discover_result",
      requestId: message.requestId,
      rooms: discovery.rooms,
      devices: this.toAppsocketDevices(discovery.devices)
    });
  }

  private async handleSnapshot(session: ClientSession, message: ProtocolMessage): Promise<void> {
    const snapshot = await this.options.discoveryService.createSnapshot();
    this.options.logger?.debug(`Sending snapshot with ${snapshot.devices.length} devices`);
    session.send({
      type: "snapshot",
      requestId: message.requestId,
      rooms: snapshot.rooms,
      devices: this.toAppsocketDevices(snapshot.devices)
    });
  }

  private async handleSubscribe(session: ClientSession, message: SubscriptionMessage): Promise<void> {
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

  private async handleUnsubscribe(session: ClientSession, message: SubscriptionMessage): Promise<void> {
    const ids = this.getIds(message);

    for (const id of ids) {
      if (session.subscriptions.has(id)) {
        await this.options.subscriptionService.unsubscribe(id);
        session.subscriptions.delete(id);
      }
    }

    session.send({ type: "unsubscribe", requestId: message.requestId, success: true, ids });
  }

  private async handleSetState(session: ClientSession, message: SetStateMessage): Promise<void> {
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

  private getIds(message: SubscriptionMessage): string[] {
    const candidates = [
      ...(Array.isArray(message.ids) ? message.ids : []),
      ...(Array.isArray(message.stateIds) ? message.stateIds : []),
      ...(typeof message.topic === "string" ? [message.topic] : [])
    ];

    return candidates.filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  private getAuthToken(message: ProtocolMessage): string {
    if (typeof message.token === "string") {
      return message.token;
    }

    if (message.payload && typeof message.payload === "object" && "token" in message.payload) {
      const token = (message.payload as { token?: unknown }).token;

      return typeof token === "string" ? token : "";
    }

    return "";
  }

  private requestToSetStateMessage(message: RequestMessage): SetStateMessage {
    const payload = message.payload ?? {};

    return {
      type: "set_state",
      requestId: message.requestId ?? "",
      id: typeof payload.id === "string" ? payload.id : "",
      stateId: typeof payload.stateId === "string" ? payload.stateId : "",
      value: payload.value
    };
  }

  private getStateId(message: SetStateMessage): string {
    if (typeof message.stateId === "string") {
      return message.stateId;
    }

    if (typeof message.id === "string") {
      return message.id;
    }

    return "";
  }

  private toAppsocketDevices(devices: AuraDevice[]): Record<string, unknown>[] {
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

  private toAppsocketCapability(capability: AuraCapability): Record<string, unknown> {
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

  private toAppsocketState(state: AuraState): Record<string, unknown> {
    return {
      id: state.id,
      stateId: state.id,
      name: state.name,
      role: state.role,
      value: state.value,
      unit: state.unit,
      min: state.min,
      max: state.max,
      states: state.states,
      writable: state.writable,
      common: {
        name: state.name,
        role: state.role,
        type: state.type,
        read: state.readable,
        write: state.writable,
        unit: state.unit,
        min: state.min,
        max: state.max,
        states: state.states
      }
    };
  }

  private toAppsocketDeviceType(type: AuraDeviceType): string {
    const mapping: Record<AuraDeviceType, string> = {
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

  private toIoBrokerRole(capability: AuraCapability): string {
    const mapping: Record<string, string> = {
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

  private parseMessage(rawMessage: unknown): ProtocolMessage | null {
    try {
      const text = Buffer.isBuffer(rawMessage) ? rawMessage.toString("utf8") : String(rawMessage);
      const parsed = JSON.parse(text) as unknown;

      if (!parsed || typeof parsed !== "object" || !("type" in parsed) || typeof parsed.type !== "string") {
        return null;
      }

      return parsed as ProtocolMessage;
    } catch {
      return null;
    }
  }

  private sendError(session: ClientSession, code: string, message: string, requestId?: string): void {
    this.options.logger?.warn(`WebSocket error response: ${code} - ${message}`);
    session.send({
      type: "error",
      requestId,
      code,
      message
    });
  }

  private getOperationSuffix(message: ProtocolMessage): string {
    if (message.type === "request" && typeof message.op === "string") {
      return `/${message.op}`;
    }

    return "";
  }
}
