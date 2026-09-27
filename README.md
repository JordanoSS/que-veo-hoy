# ¿Qué veo hoy? — QVH

Recomendador en español de películas, series y anime. Web pública actual: **https://que-veo-hoy.pages.dev/**. Mantiene la identidad crema / negro / amarillo eléctrico y no requiere cuentas ni muestra publicidad.

## Producto y reglas

Filtros: plataforma, tipo, mood, duración, rango de años y país. Regiones admitidas: Ecuador (`EC`, inicial), México (`MX`), Colombia (`CO`), Argentina (`AR`), Perú (`PE`), Chile (`CL`) y España (`ES`). La región se elige explícitamente: no hay GPS ni inferencia por IP.

Mood, tipo, anime y años son restricciones estrictas. Romance no equivale a Drama; Horror no equivale a Thriller; Action no equivale a Adventure; Anime requiere animación y evidencia japonesa/anime. Para TV, Romance/Horror requieren keywords fuertes. Crunchyroll + Anime + Romance se valida como intersección. Si faltan resultados se relaja primero duración y después plataforma, con explicación visible. Si nada cumple, se devuelve vacío. La duración de series corresponde al episodio.

Calidad centralizada en `src/config/recommendation.js`: mínimo 30 votos y 6.5/10, póster, sinopsis, fecha y exclusión de adultos. QVH Score pondera afinidad, valoración ajustada por votos, confianza y metadatos; aleatoriza entre hasta cinco candidatos a no más de cinco puntos del mejor encontrado. `VER OTRA`, `YA LA VI` y `NO ME INTERESA` conservan los filtros y la tarjeta durante la búsqueda; un fallo conserva la última recomendación sin scroll programático adicional.

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

- `/api/discover`: `type` (movie/tv/series/any/anime), `platform`, `mood` obligatorio, `time`, `yearFrom`, `yearTo`, `region`.
- `/api/details` y `/api/providers`: `type` (movie/tv/series), `id`, `region`.
- Se rechazan parámetros desconocidos, repetidos, años inválidos y métodos distintos de GET.
- Éxito: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
- Sin configuración: 503; título inexistente: 404; límite externo: 429; fallo externo: 502. No hay stack traces en las respuestas.

`details` solicita `append_to_response=keywords,watch/providers`. Normaliza keywords de película (`keywords.keywords`) y TV (`keywords.results`), además de `item["watch/providers"].results[region]`. Devuelve `availability` regional. Un subrecurso ausente/malformado devuelve `null` y activa la consulta separada de respaldo; una respuesta válida sin país contiene una lista vacía. Nunca se interpreta un fallo como disponibilidad confirmada.

Discover consulta hasta dos páginas por tipo/rama, hace un pre-ranking barato, excluye recientes/vistos/descartados y enriquece en lotes de cuatro, con máximo de 40 candidatos por tipo. Se detiene con cinco candidatos válidos de al menos 85 puntos, dentro de cinco puntos del mejor. `any` evalúa ambos tipos con un cupo independiente para el corte anticipado. Este corte garantiza los criterios de aceptación, no el máximo global de todo TMDB. Si no reúne ese grupo, continúa hasta el límite. Los detalles y proveedores se reutilizan entre fallbacks; la caché de cliente dura 60 segundos (80 entradas), y los catálogos de servidor hasta una hora (100 entradas por isolate).

Ejemplo estimado, película + cualquier plataforma, 40 candidatos válidos y dos páginas discover: antes **82 consultas TMDB** (2 + 40 details + 40 providers); ahora **10** (2 + 8 details anexados) si alcanza el umbral tras dos lotes. En navegador: **81 → 9** llamadas a `/api/*`. Son cuentas de un escenario, no mediciones de tráfico real. Si no se activa el corte: hasta 42 consultas TMDB; subrecursos ausentes, varios tipos, búsquedas de keywords/proveedores o fallbacks pueden aumentar el total. No hay rate limiter distribuido propio ni caché persistente con Cache API; las cabeceras HTTP no garantizan por sí solas caché de Functions.

## Privacidad y almacenamiento local

| Clave | Uso | Límite |
|---|---|---|
| `qvh:region` | País elegido | Una región; EC inicial |
| `qvh:recent` | Evitar repeticiones recientes | 30 títulos |
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

La suite cubre filtros V2, anime, año/tipo, fallback, score, exclusiones, almacenamiento y borrado, país, estabilidad DOM/scroll de Ver otra, errores, API, append y early-stop, SEO, CSP, sitemap y ausencia de credenciales reales en fuentes/build. `tests/public.test.js` valida páginas y fragmentos compartidos sin navegador. Las pruebas de seguridad revisan archivos nuevos además de los existentes, sin depender de subprocessos Git.

Para QA visual pendiente, ejecutar `scripts/check-public-browser.js` con la herramienta Playwright `browser_run_code_unsafe(filename)` y `cf:dev` abierto. Usa API simulada y comprueba home, información, 404 y resultados a 320, 375, 430, 768, 1024 y 1440 px; también teclado y reflow equivalente al 200 %. Los scripts `check-v2*` conservan las regresiones históricas. No añadir tests de red TMDB a la suite principal.

En el entorno de esta pasada no fue posible abrir puertos (`EPERM`), Wrangler no pudo enumerar interfaces (`uv_interface_addresses`) y Playwright exigió una aprobación deshabilitada. Por ello quedan pendientes inspección visual, zoom real, mediciones CWV, HTTP local y confirmación del beacon y append contra servicios reales. No confundir tests de DOM con renderizado visual.

## Atribución y próximos pasos

This product uses the TMDB API but is not endorsed or certified by TMDB.

TMDB aporta metadatos y pósteres; JustWatch aporta disponibilidad mediante TMDB. Los metadatos y la disponibilidad pueden estar incompletos o cambiar. No se inventan duración ni disponibilidad. El catálogo consultado es acotado.

Antes de monetizar, revisar licencia comercial de TMDB y requisitos de consentimiento/CMP aplicables.

PWA queda pendiente: el sitio tiene favicon SVG, pero no un juego de iconos de instalación validado en 192/512 px. No se añadió manifest ni Service Worker ni caché offline de API. Priorizar QA de navegador, comprobación real de Analytics y TMDB, Search Console y protección frente a abuso según tráfico antes de sumar funciones.

Fuentes oficiales consultadas:
- [TMDB append](https://developer.themoviedb.org/docs/append-to-response), [movie providers](https://developer.themoviedb.org/reference/movie-watch-providers), [TV providers](https://developer.themoviedb.org/reference/tv-series-watch-providers).
- [Cloudflare CSP](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/), [recolección Analytics](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/), [rutas y 404 Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
