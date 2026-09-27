import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

// Fragmentos estáticos compartidos: el contenido final no depende de JavaScript.
export default defineConfig({
  plugins: [{
    name: "qvh-static-partials",
    transformIndexHtml(html) {
      return html.replace(/<!-- qvh:([\w-]+) -->/g, (_, name) => {
        if (!["footer", "privacy-controls"].includes(name)) throw new Error("Fragmento desconocido");
        return readFileSync(new URL(`./src/templates/${name}.html`, import.meta.url), "utf8");
      });
    }
  }],
  build: {
    rolldownOptions: {
      input: ["index.html", "privacidad.html", "cookies.html", "terminos.html", "acerca-de.html", "contacto.html", "404.html"]
    }
  },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:8788" }
  }
});
