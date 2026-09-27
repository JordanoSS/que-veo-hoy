// Fixtures locales: prueba la UI real sin consultar TMDB ni necesitar secretos.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.addInitScript(() => {
    localStorage.removeItem("qvh:recent");
    localStorage.removeItem("qvh:seen");
  });
  const requests = [];
  let fixtureType = "movie";
  let fixtureMood = "romance";
  let anime = false;
  const makeTitle = id => ({
    id, type: fixtureType, title: `Fixture ${id}`, date: "2020-01-01", poster: "/fixture-poster.svg",
    overview: "Sinopsis de prueba", score: 7.8, votes: 3000, popularity: 30, runtime: 24,
    genres: [fixtureMood], genreIds: [...(anime ? [16] : []), ...({ action: [fixtureType === "movie" ? 28 : 10759], horror: fixtureType === "movie" ? [27] : [], romance: fixtureType === "movie" ? [10749] : [18], funny: [35], random: [35] }[fixtureMood])],
    keywords: [fixtureMood], originalLanguage: anime ? "ja" : "en"
  });
  await page.route("**/fixture-poster.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#eee"/></svg>' }));
  await page.route("**/api/**", async route => {
    const requestUrl = route.request().url();
    const pathname = requestUrl.split("?")[0];
    const params = Object.fromEntries((requestUrl.split("?")[1] || "").split("&").filter(Boolean).map(pair => pair.split("=").map(decodeURIComponent)));
    requests.push(params);
    let data;
    if (pathname.endsWith("discover")) {
      const type = params.type;
      data = { candidates: [fixtureType, "anime", "any"].includes(type) ? [1, 2, 3, 4, 5].map(makeTitle) : [] };
    } else if (pathname.endsWith("details")) data = makeTitle(Number(params.id));
    else data = { region: "EC", providers: [{ name: "Crunchyroll", id: 123, kind: "flatrate" }] };
    await route.fulfill({ json: { ok: true, data } });
  });
  const option = (group, value) => page.locator(`[data-group="${group}"] [data-value="${value}"]`);
  const cases = [["movie", "action"], ["movie", "horror"], ["movie", "romance"], ["tv", "romance"], ["movie", "random"], ["anime", "romance"], ["anime", "action"], ["anime", "horror"], ["anime", "funny"]];
  try {
    for (const [type, mood] of cases) {
      fixtureType = type === "anime" ? "tv" : type; fixtureMood = mood; anime = type === "anime";
      await page.goto("http://localhost:5173");
      await option("type", type).click(); await option("mood", mood).click();
      if (anime) await option("platform", "crunchyroll").click();
      await page.locator("#recommendButton").click();
      await page.locator('#result[data-state="success"]').waitFor();
      const first = await page.locator(".result-content h2").innerText();
      await page.getByRole("button", { name: "VER OTRA" }).click();
      await page.locator('#result[data-state="success"]').waitFor();
      const second = await page.locator(".result-content h2").innerText();
      check(first !== second, "Ver otra repitió el resultado");
      await page.getByRole("button", { name: "YA LA VI" }).click();
      await page.locator('#result[data-state="success"]').waitFor();
      const third = await page.locator(".result-content h2").innerText();
      check(third !== second && third !== first, "Historial no respetado");
      check((await page.evaluate(() => JSON.parse(localStorage.getItem("qvh:seen")))).length === 1, "Ya la vi no guardó el título");
    }
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow resultado a ${width}`);
    }
    return { passed: true, cases, history: "Ver otra y Ya la vi en cada caso", requests: requests.length };
  } finally { await page.unroute("**/api/**"); await page.unroute("**/fixture-poster.svg"); }
}
