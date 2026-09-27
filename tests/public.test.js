import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { regions } from "../src/config/platforms.js";
import config from "../vite.config.js";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const base = "https://que-veo-hoy.pages.dev/";
const pages = ["index", "privacidad", "cookies", "terminos", "acerca-de", "contacto"];
const expand = html => config.plugins[0].transformIndexHtml(html);

test("SEO: canonical, OG, Twitter e identidad real en cada página pública", () => {
  for (const name of pages) {
    const html = expand(read(`${name}.html`));
    const url = base + (name === "index" ? "" : name);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
    assert.ok(html.includes(`<meta property="og:image" content="${base}assets/social-card.png">`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${base}assets/social-card.png">`));
    assert.match(html, /og:site_name/);
    assert.match(html, /summary_large_image/);
    assert.doesNotMatch(html, /example\.com|unsafe-inline|unsafe-eval/);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
    assert.equal((html.match(/<main[ >]/g) ?? []).length, 1);
    assert.match(html, /Saltar al contenido/);
    for (const path of pages.slice(1)) assert.ok(html.includes(`href="/${path}"`));
    assert.match(html, /JustWatch/);
    assert.match(html, /This product uses the TMDB API but is not endorsed or certified by TMDB\./);
  }
});

test("JSON-LD válido y hash de CSP corresponde al contenido exacto", () => {
  const json = read("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(json), { "@context": "https://schema.org", "@type": "WebSite", name: "¿Qué veo hoy?", alternateName: "QVH", url: base });
  const hash = createHash("sha256").update(json).digest("base64");
  assert.ok(read("public/_headers").includes(`'sha256-${hash}'`));
});

test("CSP mínima permite Analytics, API e imágenes; bloquea objetos y framing", () => {
  const headers = read("public/_headers");
  const csp = headers.split("Content-Security-Policy: ")[1].trim();
  const rules = Object.fromEntries(csp.split(";").map(rule => { const [key, ...values] = rule.trim().split(/\s+/); return [key, values]; }));
  assert.deepEqual(rules["connect-src"], ["'self'", "https://cloudflareinsights.com"]);
  assert.deepEqual(rules["img-src"], ["'self'", "https://image.tmdb.org"]);
  assert.ok(rules["script-src"].includes("https://static.cloudflareinsights.com"));
  for (const key of ["frame-ancestors", "object-src"]) assert.deepEqual(rules[key], ["'none'"]);
  for (const key of ["base-uri", "form-action"]) assert.deepEqual(rules[key], ["'self'"]);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  for (const value of ["X-Content-Type-Options: nosniff", "Strict-Transport-Security: max-age=31536000", "geolocation=()", "Referrer-Policy: strict-origin-when-cross-origin"]) assert.ok(headers.includes(value));
});

test("sitemap contiene exactamente las rutas públicas y robots permite rastreo", () => {
  const sitemap = read("public/sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls.sort(), pages.map(name => base + (name === "index" ? "" : name)).sort());
  assert.match(sitemap, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  const robots = read("public/robots.txt");
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.ok(robots.includes(`Sitemap: ${base}sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow/);
});

test("social PNG 1200×630, favicon, 404 y entradas de Vite disponibles", () => {
  const png = readFileSync(new URL("../public/assets/social-card.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(existsSync(new URL("../public/assets/favicon.svg", import.meta.url)));
  assert.match(read("404.html"), /name="robots" content="noindex"/);
  assert.match(read("404.html"), /VOLVER A QVH/);
  assert.match(read("404.html"), /name="description" content="[^"]+"/);
  assert.deepEqual(config.build.rolldownOptions.input, [...pages.map(name => `${name}.html`), "404.html"]);
});

test("selector coincide con regiones del servidor; privacidad documenta claves reales", () => {
  const html = read("index.html");
  const select = html.match(/<select id="region"[\s\S]*?<\/select>/)[0];
  assert.deepEqual([...select.matchAll(/value="([A-Z]+)"/g)].map(match => match[1]), regions);
  for (const key of ["region", "recent", "seen", "disliked"]) assert.ok(read("cookies.html").includes(`qvh:${key}`));
  assert.doesNotMatch(read("src/utils/storage.js"), /localStorage\.clear\(/);
});
