import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const titleElement = document.getElementById("publishedTitle");
const metaElement = document.getElementById("publishedMeta");
const publishedFrame = document.getElementById("publishedFrame");
const params = new URLSearchParams(window.location.search);

function setState(title, meta) {
  if (titleElement) titleElement.textContent = title;
  if (metaElement) metaElement.textContent = meta;
}

function injectInHtml(html, marker, chunk) {
  if (!chunk.trim()) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf(marker);
  if (idx >= 0) return `${html.slice(0, idx)}${chunk}\n${html.slice(idx)}`;
  return `${html}\n${chunk}`;
}

function getDocumentBaseHref() {
  if (typeof window === "undefined" || !window.location?.href) return "./";
  return new URL("./", window.location.href).toString();
}

function preparePublishedHtml(html = "") {
  const source = `${html || ""}`.trim();
  if (!source) return "";
  if (/<base\b/i.test(source)) return source;
  return injectInHtml(source, "</head>", `<base href="${getDocumentBaseHref()}">`);
}

async function loadPublishedPage() {
  const pageId = `${params.get("page") || ""}`.trim();
  if (!pageId) {
    setState("Publicacion no encontrada", "Falta el identificador de la pagina en la URL.");
    return;
  }

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg?.apiKey) {
    setState("Firebase no configurado", "Falta firebase-config.js o no tiene credenciales validas.");
    return;
  }

  try {
    const app = initializeApp(cfg);
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "publishedPages", pageId));

    if (!snap.exists()) {
      setState("Publicacion no disponible", "La pagina fue eliminada o todavia no existe.");
      return;
    }

    const data = snap.data() || {};
    const projectName = `${data.projectName || "Pagina publicada"}`.trim() || "Pagina publicada";
    const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString("es-ES") : "Sin fecha";
    const ownerName = `${data.ownerName || ""}`.trim();
    const metaParts = [`Actualizada: ${updatedAt}`];
    if (ownerName) metaParts.push(`Autor: ${ownerName}`);

    document.title = `${projectName} | Laboratorio HTML Kids`;
    setState(projectName, metaParts.join(" | "));
    if (publishedFrame) publishedFrame.srcdoc = preparePublishedHtml(typeof data.html === "string" ? data.html : "");
  } catch (error) {
    console.warn("Publicacion HTML Kids:", error);
    setState("No se pudo cargar la publicacion", "Revisa la configuracion de Firebase y las reglas publicas.");
  }
}

await loadPublishedPage();
