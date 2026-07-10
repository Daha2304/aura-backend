import type { IoBrokerState } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
import type { MessageRouter } from "./MessageRouter";
export declare class WebSocketServer {
    private readonly port;
    private readonly router;
    private readonly subscriptionService;
    private server;
    private readonly sessions;
    constructor(port: number, router: MessageRouter, subscriptionService: SubscriptionService);
    start(): void;
    stop(): Promise<void>;
    broadcastStateChanged(id: string, state: IoBrokerState): void;
    broadcastNotification(stateId: string, message: string, timestamp: number): void;
    private removeSession;
}
