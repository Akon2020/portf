import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, id, timestamptz } from "./columns";

/** In-app notifications of the administration, one row per recipient. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    readAt: timestamptz("read_at"),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt)],
);

export type Notification = typeof notifications.$inferSelect;
