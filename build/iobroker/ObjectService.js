"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectService = void 0;
class ObjectService {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async getObjects() {
        const objects = await this.adapter.getForeignObjectsAsync("*");
        return Object.values(objects).filter((object) => !object._id.startsWith("system."));
    }
    async getObject(id) {
        const object = await this.adapter.getForeignObjectAsync(id);
        return object ?? null;
    }
    async getStateObjects() {
        const objects = await this.getObjects();
        return objects.filter((object) => object.type === "state");
    }
}
exports.ObjectService = ObjectService;
//# sourceMappingURL=ObjectService.js.map