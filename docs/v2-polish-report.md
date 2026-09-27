# V2: corrección y pulido

Se conservan Vite + JavaScript, Cloudflare Pages + Pages Functions y el estilo cream/black/electric-yellow. Sin dependencias nuevas, push, despliegue ni cambios de secretos. Se inspeccionaron AGENTS.md, el skill, su contrato y los cambios previos; esos cambios se conservaron.

## Archivos editados en esta pasada

- `functions/api/discover.js`: intersecciones de géneros en Anime.
- `server/tmdb.js`: normalización adicional de países de producción.
- `src/config/moods.js`: detección central de Anime y evidencia psicológica para Think.
- `src/config/recommendation.js`: calidad y pesos QVH.
- `src/services/recommendation.js`: deduplicación antes de solicitar detalles.
- `src/components/recommender.js`: ciclo de refresh, loading, errores y reserva de altura.
- `src/components/resultCard.js`: actualización del contenido conservando tarjeta y botones.
- `src/components/errorState.js`: empty state explicativo.
- `src/styles/result.css`: estabilidad del resultado y estado disabled.
- `src/utils/format.js`: explicación de disponibilidad regional confirmada.
- `src/utils/storage.js`: límite de vistos.
- `tests/ui.test.js`, `tests/v2.test.js`, `tests/storage.test.js`, `tests/security.test.js`.
- `scripts/check-v2-polish-browser.js` (nuevo) y este informe.

Los cambios previos en otros archivos siguen presentes; no se descartaron ni se atribuyen a esta pasada.

## Causa exacta del salto y corrección

`another: run` reutilizaba el flujo inicial. `run()` ejecutaba siempre `result.scrollIntoView(...)`, también al pulsar VER OTRA. Antes de ello, `loadingState(result)` reemplazaba la tarjeta completa por un bloque pequeño, reduciendo la altura del documento y pudiendo limitar el scroll cerca del final. El botón ya era `type="button"`; no era un submit ni un anchor. El focus existente tenía `preventScroll`, pero también se eliminó del refresh.

Ahora solo la búsqueda inicial solicita scroll/foco. El refresh mantiene la tarjeta y sus nodos principales, incluido el mismo botón; muestra «Buscando otra...», desactiva las acciones y evita ejecuciones simultáneas. Se reserva la altura del resultado y del cuerpo para que una sinopsis menor no suba los botones. El resultado desactiva scroll anchoring para evitar ajustes inducidos por sus cambios internos. No se utiliza `scrollTo`, ni se toca el hash.

La altura reservada se reinicia con una nueva búsqueda/selección. Puede quedar espacio libre al sustituir un título largo por uno corto: es deliberado para conservar dimensiones y posición de los controles.

## Filtros semánticos

`isAnimeCandidate(candidate, details, keywords)` requiere Animation más idioma original japonés, origen/producción JP o keyword explícita `anime`. Animation occidental sola, live action japonés o una adaptación de manga occidental sin otra evidencia no bastan. No se usa el nombre del proveedor como prueba de Anime.

- **Romance:** película con género Romance; TV con keywords explícitas `romance`, `romantic comedy`, `romantic drama` o `love story`. Drama/Comedy y overview no sustituyen esa prueba. Se conserva la política previa de descartar Romance mezclado con Horror.
- **Horror:** película con Horror; TV con keywords de horror, supernatural horror, psychological horror o slasher. Mystery/Thriller solos no bastan.
- **Action:** Action en películas, Action & Adventure en TV. Adventure solo no basta.
- **Funny:** exige Comedy.
- **Think:** Mystery, Sci-Fi o Thriller en películas; Mystery o keywords explícitas de ciencia ficción, thriller o contenido psicológico en TV. El género TV combinado Sci-Fi & Fantasy no basta por sí solo.

La consulta anterior sobrescribía los géneros del mood con `16` al elegir Anime. Ahora las ramas de películas usan `16,10749`, `16,27`, `16,28`, etc. Para moods con alternativas se unen resultados de ramas que individualmente conservan Animation AND género. TV Romance/Horror combina Animation/idioma con keywords. TV Think recupera candidatos para validarlos semánticamente en details; esa recuperación amplia no autoriza recomendaciones sin evidencia.

