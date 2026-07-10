"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
class SubscriptionService {
    adapter;
    subscriptionCounts = new Map();
    constructor(adapter) {
        this.adapter = adapter;
    }
    async subscribe(id) {
        const count = this.subscriptionCounts.get(id) ?? 0;
        if (count === 0) {
            await this.adapter.subscribeForeignStatesAsync(id);
        }
        this.subscriptionCounts.set(id, count + 1);
    }
    async unsubscribe(id) {
        const count = this.subscriptionCounts.get(id) ?? 0;
        if (count <= 1) {
            this.subscriptionCounts.delete(id);
            await this.adapter.unsubscribeForeignStatesAsync(id);
            return;
        }
        this.subscriptionCounts.set(id, count - 1);
    }
    isSubscribed(id) {
        return this.subscriptionCounts.has(id);
    }
}
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=SubscriptionService.js.map