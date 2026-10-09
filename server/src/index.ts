import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { providerFromEnv } from "./providers/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const provider = providerFromEnv();
const app = await buildApp({
  provider,
  samplesDir: process.env.SAMPLES_DIR ?? join(root, "samples"),
  webDir: process.env.WEB_DIR ?? join(root, "web", "dist"),
  logger: true,
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`Extraction provider: ${provider.name}`);
