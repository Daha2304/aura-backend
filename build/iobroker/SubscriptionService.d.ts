import type { IoBrokerState } from "./StateService";
export interface SubscriptionAdapter {
    subscribeForeignStatesAsync(pattern: string): Promise<void>;
    unsubscribeForeignStatesAsync(pattern: string): Promise<void>;
}
export type StateChangeHandler = (id: string, state: IoBrokerState | null | undefined) => void;
export declare class SubscriptionService {
    private readonly adapter;
    private readonly subscriptionCounts;
    constructor(adapter: SubscriptionAdapter);
    subscribe(id: string): Promise<void>;
    unsubscribe(id: string): Promise<void>;
    isSubscribed(id: string): boolean;
}
