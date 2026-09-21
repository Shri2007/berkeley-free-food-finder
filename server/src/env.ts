import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// `neon link` / `neon deploy` write DATABASE_URL to .env.local at the project root.
// Resolved relative to this file, so it works no matter which folder you start the server from.
dotenv.config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)) });
