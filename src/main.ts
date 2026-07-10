import * as utils from "@iobroker/adapter-core";
import { loadConfig } from "./config";
import { DiscoveryService } from "./discovery/DiscoveryService";
import { ObjectService } from "./iobroker/ObjectService";
import { StateService, type IoBrokerState } from "./iobroker/StateService";
import { SubscriptionService } from "./iobroker/SubscriptionService";
import { NotificationService } from "./notifications/NotificationService";
import { MessageRouter } from "./websocket/MessageRouter";
import { WebSocketServer } from "./websocket/WebSocketServer";

class AuraBackendAdapter {
  private readonly adapter: ioBroker.Adapter;
  private webSocketServer: WebSocketServer | null = null;
  private notificationService: NotificationService | null = null;

  public constructor(options: Partial<utils.AdapterOptions> = {}) {
    this.adapter = new utils.Adapter({
      ...options,
      name: "aura-backend"
    });

    this.adapter.on("ready", () => {
      void this.onReady();
    });

    this.adapter.on("stateChange", (id, state) => {
      this.onStateChange(id, state as IoBrokerState | null | undefined);
    });

    this.adapter.on("unload", (callback) => {
      void this.onUnload(callback);
    });
  }

  private async onReady(): Promise<void> {
    const config = loadConfig(this.adapter.config);

    if (config.token.length === 0) {
      this.adapter.log.warn("No token configured. WebSocket clients cannot authenticate until a token is set.");
    }

    const objectService = new ObjectService(this.adapter);
    const stateService = new StateService(this.adapter);
    const subscriptionService = new SubscriptionService(this.adapter);
    const discoveryService = new DiscoveryService(objectService, stateService);
    const router = new MessageRouter({
      token: config.token,
      discoveryService,
      objectService,
      stateService,
      subscriptionService,
      logger: this.adapter.log
    });

    this.webSocketServer = new WebSocketServer(config.port, router, subscriptionService);
    this.webSocketServer.start();
    this.adapter.log.info(`Aura Backend WebSocket server listening on port ${config.port}`);

    this.notificationService = new NotificationService(config.notificationStateId, subscriptionService, (stateId, message, timestamp) => {
      this.webSocketServer?.broadcastNotification(stateId, message, timestamp);
    });

    await this.notificationService.start();
  }

  private onStateChange(id: string, state: IoBrokerState | null | undefined): void {
    if (!state) {
      return;
    }

    this.webSocketServer?.broadcastStateChanged(id, state);
    this.notificationService?.handleStateChange(id, state);
  }

  private async onUnload(callback: () => void): Promise<void> {
    try {
      await this.notificationService?.stop();
      await this.webSocketServer?.stop();
      callback();
    } catch (error) {
      this.adapter.log.error(error instanceof Error ? error.message : String(error));
      callback();
    }
  }
}

if (require.main !== module) {
  module.exports = (options: Partial<utils.AdapterOptions> = {}) => new AuraBackendAdapter(options);
} else {
  new AuraBackendAdapter();
}
