# ¿Qué veo hoy?

Recomendador en español con Vite y JavaScript, alojado en **Cloudflare Pages** con **Pages Functions**. Conserva la interfaz crema, negro y amarillo, los filtros, el historial y la región inicial Ecuador (`EC`).

## Estructura

```text
index.html                  Página y cuestionario
src/                        Frontend, estilos, reglas y servicios
public/                     Assets y _headers de Cloudflare
functions/api/discover.js    /api/discover
functions/api/details.js     /api/details
functions/api/providers.js   /api/providers
server/tmdb.js              Validación, cliente privado TMDB y respuestas
wrangler.jsonc              Nombre, salida dist y fecha de compatibilidad
vite.config.js              Vite y proxy local /api hacia Wrangler
tests/                      Pruebas sin llamadas externas
backup-original/            Respaldo inmutable: no modificar
```

`functions/` está en la raíz, junto a `src/`, `public/` y `package.json`, **fuera de `dist/`**. Cloudflare compila las funciones por separado. Los helpers están en `server/` para no generar rutas públicas adicionales. No se requiere compatibilidad Node en el runtime.

## Desarrollo local

Requiere Node.js 22.12 o posterior y npm.

1. Instalar dependencias:
   ```sh
   npm install
   ```
2. Crear el archivo privado local:
   ```sh
   cp .dev.vars.example .dev.vars
   ```
   Editar `.dev.vars` y completar `TMDB_BEARER_TOKEN` con el **API Read Access Token** de TMDB. No compartir el archivo ni subirlo a Git. `.dev.vars`, sus variantes, `.env`, `.env.*`, `.wrangler/`, `node_modules/` y `dist/` están ignorados. Las plantillas `.example` no contienen credenciales.

   Si vienes de la configuración anterior, copia únicamente el valor de `TMDB_BEARER_TOKEN` desde tu `.env` a `.dev.vars`. Wrangler da prioridad a `.dev.vars`; mantener una única fuente evita confusiones. Las funciones leen **`context.env.TMDB_BEARER_TOKEN`**, nunca `process.env` ni variables con prefijo `VITE_`.
3. Compilar:
   ```sh
   npm run build
   ```
4. Iniciar Pages y sus funciones:
   ```sh
   npm run cf:dev
   ```
   Abre `http://localhost:8788`. Este script reconstruye `dist` antes de iniciar Wrangler; si ya compilaste, también puedes ejecutar `npx wrangler pages dev dist` directamente. No necesitas iniciar sesión en Cloudflare para desarrollo local. Reinicia Wrangler después de cambiar el secreto.

Para editar la interfaz con HMR, mantén Wrangler en el puerto 8788 y abre otra terminal:

```sh
npm run dev
```

Vite sirve la interfaz en `http://localhost:5173` y envía `/api/*` al runtime real de Wrangler. El frontend conserva sus llamadas relativas `/api/discover`, `/api/details` y `/api/providers`. `npm run preview` previsualiza solo archivos estáticos: usa `cf:dev` para probar el sitio completo. Al editar frontend usando únicamente Wrangler, vuelve a compilar para actualizar `dist/`.

## Probar la API

```sh
curl -i 'http://localhost:8788/api/discover?type=movie&platform=any&mood=action&time=120&yearFrom=2015&yearTo=2026&region=EC'
curl -i 'http://localhost:8788/api/details?type=movie&id=550&region=EC'
curl -i 'http://localhost:8788/api/providers?type=movie&id=550&region=EC'
```

Ajusta los años al rango que quieras consultar, sin superar el año actual. Solo se admite `GET`; otro método devuelve `405` y `Allow: GET`. Parámetros desconocidos, duplicados o inválidos devuelven `400`.

- Discover acepta `type`, `platform`, `mood`, `time`, `yearFrom`, `yearTo`, `region`. Mood es obligatorio; años opcionales, entre 1900 y el año actual, sin rango invertido.
- Detalles/proveedores aceptan `type`, `id` y `region`. `tv` es el tipo público de series; se mantiene el alias `series` por compatibilidad.
- Regiones: EC, MX, CO, AR, PE, CL, ES.
- Éxito: `{ "ok": true, "data": ... }`.
- Error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
- Sin secreto: `503 NOT_CONFIGURED`. Proveedor no disponible: `502`; límite externo: `429`; título ausente: `404`. No se devuelven stack traces.

