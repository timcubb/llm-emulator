
import express from "express";
import { createLlmMockRouter } from "./middleware.js";

export async function start(cfg) {
  const app = express();
  const router = await createLlmMockRouter(cfg);
  app.use(router);
  app.listen(cfg.server.port, () => {
    console.log(`[llm-mock] http://localhost:${cfg.server.port} (${cfg.env})`);
  });
}
