export function errorState(container, state, retry) {
  container.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = state === "exhausted" ? "YA EXPLORASTE ESTAS OPCIONES." : state === "empty" ? "OTRA COMBINACIÓN." : "ALGO FALLÓ.";
  const message = document.createElement("p");
  message.textContent = state === "exhausted"
    ? "Ya te mostramos las mejores opciones de esta búsqueda. Prueba otro estilo, mood, año, duración o plataforma."
    : state === "empty"
    ? "No encontramos una recomendación que cumpla todos esos filtros. Puedes probar otra plataforma o ampliar la duración."
    : "No pudimos obtener recomendaciones. Intenta nuevamente.";
  container.append(heading, message);
  if (state === "error") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-button";
    button.textContent = "INTENTAR NUEVAMENTE";
    button.addEventListener("click", retry);
    container.append(button);
  }
}
