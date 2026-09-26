# ¿Qué veo hoy?

Recomendador de películas y series en español según plataforma, tipo, estado de ánimo y tiempo. Conserva el diseño crema, negro y amarillo del prototipo y su animación glitch. La región inicial es Ecuador (`EC`).

## Stack y estructura

HTML5, CSS moderno, JavaScript con ES Modules, Vite y funciones Node compatibles con Vercel. TMDB aporta catálogo, imágenes y disponibilidad regional mediante JustWatch. No se utiliza ningún framework de interfaz.

```text
index.html                 Página y cuestionario
src/main.js                Entrada JavaScript del cliente
src/styles/main.css        Entrada CSS externa cargada por index.html
src/styles/                Variables, base, layout, cuestionario, resultado, responsive
src/components/            Cuestionario, tarjeta, loading y error/empty
src/config/                Moods/géneros y plataformas/regiones
src/services/movies.js     Cliente de nuestras rutas API y caché de sesión
src/utils/                 Almacenamiento, aleatoriedad y formato
api/                       discover.js, details.js, providers.js
api/_lib/tmdb.js            Validación, acceso privado a TMDB y respuestas
public/assets/             Logo de atribución y tarjeta social
tests/                    Pruebas Node sin llamadas externas
backup-original/           Respaldo inmutable del prototipo
```

`app.js` y `style.css` de la raíz solo indican la ubicación de los módulos migrados. No se cargan. **No modificar `backup-original/`.**

## Instalación y configuración

Requiere Node.js 22.12 o posterior (se recomienda Node 22 LTS) y npm.

```sh
npm install
cp .env.example .env
```

Solicita en la configuración API de tu cuenta de TMDB un **API Read Access Token**. Escríbelo únicamente en `.env`:

```dotenv
TMDB_BEARER_TOKEN=tu_token_de_lectura
```

No uses el prefijo `VITE_`, no lo incluyas en HTML/JS del cliente ni lo subas a Git. `.env` está ignorado. No se imprimen credenciales ni respuestas internas de errores.

```sh
npm run dev
```

Abre la URL indicada por Vite (normalmente `http://localhost:5173`). Un adaptador de desarrollo ejecuta los mismos handlers de `/api` dentro del servidor Node de Vite: **no necesitas otro servidor ni Vercel CLI para trabajar localmente**. Reinicia Vite después de editar `.env` o los handlers API.

Sin token, el proyecto compila y la interfaz funciona; las consultas devuelven `503 NOT_CONFIGURED` y muestran un error comprensible. No se simulan recomendaciones en producción.

## API y criterios

Solo se admite `GET`. Los parámetros desconocidos, duplicados o inválidos producen `400`; otros métodos, `405`.

- `/api/discover?type=movie&platform=netflix&mood=funny&time=120&region=EC`
- `/api/details?type=movie&id=550&region=EC`
- `/api/providers?type=movie&id=550&region=EC`

Descubrimiento acepta exclusivamente `type`, `platform`, `mood`, `time`, `region`. Detalles/proveedores aceptan `type` (`movie` o `series`), ID numérico positivo y región. Regiones previstas: EC, MX, CO, AR, PE, CL, ES.

Éxito: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`. Los fallos del proveedor generan `502`, el límite externo `429` y los títulos ausentes `404`. Solo se cachean éxitos (descubrimiento: 5 minutos en CDN; detalles/proveedores: 1 hora).

Se excluyen adultos y títulos sin póster, sinopsis o fecha; se exigen al menos 100 votos y puntuación 6/10. Se consultan hasta dos páginas por tipo para mantener un conjunto acotado de candidatos. Los géneros alternativos de cada mood se combinan con OR. `any` sortea el tipo y permite probar el otro si no encuentra una opción útil. No se relajan silenciosamente los filtros.

Los límites de tiempo son estrictos (`<30`, `<60`, `<120`). Para series se usa el mayor tiempo conocido de episodio; con filtro temporal se descartan duraciones desconocidas. Los detalles se verifican antes de presentar el resultado. Se prueban hasta diez candidatos por tipo para limitar tráfico.

Los IDs de plataformas se resuelven desde el catálogo regional; se distingue suscripción de alquiler/compra. El historial conserva 30 claves `tipo:id`, evita el resultado inmediato y prioriza títulos nuevos. Si se agota, reutiliza antiguos no vistos. “Ya la vi” excluye el título y busca otro. Región, vistos e historial se guardan localmente; si falla localStorage, funcionan en memoria durante la sesión.

## Pruebas y build

```sh
npm test
npm run build
npm run preview
```

Las pruebas usan `node:test`, datos controlados y fetch simulado; no requieren token. Cubren validación, exclusión de adultos/calidad, fallback de tipo, duración, proveedores, errores y almacenamiento bloqueado/dañado. El build genera `dist/`; preview también conecta el adaptador API local. `dist/` por sí solo requiere las funciones serverless para recomendar.

Comprobación manual:

1. Elegir opciones con ratón, touch y teclado; comprobar foco y selección única.
2. Solicitar una recomendación con token válido y revisar datos, explicación y región.
3. Pulsar “Ver otra” y “Ya la vi”; recargar y comprobar la persistencia.
4. Compartir desde HTTPS o localhost; comprobar copia y alternativa manual si falta permiso.
5. Probar sin token, sin conexión, disponibilidad vacía y filtros sin coincidencias.
6. Revisar 320, 375, 768, 1024 y 1440 px, sin scroll horizontal.

## Despliegue en Vercel

1. Subir el repositorio e importarlo en Vercel con preset **Vite**.
2. Usar `npm run build`, salida `dist` y Node 22.x.
3. Añadir `TMDB_BEARER_TOKEN` en las variables de entorno de Production y Preview según corresponda; volver a desplegar al cambiarla.
4. Vercel publicará los handlers de `api/` como funciones; no añadas una reescritura global que capture `/api`.
5. Reemplazar `https://example.com/` en canonical, Open Graph y Twitter por el dominio final. Comprobar `/assets/social-card.png` y ejecutar la prueba manual con datos reales.

