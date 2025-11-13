import { v4 as uuidv4 } from "uuid";

export function log(evt, data = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), evt, ...data }));
}

export function withReqId(req, res, next) {
  req._reqId = uuidv4();
  res.setHeader("x-request-id", req._reqId);
  next();
}
