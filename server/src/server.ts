// Must be the first import so DATABASE_URL is set before db.ts creates the pool.
import "./env";
import { createApp } from "./app";
import { initDb } from "./db";

const PORT = Number(process.env.PORT) || 3001;

async function main() {
  await initDb();
  createApp().listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
