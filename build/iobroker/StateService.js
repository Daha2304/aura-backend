"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateService = void 0;
class StateService {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async getState(id) {
        const state = await this.adapter.getForeignStateAsync(id);
        return state ?? null;
    }
    async getValues(ids) {
        const entries = await Promise.all(ids.map(async (id) => [id, await this.getState(id)]));
        return Object.fromEntries(entries);
    }
    validateWritableValue(object, value) {
        if (object.type !== "state") {
            return "Object is not a state";
        }
        if (object.common?.write !== true) {
            return "State is not writable";
        }
        const valueType = object.common?.type;
        if (valueType === "boolean" && typeof value !== "boolean") {
            return "Value must be boolean";
        }
        if (valueType === "number" && typeof value !== "number") {
            return "Value must be number";
        }
        if (valueType === "string" && typeof value !== "string") {
            return "Value must be string";
        }
        return null;
    }
    getValueType(object) {
        const type = object.common?.type;
        if (type === "boolean" || type === "number" || type === "string") {
            return type;
        }
        return "string";
    }
    async setState(id, value) {
        await this.adapter.setForeignStateAsync(id, value, false);
    }
}
exports.StateService = StateService;
//# sourceMappingURL=StateService.js.map