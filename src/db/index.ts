import type { SQL } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { getContext } from "hono/context-storage";
import type { AppEnv } from "@/env";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/**
 * Request-scoped database handle. The D1 binding only exists per request, so
 * this forwards to the instance the middleware put on the Hono context.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getContext<AppEnv>().var.db;
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

const dialect = new SQLiteAsyncDialect();

/**
 * Runs raw statements as one atomic D1 batch. Drizzle's own `db.batch` only
 * takes query builders, and the booking/credit updates need conditional SQL.
 */
export function runBatch(statements: SQL[]): Promise<D1Result[]> {
  const d1 = getContext<AppEnv>().env.DB;
  return d1.batch(
    statements.map((statement) => {
      const query = dialect.sqlToQuery(statement);
      return d1.prepare(query.sql).bind(...query.params);
    }),
  );
}
