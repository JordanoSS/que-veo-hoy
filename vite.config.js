import { defineConfig, loadEnv } from "vite";
import discover from "./api/discover.js";
import details from "./api/details.js";
import providers from "./api/providers.js";

// Adaptador local: ejecuta los mismos handlers Node que desplegará Vercel.
function localApi() {
  const routes = { "/api/discover": discover, "/api/details": details, "/api/providers": providers };
  const attach = server => {
    server.middlewares.use((req, res, next) => {
      const path = new URL(req.url, "http://localhost").pathname;
      if (Object.hasOwn(routes, path)) return routes[path](req, res);
      if (path.startsWith("/api/")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "Ruta no encontrada." } }));
      }
      next();
    });
  };
  return { name: "local-api", configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig(({ mode }) => {
  // loadEnv queda en el proceso Node; no se inyecta con define ni prefijos VITE_.
  const env = loadEnv(mode, process.cwd(), "TMDB_");
  if (env.TMDB_BEARER_TOKEN) process.env.TMDB_BEARER_TOKEN = env.TMDB_BEARER_TOKEN;
  return { plugins: [localApi()], server: { host: "127.0.0.1" } };
});
