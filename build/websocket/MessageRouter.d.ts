import type { DiscoveryService } from "../discovery/DiscoveryService";
import type { ObjectService } from "../iobroker/ObjectService";
import type { StateService } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";
import type { ClientSession } from "./ClientSession";
interface MessageRouterOptions {
    token: string;
    discoveryService: DiscoveryService;
    objectService: ObjectService;
    stateService: StateService;
    subscriptionService: SubscriptionService;
}
export declare class MessageRouter {
    private readonly options;
    constructor(options: MessageRouterOptions);
    route(session: ClientSession, rawMessage: unknown): Promise<void>;
    private routeAuthenticated;
    private handleHello;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleSetState;
    private getIds;
    private parseMessage;
    private sendError;
}
export {};
