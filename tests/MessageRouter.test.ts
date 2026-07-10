import { describe, expect, it } from "vitest";
import { MessageRouter } from "../src/websocket/MessageRouter";
import type { ClientSession } from "../src/websocket/ClientSession";

class TestSession {
  public authenticated = false;
  public readonly subscriptions = new Set<string>();
  public readonly messages: Record<string, unknown>[] = [];

  public send(message: Record<string, unknown>): void {
    this.messages.push(message);
  }
}

function createRouter(): MessageRouter {
  return new MessageRouter({
    token: "1234qwer",
    discoveryService: {
      discover: async () => ({
        rooms: [],
        devices: [
          {
            id: "test.0.light",
            name: "Light",
            type: "light",
            capabilities: []
          }
        ]
      }),
      createSnapshot: async () => ({
        type: "snapshot",
        version: 1,
        rooms: [],
        devices: []
      })
    },
    objectService: {
      getObject: async () => null
    },
    stateService: {
      validateWritableValue: () => null,
      setState: async () => undefined
    },
    subscriptionService: {
      subscribe: async () => undefined,
      unsubscribe: async () => undefined
    }
  } as ConstructorParameters<typeof MessageRouter>[0]);
}

describe("MessageRouter", () => {
  it("authenticates app auth messages", async () => {
    const session = new TestSession();

    await createRouter().route(session as unknown as ClientSession, JSON.stringify({
      type: "auth",
      payload: {
        token: "1234qwer"
      }
    }));

    expect(session.authenticated).toBe(true);
    expect(session.messages[0]).toMatchObject({
      type: "auth_ack",
      success: true,
      authenticated: true
    });
  });

  it("answers devices.list requests with discovery payload", async () => {
    const session = new TestSession();
    session.authenticated = true;

    await createRouter().route(session as unknown as ClientSession, JSON.stringify({
      type: "request",
      op: "devices.list",
      requestId: "sync_1"
    }));

    expect(session.messages[0]).toMatchObject({
      type: "response",
      op: "devices.list",
      requestId: "sync_1",
      success: true,
      payload: {
        devices: [
          {
            id: "test.0.light"
          }
        ]
      }
    });
  });

  it("keeps ping timestamps in pong messages", async () => {
    const session = new TestSession();

    await createRouter().route(session as unknown as ClientSession, JSON.stringify({
      type: "ping",
      ts: 1783701758431
    }));

    expect(session.messages[0]).toEqual({
      type: "pong",
      ts: 1783701758431
    });
  });
});
