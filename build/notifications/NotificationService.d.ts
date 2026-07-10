import type { IoBrokerState } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
export type NotificationHandler = (stateId: string, message: string, timestamp: number) => void;
export declare class NotificationService {
    private readonly stateId;
    private readonly subscriptionService;
    private readonly handler;
    constructor(stateId: string, subscriptionService: SubscriptionService, handler: NotificationHandler);
    start(): Promise<void>;
    stop(): Promise<void>;
    handleStateChange(id: string, state: IoBrokerState | null | undefined): void;
}
