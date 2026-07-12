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
    logger?: {
        debug(message: string): void;
        warn(message: string): void;
    };
}
export declare class MessageRouter {
    private readonly options;
    constructor(options: MessageRouterOptions);
    route(session: ClientSession, rawMessage: unknown): Promise<void>;
    private routeAuthenticated;
    private handleHello;
    private handleRequest;
    private collectStateIds;
    private applyStateValues;
    private handleDiscover;
    private handleSnapshot;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleSetState;
    private getIds;
    private getAuthToken;
    private requestToSetStateMessage;
    private getStateId;
    private toAppsocketDevices;
    private toAppsocketCapability;
    private toAppsocketState;
    private toAppsocketDeviceType;
    private toIoBrokerRole;
    private parseMessage;
    private sendError;
    private getOperationSuffix;
}
export {};
