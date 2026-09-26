export function loadingState(container) {
  container.replaceChildren();
  const label = document.createElement("span");
  label.className = "result-label";
  label.textContent = "UN MOMENTO";
  const message = document.createElement("h2");
  message.className = "loading-message";
  message.textContent = "Buscando algo bueno...";
  container.append(label, message);
}
