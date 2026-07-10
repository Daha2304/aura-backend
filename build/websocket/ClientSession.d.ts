import type { WebSocket } from "ws";
import type { ProtocolMessage } from "../models/ProtocolMessage";
export declare class ClientSession {
    readonly id: string;
    private readonly socket;
    authenticated: boolean;
    readonly subscriptions: Set<string>;
    constructor(id: string, socket: WebSocket);
    send(message: ProtocolMessage | Record<string, unknown>): void;
    close(): void;
}
