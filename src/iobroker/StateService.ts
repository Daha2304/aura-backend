import type { IoBrokerObject } from "./ObjectService";
import type { AuraValueType } from "../models/AuraCapability";

export interface IoBrokerState {
  val: unknown;
  ack: boolean;
  ts: number;
  lc?: number;
  from?: string;
}

export interface StateAdapter {
  getForeignStateAsync(id: string): Promise<IoBrokerState | null | undefined>;
  setForeignStateAsync(id: string, value: unknown, ack?: boolean): Promise<unknown>;
}

export class StateService {
  public constructor(private readonly adapter: StateAdapter) {}

  public async getState(id: string): Promise<IoBrokerState | null> {
    const state = await this.adapter.getForeignStateAsync(id);

    return state ?? null;
  }

  public async getValues(ids: string[]): Promise<Record<string, IoBrokerState | null>> {
    const entries = await Promise.all(ids.map(async (id) => [id, await this.getState(id)] as const));

    return Object.fromEntries(entries);
  }

  public validateWritableValue(object: IoBrokerObject, value: unknown): string | null {
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

  public getValueType(object: IoBrokerObject): AuraValueType {
    const type = object.common?.type;

    if (type === "boolean" || type === "number" || type === "string") {
      return type;
    }

    return "string";
  }

  public async setState(id: string, value: unknown): Promise<void> {
    await this.adapter.setForeignStateAsync(id, value, false);
  }
}
