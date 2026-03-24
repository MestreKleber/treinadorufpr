import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "./db.sqlite";

const sqlite = new Database(databaseUrl);
sqlite.pragma("journal_mode = WAL");

function ensureQuestionsColumns() {
	const tableInfo = sqlite.prepare("PRAGMA table_info(questions)").all() as Array<{ name: string }>;
	const columns = new Set(tableInfo.map((item) => item.name));

	if (!columns.has("bundle_id")) {
		sqlite.exec("ALTER TABLE questions ADD COLUMN bundle_id text");
	}
	if (!columns.has("bundle_title")) {
		sqlite.exec("ALTER TABLE questions ADD COLUMN bundle_title text");
	}
	if (!columns.has("bundle_context")) {
		sqlite.exec("ALTER TABLE questions ADD COLUMN bundle_context text");
	}
}

ensureQuestionsColumns();

export const db = drizzle(sqlite, { schema });
export { schema };
