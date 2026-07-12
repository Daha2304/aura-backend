export interface IoBrokerCommon {
  name?: string | Record<string, string>;
  role?: string;
  type?: string;
  read?: boolean;
  write?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  states?: unknown;
}

export interface IoBrokerObject {
  _id: string;
  type: string;
  common?: IoBrokerCommon;
  native?: Record<string, unknown>;
  enums?: Record<string, unknown>;
}

export interface IoBrokerObjectTreeNode {
  id: string;
  name: string;
  type: string;
  role?: string;
  valueType?: string;
  readable?: boolean;
  writable?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  value?: unknown;
  ack?: boolean;
  ts?: number;
  children: IoBrokerObjectTreeNode[];
}

export interface ObjectReaderAdapter {
  getForeignObjectsAsync(pattern: string, options?: unknown): Promise<Record<string, IoBrokerObject>>;
  getForeignObjectAsync(id: string): Promise<IoBrokerObject | null | undefined>;
}

export class ObjectService {
  public constructor(private readonly adapter: ObjectReaderAdapter) {}

  public async getObjects(): Promise<IoBrokerObject[]> {
    const objects = await this.adapter.getForeignObjectsAsync("*");

    return Object.values(objects).filter((object) => !object._id.startsWith("system."));
  }

  public async getObject(id: string): Promise<IoBrokerObject | null> {
    const object = await this.adapter.getForeignObjectAsync(id);

    return object ?? null;
  }

  public async getStateObjects(): Promise<IoBrokerObject[]> {
    const objects = await this.getObjects();

    return objects.filter((object) => object.type === "state");
  }

  public async getObjectTree(): Promise<IoBrokerObjectTreeNode[]> {
    const objects = await this.getObjects();
    const byId = new Map(objects.map((object) => [object._id, object]));
    const nodes = new Map<string, IoBrokerObjectTreeNode>();

    const getNode = (id: string): IoBrokerObjectTreeNode => {
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

  private createTreeNode(id: string, object?: IoBrokerObject): IoBrokerObjectTreeNode {
    const common = object?.common;
    const node: IoBrokerObjectTreeNode = {
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

  private getName(name: IoBrokerCommon["name"]): string | undefined {
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }

    if (name && typeof name === "object") {
      return name.de ?? name.en ?? Object.values(name).find((value) => value.trim().length > 0);
    }

    return undefined;
  }

  private sortTree(nodes: IoBrokerObjectTreeNode[]): void {
    nodes.sort((first, second) => {
      if (first.type !== second.type) {
        if (first.type === "folder") return -1;
        if (second.type === "folder") return 1;
        if (first.children.length !== second.children.length) return second.children.length - first.children.length;
      }

      return first.name.localeCompare(second.name, "de");
    });

    for (const node of nodes) {
      this.sortTree(node.children);
    }
  }
}