La sintaxis de TMDB usa coma para AND y pipe para OR: [Discover Movie](https://developer.themoviedb.org/reference/discover-movie), [Discover TV](https://developer.themoviedb.org/reference/discover-tv).

Todos los resultados pasan de nuevo por details, validación semántica, calidad, tipo, años y duración efectiva. Crunchyroll requiere coincidencia exacta de suscripción en proveedores de la región. Crunchyroll Amazon Channel no se trata como Crunchyroll.

## Ver otra, historial y fallback

Se guarda una copia de los filtros originales del ciclo: plataforma, tipo (incluido Anime), mood, duración (`time`), años y región. VER OTRA usa esa misma copia y añade exclusiones: actual, 30 recientes y hasta 1000 vistos. No existe una función independiente de «no deseados» en esta versión. Las claves distinguen película/TV y el historial funciona en memoria si localStorage falla.

Cada refresh vuelve a intentar el conjunto original y aplica, si hace falta, la secuencia duración → plataforma → empty. El nivel efectivo puede cambiar al agotarse candidatos recientes; la explicación de cada tarjeta informa las relajaciones. No se relajan Anime, mood, años, tipo explícito ni región. No se reciclan actuales/recientes/vistos para evitar un empty.

## QVH y calidad

Umbral central: nota mínima 6.5, al menos 30 votos, póster, sinopsis, título, fecha, géneros e identificador válidos; se excluyen adultos. Se valida que rating/votos sean números coherentes. Se conserva un mínimo de votos moderado para no excluir sistemáticamente Anime.

La media bayesiana mantiene prior 6 con peso 100 votos. Pesos finales: mood 35, rating ajustado 25, confianza 18, popularidad 2, filtros 10, metadata 10. Así se reduce el peso anterior de popularidad (10) y se refuerza rating/confianza (antes 20/15). Las pruebas comprueban 7.8 con 15 000 votos frente a 9.3 con 7 votos.

Después de validar se ordena y se escoge entre hasta cinco candidatos situados a un máximo de cinco puntos del mejor. Nunca se sortea todo el catálogo ni se aceptan candidatos que fallen el gate. Se deduplican IDs antes de pedir details.

## Empty, errores y explicaciones

Sin coincidencias se muestra «No encontramos una recomendación que cumpla todos esos filtros» y se sugiere cambiar plataforma o ampliar duración. Durante un refresh se conserva la tarjeta anterior y se indica expresamente que no se ha encontrado otra. No se presenta la anterior como una recomendación nueva.

Los errores muestran texto seguro en resultados, conservan la tarjeta si existe y permiten reintentar. Nunca se renderiza el error técnico. La explicación usa filtros efectivos y solo afirma una plataforma seleccionada cuando se validó su disponibilidad regional. El fallback de plataforma se explica expresamente.

## Verificación

- `npm test`: **49/49**, cero fallos.
- `npm run build`: **correcto**, 16 módulos, sin errores.
- Skill `scripts/verify.sh`: **correcto**.
- Test de seguridad repetido después del build: **correcto**; cliente, dist y archivos rastreados sin credencial real. No se imprimió el token.
- `git diff --check`: correcto.
- Playwright existente: nueve combinaciones (movie action/horror/romance/random, TV romance, Anime romance/action/horror/funny), con VER OTRA y YA LA VI.
- Script nuevo: loading demorado, doble clic, cambio de sinopsis larga a corta, error HTTP 502 simulado, empty y reintento; mismo DOM, hash y ancho, sin overflow ni póster deformado.

| Viewport (alto 900) | scrollY antes | loading | después |
| --- | ---: | ---: | ---: |
| 320 | 5088 | 5088 | 5088 |
| 375 | 4938 | 4938 | 4938 |
| 430 | 4709 | 4709 | 4709 |
| 768 | 3520 | 3520 | 3520 |
| 1024 | 3005 | 3005 | 3005 |
| 1440 | 2884 | 2884 | 2884 |

Error/empty tampoco cambiaron scrollY. No hubo excepciones JavaScript; el error de red 502 en consola fue inyectado por la prueba. Capturas en `/tmp/qvh-polish-{ancho}.png`; se inspeccionaron visualmente 320 y 1440.

## Limitaciones reales

La validación semántica y de navegador usa fixtures controladas, no el catálogo TMDB en vivo ni un despliegue Cloudflare. No certifica la disponibilidad real de un título hoy. TMDB puede omitir keywords, duración o datos regionales; en ese caso se descarta el candidato o se aplica únicamente el fallback autorizado. Discover Anime conserva el filtro conservador `original_language=ja`, que puede dejar fuera coproducciones/anime cuyo idioma original esté registrado de otra forma aunque la detección final admita otras pruebas.

La búsqueda es acotada y cacheada: un empty significa que no se encontró un candidato válido en el conjunto consultado, no que se agotó todo TMDB. Recientes conserva 30 entradas y vistos 1000; los más antiguos salen de sus respectivas listas. El espacio reservado de tarjeta puede ser visible después de cambiar de una sinopsis muy larga a una corta.