`vercel.json` configura el build y cabeceras de seguridad. Los recursos del respaldo y los archivos de desarrollo no forman parte de `dist/`.

## Atribuciones y licencias

“This product uses the TMDB API but is not endorsed or certified by TMDB.”

El pie incluye el logotipo oficial de TMDB y créditos de JustWatch. Los enlaces de disponibilidad llevan a la página proporcionada por TMDB. Consultar [atribución de TMDB](https://developer.themoviedb.org/docs/faq), [proveedores y JustWatch](https://developer.themoviedb.org/reference/movie-watch-providers), [Vite](https://vite.dev/guide/) y [funciones Node de Vercel](https://vercel.com/docs/functions/runtimes/node-js).

**Antes de monetizar el proyecto deben revisarse las licencias y condiciones comerciales de las fuentes de datos utilizadas.**

## Limitaciones

- La disponibilidad regional depende de TMDB/JustWatch y puede cambiar; no es garantía contractual ni enlace directo de reproducción.
- Una respuesta sin traducción española se descarta; TMDB puede no tener duración o proveedores. El fallo de proveedores permite mostrar el título con un aviso.
- TV no tiene géneros independientes de terror, thriller o romance: los moods usan misterio, drama o ciencia ficción/fantasía como aproximación. No garantizan el tono de cada serie.
- Un conjunto limitado de candidatos puede agotarse; cambia los filtros si ocurre. Las recomendaciones no son personalización por aprendizaje automático.
- Datos locales vinculados al navegador; no se sincronizan. Sin localStorage se pierden al cerrar/recargar.
- Compartir requiere soporte del navegador; el portapapeles normalmente requiere HTTPS o localhost.
- La API pública tiene validación, caché y límites de trabajo, pero no un limitador distribuido por usuario. Para mayor tráfico, configurar protección/rate limiting en Vercel y supervisar la cuota de TMDB.

## Roadmap (sin implementar)

Selector completo de países, favoritos, cuentas de usuario, login, watchlist sincronizada, modo pareja, recomendaciones personalizadas, páginas SEO, PWA, rankings y filtros avanzados.

## Verificación de esta etapa

- `npm install`: completado; auditoría de instalación sin vulnerabilidades reportadas.
- `npm test`: correcto; 11 casos en dos archivos (API y almacenamiento).
- `npm run build`: correcto con Vite 8.3.1; 20 módulos. JS de producción: aproximadamente 9.11 kB (4.06 kB gzip), CSS: 7.45 kB (2.22 kB gzip).
- Navegador: estados loading/success/empty/error, selección por teclado, cancelación al cambiar filtros, historial, vistos, compartir y fallback de localStorage comprobados con respuestas controladas.
- Sin scroll horizontal en cuestionario y resultado a 320, 375, 430, 768, 1024 y 1440 px. Capturas de escritorio y móvil revisadas.
- A 1440 px, posiciones y dimensiones del hero, título, tarjeta decorativa y cuestionario coinciden con el respaldo original; el fondo conserva exactamente su color.
- Sin token: API real local devuelve 503 con `NOT_CONFIGURED`; no se incluyen credenciales ni llamadas directas al API de TMDB en el bundle del cliente.
- Los hashes SHA-256 de los tres archivos de `backup-original/` permanecen idénticos.
- Pendientes: consulta real con credencial TMDB, validación del catálogo regional en vivo, dominio definitivo y despliegue real en Vercel.

### Carga de estilos y Vercel dev

`index.html` carga `/src/styles/main.css` mediante un `<link rel="stylesheet">`. Esta entrada importa los seis módulos CSS en orden; Vite los procesa y genera una hoja CSS en `dist/assets/`. No mover estos imports a JavaScript: en desarrollo Vite los inyectaría como etiquetas `<style>`, bloqueadas por la política `style-src 'self'` que aplica `vercel dev`. La hoja externa conserva la política estricta y funciona en desarrollo y producción.
