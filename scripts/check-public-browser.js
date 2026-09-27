// Ejecutar con Playwright browser_run_code_unsafe(filename) y npm run cf:dev.
// Solo API simulada. No modifica datos remotos ni requiere TMDB.
async (page) => {
  const origin = "http://localhost:8788";
  const check = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("qvh:")) localStorage.removeItem(key);
    Math.random = () => 0;
  });
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    requests.push(url);
    const region = url.searchParams.get("region") ?? "EC";
    const makeTitle = id => ({ id, type: "movie", title: `Película de prueba ${id}`, date: "2020-01-01", poster: "/assets/social-card.png", overview: "Una sinopsis de prueba.", score: 8.7, votes: 15000, popularity: 30, runtime: 90, genres: ["Acción"], genreIds: [28], keywords: [], availability: { region, providers: [{ name: "Netflix", kind: "flatrate" }] } });
    const data = url.pathname.endsWith("discover") ? { candidates: Array.from({ length: 20 }, (_, i) => makeTitle(i + 1)) } : makeTitle(Number(url.searchParams.get("id")));
    return route.fulfill({ json: { ok: true, data } });
  });
  const measurements = [];
  try {
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/privacidad", "/cookies", "/terminos", "/acerca-de", "/contacto", "/ruta-que-no-existe"]) {
        const response = await page.goto(origin + path);
        check(response.status() === (path.includes("no-existe") ? 404 : 200), `Estado HTTP ${path}`);
        check(await page.locator("main h1").count() === 1, `H1 ${path}`);
        check(await page.locator("footer a[href='/privacidad']").count() === 1, `Footer ${path}`);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${width}: ${path}`);
        measurements.push({ width, path, overflow: false });
      }
      await page.goto(origin);
      await page.keyboard.press("Tab");
      check(await page.getByRole("link", { name: "Saltar al contenido" }).evaluate(node => node === document.activeElement), "Skip link no accesible por teclado");
      await page.locator("#region").selectOption("MX");
      await page.locator('[data-group="type"] [data-value="movie"]').click();
      await page.locator('[data-group="mood"] [data-value="action"]').click();
      await page.locator("#recommendButton").click();
      await page.locator('#result[data-state="success"]').waitFor();
      check((await page.locator(".result-providers").innerText()).includes("MX"), "País incorrecto");
      const another = page.getByRole("button", { name: "VER OTRA" });
      await another.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      await another.click();
      await page.locator('#result[data-state="success"]').waitFor();
      check(Math.abs(await page.evaluate(() => scrollY) - y) <= 1, `Scroll Ver otra ${width}`);
      for (const name of ["YA LA VI", "NO ME INTERESA"]) {
        const button = page.getByRole("button", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => scrollY);
        await button.click();
        await page.locator('#result[data-state="success"]').waitFor();
        check(Math.abs(await page.evaluate(() => scrollY) - before) <= 1, `Scroll ${name}: ${width}`);
      }
      check(await page.evaluate(() => JSON.parse(localStorage.getItem("qvh:disliked")).length === 1), "Descartado no guardado");
      await page.screenshot({ path: `/tmp/qvh-public-${width}.png`, fullPage: true });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow resultado ${width}`);
      await page.locator("#region").selectOption("ES");
      check(!await page.locator("#result").isVisible(), "Disponibilidad antigua visible");
      await page.locator("#recommendButton").click();
      await page.locator('#result[data-state="success"]').waitFor();
      await page.locator("#clearHistory").click();
      check(await page.locator("#region").inputValue() === "ES", "Borrar historial perdió país");
      await page.locator("#clearData").click();
      check(await page.locator("#region").inputValue() === "EC", "Borrar todos no reinició país");
      check(await page.locator("#recommendButton").isDisabled(), "Mood no reiniciado");
    }
    // Reflow equivalente a 200 % sobre una ventana de 1280 px; no sustituye zoom nativo.
    await page.setViewportSize({ width: 640, height: 450 });
    await page.goto(origin + "/cookies");
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Overflow reflow 200 %");
    for (const path of ["/robots.txt", "/sitemap.xml", "/assets/social-card.png"]) {
      check((await page.request.get(origin + path)).status() === 200, `Asset ${path}`);
    }
    check(errors.length === 0, errors.join("; "));
    return { passed: true, measurements, errors, requests: requests.length, screenshots: "/tmp/qvh-public-*.png" };
  } finally {
    page.off("pageerror", onError);
    await page.unroute("**/api/**");
  }
}
