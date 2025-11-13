
import express from "express";
import { createLlmMockRouter } from "./middleware.js";

export async function start(config) {
  const app = express();
  const router = await createLlmMockRouter(config);
  app.use(router);
  app.listen(config.server.port, () => {
    console.log(`[llm-emulator] http://localhost:${config.server.port} (${config.env})`);
  });
}
