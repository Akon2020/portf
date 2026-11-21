/**
 * Every monitoring write goes through track(): a stable, versioned event
 * schema with an interchangeable transport. "local" stores in PostgreSQL;
 * "batela" also forwards batches to Batela over HTTP, with a retry queue.
 */
import { getDb } from "@/server/db";
import { analyticsEvents, errorLogs, pageViews, securityEvents } from "@/server/db/schema";

export type MonitoringEvent =
  | { type: "page_view"; data: typeof pageViews.$inferInsert }
  | { type: "analytics_event"; data: typeof analyticsEvents.$inferInsert }
  | { type: "security_event"; data: typeof securityEvents.$inferInsert }
  | { type: "error"; data: typeof errorLogs.$inferInsert };

export interface Envelope {
  v: 1;
  type: MonitoringEvent["type"];
  ts: string;
  app: "portfolio";
  data: Record<string, unknown>;
}

export interface Transport {
  send(events: MonitoringEvent[]): Promise<void>;
}

export function envelope(event: MonitoringEvent): Envelope {
  return { v: 1, type: event.type, ts: new Date().toISOString(), app: "portfolio", data: event.data as Record<string, unknown> };
}

export class LocalTransport implements Transport {
  async send(events: MonitoringEvent[]): Promise<void> {
    const db = getDb();
    const by = <T extends MonitoringEvent["type"]>(type: T) => events.filter((event) => event.type === type).map((event) => event.data);
    const views = by("page_view") as (typeof pageViews.$inferInsert)[];
    const analytics = by("analytics_event") as (typeof analyticsEvents.$inferInsert)[];
    const security = by("security_event") as (typeof securityEvents.$inferInsert)[];
    const errors = by("error") as (typeof errorLogs.$inferInsert)[];
    await Promise.all([
      views.length ? db.insert(pageViews).values(views) : null,
      analytics.length ? db.insert(analyticsEvents).values(analytics) : null,
      security.length ? db.insert(securityEvents).values(security) : null,
      errors.length ? db.insert(errorLogs).values(errors) : null,
    ]);
  }
}

/** Batela: local storage stays the source of the admin dashboards, events are also pushed by HTTP. */
export class BatelaTransport implements Transport {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly local = new LocalTransport(),
  ) {}

  async send(events: MonitoringEvent[]): Promise<void> {
    await this.local.send(events);
    const batch = events.map(envelope);
    try {
      await postBatch(this.endpoint, this.apiKey, batch);
    } catch {
      const { enqueueJob } = await import("@/server/jobs/queue");
      await enqueueJob("monitoring.batela", { events: batch }, { runAt: new Date(Date.now() + 60_000), maxAttempts: 5 });
    }
  }
}

export async function postBatch(endpoint: string, apiKey: string, events: Envelope[]): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ events }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Batela HTTP ${response.status}`);
}

let transport: Transport | undefined;

export function getTransport(): Transport {
  if (transport) return transport;
  const endpoint = process.env.BATELA_ENDPOINT;
  const key = process.env.BATELA_API_KEY;
  transport = process.env.MONITORING_TRANSPORT === "batela" && endpoint && key ? new BatelaTransport(endpoint, key) : new LocalTransport();
  return transport;
}

export async function track(...events: MonitoringEvent[]): Promise<void> {
  if (events.length) await getTransport().send(events);
}

/** Fire and forget: the request is never slowed down or broken by monitoring. */
export function trackInBackground(...events: MonitoringEvent[]): void {
  track(...events).catch((error) => console.error("[monitoring] write failed", error instanceof Error ? error.message : error));
}
