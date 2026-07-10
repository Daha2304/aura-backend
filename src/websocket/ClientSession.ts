import type { WebSocket } from "ws";
import type { ProtocolMessage } from "../models/ProtocolMessage";

export class ClientSession {
  public authenticated = false;
  public readonly subscriptions = new Set<string>();

  public constructor(public readonly id: string, private readonly socket: WebSocket) {}

  public send(message: ProtocolMessage | Record<string, unknown>): void {
    if (this.socket.readyState !== this.socket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  public close(): void {
    this.socket.close();
  }
}
