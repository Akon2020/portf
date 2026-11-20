import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => timestamptz("created_at").notNull().defaultNow();

export const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const deletedAt = () => timestamptz("deleted_at");
