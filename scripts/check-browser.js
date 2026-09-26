// Ejecutar esta función con Playwright sobre el servidor Vite local.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:5173");
  await page.evaluate(() => {
    window.__requests = [];
    window.__testMode = "empty";
    window.__originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (!String(url).startsWith("/api/discover?")) return window.__originalFetch(url, options);
      window.__requests.push(Object.fromEntries(new URL(url, location.href).searchParams));
      await new Promise(resolve => setTimeout(resolve, 250));
      return Response.json(window.__testMode === "error" ? { ok: false, error: { code: "UPSTREAM_ERROR" } } : { ok: true, data: { candidates: [] } }, { status: window.__testMode === "error" ? 502 : 200 });
    };
  });
  let requests;
  try {
    const main = page.locator("#recommendButton");
    const option = (group, value) => page.locator(`[data-group="${group}"] [data-value="${value}"]`);
    check(await main.isDisabled(), "Mood vacío debe deshabilitar");
    check(await page.locator('[data-group="mood"] .selected').count() === 0, "No debe existir mood inicial");
    await option("mood", "action").click();
    check(await main.isEnabled(), "Acción debe habilitar");
    await option("mood", "think").click();
    check(await page.locator('[data-group="mood"] .selected').count() === 1, "Solo un mood seleccionado");
    await option("type", "movie").click();
    await option("yearPreset", "custom").click();
    await page.locator("#yearFrom").fill("2020");
    await page.locator("#yearTo").fill("2010");
    check(await main.isDisabled(), "Rango invertido debe bloquear");
    check((await page.locator("#yearError").innerText()).includes("mayor"), "Error visible");
    await page.locator("#yearFrom").fill("2015");
    await page.locator("#yearTo").fill("2020");
    await main.click();
    check(await page.locator('#result[data-state="loading"]').count() === 1, "Loading visible");
    await page.locator('#result[data-state="empty"]').waitFor();
    requests = await page.evaluate(() => window.__requests);
    check(requests.at(-1).yearFrom === "2015", "Rango enviado");
    check(requests.at(-1).mood === "think", "Mood enviado coincide con selected");
    await option("yearPreset", "2020").click();
    check(await page.locator("#yearFrom").isDisabled(), "Preset inactiva inputs");
    await main.click();
    await page.locator('#result[data-state="empty"]').waitFor();
    requests = await page.evaluate(() => window.__requests);
    check(requests.at(-1).yearTo === String(new Date().getFullYear()), "Actualidad dinámica");
    await option("yearPreset", "any").click();
    await main.click();
    await page.locator('#result[data-state="empty"]').waitFor();
    requests = await page.evaluate(() => window.__requests);
    check(!("yearFrom" in requests.at(-1)) && !("yearTo" in requests.at(-1)), "Cualquier año limpia ambos límites");
    await page.evaluate(() => { window.__testMode = "error"; });
    await option("mood", "funny").click();
    await main.click();
    await page.locator('#result[data-state="error"]').waitFor();
    check(await main.isEnabled(), "Botón recuperado tras error");
    const widths = [];
    await option("yearPreset", "custom").click();
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow a ${width}`);
      widths.push(width);
    }
    check(errors.length === 0, "Errores de JavaScript");
    return { passed: true, widths, requests: await page.evaluate(() => window.__requests.length), errors };
  } finally {
    await page.evaluate(() => { window.fetch = window.__originalFetch; });
  }
}
