# Pasada de profesionalización QVH — 2026-09-27

Trabajo local para revisión. Sin commit, push, deploy, cambios de dominio, publicidad, login ni cambios de `.env`, `.dev.vars` o `backup-original`.

1. **Estado inicial.** Main limpio y sincronizado. Vite + Pages Functions y recomendador V2 funcionando con tests offline. Canonical/OG/Twitter apuntaban a un dominio de ejemplo; la CSP bloqueaba el beacon existente. Solo había home, footer mínimo y sin páginas informativas, selector visible de país ni borrado de datos. AGENTS/README contenían descripciones del prototipo y umbrales antiguos. La tarjeta social ya era PNG 1200 × 630. El test de seguridad fallaba aquí al intentar crear un subproceso Git (`EPERM`).

2. **Archivos creados.** `404.html`, `privacidad.html`, `cookies.html`, `terminos.html`, `acerca-de.html`, `contacto.html`; `server/providers.js`; `src/components/privacyControls.js`; `src/information.js`; `src/styles/information.css`; `src/templates/footer.html`, `src/templates/privacy-controls.html`; `tests/public.test.js`; `scripts/check-public-browser.js`; este informe.

3. **Archivos modificados.** Inventario al final. No se modificaron dependencias, lockfile, credenciales ni configuración de proyecto Wrangler. Se actualizaron AGENTS y README para describir la arquitectura real.

4. **SEO.** Dominio único `https://que-veo-hoy.pages.dev/`, título/description de home con películas, series y anime, canonical y OG/Twitter por página. Favicon conservado, tarjeta social absoluta con dimensiones y texto alternativo. Sin referencias incorrectas al dominio de ejemplo en contenido público. Asset disponible en `dist/assets/social-card.png`; HTTP público pendiente de comprobación por limitaciones de herramientas.

5. **Structured data.** JSON-LD WebSite: name, alternateName QVH y URL reales. Sin empresa, valoraciones, precio, teléfono ni autor legal inventados. JSON y hash SHA-256 de CSP comprobados, también sobre HTML compilado.

6. **Sitemap/robots.** Seis URLs: home, privacidad, cookies, términos, acerca de y contacto. XML parseado correctamente. Robots permite rastreo y señala el sitemap oficial. 404 y API fuera del sitemap.

7. **CSP antes/después.** Antes `script-src 'self'; connect-src 'self'`. Ahora `script-src 'self' https://static.cloudflareinsights.com 'sha256-j4pgdbt9KufSx0Ts3XHKTPrADpiHDRQuKDVuHfbzWTc='` y `connect-src 'self' https://cloudflareinsights.com`. El primero descarga el beacon y permite solo el JSON-LD exacto; el segundo envía métricas. Se añadió `object-src 'none'`. El resto de restricciones se conserva: imágenes solo locales/TMDB, estilos locales, frame-ancestors none, base-uri/form-action self. Sin unsafe-inline, unsafe-eval ni comodines. Fuente: [Cloudflare CSP](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/).

8. **Seguridad.** Nosniff y Referrer-Policy conservados; HSTS de un año y Permissions-Policy sin cámara, micrófono, GPS o pagos. Cabeceras propias también en Functions. Continúan allowlists de parámetros, errores normalizados, textContent y secreto exclusivamente servidor. El test de secretos examina archivos nuevos/existentes y dist sin imprimir valores. Sin exposición detectada. `npm audit` no pudo consultar advisories por DNS; no se afirma ausencia de vulnerabilidades en dependencias. No se implementó rate limiting distribuido.

9. **Analytics.** Snippet existente con identificador público, ahora defer y permitido por CSP, en home y páginas informativas. No hay nuevos trackers ni eventos de historial. Self permite además `/cdn-cgi/rum`. Recepción en dashboard y posibles bloqueadores no comprobados. Si se activa inyección automática en Pages, evitar duplicación con el snippet manual. [Recolección oficial](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/).

10. **Páginas legales.** Privacidad, cookies/almacenamiento y términos describen funcionalidades reales, infraestructura, fuentes, enlaces y límites. Fecha 27-09-2026. Se informa que no se conocen aquí los plazos exactos de logs externos. No se inventó empresa, DPO, contacto privado ni certificación.

