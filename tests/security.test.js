import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
test("credenciales TMDB ausentes del cliente y build; .env ignorado", () => {
  const root = resolve(import.meta.dirname, "..");
  const envFiles = readdirSync(root).filter(name => (name.startsWith(".env") || name.startsWith(".dev.vars")) && !name.endsWith(".example"));
  const secrets = envFiles.flatMap(name => [...readFileSync(join(root, name), "utf8").matchAll(/^TMDB_BEARER_TOKEN=(.+)$/gm)].map(match => match[1].trim().replace(/^["']|["']$/g, ""))).filter(Boolean);
  // Inspecciona también archivos nuevos, sin depender de procesos Git secundarios.
  const ignored = new Set([".git", "node_modules", ".wrangler", ".vercel"]);
  function projectFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      if (ignored.has(entry.name) || ((entry.name.startsWith(".env") || entry.name.startsWith(".dev.vars")) && !entry.name.endsWith(".example"))) return [];
      const path = join(directory, entry.name);
      return entry.isDirectory() ? projectFiles(path) : [path];
    });
  }
  const project = projectFiles(root);
  for (const file of project) {
    const path = file;
    if (existsSync(path)) assert.equal(secrets.some(secret => readFileSync(path, "utf8").includes(secret)), false, `Credencial en archivo del proyecto: ${file}`);
  }
  const client = [...files(join(root, "src")), ...files(join(root, "public")), ...files(join(root, "dist")), join(root, "index.html")];
  for (const path of client) {
    const content = readFileSync(path, "utf8");
    assert.equal(/TMDB_BEARER_TOKEN|VITE_TMDB_(TOKEN|BEARER_TOKEN)/.test(content), false, `Referencia privada en ${path}`);
    assert.equal(secrets.some(secret => content.includes(secret)), false, `Credencial en ${path}`);
  }
  for (const name of [".env", ".dev.vars", ".wrangler/"]) assert.ok(readFileSync(join(root, ".gitignore"), "utf8").split("\n").includes(name));
});
