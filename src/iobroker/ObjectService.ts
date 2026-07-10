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
}
