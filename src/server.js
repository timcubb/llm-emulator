
import express from "express";
import { createLlmEmulatorRouter } from "./middleware.js";

export async function start(config) {
  const app = express();
  const router = await createLlmEmulatorRouter(config);
  app.use(router);
  app.listen(config.server.port, () => {
    console.log(`[llm-emulator] http://localhost:${config.server.port} (${config.env})`);
  });
}
