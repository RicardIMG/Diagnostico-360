import { buildServer } from "./src/server.mjs";

const app = await buildServer();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`Diagnóstico 360 disponível em http://127.0.0.1:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
