import { loadConfig } from "../src/config.mjs";
import { createDatabase } from "../src/database.mjs";

const db = await createDatabase(loadConfig());
await db.destroy();
console.log("Banco atualizado com sucesso.");
