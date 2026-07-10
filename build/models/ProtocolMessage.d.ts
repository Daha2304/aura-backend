export type ProtocolMessageType = "hello" | "hello_ack" | "auth" | "auth_ack" | "ping" | "pong" | "request" | "response" | "discover" | "discover_result" | "subscribe" | "unsubscribe" | "set_state" | "setState" | "snapshot" | "state_changed" | "notification" | "error";
export interface ProtocolMessage {
    type: ProtocolMessageType;
    requestId?: string;
    [key: string]: unknown;
}
export interface HelloMessage extends ProtocolMessage {
    type: "hello";
    client: string;
    version: number;
    token: string;
}
export interface AuthMessage extends ProtocolMessage {
    type: "auth";
    payload?: {
        token?: string;
    };
}
export interface RequestMessage extends ProtocolMessage {
    type: "request";
    op: string;
    payload?: Record<string, unknown>;
}
export interface SubscriptionMessage extends ProtocolMessage {
    type: "subscribe" | "unsubscribe";
    ids?: string[];
    stateIds?: string[];
    topic?: string;
    devices?: string[];
}
export interface SetStateMessage extends ProtocolMessage {
    type: "set_state" | "setState";
    id?: string;
    stateId?: string;
    value: unknown;
    requestId?: string;
}
export interface ErrorMessage extends ProtocolMessage {
    type: "error";
    code: string;
    message: string;
}
