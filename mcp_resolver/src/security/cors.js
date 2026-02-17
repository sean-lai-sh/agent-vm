import { ALLOWED_ORIGINS } from "../config/constants.js";

export function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  if (ALLOWED_ORIGINS.size > 0) {
    return ALLOWED_ORIGINS.has(origin);
  }
  return origin === "http://localhost" || origin === "http://127.0.0.1";
}
