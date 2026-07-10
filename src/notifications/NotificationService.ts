import type { IoBrokerState } from "../iobroker/StateService";
import type { SubscriptionService } from "../iobroker/SubscriptionService";

export type NotificationHandler = (stateId: string, message: string, timestamp: number) => void;

export class NotificationService {
  public constructor(
    private readonly stateId: string,
    private readonly subscriptionService: SubscriptionService,
    private readonly handler: NotificationHandler
  ) {}

  public async start(): Promise<void> {
    if (this.stateId.length === 0) {
      return;
    }

    await this.subscriptionService.subscribe(this.stateId);
  }

  public async stop(): Promise<void> {
    if (this.stateId.length === 0) {
      return;
    }

    await this.subscriptionService.unsubscribe(this.stateId);
  }

  public handleStateChange(id: string, state: IoBrokerState | null | undefined): void {
    if (id !== this.stateId || !state) {
      return;
    }

    this.handler(id, String(state.val ?? ""), state.ts);
  }
}
