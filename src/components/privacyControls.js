import { clearHistory, clearAllData } from "../utils/storage.js";

export function initPrivacyControls(onClear = () => {}) {
  const status = document.getElementById("privacyStatus");
  for (const [id, all] of [["clearHistory", false], ["clearData", true]]) {
    document.getElementById(id)?.addEventListener("click", () => {
      const persisted = all ? clearAllData() : clearHistory();
      onClear(all);
      status.textContent = persisted
        ? all ? "Todos tus datos locales de QVH se han borrado. Región inicial: Ecuador." : "Historial borrado: recientes, vistos y títulos que no te interesan. Conservamos tu país."
        : "Datos borrados de esta sesión. El navegador impidió confirmar el borrado persistente: elimina los datos de este sitio desde sus ajustes.";
    });
  }
}
