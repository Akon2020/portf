import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { settings } from "../db/schema";
import { DEFAULT_SETTINGS, SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "./settings-schema";

/**
 * Reads a settings value straight from the database, merged with defaults.
 * No Next.js import here: it is also used by the cron bundle and the tests.
 */
export async function readSettingUncached<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
  const merged = { ...DEFAULT_SETTINGS[key], ...((row?.value as object | undefined) ?? {}) };
  const parsed = SETTINGS_SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as SettingsValue<K>;
}
