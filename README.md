# ¿Qué veo hoy? — QVH V3 FINAL

Recomendador en español de películas, series y anime. Web pública actual: **https://que-veo-hoy.pages.dev/**. Mantiene la identidad crema / negro / amarillo eléctrico y no requiere cuentas ni muestra publicidad.

## Producto y reglas

Filtros: plataforma, tipo, mood, duración, rango de años, país y estilo de recomendación. Regiones admitidas: Ecuador (`EC`, inicial), México (`MX`), Colombia (`CO`), Argentina (`AR`), Perú (`PE`), Chile (`CL`) y España (`ES`). La región se elige explícitamente: no hay GPS ni inferencia por IP.

Mood, tipo, anime y años son restricciones estrictas. Romance no equivale a Drama; Horror no equivale a Thriller; Action no equivale a Adventure; Anime requiere animación y evidencia japonesa/anime. Para TV, Romance/Horror requieren keywords fuertes. Crunchyroll + Anime + Romance se valida como intersección. Si faltan resultados se relaja primero duración y después plataforma, con explicación visible. Si nada cumple, se devuelve vacío. La duración de series corresponde al episodio.

Calidad centralizada en `src/config/recommendation.js`: mínimo 30 votos y 6.5/10, póster, sinopsis, fecha y exclusión de adultos. QVH Score pondera afinidad, valoración ajustada por votos, confianza y metadatos; aleatoriza entre hasta cinco candidatos a no más de cinco puntos del mejor encontrado. `VER OTRA`, `YA LA VI` y `NO ME INTERESA` conservan los filtros y la tarjeta durante la búsqueda; un fallo conserva la última recomendación sin scroll programático adicional.

### Estilos V3

`recommendationMode` es opcional y usa `mix` por defecto; vive en memoria, no crea una clave de localStorage.

- **Safe / Apuesta segura:** Discover por valoración, mínimo 300 votos y score bayesiano; popularidad no decide por sí sola.
- **Trending / En tendencia:** unión de `trending/movie|tv/day` y `week`, después los mismos filtros baratos, Details y disponibilidad regional. No se presentan candidatos de Discover como tendencias.
- **New / Algo nuevo:** Discover por fecha descendente; sin años explícitos consulta los últimos 24 meses. Con rango respeta sus límites y favorece su extremo más reciente.
- **Hidden / Joya oculta:** Discover por valoración, al menos 7/10 y 80–3000 votos; popularidad máxima 40 y penalización gradual en selección. Son heurísticas de TMDB, no una certificación editorial.
- **Mix / Mezclar todo:** combina las cuatro fuentes, deduplica tipo+ID conservando procedencia e intercala fuentes antes del enrichment. Selecciona una fuente representada y después un buen candidato de ella; no exige cuotas cuando una fuente no cumple filtros.

Se excluyen actual + 100 recientes + vistos + descartados. Al consumir una ventana se avanza por páginas, sin vaciar recent. Los cursores de sesión se separan por filtros/país/modo y se acotan a 40 combinaciones; se reinician al borrar datos. Si no queda un resultado nuevo y una comprobación semántica/regional de recientes confirma opciones ya mostradas, aparece **«Ya te mostramos las mejores opciones de esta búsqueda»**, sin cambiar filtros automáticamente. No equivale a recorrer todo TMDB; con catálogos estrechos o límites de búsqueda puede ser necesario cambiar filtros. Si no existe esa evidencia se conserva el estado vacío.

## Arquitectura

- HTML multipágina en la raíz: home, privacidad, cookies, términos, acerca de, contacto y 404.
- `src/main.js`, `src/components/`, `src/services/`, `src/config/`, `src/utils/`: JavaScript nativo, estado y recomendador.
- `src/styles/`: CSS compartido; no framework visual ni fuentes externas.
- `src/templates/`: footer y controles de privacidad insertados por Vite en el HTML durante build/desarrollo. Son accesibles e indexables sin ejecutar JavaScript. Las páginas informativas no cargan el motor de recomendaciones.
- `public/`: assets, `robots.txt`, `sitemap.xml`, verificación de buscador y `_headers`.
- `functions/api/{discover,details,providers}.js`: Cloudflare Pages Functions. Solo aceptan GET y parámetros de listas permitidas.
- `server/`: cliente privado TMDB, catálogos regionales y normalización de proveedores.
- `tests/`: `node:test`, mocks de red y DOM; ninguna prueba principal necesita TMDB.
- `backup-original/`: respaldo histórico inmutable. `app.js` y `style.css` de la raíz son avisos de migración, no entradas activas.

