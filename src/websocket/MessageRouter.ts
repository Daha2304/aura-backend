import type { DiscoveryService } from "../discovery/DiscoveryService";
import type { ObjectService } from "../iobroker/ObjectService";
import type { StateService } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
import type { ProtocolMessage, RequestMessage, SetStateMessage, SubscriptionMessage } from "../models/ProtocolMessage";
import type { ClientSession } from "./ClientSession";

interface MessageRouterOptions {
  token: string;
  discoveryService: DiscoveryService;
  objectService: ObjectService;
  stateService: StateService;
  subscriptionService: SubscriptionService;
}

export class MessageRouter {
  public constructor(private readonly options: MessageRouterOptions) {}

  public async route(session: ClientSession, rawMessage: unknown): Promise<void> {
    const message = this.parseMessage(rawMessage);

    if (!message) {
      this.sendError(session, "invalid_message", "Message must be a JSON object");
      return;
    }

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
        session.send({ type: "discover", requestId: message.requestId, ...(await this.options.discoveryService.discover()) });
        return;
      case "snapshot":
        session.send({ requestId: message.requestId, ...(await this.options.discoveryService.createSnapshot()) });
        return;
      case "subscribe":
        await this.handleSubscribe(session, message as SubscriptionMessage);
        return;
      case "unsubscribe":
        await this.handleUnsubscribe(session, message as SubscriptionMessage);
        return;
      case "set_state":
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
        session.send({
          type: "response",
          op: message.op,
          requestId: message.requestId,
          success: true,
          payload: discovery
        });
        return;
      }
      case "snapshot.get":
      case "snapshot": {
        const snapshot = await this.options.discoveryService.createSnapshot();
        session.send({
          type: "response",
          op: message.op,
          requestId: message.requestId,
          success: true,
          payload: snapshot
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

  private async handleSubscribe(session: ClientSession, message: SubscriptionMessage): Promise<void> {
    const ids = this.getIds(message);

    for (const id of ids) {
      await this.options.subscriptionService.subscribe(id);
      session.subscriptions.add(id);
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

  private getIds(message: SubscriptionMessage): string[] {
    return Array.isArray(message.ids) ? message.ids.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
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
      value: payload.value
    };
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
    session.send({
      type: "error",
      requestId,
      code,
      message
    });
  }
}
