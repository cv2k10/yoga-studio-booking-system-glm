import type { Db } from "@/db";
import type { User } from "@/db/schema";

export type Flash = { ok: boolean; message: string };

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    AUTH_SECRET: string;
    STUDIO_TZ?: string;
  };
  Variables: {
    db: Db;
    user: User | null;
    flash: Flash | null;
  };
};
