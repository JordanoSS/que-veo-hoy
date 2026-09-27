# Motor QVH V2

Vite + JavaScript, Pages Functions `/api/discover`, `/api/details`, `/api/providers`.
Las credenciales continúan exclusivamente en `server/tmdb.js` mediante `context.env`.
No se añaden dependencias ni se cambian los estilos. Anime y Crunchyroll usan los botones existentes.

## Semántica centralizada (`src/config/moods.js`)

| Mood | Movie | TV |
| --- | --- | --- |
| Romance | Romance 10749 obligatorio | Keyword exacta romance, romantic comedy, romantic drama o love story |
| Terror | Horror 27 obligatorio | Keyword horror, supernatural horror, psychological horror o slasher |
| Acción | Action 28 obligatorio; Adventure 12 no basta | Action & Adventure 10759, categoría combinada de TMDB |
| Reírme | Comedy 35 | Comedy 35 |
| Pensar | Mystery 9648, Science Fiction 878 o Thriller 53 | Mystery 9648 o keywords explícitas de ciencia ficción/thriller; Sci-Fi & Fantasy 10765 por sí solo no basta |
| Tranquilo | Comedy 35, Family 10751 o Animation 16 | Mismos géneros compatibles |
| Sorpréndeme | Sin género obligatorio | Sin género obligatorio |

Romance descarta Horror incluso con Romance presente: decisión conservadora para casos dudosos.
Tranquilo descarta Horror, Thriller y Action, también por keywords fuertes de terror/thriller.
El texto libre de overview no prueba un género: evita aceptar menciones incidentales o negaciones.
Drama, idiomas y países no demuestran romance/terror. Los detalles adjuntan keywords y la
validación final vuelve a comprobar tipo, años, semántica, calidad y duración. Ningún candidato
se muestra directamente desde Discover. Movie y TV tienen mappings independientes.

Para descubrir Romance/Terror TV se resuelven IDs mediante `search/keyword`, con igualdad
exacta de nombre, y se pasan con OR a `with_keywords`. La respuesta de details debe confirmar
la keyword; una coincidencia de Discover por sí sola no basta. Pensar TV usa un catálogo más
amplio para no limitar thriller a géneros inexistentes, con post-validación estricta.

## Anime

`type=anime` es una selección de contenido, no un media type de TMDB: consulta movie y TV.
Cada resultado conserva su tipo real para tarjeta, historial y endpoints de detalles.
Regla final: Animation 16 Y (idioma original ja O país JP O keyword exacta anime).
Discovery limita Animation + idioma original ja para priorizar precisión y acotar peticiones.
Esto puede omitir coproducciones anime cuyo idioma original no sea japonés, aunque la regla
final las admitiría. Anime nunca elimina la restricción de mood ni de años.

## Calidad y QVH Score

Configuración única en `src/config/recommendation.js`: mínimo 30 votos, rating 6/10,
póster y overview obligatorios, título/fecha válidos, nunca adult. Se aplican a movie, TV y anime.
Son gates invariables: no se relajan para producir un resultado.

Score de 0–100: mood 35%, rating 20%, confianza 15%, popularidad 10%, otros filtros 10%,
metadata 10%. Rating bayesiano con prior 6/10 y peso de 100 votos; confianza logarítmica
saturada en 5000 votos; popularidad logarítmica saturada en 100. Metadata considera póster,
sinopsis, fecha, runtime y géneros. Los otros filtros consideran tipo/años conservados y
coincidencia de duración/plataforma originales, incluso si hubo fallback.

Hasta dos páginas Discover por tipo (primera + una entre 2 y 5), hasta 40 candidatos por
consulta a validar, lotes de cuatro peticiones de detalles. Se reutilizan detalles y providers
a través del fallback y mediante caché corta cliente. Selección aleatoria únicamente entre
los cinco mejores que estén a no más de cinco puntos del máximo validado. No se selecciona
aleatoriamente de todo el catálogo. La muestra está acotada: no garantiza el máximo global.

## Plataformas

`server/catalog.js` resuelve el catálogo regional por movie/TV y región, caché pública de una
hora por isolate (máximo 100 entradas, compartido con keywords). No cachea errores ni tokens.
Crunchyroll solo coincide con el nombre exacto Crunchyroll, nunca Amazon Channel. No hay ID
fallback. Discover envía watch_region=EC por defecto, with_watch_providers resuelto y
with_watch_monetization_types=flatrate. Antes de seleccionar se verifica de nuevo la suscripción
regional en `/watch/providers` del título. Un error de consulta de plataforma activa produce
error, no una afirmación de ausencia. Ausencia real de datos permite el fallback explícito.

## Fallback e historial

1. Tipo/contenido + mood + años + plataforma + duración.
2. Misma selección, sin límite de duración.
3. Misma selección, también sin restricción de plataforma.
4. Empty si no queda candidato válido.

Tipo/contenido, mood, años y región siempre se mantienen. En any/anime se prueban movie y TV
antes de relajar. `relaxed.time` y `relaxed.platform` acompañan el resultado; la explicación
reconoce los cambios y no afirma disponibilidad sin confirmación.

Ver otra conserva las selecciones, excluye los últimos 30 IDs, el actual y los vistos. Las
claves incluyen tipo (movie/series); IDs numéricos de movie y TV no colisionan. Si se agota la
muestra devuelve empty, sin reciclar recientes ni vistos. El historial reciente se limita a 30
al añadir resultados. No se recortan exclusiones silenciosamente para forzar una respuesta.

## Límites de la fuente

TMDB es metadata comunitaria: keywords y disponibilidad EC pueden faltar o estar incompletas.
TV no distingue Action de Adventure en su género combinado; la precisión depende de esa
clasificación. No se usa Drama para suplir Romance ni Thriller para suplir Horror.
Las keywords ausentes provocan falsos negativos deliberados. Runtime TV representa episodios,
no la serie completa; cuando falta solo se acepta después de relajar duración. Las consultas
son acotadas, por lo que empty significa que la búsqueda no encontró una opción validada,
no que no exista ninguna en todo TMDB. Las pruebas usan fixtures y no certifican el catálogo
comercial vivo ni la exactitud editorial de cada ficha.

Referencias oficiales: https://developer.themoviedb.org/reference/discover-tv,
https://developer.themoviedb.org/reference/discover-movie,
https://developer.themoviedb.org/reference/tv-series-keywords.
