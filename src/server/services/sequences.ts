import { sql } from "drizzle-orm";
import type { Database } from "../db";
import { sequences } from "../db/schema";

export type SequenceType = "DEV" | "FAC" | "REC";

type Executor = Pick<Database, "execute">;

export function formatDocumentNumber(type: SequenceType, year: number, value: number): string {
  return `${type}-${year}-${String(value).padStart(4, "0")}`;
}

/**
 * Next number of a document type for the year. Must run inside the
 * transaction that stores the document: the upsert locks the counter row
 * until commit, and a rollback also rolls the counter back, so numbers are
 * unique and without gaps.
 */
export async function nextDocumentNumber(tx: Executor, type: SequenceType, year = new Date().getFullYear()): Promise<string> {
  const rows = await tx.execute<{ value: number }>(sql`
    insert into ${sequences} (type, year, value) values (${type}, ${year}, 1)
    on conflict (type, year) do update set value = ${sequences.value} + 1
    returning value
  `);
  return formatDocumentNumber(type, year, Number(rows[0].value));
}