Se mantienen Vite, Cloudflare Pages y Pages Functions. No hay base de datos, login, Service Worker ni dependencias nuevas. `functions/` se compila por separado de `dist/`.

## Desarrollo local

Requiere Node.js ≥ 22.12 y npm.

```sh
npm ci
# Solo en una instalación nueva:
cp .dev.vars.example .dev.vars
# Completar privadamente el API Read Access Token de TMDB en .dev.vars.
npm run cf:dev
```

Abre `http://localhost:8788`. `cf:dev` compila Vite y ejecuta `wrangler pages dev dist`. Para HMR, mantén Wrangler abierto y ejecuta `npm run dev`: Vite sirve en `http://localhost:5173` y envía `/api/*` a Wrangler. Después de editar archivos, reconstruye si utilizas solo Wrangler. `npm run preview` no ejecuta Functions.

El secreto **`TMDB_BEARER_TOKEN`** se lee únicamente de `context.env` en el servidor. Nunca debe usar prefijo `VITE_` ni aparecer en HTML, bundles o logs. `.dev.vars`, `.env`, sus variantes, `.wrangler/`, `dist/` y `node_modules/` están ignorados. No sobrescribas archivos privados existentes al preparar un entorno.

## Cloudflare

Configuración del proyecto Pages: build `npm run build`, salida `dist`, raíz del repositorio, Node ≥ 22.12. `wrangler.jsonc` conserva nombre y compatibilidad. Configura el secreto TMDB para producción y previews desde Cloudflare, sin publicarlo en Git. El comando `cf:deploy` existe como operación manual; build y tests no despliegan.

Pages sirve `/privacidad`, `/cookies`, `/terminos`, `/acerca-de` y `/contacto` desde sus archivos HTML. `404.html` en la raíz de `dist` proporciona la respuesta para rutas inexistentes y evita el fallback SPA. No hay reescrituras que capturen `/api/*`.

## API y peticiones a TMDB

- `/api/discover`: `type` (movie/tv/series/any/anime), `platform`, `mood` obligatorio, `time`, `yearFrom`, `yearTo`, `region`, `recommendationMode` (safe/trending/new/hidden/mix), `window` (0–19) y `sourceBudget` (1–12, interno para limitar páginas).
- `/api/details` y `/api/providers`: `type` (movie/tv/series), `id`, `region`.
- Se rechazan parámetros desconocidos, repetidos, años inválidos y métodos distintos de GET.
- Éxito: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
- Sin configuración: 503; título inexistente: 404; límite externo: 429; fallo externo: 502. No hay stack traces en las respuestas.

`details` solicita `append_to_response=keywords,watch/providers`. Normaliza keywords de película (`keywords.keywords`) y TV (`keywords.results`), además de `item["watch/providers"].results[region]`. Devuelve `availability` regional. Un subrecurso ausente/malformado devuelve `null` y activa la consulta separada de respaldo; una respuesta válida sin país contiene una lista vacía. Nunca se interpreta un fallo como disponibilidad confirmada.

Límites en `src/config/discovery.js` y `src/config/recommendation.js`: hasta 40 candidatos por fuente/tipo; pre-ranking de hasta 80 tras intercalar; enrichment máximo **40 para toda la búsqueda**, incluidos tipos, fallbacks y comprobación de agotamiento. Lotes de **2** y early-stop con **6** candidatos válidos de al menos 85 puntos, a no más de 5 puntos del mejor. El top final admite hasta 5. Mood, anime, tipo y años nunca se relajan; solo duración y luego plataforma. Think acepta Mystery/Sci-Fi/Thriller en cine y Mystery o evidencia fuerte de ciencia ficción/thriller/psicología en TV.

Por ventana: Safe/New/Hidden usan hasta 2 páginas (1 por rama anime); Trending usa day+week, sin paginación posterior; Mix usa 1 página por fuente Discover y day+week. Máximo 12 páginas externas por respuesta, 24 por búsqueda, 6 llamadas a Discover y 3 ventanas por etapa/tipo. Hay hasta 20 ventanas por combinación. Los límites son globales: una búsqueda difícil puede detenerse antes de recorrer todas las fuentes o fallbacks. Nunca se devuelven títulos incompatibles para completar el presupuesto.