11. **Datos locales.** `qvh:region`; `qvh:recent` (30); `qvh:seen` (1000); `qvh:disliked` (1000). Sin caducidad temporal. Los demás filtros son estado en memoria. Las listas no se transmiten como listas a la API. Modo de memoria cuando almacenamiento falla.

12. **Borrado.** Historial elimina recientes, vistos y descartados. Todos elimina exclusivamente claves qvh:* y reinicia filtros/país EC. Controles en home y cookies, confirmación por role=status, sin confirm() ni localStorage.clear(). Fallo de eliminación persistente se comunica; los datos no reaparecen en memoria de esa sesión. Se invalidan peticiones/resultados y se atienden cambios de otras pestañas.

13. **Footer.** Marca, producto, información, legal, datos y © 2026 QVH. Atribuciones visibles TMDB/JustWatch. Fragmento estático compartido en build, con cinco columnas en escritorio y dos en móvil; enlaces legibles y con espacio táctil.

14. **Contacto.** GitHub Issues de JordanoSS/que-veo-hoy, con instrucciones para reportar y aviso de que los issues son públicos y no deben contener datos personales ni secretos.

15. **404.** Página brutalista crema/negro/amarillo, mensaje solicitado, regreso a home y noindex. Archivo raíz compatible con [Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/); no captura endpoints API. Su status HTTP real queda pendiente de runtime.

16. **País.** Selector nativo estilizado, etiquetado y usable por teclado; EC/MX/CO/AR/PE/CL/ES según config. Default Ecuador. Guarda elección explícita, cancela petición anterior y oculta disponibilidad vieja. Requests siguientes llevan la región elegida. Test de respuesta tardía tras cambio de país.

17. **Accesibilidad.** Skip links, navegación móvil accesible, labels/landmarks, foco al seguir enlaces de tipo, estados de selección/carga/error y confirmaciones. Se conserva foco/DOM de Ver otra. El glitch decorativo termina a los cinco segundos, y reduced-motion continúa desactivando movimiento. WCAG AA es objetivo; no se afirma certificación ni auditoría manual completa.

18. **Responsive.** Nuevos layouts fluidos de footer, selector, privacidad y páginas informativas; texto largo con wrap y controles sin anchuras rígidas. Script preparado para 320/375/430/768/1024/1440 y reflow equivalente a 200 %. No se pudieron renderizar esos viewports ni obtener capturas en este entorno. Hero/cuestionario/paleta/tipografía existentes preservados, salvo hacer visible la navegación móvil y limitar la animación.

19. **Performance.** HTML informativo estático, fragmentos sin inyección client-side, carga del motor solo en home, beacon defer, fuentes del sistema y pósteres con dimensiones/lazy loading. Sin bibliotecas nuevas. Build de referencia: CSS 3.10 kB gzip, JS de home 6.67 kB y módulo compartido 1.51 kB gzip. LCP/INP/CLS no medidos; los objetivos no se presentan como resultados.

