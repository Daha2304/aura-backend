"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
class NotificationService {
    stateId;
    subscriptionService;
    handler;
    constructor(stateId, subscriptionService, handler) {
        this.stateId = stateId;
        this.subscriptionService = subscriptionService;
        this.handler = handler;
    }
    async start() {
        if (this.stateId.length === 0) {
            return;
        }
        await this.subscriptionService.subscribe(this.stateId);
    }
    async stop() {
        if (this.stateId.length === 0) {
            return;
        }
        await this.subscriptionService.unsubscribe(this.stateId);
    }
    handleStateChange(id, state) {
        if (id !== this.stateId || !state) {
            return;
        }
        this.handler(id, String(state.val ?? ""), state.ts);
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map