Presupuesto orientativo con un tipo, sin fallback, caché fría y 6 excelentes: Safe/New/Hidden **8** llamadas TMDB (2 páginas + 6 Details anexados); Trending **8** (day+week + 6); Mix **11** (3 Discover + 2 Trending + 6). Con ambos tipos: aproximadamente 16 y 22 respectivamente. Si falta el grupo excelente, se continúa hasta 40 Details: máximo normal **24 + 40 = 64**, más catálogos fríos. Append ausente/malformado puede añadir hasta 40 llamadas de disponibilidad; este caso excepcional puede superar 100. Son presupuestos lógicos, no mediciones de latencia ni tráfico real.

Se conservan caché cliente de 60 segundos/80 entradas (incluye fuentes, Details y disponibilidad) y catálogos de servidor de una hora/100 entradas. Claves incluyen ruta, tipo, país, modo, ventana y parámetros relevantes. Peticiones concurrentes se deduplican dentro de la misma señal; errores y abortos no se guardan. Details y disponibilidad se reutilizan entre fallbacks. Las cabeceras HTTP no garantizan caché persistente de Functions; no hay rate limiter distribuido propio.

## Privacidad y almacenamiento local

| Clave | Uso | Límite |
|---|---|---|
| `qvh:region` | País elegido | Una región; EC inicial |
| `qvh:recent` | Evitar repeticiones recientes | 100 títulos |
| `qvh:seen` | Títulos ya vistos | 1000 títulos |
| `qvh:disliked` | Títulos que no interesan | 1000 títulos |

Las listas contienen tipo e ID y no se envían como listas al servidor. Permanecen hasta borrado o hasta que sus límites retiren las entradas más antiguas. Los demás filtros viven en memoria de página. Si localStorage está bloqueado se usa memoria temporal. Una entrada descartada no se vuelve a recomendar mientras siga en la lista; no se promete exclusión perpetua tras borrado o expulsión por límite.

**Borrar historial** elimina recientes, vistos y descartados, manteniendo país/filtros. **Borrar todos mis datos locales** elimina solo claves `qvh:*`, restablece Ecuador y reinicia filtros. Nunca usa `localStorage.clear()`. Ambas acciones invalidan resultados y peticiones activas, y anuncian confirmación o imposibilidad de confirmar borrado persistente. Los cambios de otra pestaña invalidan el resultado para evitar disponibilidad o historial antiguos. Los controles están en home y `/cookies`.

## Analytics y seguridad

Se conserva el identificador público existente de Cloudflare Web Analytics. El beacon se carga con `defer` desde `https://static.cloudflareinsights.com/beacon.min.js` en home y páginas informativas; no es un secreto TMDB. No se instrumentan preferencias, historial ni eventos personalizados. Cloudflare documenta Analytics sin cookies; no hay banner publicitario, AdSense, Google Analytics, GTM ni CMP.

CSP anterior: `script-src 'self'; connect-src 'self'`. Ahora se añaden exclusivamente:

- `https://static.cloudflareinsights.com` a `script-src`, para descargar el beacon.
- `https://cloudflareinsights.com` a `connect-src`, para enviar métricas; `'self'` ya permite `/cdn-cgi/rum` y `/api/*`.
- Un hash SHA-256 del bloque JSON-LD exacto, sin habilitar scripts inline arbitrarios. La prueba SEO comprueba el hash; debe actualizarse si cambia ese bloque.

Se mantienen imágenes TMDB en `img-src`, CSS y recursos locales. `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` y `form-action 'self'`; sin comodines ni `unsafe-eval`/`unsafe-inline`. Se añaden HSTS de un año para HTTPS, Permissions-Policy sin cámara/micrófono/geolocalización/pagos, y se conservan nosniff y Referrer-Policy. Functions devuelve sus propias cabeceras de seguridad porque `_headers` afecta los assets. Texto de catálogo mediante `textContent` y enlaces de proveedor restringidos al origen TMDB.

