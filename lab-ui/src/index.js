/**
 * novamind-lab-ui — Worker for the ThreatOps console.
 *
 * Routing (run_worker_first is true, so every request enters here):
 *   /api/*  and  /ws/*   -> backend container (FastAPI/uvicorn, port 8000)
 *   everything else       -> static SPA assets (frontend/dist) via env.ASSETS,
 *                            with SPA fallback to index.html (configured in
 *                            wrangler.jsonc: not_found_handling).
 *
 * The frontend is static, so it is served from Cloudflare's edge as assets
 * rather than from a container. Only the backend needs a container; it is a
 * single-instance Durable Object (fixed id) so the in-memory campaign_engine
 * state stays consistent across requests — sufficient for this demo lab.
 */
import { Container, getContainer } from "@cloudflare/containers";

export class Backend extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";

  constructor(ctx, env, options) {
    super(ctx, env, options);
    // Cloudflare Containers get no environment by default — the backend
    // (os.getenv) sees nothing unless we forward the Worker's bindings in.
    // These come from wrangler.jsonc `vars` (RELAY_URL, LAB_DOMAIN — public)
    // and `wrangler secret put` (ADMIN_TOKEN, LAB_ENROLL_CODE — secret).
    // Empty string when a binding is absent = feature disabled, matching the
    // partner-instance / local-docker defaults. Only non-empty values are
    // forwarded so an unset secret doesn't shadow a Dockerfile/compose default.
    const forwarded = {};
    for (const key of ["RELAY_URL", "LAB_ENROLL_CODE", "ADMIN_TOKEN", "LAB_DOMAIN"]) {
      if (env[key]) forwarded[key] = env[key];
    }
    this.envVars = forwarded;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isBackendRoute =
      url.pathname.startsWith("/api") || url.pathname.startsWith("/ws");

    if (isBackendRoute) {
      return getContainer(env.BACKEND, "backend-singleton").fetch(request);
    }

    // Static SPA: index.html, hashed JS/CSS assets, and client-side-route
    // fallback are all handled by the assets binding.
    return env.ASSETS.fetch(request);
  },
};
