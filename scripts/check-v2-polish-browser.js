// Ejecutar con browser_run_code_unsafe(filename). Fixtures, sin credenciales.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.clear();
    Math.random = () => 0;
    const now = Date.now.bind(Date);
    window.cacheOffset = 0;
    Date.now = () => now() + window.cacheOffset;
  });
  let mode = "success";
  let release;
  let notifyHeld;
  let requests = 0;
  const title = id => ({ id, type: "tv", title: `Anime de prueba ${id}`, date: "2020-01-01", poster: "/fixture-poster.svg", overview: id === 1 ? "Una historia romántica de prueba. ".repeat(25) : "Una historia romántica breve.", score: 7.8, votes: 3000, popularity: 30, runtime: 24, genres: ["Animación", "Drama"], genreIds: [16, 18], keywords: ["romance"], originalLanguage: "ja" });
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  await page.route("**/fixture-poster.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#eee"/></svg>' }));
  await page.route("**/api/**", async route => {
    requests++;
    const requestUrl = route.request().url();
    const pathname = requestUrl.split("?")[0];
    const params = Object.fromEntries((requestUrl.split("?")[1] || "").split("&").filter(Boolean).map(pair => pair.split("=").map(decodeURIComponent)));
    if (pathname.endsWith("discover") && mode === "hold") await new Promise(resolve => { release = resolve; notifyHeld(); });
    if (mode === "error") return route.fulfill({ status: 502, json: { ok: false, error: { code: "UPSTREAM_ERROR", message: "Error" } } });
    const data = pathname.endsWith("discover") ? { candidates: mode === "empty" ? [] : [1, 2, 3, 4, 5].map(title) }
      : pathname.endsWith("details") ? title(Number(params.id))
      : { providers: [{ name: "Crunchyroll", kind: "flatrate" }], region: "EC" };
    return route.fulfill({ json: { ok: true, data } });
  });
  const metrics = [];
  try {
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      mode = "success";
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://localhost:5173");
      for (const [group, value] of [["type", "anime"], ["platform", "crunchyroll"], ["mood", "romance"], ["yearPreset", "2020"]]) {
        await page.locator(`[data-group="${group}"] [data-value="${value}"]`).click();
      }
      await page.locator("#recommendButton").click();
      await page.locator('#result[data-state="success"]').waitFor();
      const button = page.getByRole("button", { name: "VER OTRA" });
      await button.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => {
        window.oldCard = document.querySelector(".result-card");
        window.oldButton = document.querySelector(".result-actions button");
        window.cacheOffset += 61000;
        return { y: scrollY, hash: location.hash, width: document.querySelector("#result").getBoundingClientRect().width };
      });
      mode = "hold";
      const held = new Promise(resolve => { notifyHeld = resolve; });
      await button.click();
      await held;
      await page.locator('#result[data-state="loading"]').waitFor();
      check(await button.isDisabled(), `Botón activo durante loading ${width}`);
      check(await page.evaluate(() => document.querySelector(".result-card") === window.oldCard), "Loading destruyó tarjeta");
      const loadingY = await page.evaluate(() => scrollY);
      check(Math.abs(loadingY - before.y) <= 1, `Salto loading ${width}: ${before.y} -> ${loadingY}`);
      const count = requests;
      await page.evaluate(() => window.oldButton.click());
      check(requests === count, "Request duplicado");
      mode = "success";
      release();
      await page.locator('#result[data-state="success"]').waitFor();
      const after = await page.evaluate(() => ({
        y: scrollY, hash: location.hash, width: document.querySelector("#result").getBoundingClientRect().width,
        stableDOM: document.querySelector(".result-card") === window.oldCard && document.querySelector(".result-actions button") === window.oldButton,
        overflow: document.documentElement.scrollWidth > innerWidth,
        posterRatio: document.querySelector(".result-poster").getBoundingClientRect().width / document.querySelector(".result-poster").getBoundingClientRect().height,
        buttonsFit: [...document.querySelectorAll(".result-actions button")].every(node => node.getBoundingClientRect().right <= innerWidth)
      }));
      check(Math.abs(after.y - before.y) <= 1, `Salto success ${width}: ${before.y} -> ${after.y}`);
      check(after.hash === before.hash && after.width === before.width && after.stableDOM, `Hash/ancho/DOM cambió ${width}`);
      check(!after.overflow && after.buttonsFit && Math.abs(after.posterRatio - 2 / 3) < 0.01, `Layout incorrecto ${width}`);
      for (const state of ["error", "empty"]) {
        mode = state;
        await page.evaluate(() => { window.cacheOffset += 61000; });
        await button.click();
        await page.locator(`#result[data-state="${state}"]`).waitFor();
        check(await page.evaluate(() => document.querySelector(".result-card") === window.oldCard), `${state} destruyó tarjeta`);
        check(Math.abs(await page.evaluate(() => scrollY) - before.y) <= 1, `Salto ${state} ${width}: ${before.y} -> ${await page.evaluate(() => scrollY)}`);
        check(!await button.isDisabled(), "No se puede reintentar");
      }
      mode = "success";
      await page.evaluate(() => { window.cacheOffset += 61000; });
      await button.click();
      await page.locator('#result[data-state="success"]').waitFor();
      await page.screenshot({ path: `/tmp/qvh-polish-${width}.png`, fullPage: true });
      metrics.push({ width, scrollBefore: before.y, scrollAfter: after.y, loadingY, overflow: after.overflow, stableDOM: after.stableDOM });
    }
    check(errors.length === 0, `Errores JS: ${errors.join(", ")}`);
    return { passed: true, metrics, errors, requests };
  } finally {
    page.off("pageerror", onError);
    await page.unroute("**/api/**");
    await page.unroute("**/fixture-poster.svg");
  }
}
