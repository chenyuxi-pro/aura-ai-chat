const MATERIAL_SYMBOLS_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";

export function ensureMaterialSymbolsFont(): void {
  const id = "aura-material-symbols-font";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = MATERIAL_SYMBOLS_URL;
    document.head.appendChild(link);
  }
}