La aceptación final del beacon debe comprobarse en red y en el panel de Cloudflare después de publicar; bloqueadores pueden impedirlo. Si se activa la inyección automática de Analytics en Pages, evitar duplicar el snippet manual. No conocemos desde el repositorio la retención exacta de logs de infraestructura ni la configuración de seguridad del dashboard.

## SEO, información pública y accesibilidad

Canonical oficial, Open Graph, Twitter Card, favicon y JSON-LD `WebSite` reales. `social-card.png` es 1200 × 630; no se modificó. `sitemap.xml` incluye home y las cinco páginas informativas; `robots.txt` permite rastreo. 404 lleva `noindex` y no aparece en el sitemap. No se garantiza indexación por el mero hecho de publicar.

Páginas de privacidad, cookies/almacenamiento, términos, acerca de/créditos y contacto actualizadas el 27-09-2026. Contacto temporal: https://github.com/JordanoSS/que-veo-hoy/issues. Los issues son públicos; no publicar datos personales o secretos.

Enlaces para saltar al contenido, labels, controles nativos, foco visible, navegación móvil visible, `aria-pressed`, estados en español y `prefers-reduced-motion`. El glitch decorativo termina a los cinco segundos. Pósteres con dimensiones explícitas y carga diferida. WCAG 2.2 AA y LCP < 2.5 s / INP < 200 ms / CLS < 0.1 son objetivos, no una certificación ni mediciones obtenidas.

## Verificación

```sh
npm test
npm run build
bash .agents/skills/que-veo-hoy-maintainer/scripts/verify.sh
```

La suite incluye `tests/v3.test.js`: cinco fuentes, deduplicación, presupuesto global, 100 recomendaciones distintas, agotamiento, paginación, caché por modo/país/tipo y constraints en cada modo. Los tests DOM cubren mantener/cambiar modo, cancelación y agotamiento sin scroll. También cubre filtros V2, anime, año/tipo, fallback, score, exclusiones, almacenamiento y borrado, país, estabilidad DOM/scroll de Ver otra, errores, API, append y early-stop, SEO, CSP, sitemap y ausencia de credenciales reales en fuentes/build. `tests/public.test.js` valida páginas y fragmentos compartidos sin navegador. Las pruebas de seguridad revisan archivos nuevos además de los existentes, sin depender de subprocessos Git.

Para QA visual pendiente, ejecutar `scripts/check-public-browser.js` con la herramienta Playwright `browser_run_code_unsafe(filename)` y `cf:dev` abierto. Usa API simulada y comprueba home, información, 404 y resultados a 320, 375, 430, 768, 1024 y 1440 px; también teclado y reflow equivalente al 200 %. Los scripts `check-v2*` conservan las regresiones históricas. No añadir tests de red TMDB a la suite principal.

En el entorno de esta pasada no fue posible abrir puertos (`EPERM`), Wrangler no pudo enumerar interfaces (`uv_interface_addresses`) y Playwright exigió una aprobación deshabilitada. Por ello quedan pendientes inspección visual, zoom real, mediciones CWV, HTTP local y confirmación del beacon y append contra servicios reales. No confundir tests de DOM con renderizado visual.

## Atribución y próximos pasos

This product uses the TMDB API but is not endorsed or certified by TMDB.

TMDB aporta metadatos y pósteres; JustWatch aporta disponibilidad mediante TMDB. Los metadatos y la disponibilidad pueden estar incompletos o cambiar. No se inventan duración ni disponibilidad. El catálogo consultado es acotado.

Antes de monetizar, revisar licencia comercial de TMDB y requisitos de consentimiento/CMP aplicables.

V3 cierra el alcance funcional. Quedan QA de navegador y comprobaciones operativas; después, solo correcciones de bugs reales. No se planifican PWA, cuentas ni funciones sociales.

Fuentes oficiales consultadas:
- [TMDB Trending](https://developer.themoviedb.org/reference/trending-movies), [Discover movie](https://developer.themoviedb.org/reference/discover-movie), [Discover TV](https://developer.themoviedb.org/reference/discover-tv).
- [TMDB append](https://developer.themoviedb.org/docs/append-to-response), [movie providers](https://developer.themoviedb.org/reference/movie-watch-providers), [TV providers](https://developer.themoviedb.org/reference/tv-series-watch-providers).
- [Cloudflare CSP](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/), [recolección Analytics](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/), [rutas y 404 Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
