import type { IoBrokerState } from "./StateService";

export interface SubscriptionAdapter {
  subscribeForeignStatesAsync(pattern: string): Promise<void>;
  unsubscribeForeignStatesAsync(pattern: string): Promise<void>;
}

export type StateChangeHandler = (id: string, state: IoBrokerState | null | undefined) => void;

export class SubscriptionService {
  private readonly subscriptionCounts = new Map<string, number>();

  public constructor(private readonly adapter: SubscriptionAdapter) {}

  public async subscribe(id: string): Promise<void> {
    const count = this.subscriptionCounts.get(id) ?? 0;

    if (count === 0) {
      await this.adapter.subscribeForeignStatesAsync(id);
    }

    this.subscriptionCounts.set(id, count + 1);
  }

  public async unsubscribe(id: string): Promise<void> {
    const count = this.subscriptionCounts.get(id) ?? 0;

    if (count <= 1) {
      this.subscriptionCounts.delete(id);
      await this.adapter.unsubscribeForeignStatesAsync(id);
      return;
    }

    this.subscriptionCounts.set(id, count - 1);
  }

  public isSubscribed(id: string): boolean {
    return this.subscriptionCounts.has(id);
  }
}
