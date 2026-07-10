import { WebSocketServer as WsServer } from "ws";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import type { IoBrokerState } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
import { ClientSession } from "./ClientSession";
import type { MessageRouter } from "./MessageRouter";

export class WebSocketServer {
  private server: WsServer | null = null;
  private readonly sessions = new Map<string, ClientSession>();

  public constructor(
    private readonly port: number,
    private readonly router: MessageRouter,
    private readonly subscriptionService: SubscriptionService
  ) {}

  public start(): void {
    this.server = new WsServer({ port: this.port });

    this.server.on("connection", (socket) => {
      const session = new ClientSession(randomUUID(), socket);
      this.sessions.set(session.id, session);

      socket.on("message", (message) => {
        void this.router.route(session, message);
      });

      socket.on("close", () => {
        void this.removeSession(session);
      });
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;

    for (const session of this.sessions.values()) {
      session.close();
      await this.removeSession(session);
    }

    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      (server as WsServer & { _server?: Server }).close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public broadcastStateChanged(id: string, state: IoBrokerState): void {
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

  public broadcastNotification(stateId: string, message: string, timestamp: number): void {
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

  private async removeSession(session: ClientSession): Promise<void> {
    this.sessions.delete(session.id);

    for (const id of session.subscriptions) {
      await this.subscriptionService.unsubscribe(id);
    }

    session.subscriptions.clear();
  }
}
