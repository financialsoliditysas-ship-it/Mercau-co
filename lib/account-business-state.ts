const labels: Record<string, string> = {
  Borrador: "Borrador",
  Pendiente: "Pendiente de revisión",
  "En revisión": "Pendiente de revisión",
  Publicado: "Publicada",
  Verificado: "Publicada",
  Destacado: "Publicada",
  "Requiere cambios": "Requiere cambios",
  Rechazado: "Requiere cambios",
  Suspendido: "Suspendida",
  Suspendida: "Suspendida",
  Archivado: "Archivada",
  Archivada: "Archivada",
};
export function accountBusinessState(status: string) {
  return labels[status] || "Estado en revisión";
}
