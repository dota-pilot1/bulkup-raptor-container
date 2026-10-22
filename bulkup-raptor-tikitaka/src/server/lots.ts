import "server-only";

import { desc } from "drizzle-orm";
import { lots } from "@/db/schema";
import { db } from "@/server/database";

export async function listLots(limit = 50) {
  return db.select().from(lots).orderBy(desc(lots.updatedAt), desc(lots.id)).limit(limit);
}