20. **TMDB.** `append_to_response=keywords,watch/providers`, con normalizador regional compartido. Respeta las formas movie keywords.keywords y TV keywords.results. Usa availability anexada solo si coincide la región. Ausencia de subrecurso activa endpoint providers de respaldo; respuesta válida sin región produce lista vacía. Pre-ranking/exclusión antes de enriquecer, lotes de cuatro y corte con cinco candidatos >=85 dentro del margen superior de cinco puntos. En any, cada tipo tiene su propio cupo para el corte anticipado. Tests sin red para formas y cantidad de requests. [TMDB append](https://developer.themoviedb.org/docs/append-to-response) y endpoints oficiales movie/TV consultados. No se hizo prueba live autenticada.

21. **Requests estimadas.** Escenario de 40 películas válidas, dos páginas discover, sin fallbacks ni consulta de catálogo de plataforma: TMDB 82 → 10 cuando dos lotes bastan (2 + 8 anexados); frontend 81 → 9. Sin corte serían 42 solicitudes TMDB frente a 82. No es una medición real ni una promesa para todas las combinaciones; keywords/catálogos/regiones y subrecursos fallidos varían el coste.

22. **Recomendador.** Se conservan semántica V2, restricciones mood/type/year/anime, quality gates, score, aleatorización superior, recientes/vistos y fallback duración → plataforma. No se garantizan máximos globales del catálogo: se mantiene una búsqueda acotada que prioriza candidatos excelentes. Tests conservados y ampliados; respuestas 200 por sí solas no cuentan como validación semántica.

23. **No me interesa.** Implementado; guarda título, excluye en todos los fallbacks y busca otro con los mismos filtros y sin nuevo scroll programático. Se mantiene tarjeta ante error/vacío. Exclusión dura mientras el ID esté almacenado; después de borrar o superar 1000 entradas puede reaparecer. Límite explicitado en la página de almacenamiento.

24. **PWA.** Evaluada y aplazada: falta un conjunto de iconos de instalación validado. No se añadieron manifest, Service Worker ni cachés offline de API.

25. **npm test.** Exit 0. El runner del entorno resume 7 archivos: tests 7, pass 7, fail 0, skipped 0. Verificación directa de archivos: 73 casos (API 13, public 6, recommendation 14, security 1, storage 7, UI 14, V2 18), todos correctos. Incluye compartir/copiar, fallo de compartir, timeout, cambio de región en vuelo, borrado y exclusión de descartados.

26. **npm run build.** Exit 0. Vite 8.3.1, 24 módulos transformados, siete páginas HTML de la aplicación y bundles generados. Sin nuevas dependencias. HTML generado revisado con parser: un H1/main, IDs no duplicados y recursos/enlaces locales existentes; fragmentos expandidos.

27. **verify.** Exit 0: `Verification completed successfully.` Ejecuta tests/build y comprueba asignaciones de secretos en frontend y existencia de dist. Además pasó el test de comparación con valores privados reales sin imprimirlos. `git diff --check` limpio.

28. **Playwright y runtime.** Intento de navegador rechazado porque la herramienta requiere aprobación y la política es never. No se realizaron validaciones visuales. Vite no pudo escuchar en 5173 (`EPERM`). `cf:dev` compiló Worker y reconoció la regla de headers, pero no inició: `uv_interface_addresses` y ruta de logs no escribible. No hubo HTTP local verificable. No se invirtió tiempo en cambiar el sandbox ni las aprobaciones. Se dejó un script reproducible de QA para ejecutar fuera de estas restricciones.

29. **Limitaciones reales.** QA visual/zoom/teclado real/CWV pendiente; confirmación HTTP de páginas/404/social asset y funcionamiento de Analytics pendiente; append live pendiente; advisories npm inaccesibles por DNS; retención de logs y configuración de dashboard desconocidas. Catálogo y disponibilidad pueden estar incompletos. No hay defensa de cuota distribuida ni exclusión permanente fuera de las listas acotadas. Sin PWA. No hay prueba de indexación ni certificación legal/accesible.

30. **Próximos pasos.** Revisar diff y ejecutar QA local con navegador/Pages permitido; comprobar casos semánticos reales y recepción de Analytics; revisar controles de abuso según tráfico y repetir audit con red. Tras publicación autorizada, revisar canonical/404/social card y enviar sitemap a Search Console. Antes de monetizar, revisar licencia comercial de TMDB y requisitos de consentimiento/CMP aplicables.

## Segunda revisión del diff

Revisados el diff completo y los archivos nuevos, incluyendo documentación, tests, HTML, CSS, API, estado y almacenamiento. No se añadieron archivos ni funcionalidades grandes en esta segunda pasada.

### Problemas encontrados y corregidos

- **Motor, prioridad media:** el pool compartido permitía detener TV después de un solo lote cuando ya había suficientes películas excelentes. El corte ahora cuenta candidatos del tipo actual en `any`; una regresión comprueba que se alcanza un título TV válido posterior a cuatro candidatos descartados.
- **Disponibilidad, prioridad media:** valores regionales o listas malformadas podían convertirse en ausencia aparente de catálogo, y un enlace no textual o un elemento nulo podían producir excepciones. Ahora la estructura inválida devuelve disponibilidad desconocida (`null`) y habilita el respaldo; el endpoint separado devuelve 502 seguro. Un enlace inválido no rompe proveedores válidos.
- **Navegación, prioridad baja:** el handler de tipo interceptaba Ctrl/Cmd/Shift/Alt+clic. Se respeta el comportamiento nativo, y los enlaces del header incluyen la selección de tipo para una nueva pestaña. El clic normal sigue sincronizando estado y foco.
- **Metadatos, prioridad baja:** faltaba description en 404. Añadida; corregidas también la repetición del título y la descripción poco natural de Acerca de.
- **Limpieza:** eliminadas ramas inalcanzables de error/vacío del script nuevo de QA que nunca cambiaba su modo. Esos estados siguen cubiertos en las pruebas DOM y el script histórico correspondiente.

### Validación definitiva

- `npm test`: exit 0; runner 7/7 archivos, sin fallos. Ejecución directa: 73/73 casos.
- `npm run build`: exit 0; Vite 8.3.1, 24 módulos, siete páginas.
- `verify.sh`: exit 0, Verification completed successfully.
- Parser de HTML compilado: etiquetas balanceadas, IDs únicos, title/description y un H1 por página; todos los enlaces y anchors locales resuelven. Imports relativos del frontend existentes.
- Sitemap XML: seis URLs con archivo compilado real. JSON-LD parseado y hash CSP comprobado en dist.
- CSP sin cambios adicionales: permite carga/envío de Analytics y mantiene mínimo privilegio. Confirmar tráfico efectivo requiere navegador/panel.
- Sin secretos reales detectados en frontend, páginas, fuentes o dist. El identificador de Analytics es público. No hay dominios de ejemplo, Vercel, localhost ni marcadores TODO/FIXME en las páginas públicas; localhost queda en herramientas de desarrollo, tests y documentación.
- `npm audit`: no disponible por EAI_AGAIN de registry.npmjs.org; no se insistió. QA visual y HTTP siguen pendientes por las restricciones ya documentadas, sin intentar eludirlas.

### QA manual fuera de Codex

1. Ejecutar `npm run cf:dev` y abrir la URL local; revisar consola y red, especialmente beacon, /api/details y pósteres.
2. Probar película + Romance/Horror/Action, series y Crunchyroll + Anime + Romance; revisar género, años, región y explicación del fallback. Un vacío es válido si nada cumple.
3. Encadenar VER OTRA, YA LA VI y NO ME INTERESA; verificar ausencia de saltos y exclusión de los títulos. Probar COMPARTIR y copia; simular fallo de red durante VER OTRA y comprobar que conserva la tarjeta.
4. Cambiar país durante y después de una búsqueda; no debe quedar disponibilidad anterior. Recargar y verificar persistencia del país.
5. Borrar historial y luego todos los datos; comprobar claves qvh:* y conservación de una clave ajena. Probar también desde /cookies y con dos pestañas abiertas.
6. Recorrer header/footer con teclado; probar enlaces de tipo normales y Ctrl/Cmd+clic. Abrir las cinco páginas informativas y volver al recomendador.
7. Comprobar 320, 375, 430, 768, 1024 y 1440 px, zoom real 200 %, foco y reduced-motion; sin desbordamiento horizontal ni controles cortados.
8. Abrir una ruta inexistente: 404 real con regreso; robots, sitemap y social-card deben responder. En el dominio autorizado para Analytics, comprobar recepción de métricas y que no exista beacon duplicado.

## Inventario de archivos modificados

- `AGENTS.md`
- `README.md`
- `functions/api/details.js`
- `functions/api/providers.js`
- `index.html`
- `public/_headers`
- `public/robots.txt`
- `public/sitemap.xml`
- `server/tmdb.js`
- `src/components/recommender.js`
- `src/components/resultCard.js`
- `src/config/recommendation.js`
- `src/main.js`
- `src/services/recommendation.js`
- `src/styles/layout.css`
- `src/styles/main.css`
- `src/utils/storage.js`
- `style.css`
- `tests/api.test.js`
- `tests/security.test.js`
- `tests/storage.test.js`
- `tests/ui.test.js`
- `tests/v2.test.js`
- `vite.config.js`