La migración conserva validación semántica de géneros, tipo y años; calidad mínima de 100 votos y puntuación 6; exclusión de adultos; y fallback de duración antes que plataforma, sin eliminar mood, tipo explícito ni años. Para TV, el tiempo corresponde al episodio. El catálogo TV no tiene Horror/Thriller: esa combinación devuelve vacío, sin sustituirla por misterio.

Se mantienen las cabeceras de caché de éxitos y `no-store` en errores. Estas cabeceras no implican una caché persistente de Functions; no se ha añadido Cache API. Las cabeceras de seguridad anteriores se aplican mediante `public/_headers` a assets y desde los handlers a JSON.

## Cloudflare Pages con GitHub

1. Subir este proyecto a un repositorio GitHub y conectarlo en **Workers & Pages → Create application → Pages → Connect to Git**.
2. Configurar:

   | Ajuste | Valor |
   |---|---|
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` (raíz del repositorio) |
   | Node.js | 22.12 o posterior |

   El repositorio conectado debe contener `package.json` y `functions/` en su raíz. Si subes un monorepo, selecciona como raíz la carpeta de este proyecto.
3. En **Workers & Pages → proyecto → Settings → Variables and Secrets**, añadir **`TMDB_BEARER_TOKEN` como Secret**. Configurarlo para **Production** y también **Preview** si vas a probar previews. No colocarlo en `wrangler.jsonc`, en el cliente ni bajo un nombre `VITE_`.
4. Desplegar o volver a desplegar después de configurar el secreto. Comprobar `/api/discover` en el dominio `pages.dev` y luego, si corresponde, configurar el dominio propio.

`wrangler.jsonc` solo fija el nombre `que-veo-hoy`, la carpeta `dist` y la fecha de compatibilidad. Cambia `name` si tu proyecto de Pages tiene otro nombre. No contiene IDs de cuenta ni secretos.

## Desplegar con Wrangler como alternativa

Desde la raíz de este proyecto:

```sh
npx wrangler login
# Solo si el proyecto todavía no existe:
npx wrangler pages project create que-veo-hoy --production-branch main
# El comando solicita el valor de forma interactiva; no lo incluyas en la línea de comandos:
npx wrangler pages secret put TMDB_BEARER_TOKEN --project-name que-veo-hoy
npm run cf:deploy -- --branch main
```

`cf:deploy` ejecuta build y `wrangler pages deploy dist`; incluye Pages Functions automáticamente. Usa la rama de producción real en lugar de `main` si difiere. Otra rama crea un preview; configura también su secreto en el dashboard. Los secretos de `.dev.vars` **no se suben automáticamente**. Evita el arrastrar y soltar de `dist` en el dashboard para este proyecto: necesitas desplegar también las funciones.

## Verificación

```sh
npm test
npm run build
bash .agents/skills/que-veo-hoy-maintainer/scripts/verify.sh
```

Las pruebas usan `node:test` con `Request`, `Response` y `context.env` de prueba, sin necesitar credenciales ni red. Cubren contratos y errores de las tres rutas, token por contexto, filtros semánticos, años, fallback, estado visual, historial y ausencia de secretos en cliente/build. No se modificaron HTML, CSS, componentes ni lógica del recomendador durante esta migración.

## Atribución y límites

TMDB aporta catálogo e imágenes; JustWatch, disponibilidad mediante TMDB. Se conserva la atribución visible: “This product uses the TMDB API but is not endorsed or certified by TMDB.” La disponibilidad regional y los metadatos pueden ser incompletos; no se inventa duración ni disponibilidad. La consulta está acotada y puede devolver vacío. El historial permanece en el navegador.

El despliegue remoto requiere tu cuenta de Cloudflare, acceso al repositorio y configuración de secretos. La preparación y las pruebas locales no publican el sitio ni cambian DNS. Revisa las condiciones de TMDB antes de monetizar; configura protección frente a abuso según el tráfico.

Documentación oficial: [Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/), [desarrollo local](https://developers.cloudflare.com/pages/functions/local-development/), [bindings y secretos](https://developers.cloudflare.com/pages/functions/bindings/), [configuración Wrangler](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [deploy con Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/pages/).
