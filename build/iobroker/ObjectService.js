"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectService = void 0;
class ObjectService {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async getObjects(options = {}) {
        const objects = await this.adapter.getForeignObjectsAsync(options.pattern ?? "*");
        return Object.values(objects).filter((object) => options.includeSystem === true || !object._id.startsWith("system."));
    }
    async getObject(id) {
        const object = await this.adapter.getForeignObjectAsync(id);
        return object ?? null;
    }
    async getStateObjects() {
        const objects = await this.getObjects();
        return objects.filter((object) => object.type === "state");
    }
    async getObjectTree() {
        const objects = await this.getObjects();
        const byId = new Map(objects.map((object) => [object._id, object]));
        const nodes = new Map();
        const getNode = (id) => {
            const existing = nodes.get(id);
            if (existing) {
                return existing;
            }
            const object = byId.get(id);
            const node = this.createTreeNode(id, object);
            nodes.set(id, node);
            return node;
        };
        for (const object of objects) {
            const parts = object._id.split(".");
            for (let length = 1; length <= parts.length; length += 1) {
                const id = parts.slice(0, length).join(".");
                const node = getNode(id);
                if (length > 1) {
                    const parentId = parts.slice(0, length - 1).join(".");
                    const parent = getNode(parentId);
                    if (!parent.children.some((child) => child.id === node.id)) {
                        parent.children.push(node);
                    }
                }
            }
        }
        const roots = Array.from(nodes.values()).filter((node) => !node.id.includes("."));
        this.sortTree(roots);
        return roots;
    }
    createTreeNode(id, object) {
        const common = object?.common;
        const node = {
            id,
            name: this.getName(common?.name) ?? id.split(".").at(-1) ?? id,
            type: object?.type ?? "folder",
            children: []
        };
        if (common?.role) {
            node.role = common.role;
        }
        if (common?.type) {
            node.valueType = common.type;
        }
        if (typeof common?.read === "boolean") {
            node.readable = common.read;
        }
        if (typeof common?.write === "boolean") {
            node.writable = common.write;
        }
        if (common?.unit) {
            node.unit = common.unit;
        }
        if (typeof common?.min === "number") {
            node.min = common.min;
        }
        if (typeof common?.max === "number") {
            node.max = common.max;
        }
        return node;
    }
    getName(name) {
        if (typeof name === "string" && name.trim().length > 0) {
            return name.trim();
        }
        if (name && typeof name === "object") {
            return name.de ?? name.en ?? Object.values(name).find((value) => value.trim().length > 0);
        }
        return undefined;
    }
    sortTree(nodes) {
        nodes.sort((first, second) => {
            if (first.type !== second.type) {
                if (first.type === "folder")
                    return -1;
                if (second.type === "folder")
                    return 1;
                if (first.children.length !== second.children.length)
                    return second.children.length - first.children.length;
            }
            return first.name.localeCompare(second.name, "de");
        });
        for (const node of nodes) {
            this.sortTree(node.children);
        }
    }
}
exports.ObjectService = ObjectService;
//# sourceMappingURL=ObjectService.js.map