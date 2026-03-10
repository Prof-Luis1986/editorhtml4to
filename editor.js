import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const LEGACY_STORAGE_KEY = "html_editor_aislado_progress_v1";
const SESSION_DRAFT_PREFIX = "html_editor_aislado_session_draft_v2__";
const ACTIVE_PROJECT_PREFIX = "html_editor_aislado_active_project_v2__";
const USER_PROJECTS_PREFIX = "html_editor_aislado_projects_v2__";
const AUTO_SAVE_DELAY_MS = 1200;

const defaultHtmlCode = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Mi primera pagina</title>
  </head>
  <body>
    <h1>Hola, soy creador web</h1>
    <p>Hoy practico HTML en Mision Code.</p>
  </body>
</html>`;

const defaultCssCode = `body {
  font-family: Arial, sans-serif;
  margin: 24px;
  color: #0f172a;
}

h1 {
  color: #1d4ed8;
}`;

const defaultJsCode = `console.log("Hola desde Mision Code");`;

const suggestions = [
  { text: "Agrega un titulo con <h1>.", test: (code) => /<h1[\s>]/i.test(code) },
  { text: "Agrega al menos un parrafo con <p>.", test: (code) => /<p[\s>]/i.test(code) },
  { text: "Incluye una imagen con <img src='...'>.", test: (code) => /<img[\s>]/i.test(code) },
  { text: "Prueba un enlace con <a href='...'>.", test: (code) => /<a[\s>]/i.test(code) },
  { text: "Dale color con style=\"color:...\" o una etiqueta <style>.", test: (code) => /style\s*=|<style[\s>]/i.test(code) }
];

const htmlSnippets = [
  { label: "html", insert: "html>" },
  { label: "head", insert: "head>$0</head>" },
  { label: "body", insert: "body>$0</body>" },
  { label: "h1", insert: "h1>$0</h1>" },
  { label: "h2", insert: "h2>$0</h2>" },
  { label: "h3", insert: "h3>$0</h3>" },
  { label: "h4", insert: "h4>$0</h4>" },
  { label: "h5", insert: "h5>$0</h5>" },
  { label: "h6", insert: "h6>$0</h6>" },
  { label: "header", insert: "header>$0</header>" },
  { label: "section", insert: "section>$0</section>" },
  { label: "article", insert: "article>$0</article>" },
  { label: "main", insert: "main>$0</main>" },
  { label: "footer", insert: "footer>$0</footer>" },
  { label: "nav", insert: "nav>$0</nav>" },
  { label: "p", insert: "p>$0</p>" },
  { label: "img", insert: "img src=\"\" alt=\"\" />$0" },
  { label: "a", insert: "a href=\"\">$0</a>" },
  { label: "button", insert: "button>$0</button>" },
  { label: "ul", insert: "ul>\n  <li>$0</li>\n</ul>" },
  { label: "div", insert: "div>$0</div>" },
  { label: "class", insert: "class=\"$0\"" },
  { label: "id", insert: "id=\"$0\"" },
  { label: "style", insert: "style=\"$0\"" }
];

const htmlTyposMap = {
  berhavior: "behavior",
  widht: "width",
  heigth: "height",
  bacground: "background",
  aling: "align"
};

const cssSnippets = [
  { label: "body", insert: "body {\n  $0\n}" },
  { label: ".clase", insert: ".clase {\n  $0\n}" },
  { label: "#id", insert: "#id {\n  $0\n}" },
  { label: "color", insert: "color: $0;" },
  { label: "background", insert: "background: $0;" },
  { label: "background-color", insert: "background-color: $0;" },
  { label: "font-size", insert: "font-size: $0px;" },
  { label: "font-family", insert: "font-family: $0;" },
  { label: "margin", insert: "margin: $0px;" },
  { label: "margin-top", insert: "margin-top: $0px;" },
  { label: "padding", insert: "padding: $0px;" },
  { label: "padding-top", insert: "padding-top: $0px;" },
  { label: "display", insert: "display: $0;" },
  { label: "border", insert: "border: $0;" },
  { label: "border-radius", insert: "border-radius: $0px;" },
  { label: "width", insert: "width: $0px;" },
  { label: "height", insert: "height: $0px;" },
  { label: "text-align", insert: "text-align: $0;" },
  { label: "justify-content", insert: "justify-content: $0;" },
  { label: "align-items", insert: "align-items: $0;" }
];

const jsSnippets = [
  { label: "function", insert: "function nombre() {\n  $0\n}" },
  { label: "document.querySelector", insert: "document.querySelector(\"$0\")" },
  { label: "addEventListener", insert: "addEventListener(\"click\", () => {\n  $0\n});" },
  { label: "if", insert: "if ($0) {\n  \n}" },
  { label: "if else", insert: "if ($0) {\n  \n} else {\n  \n}" },
  { label: "for", insert: "for (let i = 0; i < $0; i += 1) {\n  \n}" },
  { label: "for of", insert: "for (const item of $0) {\n  \n}" },
  { label: "while", insert: "while ($0) {\n  \n}" },
  { label: "return", insert: "return $0;" },
  { label: "console.log", insert: "console.log($0);" },
  { label: "const", insert: "const $0 = ;" },
  { label: "let", insert: "let $0 = ;" },
  { label: "array.map", insert: "$0.map((item) => {\n  return item;\n});" }
];

const imageResources = [
  { label: "Bosques 1", alt: "Bosque verde", url: "https://i.ibb.co/dwfcKspS/BOSQUES.jpg" },
  { label: "Bosques 2", alt: "Bosque con montanas", url: "https://i.ibb.co/4nQjGmyX/BOSQUES2.jpg" },
  { label: "Axolote", alt: "Axolote en el agua", url: "https://i.ibb.co/WvQD0fRg/axolote.jpg" },
  { label: "Cebras", alt: "Grupo de cebras", url: "https://i.ibb.co/7NWJnPQ8/cebras.jpg" },
  { label: "Mapache", alt: "Mapache en primer plano", url: "https://i.ibb.co/fYsWp2Wc/mapache.jpg" }
];

const htmlInput = document.getElementById("htmlInput");
const codeHighlight = document.getElementById("codeHighlight");
const lineNumbers = document.getElementById("lineNumbers");
const autocompleteList = document.getElementById("autocompleteList");
const backLink = document.querySelector(".back-link");
const fileTabs = document.getElementById("fileTabs");
const newHtmlFileButton = document.getElementById("newHtmlFileButton");
const newCssFileButton = document.getElementById("newCssFileButton");
const newJsFileButton = document.getElementById("newJsFileButton");
const previewFrame = document.getElementById("previewFrame");
const runButton = document.getElementById("runButton");
const saveButton = document.getElementById("saveButton");
const openHtmlButton = document.getElementById("openHtmlButton");
const exportHtmlButton = document.getElementById("exportHtmlButton");
const resetButton = document.getElementById("resetButton");
const hintButton = document.getElementById("hintButton");
const undoResetButton = document.getElementById("undoResetButton");
const autocompleteButton = document.getElementById("autocompleteButton");
const exitWithoutSaveButton = document.getElementById("exitWithoutSaveButton");
const hintText = document.getElementById("hintText");
const htmlFileInput = document.getElementById("htmlFileInput");
const suggestionList = document.getElementById("suggestionList");
const progressText = document.getElementById("progressText");
const savedAtText = document.getElementById("savedAtText");
const cloudStatusText = document.getElementById("cloudStatusText");
const imageResourceGrid = document.getElementById("imageResourceGrid");
const resourceStatusText = document.getElementById("resourceStatusText");
const imageUrlInput = document.getElementById("imageUrlInput");
const insertImageUrlButton = document.getElementById("insertImageUrlButton");
const signInGoogleButton = document.getElementById("signInGoogleButton");
const signOutButton = document.getElementById("signOutButton");
const authStatusText = document.getElementById("authStatusText");
const projectStatusText = document.getElementById("projectStatusText");
const clearSessionButton = document.getElementById("clearSessionButton");
const newProjectButton = document.getElementById("newProjectButton");
const projectsList = document.getElementById("projectsList");
const projectsEmptyText = document.getElementById("projectsEmptyText");
const params = new URLSearchParams(window.location.search);

let db = null;
let auth = null;
let firebaseReady = false;
let cloudWriteLocked = false;
let currentUser = null;
let autoSaveTimer = null;
let skipSaveOnUnload = false;
let lastResetSnapshot = null;
let committedSnapshot = null;
let editorFiles = [];
let activeFileId = "";
let activeProjectId = "";
let activeProjectName = "";
let autocompleteState = { items: [], selectedIndex: 0, start: 0, end: 0, visible: false };

const sessionPlayerId = slugify(params.get("player") || "", 36);
const sessionDraftKey = `${SESSION_DRAFT_PREFIX}${sessionPlayerId || "anon"}`;
const returnMode = (params.get("returnMode") || "standalone").toLowerCase();
const lockReturn = params.get("lockReturn") !== "0";

function readSessionValue(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignorar errores de sessionStorage.
  }
}

function removeSessionValue(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignorar errores de sessionStorage.
  }
}

function buildReturnUrl() {
  if (returnMode === "standalone") return "./index.html";
  const rawPlayer = normalizeText(params.get("player") || "", 36) || "EXPLORADOR";
  const safeMode = ["primero", "segundo", "foe", "tercero"].includes(returnMode) ? returnMode : "tercero";
  return `../index.html?mode=${encodeURIComponent(safeMode)}&player=${encodeURIComponent(rawPlayer)}`;
}

function applyReturnAccessPolicy() {
  if (!lockReturn) return;
  if (backLink) backLink.hidden = true;
  if (exitWithoutSaveButton) exitWithoutSaveButton.hidden = true;
}

function normalizeText(value, max = 40) {
  return `${value || ""}`.trim().replace(/\s+/g, " ").slice(0, max);
}

function sanitizeFileName(value) {
  return `${value || ""}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_\.]/g, "")
    .slice(0, 40);
}

function slugify(value, max = 40) {
  return `${value || ""}`
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, max);
}

function escapeHtml(value) {
  return `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setAuthStatus(text, kind = "") {
  if (!authStatusText) return;
  authStatusText.textContent = text;
  authStatusText.classList.remove("ok", "warn");
  if (kind) authStatusText.classList.add(kind);
}

function setProjectStatus(text, kind = "") {
  if (!projectStatusText) return;
  projectStatusText.textContent = text;
  projectStatusText.classList.remove("ok", "warn");
  if (kind) projectStatusText.classList.add(kind);
}

function setCloudStatus(text) {
  if (cloudStatusText) cloudStatusText.textContent = `Nube: ${text}`;
}

function formatSavedAt(isoDate) {
  if (!isoDate) return "Sin guardar todavia.";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Sin guardar todavia.";
  return `Guardado: ${date.toLocaleString("es-ES")}`;
}

function getFileTypeByName(name = "") {
  const lower = name.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".js")) return "js";
  return "html";
}

function normalizeFileName(name, type) {
  const fallback = type === "css" ? "styles.css" : type === "js" ? "app.js" : "index.html";
  const raw = sanitizeFileName(name || fallback);
  const base = raw || fallback;
  if (base.endsWith(".html") || base.endsWith(".htm") || base.endsWith(".css") || base.endsWith(".js")) return base;
  if (type === "css") return `${base}.css`;
  if (type === "js") return `${base}.js`;
  return `${base}.html`;
}

function makeFileId() {
  return `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function createFileRecord(type = "html", name = "", code = "") {
  const safeType = ["html", "css", "js"].includes(type) ? type : "html";
  const fileName = normalizeFileName(name, safeType);
  const defaultCode = safeType === "css" ? defaultCssCode : safeType === "js" ? defaultJsCode : defaultHtmlCode;
  return {
    id: makeFileId(),
    type: safeType,
    name: fileName,
    code: typeof code === "string" ? code : defaultCode
  };
}

function cloneFiles(files = []) {
  return files.map((file) => ({
    id: `${file.id || makeFileId()}`,
    type: ["html", "css", "js"].includes(file.type) ? file.type : getFileTypeByName(file.name || "index.html"),
    name: normalizeFileName(file.name || "index.html", file.type || "html"),
    code: typeof file.code === "string" ? file.code : ""
  }));
}

function getDefaultFiles() {
  return [createFileRecord("html", "index.html", defaultHtmlCode)];
}

function ensureFiles(files = []) {
  const clean = cloneFiles(files).filter((file) => Boolean(file.name));
  if (!clean.length) return getDefaultFiles();
  const seen = new Set();
  for (const file of clean) {
    let candidate = file.name;
    let counter = 2;
    while (seen.has(candidate)) {
      const type = getFileTypeByName(file.name);
      const originalBase = (file.name || "archivo").replace(/\.(html?|css|js)$/i, "");
      candidate = normalizeFileName(`${originalBase}-${counter}`, type);
      counter += 1;
    }
    file.name = candidate;
    seen.add(candidate);
  }
  return clean;
}

function getMainHtmlFromFiles(files = []) {
  const htmlFile = files.find((file) => file.type === "html");
  return htmlFile?.code || defaultHtmlCode;
}

function getActiveFile() {
  const file = editorFiles.find((item) => item.id === activeFileId);
  if (file) return file;
  return editorFiles[0] || null;
}

function updateActiveFileFromInput() {
  const file = getActiveFile();
  if (!file || !htmlInput) return;
  file.code = htmlInput.value;
}

function syncInputFromActiveFile() {
  if (!htmlInput) return;
  const file = getActiveFile();
  htmlInput.value = file?.code || "";
}

function setActiveFile(fileId) {
  updateActiveFileFromInput();
  activeFileId = fileId;
  if (!getActiveFile() && editorFiles[0]) activeFileId = editorFiles[0].id;
  syncInputFromActiveFile();
  renderFileTabs();
  renderCodeHighlight();
  refreshSuggestionProgress();
  renderPreview();
}

function renderFileTabs() {
  if (!fileTabs) return;
  fileTabs.innerHTML = "";
  for (const file of editorFiles) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `file-tab${file.id === activeFileId ? " active" : ""}`;
    button.textContent = file.name;
    button.title = `Abrir ${file.name}`;
    button.dataset.fileId = file.id;
    button.addEventListener("click", () => {
      setActiveFile(file.id);
    });
    fileTabs.appendChild(button);
  }
}

function insertIntoEditor(insertText, start, end) {
  if (!htmlInput) return;
  const cursorTag = "$0";
  const idx = insertText.indexOf(cursorTag);
  const finalText = insertText.replace(cursorTag, "");
  htmlInput.setRangeText(finalText, start, end, "end");
  const newPos = idx >= 0 ? start + idx : start + finalText.length;
  htmlInput.setSelectionRange(newPos, newPos);
}

function setResourceStatus(message) {
  if (!resourceStatusText) return;
  resourceStatusText.textContent = message;
}

function ensureHtmlFileActive() {
  const currentFile = getActiveFile();
  if (currentFile?.type === "html") return true;
  const htmlFile = editorFiles.find((file) => file.type === "html");
  if (!htmlFile) return false;
  setActiveFile(htmlFile.id);
  return true;
}

function insertImageResource(resource) {
  if (!htmlInput || !resource || typeof resource.url !== "string") return;
  if (!ensureHtmlFileActive()) {
    setResourceStatus("Crea un archivo .html para insertar imagenes.");
    return;
  }

  htmlInput.focus();
  const start = htmlInput.selectionStart ?? htmlInput.value.length;
  const end = htmlInput.selectionEnd ?? start;
  const before = htmlInput.value.slice(Math.max(0, start - 1), start);
  const prefix = before && before !== "\n" ? "\n" : "";
  const snippet = `${prefix}<img src="${resource.url}" alt="${resource.alt}" />$0`;
  insertIntoEditor(snippet, start, end);
  updateActiveFileFromInput();
  renderCodeHighlight();
  renderPreview();
  refreshSuggestionProgress();
  scheduleAutoSaveLocal();
  setResourceStatus(`Imagen agregada: ${resource.label}`);
}

function getImageAltFromLabel(label = "") {
  const clean = normalizeText(label, 60);
  return clean || "Imagen";
}

function isLikelyDirectImageUrl(value = "") {
  return /(\.png|\.jpe?g|\.gif|\.webp|\.svg|\.bmp|\.avif)(\?.*)?$/i.test(value);
}

function normalizeImageUrl(value = "") {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  if (raw.startsWith("data:image/")) return raw;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function insertImageTagFromUrl(rawUrl, label = "Imagen externa") {
  const normalizedUrl = normalizeImageUrl(rawUrl);
  if (!normalizedUrl) {
    setResourceStatus("La URL no es valida. Usa un enlace directo que empiece con http o https.");
    return false;
  }
  if (!normalizedUrl.startsWith("data:image/") && !isLikelyDirectImageUrl(normalizedUrl)) {
    setResourceStatus("Ese enlace parece ser una pagina web, no la imagen directa. Abre la imagen y copia la URL del archivo.");
    return false;
  }

  insertImageResource({
    label,
    alt: getImageAltFromLabel(label),
    url: normalizedUrl
  });
  return true;
}

function renderImageResources() {
  if (!imageResourceGrid) return;
  imageResourceGrid.innerHTML = "";

  for (const resource of imageResources) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-resource-card";
    button.setAttribute("aria-label", `Insertar imagen ${resource.label}`);

    const thumb = document.createElement("img");
    thumb.className = "image-resource-thumb";
    thumb.src = resource.url;
    thumb.alt = resource.alt;
    thumb.loading = "lazy";

    const label = document.createElement("span");
    label.className = "image-resource-label";
    label.textContent = resource.label;

    button.append(thumb, label);
    button.addEventListener("click", () => {
      insertImageResource(resource);
    });
    imageResourceGrid.appendChild(button);
  }
}

function injectInHtml(html, marker, chunk) {
  if (!chunk.trim()) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf(marker);
  if (idx >= 0) return `${html.slice(0, idx)}${chunk}\n${html.slice(idx)}`;
  return `${html}\n${chunk}`;
}

function buildPreviewDocument() {
  const htmlFile = editorFiles.find((file) => file.type === "html");
  const cssText = editorFiles.filter((file) => file.type === "css").map((file) => file.code).join("\n\n");
  const jsText = editorFiles.filter((file) => file.type === "js").map((file) => file.code).join("\n\n");

  let docText = htmlFile?.code || defaultHtmlCode;
  if (cssText.trim()) {
    docText = injectInHtml(docText, "</head>", `<style>\n${cssText}\n</style>`);
  }
  if (jsText.trim()) {
    docText = injectInHtml(docText, "</body>", `<script>\n${jsText}\n<\/script>`);
  }
  return docText;
}

function renderPreview() {
  updateActiveFileFromInput();
  if (!previewFrame) return;
  previewFrame.srcdoc = buildPreviewDocument();
}

function getSuggestionMatches(code) {
  return suggestions.map((item) => item.test(code));
}

function renderSuggestions(matches) {
  if (!suggestionList || !progressText) return;
  suggestionList.innerHTML = "";
  let completed = 0;

  suggestions.forEach((item, index) => {
    const ok = Boolean(matches[index]);
    if (ok) completed += 1;
    const li = document.createElement("li");
    li.textContent = ok ? `Listo: ${item.text}` : `Sugerencia: ${item.text}`;
    if (ok) li.classList.add("ok");
    suggestionList.appendChild(li);
  });

  progressText.textContent = `Progreso: ${completed}/${suggestions.length}`;
  progressText.classList.toggle("ok", completed === suggestions.length);
}

function refreshSuggestionProgress() {
  renderSuggestions(getSuggestionMatches(getMainHtmlFromFiles(editorFiles)));
}

function wrapToken(tokenClass, text) {
  return `<span class="${tokenClass}">${text}</span>`;
}

function highlightHtml(code) {
  let out = escapeHtml(code);
  out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (m) => wrapToken("token-comment", m));
  out = out.replace(/(&lt;!DOCTYPE[^&]*&gt;)/gi, (m) => wrapToken("token-keyword", m));
  out = out.replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?)(\/??&gt;)/g, (_m, open, tag, attrs, close) => {
    const attrsHighlighted = attrs.replace(
      /(\s+)([a-zA-Z:-]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'=<>`]+)?/g,
      (_a, ws, attr, eq = "", value = "") => {
        if (!eq) return `${ws}${wrapToken("token-attr", attr)}`;
        if (!value) return `${ws}${wrapToken("token-attr", attr)}${eq}`;
        return `${ws}${wrapToken("token-attr", attr)}${eq}${wrapToken("token-string", value)}`;
      }
    );
    return `${wrapToken("token-bracket", open)}${wrapToken("token-tag", tag)}${attrsHighlighted}${wrapToken("token-bracket", close)}`;
  });
  return out;
}

function highlightCss(code) {
  let out = escapeHtml(code);
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => wrapToken("token-comment", m));
  out = out.replace(/("[^"]*"|'[^']*')/g, (m) => wrapToken("token-string", m));
  out = out.replace(/\b([a-z-]+)(?=\s*:)/g, (m) => wrapToken("token-attr", m));
  out = out.replace(/\b(@media|@keyframes|from|to)\b/g, (m) => wrapToken("token-keyword", m));
  out = out.replace(/[{}():;]/g, (m) => wrapToken("token-op", m));
  out = out.replace(/\b(\d+)(px|rem|em|%)?/g, (_m, num, unit = "") => `${wrapToken("token-number", num)}${unit}`);
  return out;
}

function highlightJs(code) {
  let out = escapeHtml(code);
  out = out.replace(/\/\/.*$/gm, (m) => wrapToken("token-comment", m));
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => wrapToken("token-comment", m));
  out = out.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (m) => wrapToken("token-string", m));
  out = out.replace(/\b(function|return|const|let|if|else|for|while|true|false|null|new)\b/g, (m) => wrapToken("token-keyword", m));
  out = out.replace(/\b([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*\()/g, (m) => wrapToken("token-fn", m));
  out = out.replace(/[{}()[\].,:;]/g, (m) => wrapToken("token-op", m));
  out = out.replace(/\b(\d+)\b/g, (m) => wrapToken("token-number", m));
  return out;
}

function renderLineNumbers() {
  if (!lineNumbers || !htmlInput) return;
  const lines = (htmlInput.value || "").split("\n").length;
  const caret = htmlInput.selectionStart || 0;
  const activeLine = (htmlInput.value.slice(0, caret).match(/\n/g)?.length || 0) + 1;
  let html = "";
  for (let i = 1; i <= lines; i += 1) {
    html += `<div class="line-number${i === activeLine ? " active" : ""}">${i}</div>`;
  }
  lineNumbers.innerHTML = html;
  lineNumbers.scrollTop = htmlInput.scrollTop;
}

function renderCodeHighlight() {
  if (!codeHighlight || !htmlInput) return;
  const file = getActiveFile();
  const code = htmlInput.value || "";
  if (!file || file.type === "html") {
    codeHighlight.innerHTML = `${highlightHtml(code)}\n`;
  } else if (file.type === "css") {
    codeHighlight.innerHTML = `${highlightCss(code)}\n`;
  } else {
    codeHighlight.innerHTML = `${highlightJs(code)}\n`;
  }
  codeHighlight.scrollTop = htmlInput.scrollTop;
  codeHighlight.scrollLeft = htmlInput.scrollLeft;
  renderLineNumbers();
}

function getWordPrefix(text, pos) {
  const before = text.slice(0, pos);
  const match = before.match(/[a-zA-Z0-9_:-]+$/);
  return match ? match[0] : "";
}

function getAutocompleteContext() {
  const file = getActiveFile();
  if (!file || !htmlInput) return null;
  const text = htmlInput.value;
  const start = htmlInput.selectionStart;
  const end = htmlInput.selectionEnd;
  if (start !== end) return null;

  if (file.type === "html") {
    const before = text.slice(0, start);
    const tagMatch = before.match(/<\/?([a-zA-Z0-9-]*)$/);
    if (tagMatch) {
      const prefix = (tagMatch[1] || "").toLowerCase();
      const items = htmlSnippets.filter((item) => item.label.startsWith(prefix)).slice(0, 8);
      if (items.length) return { items, start: start - prefix.length, end: start };
    }
    if (before.endsWith("<")) {
      return { items: htmlSnippets.slice(0, 8), start, end: start };
    }
    const attrMatch = before.match(/<[^>]*\s([a-zA-Z:-]*)$/);
    if (attrMatch) {
      const prefix = (attrMatch[1] || "").toLowerCase();
      const tagContext = before.match(/<([a-zA-Z0-9-]+)[^>]*\s([a-zA-Z:-]*)$/);
      const currentTag = (tagContext?.[1] || "").toLowerCase();
      const genericAttrs = ["class", "id", "style", "title"];
      const attrsByTag = {
        img: ["src", "alt", "width", "height", "loading"],
        a: ["href", "target", "rel", "title"],
        input: ["type", "name", "value", "placeholder", "required"],
        button: ["type", "disabled"],
        marquee: ["behavior", "direction", "scrollamount"]
      };
      const attrs = [...genericAttrs, ...(attrsByTag[currentTag] || ["src", "href", "alt", "width", "height"])];
      const items = attrs
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ label: name, insert: `${name}=\"$0\"` }))
        .slice(0, 8);
      if (items.length) return { items, start: start - prefix.length, end: start };
    }
    const prefix = getWordPrefix(text, start).toLowerCase();
    if (!prefix) return null;
    const items = htmlSnippets.filter((item) => item.label.startsWith(prefix)).slice(0, 8);
    return items.length ? { items, start: start - prefix.length, end: start } : null;
  }

  if (file.type === "css") {
    const before = text.slice(0, start);
    const openIdx = before.lastIndexOf("{");
    const closeIdx = before.lastIndexOf("}");
    const insideRule = openIdx > closeIdx;
    const prefix = getWordPrefix(text, start).toLowerCase();
    if (!prefix) {
      return insideRule
        ? { items: cssSnippets.slice(0, 12), start, end: start }
        : { items: cssSnippets.filter((item) => item.insert.includes("{")).slice(0, 8), start, end: start };
    }
    const items = cssSnippets.filter((item) => item.label.startsWith(prefix)).slice(0, 14);
    return items.length ? { items, start: start - prefix.length, end: start } : null;
  }

  const prefix = getWordPrefix(text, start).toLowerCase();
  if (!prefix) return { items: jsSnippets.slice(0, 10), start, end: start };
  const items = jsSnippets.filter((item) => item.label.startsWith(prefix)).slice(0, 12);
  return items.length ? { items, start: start - prefix.length, end: start } : null;
}

function closeAutocomplete() {
  autocompleteState = { items: [], selectedIndex: 0, start: 0, end: 0, visible: false };
  if (autocompleteList) {
    autocompleteList.hidden = true;
    autocompleteList.innerHTML = "";
  }
}

function positionAutocompleteList() {
  if (!autocompleteList || !htmlInput || !autocompleteState.visible) return;
  const text = htmlInput.value || "";
  const caret = htmlInput.selectionStart || 0;
  const before = text.slice(0, caret);
  const lines = before.split("\n");
  const line = lines.length - 1;
  const col = lines[lines.length - 1]?.length || 0;
  const style = window.getComputedStyle(htmlInput);
  const lineHeight = parseFloat(style.lineHeight) || 23;
  const charWidth = getCharWidthPx();
  const stackRect = htmlInput.getBoundingClientRect();
  const listWidth = Math.min(420, Math.max(260, Math.floor(stackRect.width * 0.62)));
  const rawLeft = 12 + col * charWidth - htmlInput.scrollLeft;
  const rawTop = 12 + (line + 1) * lineHeight - htmlInput.scrollTop + 6;
  const maxLeft = Math.max(16, stackRect.width - listWidth - 12);
  const left = Math.max(12, Math.min(rawLeft, maxLeft));
  const top = Math.max(12, Math.min(rawTop, stackRect.height - 200));
  autocompleteList.style.left = `${left}px`;
  autocompleteList.style.top = `${top}px`;
  autocompleteList.style.width = `${listWidth}px`;
}

function renderAutocompleteList() {
  if (!autocompleteList) return;
  if (!autocompleteState.visible || !autocompleteState.items.length) {
    autocompleteList.hidden = true;
    autocompleteList.innerHTML = "";
    return;
  }
  autocompleteList.hidden = false;
  autocompleteList.innerHTML = "";
  positionAutocompleteList();
  autocompleteState.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.label}  ->  ${item.insert.replace("$0", "")}`;
    if (index === autocompleteState.selectedIndex) li.classList.add("active");
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      acceptAutocomplete(index);
    });
    autocompleteList.appendChild(li);
  });
}

function getCharWidthPx() {
  if (!htmlInput) return 9;
  const style = window.getComputedStyle(htmlInput);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 9;
  ctx.font = `${style.fontSize} ${style.fontFamily}`;
  return Math.max(8, Math.round(ctx.measureText("M").width));
}

function openAutocomplete() {
  const context = getAutocompleteContext();
  if (!context || !context.items.length) {
    closeAutocomplete();
    return;
  }
  autocompleteState = {
    items: context.items,
    selectedIndex: 0,
    start: context.start,
    end: context.end,
    visible: true
  };
  renderAutocompleteList();
}

function acceptAutocomplete(index = autocompleteState.selectedIndex) {
  if (!autocompleteState.visible || !autocompleteState.items.length || !htmlInput) return;
  const item = autocompleteState.items[index];
  if (!item) return;
  insertIntoEditor(item.insert, autocompleteState.start, autocompleteState.end);
  updateActiveFileFromInput();
  renderCodeHighlight();
  refreshSuggestionProgress();
  renderPreview();
  scheduleAutoSaveLocal();
  closeAutocomplete();
}

function maybeAutoCloseHtmlTag(event) {
  const file = getActiveFile();
  if (!file || file.type !== "html" || event.key !== ">" || !htmlInput) return false;
  const start = htmlInput.selectionStart;
  const end = htmlInput.selectionEnd;
  const before = htmlInput.value.slice(0, start);
  const match = before.match(/<([a-z][a-z0-9-]*)[^>]*$/i);
  const selfClosing = /<(img|br|hr|meta|link|input)\b/i.test(before.slice(match ? match.index : before.length));
  if (!match || selfClosing || start !== end) return false;

  event.preventDefault();
  const tag = match[1];
  htmlInput.setRangeText(`></${tag}>`, start, end, "end");
  const caret = start + 1;
  htmlInput.setSelectionRange(caret, caret);
  return true;
}

function maybeAutoCloseCssBlock(event) {
  const file = getActiveFile();
  if (!file || file.type !== "css" || event.key !== "{" || !htmlInput) return false;
  const start = htmlInput.selectionStart;
  const end = htmlInput.selectionEnd;
  if (start !== end) return false;
  event.preventDefault();
  htmlInput.setRangeText("{\n  \n}", start, end, "end");
  const caret = start + 4;
  htmlInput.setSelectionRange(caret, caret);
  return true;
}

function maybeAutoCloseJsBlock(event) {
  const file = getActiveFile();
  if (!file || file.type !== "js" || event.key !== "{" || !htmlInput) return false;
  const start = htmlInput.selectionStart;
  const end = htmlInput.selectionEnd;
  if (start !== end) return false;
  event.preventDefault();
  htmlInput.setRangeText("{\n  \n}", start, end, "end");
  const caret = start + 4;
  htmlInput.setSelectionRange(caret, caret);
  return true;
}

function maybeAutoPair(event) {
  if (!htmlInput) return false;
  const pairs = { "(": ")", "[": "]", "\"": "\"", "'": "'" };
  const key = event.key;
  const closeChars = new Set([")", "]", "\"", "'"]);
  const start = htmlInput.selectionStart;
  const end = htmlInput.selectionEnd;
  const text = htmlInput.value || "";
  if (closeChars.has(key) && start === end && text[start] === key) {
    event.preventDefault();
    htmlInput.setSelectionRange(start + 1, start + 1);
    return true;
  }
  const close = pairs[key];
  if (!close || start !== end) return false;
  const prev = text[start - 1] || "";
  const next = text[start] || "";
  if ((key === "\"" || key === "'") && /[A-Za-z0-9_]/.test(prev)) return false;
  if ((key === "\"" || key === "'") && /[A-Za-z0-9_]/.test(next)) return false;
  event.preventDefault();
  htmlInput.setRangeText(`${key}${close}`, start, end, "end");
  htmlInput.setSelectionRange(start + 1, start + 1);
  return true;
}

function autoFixHtmlTypos() {
  const file = getActiveFile();
  if (!file || file.type !== "html" || !htmlInput) return false;
  const value = htmlInput.value;
  const caret = htmlInput.selectionStart || 0;
  const typoRegex = /\b(berhavior|widht|heigth|bacground|aling)\b/gi;
  let changed = false;
  const nextValue = value.replace(typoRegex, (match) => {
    const replacement = htmlTyposMap[match.toLowerCase()];
    if (!replacement) return match;
    changed = true;
    return match[0] === match[0].toUpperCase()
      ? `${replacement[0].toUpperCase()}${replacement.slice(1)}`
      : replacement;
  });
  if (!changed || nextValue === value) return false;
  const beforeText = value.slice(0, caret);
  const beforeFixed = beforeText.replace(typoRegex, (match) => {
    const replacement = htmlTyposMap[match.toLowerCase()] || match;
    return match[0] === match[0].toUpperCase()
      ? `${replacement[0].toUpperCase()}${replacement.slice(1)}`
      : replacement;
  });
  htmlInput.value = nextValue;
  const nextCaret = beforeFixed.length;
  htmlInput.setSelectionRange(nextCaret, nextCaret);
  updateActiveFileFromInput();
  renderCodeHighlight();
  renderPreview();
  refreshSuggestionProgress();
  scheduleAutoSaveLocal();
  return true;
}

function getSuggestedFileName() {
  const file = getActiveFile();
  const projectPart = sanitizeFileName(activeProjectName);
  if (file?.name) return file.name;
  if (projectPart) return `${projectPart}.html`;
  return "mi-archivo.html";
}

function downloadFileFallback(code, fileName) {
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportActiveFile() {
  if (!exportHtmlButton) return;
  updateActiveFileFromInput();
  const file = getActiveFile();
  if (!file) return;
  const code = file.code || "";
  const fileName = getSuggestedFileName();
  saveLocal(buildPayloadFromUI());

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "Archivo de codigo", accept: { "text/plain": [`.${fileName.split(".").pop() || "txt"}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(code);
      await writable.close();
    } else {
      downloadFileFallback(code, fileName);
    }

    exportHtmlButton.textContent = "Archivo guardado";
    setTimeout(() => {
      if (exportHtmlButton) exportHtmlButton.textContent = "Guardar archivo";
    }, 1200);
  } catch (error) {
    if (error?.name === "AbortError") return;
    downloadFileFallback(code, fileName);
  }
}

function applyOpenedFile(name, code) {
  const safeName = normalizeFileName(name, getFileTypeByName(name));
  const type = getFileTypeByName(safeName);
  const existing = editorFiles.find((file) => file.name === safeName);
  if (existing) {
    existing.code = code;
    activeFileId = existing.id;
  } else {
    const file = createFileRecord(type, safeName, code);
    editorFiles.push(file);
    activeFileId = file.id;
  }
  syncInputFromActiveFile();
  renderFileTabs();
  renderCodeHighlight();
  renderPreview();
  refreshSuggestionProgress();
  if (savedAtText) savedAtText.textContent = "Archivo cargado. Pulsa Guardar progreso para actualizar fecha.";
}

async function openFileFromPicker() {
  if (!window.showOpenFilePicker) return false;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: "Archivo de codigo", accept: { "text/plain": [".html", ".htm", ".css", ".js"] } }]
  });
  if (!handle) return true;
  const file = await handle.getFile();
  const text = await file.text();
  applyOpenedFile(file.name || "archivo.txt", text);
  return true;
}

async function openCodeFile() {
  if (!openHtmlButton) return;
  try {
    const opened = await openFileFromPicker();
    if (!opened && htmlFileInput) htmlFileInput.click();
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (htmlFileInput) htmlFileInput.click();
  }
}

function getErrorCode(error) {
  if (!error || typeof error !== "object") return "";
  return typeof error.code === "string" ? error.code : "";
}

function getIsoTime(isoDate) {
  const ms = Date.parse(isoDate || "");
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizePayload(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const files = Array.isArray(payload.files)
    ? ensureFiles(payload.files)
    : ensureFiles([createFileRecord("html", "index.html", typeof payload.code === "string" ? payload.code : defaultHtmlCode)]);
  const existingActive = files.find((file) => file.id === payload.activeFileId);
  const activeFile = existingActive || files[0];
  const projectId = slugify(payload.projectId || "", 40) || createProjectId();
  const lastSavedAt = typeof payload.lastSavedAt === "string" ? payload.lastSavedAt : "";
  return {
    files,
    activeFileId: activeFile ? activeFile.id : "",
    code: getMainHtmlFromFiles(files),
    lastSavedAt,
    lastSavedAtMs: Number.isFinite(payload.lastSavedAtMs) ? payload.lastSavedAtMs : getIsoTime(lastSavedAt),
    projectId,
    projectName: normalizeText(payload.projectName || "", 40) || "Proyecto",
    ownerUid: normalizeText(payload.ownerUid || "", 128),
    ownerEmail: normalizeText(payload.ownerEmail || "", 120),
    ownerName: normalizeText(payload.ownerName || "", 120)
  };
}

function clonePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  return normalizePayload(payload);
}

function createProjectId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBlankProjectPayload(projectName = "") {
  const nowIso = new Date().toISOString();
  const safeName = normalizeText(projectName || "Proyecto nuevo", 40) || "Proyecto nuevo";
  return normalizePayload({
    files: getDefaultFiles(),
    activeFileId: "",
    code: defaultHtmlCode,
    lastSavedAt: nowIso,
    lastSavedAtMs: Date.now(),
    projectId: createProjectId(),
    projectName: safeName,
    ownerUid: currentUser?.uid || "",
    ownerEmail: currentUser?.email || "",
    ownerName: currentUser?.displayName || ""
  });
}

function getSessionDraft() {
  const raw = readSessionValue(sessionDraftKey);
  if (!raw) return null;
  try {
    return normalizePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function getUserProjectsStorageKey(uid) {
  return `${USER_PROJECTS_PREFIX}${uid || "anon"}`;
}

function getActiveProjectStorageKey(uid) {
  return `${ACTIVE_PROJECT_PREFIX}${sessionPlayerId || "anon"}__${uid || "anon"}`;
}

function getProjectsStore(uid) {
  if (!uid) return { projects: {} };
  const raw = localStorage.getItem(getUserProjectsStorageKey(uid));
  if (!raw) return { projects: {} };
  try {
    const parsed = JSON.parse(raw);
    return { projects: parsed?.projects && typeof parsed.projects === "object" ? parsed.projects : {} };
  } catch {
    return { projects: {} };
  }
}

function saveProjectsStore(uid, store) {
  if (!uid) return;
  localStorage.setItem(getUserProjectsStorageKey(uid), JSON.stringify(store));
}

function getSavedProjectsForCurrentUser() {
  if (!currentUser?.uid) return [];
  const store = getProjectsStore(currentUser.uid);
  return Object.entries(store.projects || {})
    .map(([key, payload]) => ({
      key,
      payload: normalizePayload(payload)
    }))
    .sort((a, b) => (b.payload.lastSavedAtMs || 0) - (a.payload.lastSavedAtMs || 0));
}

function updateCurrentProjectStatus() {
  if (!currentUser) {
    setProjectStatus("Proyecto activo: ninguno.");
    return;
  }
  const projectLabel = activeProjectName ? `${activeProjectName}` : "ninguno";
  setProjectStatus(`Proyecto activo: ${projectLabel}.`, activeProjectId ? "ok" : "");
}

function applyPayloadToUI(payload) {
  const normalized = normalizePayload(payload);
  editorFiles = cloneFiles(normalized.files);
  activeFileId = normalized.activeFileId;
  activeProjectId = normalized.projectId;
  activeProjectName = normalizeText(normalized.projectName || "Proyecto", 40) || "Proyecto";
  if (!editorFiles.find((file) => file.id === activeFileId) && editorFiles[0]) {
    activeFileId = editorFiles[0].id;
  }
  syncInputFromActiveFile();
  renderFileTabs();
  renderCodeHighlight();
  renderPreview();
  refreshSuggestionProgress();
  updateWorkspaceLockState();
  updateCurrentProjectStatus();
  if (savedAtText) savedAtText.textContent = formatSavedAt(normalized.lastSavedAt);
  renderProjectsList();
}

function buildPayloadFromUI() {
  updateActiveFileFromInput();
  const files = cloneFiles(editorFiles);
  const now = new Date();
  return normalizePayload({
    files,
    activeFileId,
    code: getMainHtmlFromFiles(files),
    lastSavedAt: now.toISOString(),
    lastSavedAtMs: now.getTime(),
    projectId: activeProjectId || createProjectId(),
    projectName: normalizeText(activeProjectName || "Proyecto", 40) || "Proyecto",
    ownerUid: currentUser?.uid || "",
    ownerEmail: currentUser?.email || "",
    ownerName: currentUser?.displayName || ""
  });
}

function saveLocal(payload) {
  const normalized = normalizePayload(payload);
  writeSessionValue(sessionDraftKey, JSON.stringify(normalized));
  if (!currentUser?.uid || !normalized.projectId) {
    if (savedAtText) savedAtText.textContent = formatSavedAt(normalized.lastSavedAt);
    return;
  }

  const store = getProjectsStore(currentUser.uid);
  store.projects[normalized.projectId] = normalized;
  saveProjectsStore(currentUser.uid, store);
  activeProjectId = normalized.projectId;
  activeProjectName = normalized.projectName || activeProjectName || "Proyecto";
  writeSessionValue(getActiveProjectStorageKey(currentUser.uid), normalized.projectId);
  if (savedAtText) savedAtText.textContent = formatSavedAt(normalized.lastSavedAt);
  renderProjectsList();
}

function saveDraftLocalOnly() {
  saveLocal(buildPayloadFromUI());
}

function restoreFromSnapshot(snapshot) {
  if (!snapshot) return;
  applyPayloadToUI(snapshot);
  saveLocal(buildPayloadFromUI());
}

function getAutocompleteBaseByType(type) {
  if (type === "css") return defaultCssCode;
  if (type === "js") return defaultJsCode;
  return defaultHtmlCode;
}

function scheduleAutoSaveLocal() {
  if (autoSaveTimer) {
    window.clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = window.setTimeout(() => {
    saveDraftLocalOnly();
    autoSaveTimer = null;
  }, AUTO_SAVE_DELAY_MS);
}

function getProjectsCollection(uid) {
  return collection(db, "users", uid, "projects");
}

function getProjectDoc(uid, projectId) {
  return doc(db, "users", uid, "projects", projectId);
}

async function syncProjectsFromCloud() {
  if (!firebaseReady || !db || !currentUser?.uid || cloudWriteLocked) return;
  try {
    const snap = await getDocs(query(getProjectsCollection(currentUser.uid), orderBy("lastSavedAtMs", "desc")));
    const store = getProjectsStore(currentUser.uid);
    snap.forEach((projectDoc) => {
      const remotePayload = normalizePayload(projectDoc.data());
      const localPayload = store.projects[projectDoc.id] ? normalizePayload(store.projects[projectDoc.id]) : null;
      if (!localPayload || (remotePayload.lastSavedAtMs || 0) >= (localPayload.lastSavedAtMs || 0)) {
        store.projects[projectDoc.id] = {
          ...remotePayload,
          projectId: projectDoc.id
        };
      }
    });
    saveProjectsStore(currentUser.uid, store);
    setCloudStatus("sincronizada");
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "permission-denied") {
      cloudWriteLocked = true;
      setCloudStatus("sin permisos");
      return;
    }
    setCloudStatus("no se pudo leer");
    console.warn("Editor HTML Kids load remote:", error);
  }
}

async function loadRemoteProject(projectId) {
  if (!firebaseReady || !db || !currentUser?.uid || !projectId || cloudWriteLocked) return null;
  try {
    const snap = await getDoc(getProjectDoc(currentUser.uid, projectId));
    if (!snap.exists()) return null;
    return normalizePayload({ ...snap.data(), projectId: snap.id });
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "permission-denied") {
      cloudWriteLocked = true;
      setCloudStatus("sin permisos");
      return null;
    }
    console.warn("Editor HTML Kids remote project:", error);
    return null;
  }
}

async function saveRemote(payload) {
  if (!firebaseReady || !db || !currentUser?.uid || cloudWriteLocked) return;
  const normalized = normalizePayload(payload);
  try {
    await setDoc(
      getProjectDoc(currentUser.uid, normalized.projectId),
      {
        ...normalized,
        ownerUid: currentUser.uid,
        ownerEmail: currentUser.email || "",
        ownerName: currentUser.displayName || "",
        serverUpdatedAt: serverTimestamp()
      },
      { merge: true }
    );
    setCloudStatus("guardada");
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "permission-denied") {
      cloudWriteLocked = true;
      setCloudStatus("sin permisos");
      return;
    }
    if (code === "resource-exhausted") {
      cloudWriteLocked = true;
      setCloudStatus("cuota agotada");
      return;
    }
    setCloudStatus("error al guardar");
    console.warn("Editor HTML Kids save remote:", error);
  }
}

function renderProjectsList() {
  if (!projectsList) return;
  projectsList.innerHTML = "";
  const items = getSavedProjectsForCurrentUser();

  if (!currentUser) {
    if (projectsEmptyText) {
      projectsEmptyText.hidden = false;
      projectsEmptyText.textContent = "Inicia sesion con Google para ver tus proyectos.";
    }
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-item${item.key === activeProjectId ? " active" : ""}`;
    const projectName = normalizeText(item.payload.projectName, 40) || "Proyecto sin titulo";
    const savedAt = item.payload.lastSavedAt ? new Date(item.payload.lastSavedAt).toLocaleString("es-ES") : "Sin fecha";
    button.innerHTML = `<span class="project-item-name">${escapeHtml(projectName)}</span><span class="project-item-meta">Ultimo guardado: ${escapeHtml(savedAt)}</span>`;
    button.addEventListener("click", async () => {
      const localPayload = normalizePayload(item.payload);
      applyPayloadToUI(localPayload);
      committedSnapshot = clonePayload(localPayload);
      saveLocal(localPayload);
      setProjectStatus(`Proyecto activo: ${projectName}.`, "ok");
      const remotePayload = await loadRemoteProject(item.key);
      if (remotePayload && (remotePayload.lastSavedAtMs || 0) > (localPayload.lastSavedAtMs || 0)) {
        applyPayloadToUI(remotePayload);
        saveLocal(remotePayload);
        committedSnapshot = clonePayload(remotePayload);
        setCloudStatus("cargada");
      }
    });
    projectsList.appendChild(button);
  });

  if (projectsEmptyText) {
    projectsEmptyText.textContent = "Aun no hay proyectos guardados.";
    projectsEmptyText.hidden = items.length > 0;
  }
}

function isUserSessionActive() {
  return Boolean(currentUser?.uid);
}

function updateWorkspaceLockState() {
  const unlocked = isUserSessionActive();
  const protectedButtons = [
    newProjectButton,
    newHtmlFileButton,
    newCssFileButton,
    newJsFileButton,
    runButton,
    saveButton,
    openHtmlButton,
    exportHtmlButton,
    resetButton,
    autocompleteButton
  ];

  protectedButtons.forEach((button) => {
    if (button) button.disabled = !unlocked;
  });

  if (undoResetButton && !unlocked) undoResetButton.disabled = true;
  if (htmlInput) htmlInput.disabled = !unlocked;
  if (signOutButton) signOutButton.disabled = !unlocked;
  if (clearSessionButton) clearSessionButton.disabled = !unlocked;
  if (signInGoogleButton) signInGoogleButton.disabled = unlocked;
  if (insertImageUrlButton) insertImageUrlButton.disabled = !unlocked;
  if (imageUrlInput) imageUrlInput.disabled = !unlocked;

  if (!unlocked) {
    closeAutocomplete();
    setResourceStatus("Inicia sesion con Google para editar y usar recursos.");
  } else {
    setResourceStatus("Selecciona una imagen para agregarla al editor.");
  }
}

async function hydrateProjectsForCurrentUser() {
  await syncProjectsFromCloud();
  const items = getSavedProjectsForCurrentUser();
  const preferredProjectId = readSessionValue(getActiveProjectStorageKey(currentUser.uid));
  const preferredProject = items.find((item) => item.key === preferredProjectId);
  const latestProject = preferredProject || items[0];

  if (latestProject) {
    applyPayloadToUI(latestProject.payload);
    committedSnapshot = clonePayload(latestProject.payload);
    writeSessionValue(getActiveProjectStorageKey(currentUser.uid), latestProject.key);
    setProjectStatus(`Proyecto activo: ${latestProject.payload.projectName}.`, "ok");
    renderProjectsList();
    return;
  }

  const draft = getSessionDraft();
  if (draft && (!draft.ownerUid || draft.ownerUid === currentUser.uid)) {
    const adoptedDraft = normalizePayload({
      ...draft,
      ownerUid: currentUser.uid,
      ownerEmail: currentUser.email || "",
      ownerName: currentUser.displayName || ""
    });
    applyPayloadToUI(adoptedDraft);
    saveLocal(adoptedDraft);
    committedSnapshot = clonePayload(adoptedDraft);
    await saveRemote(adoptedDraft);
    setProjectStatus(`Proyecto activo: ${adoptedDraft.projectName}.`, "ok");
    return;
  }

  const initialPayload = createBlankProjectPayload("Proyecto 1");
  applyPayloadToUI(initialPayload);
  saveLocal(initialPayload);
  committedSnapshot = clonePayload(initialPayload);
  await saveRemote(initialPayload);
  setProjectStatus(`Proyecto activo: ${initialPayload.projectName}.`, "ok");
}

function getSignedOutPayload() {
  return normalizePayload({
    files: getDefaultFiles(),
    activeFileId: "",
    code: defaultHtmlCode,
    lastSavedAt: "",
    lastSavedAtMs: 0,
    projectId: createProjectId(),
    projectName: "Proyecto",
    ownerUid: "",
    ownerEmail: "",
    ownerName: ""
  });
}

async function handleAuthStateChange(user) {
  currentUser = user || null;
  cloudWriteLocked = false;

  if (!currentUser) {
    activeProjectId = "";
    activeProjectName = "";
    applyPayloadToUI(getSignedOutPayload());
    committedSnapshot = clonePayload(buildPayloadFromUI());
    setAuthStatus("Sin iniciar sesión.", "warn");
    setProjectStatus("Proyecto activo: ninguno.");
    setCloudStatus(firebaseReady ? "pendiente" : "desactivada");
    updateWorkspaceLockState();
    renderProjectsList();
    return;
  }

  const accountName = normalizeText(currentUser.displayName || currentUser.email || "Cuenta Google", 60);
  const accountEmail = normalizeText(currentUser.email || "", 80);
  setAuthStatus(`Sesion activa: ${accountName}${accountEmail ? ` (${accountEmail})` : ""}.`, "ok");
  setCloudStatus("sincronizando");
  await hydrateProjectsForCurrentUser();
  updateWorkspaceLockState();
  renderProjectsList();
}

async function initFirebase() {
  try {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) {
      setCloudStatus("desactivada (falta firebase-config)");
      return;
    }
    const app = initializeApp(cfg);
    db = getFirestore(app);
    auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    firebaseReady = true;
    await new Promise((resolve) => {
      let initialAuthEvent = false;
      onAuthStateChanged(auth, async (user) => {
        await handleAuthStateChange(user);
        if (!initialAuthEvent) {
          initialAuthEvent = true;
          resolve();
        }
      });
    });
  } catch (error) {
    firebaseReady = false;
    setCloudStatus("error de conexion");
    console.warn("Editor HTML Kids Firebase:", error);
  }
}

async function signInWithGoogle() {
  if (!auth) {
    setAuthStatus("Firebase no esta listo.", "warn");
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === "auth/popup-closed-by-user") return;
    setAuthStatus("No se pudo iniciar sesion con Google.", "warn");
    console.warn("Editor HTML Kids Google sign-in:", error);
  }
}

async function signOutCurrentUser() {
  if (!auth) return;
  try {
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (currentUser) saveDraftLocalOnly();
    await signOut(auth);
  } catch (error) {
    setAuthStatus("No se pudo cerrar sesion.", "warn");
    console.warn("Editor HTML Kids sign-out:", error);
  }
}

async function createNewProject() {
  if (!currentUser) {
    setAuthStatus("Inicia sesion con Google antes de crear un proyecto.", "warn");
    return;
  }
  const existingCount = getSavedProjectsForCurrentUser().length;
  const suggestedName = `Proyecto ${existingCount + 1}`;
  const askedName = window.prompt("Nombre del nuevo proyecto", suggestedName);
  if (askedName === null) return;
  const projectName = normalizeText(askedName, 40) || suggestedName;

  const payload = createBlankProjectPayload(projectName);
  applyPayloadToUI(payload);
  saveLocal(payload);
  committedSnapshot = clonePayload(payload);
  setProjectStatus(`Proyecto activo: ${projectName}.`, "ok");
  await saveRemote(payload);
}

async function saveProgress(showFeedback = true, forceCloud = true, commitSnapshot = true) {
  if (!saveButton) return;
  if (!currentUser) {
    writeSessionValue(sessionDraftKey, JSON.stringify(buildPayloadFromUI()));
    setAuthStatus("Inicia sesion con Google para guardar tu progreso.", "warn");
    return;
  }

  const payload = buildPayloadFromUI();
  saveLocal(payload);
  if (commitSnapshot) committedSnapshot = clonePayload(payload);

  if (showFeedback) {
    saveButton.textContent = "Progreso guardado";
    setTimeout(() => {
      if (saveButton) saveButton.textContent = "Guardar progreso";
    }, 1200);
  }

  updateCurrentProjectStatus();
  if (forceCloud) await saveRemote(payload);
}

async function bootstrapProgress() {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  applyPayloadToUI(getSignedOutPayload());
  committedSnapshot = clonePayload(buildPayloadFromUI());
  updateWorkspaceLockState();
  renderProjectsList();
  await initFirebase();
}

function createNewFileByType(type) {
  updateActiveFileFromInput();
  const defaultName = type === "css" ? "styles.css" : type === "js" ? "app.js" : "index.html";
  const asked = window.prompt(`Nombre del archivo ${type.toUpperCase()} (ej: ${defaultName})`, defaultName);
  if (!asked) return;
  const fileName = normalizeFileName(asked, type);
  if (editorFiles.some((file) => file.name === fileName)) {
    window.alert("Ya existe un archivo con ese nombre.");
    return;
  }
  const file = createFileRecord(type, fileName, getAutocompleteBaseByType(type));
  editorFiles.push(file);
  setActiveFile(file.id);
  scheduleAutoSaveLocal();
}

if (newHtmlFileButton) {
  newHtmlFileButton.addEventListener("click", () => {
    createNewFileByType("html");
  });
}

if (newCssFileButton) {
  newCssFileButton.addEventListener("click", () => {
    createNewFileByType("css");
  });
}

if (newJsFileButton) {
  newJsFileButton.addEventListener("click", () => {
    createNewFileByType("js");
  });
}

if (runButton) {
  runButton.addEventListener("click", async () => {
    renderPreview();
    refreshSuggestionProgress();
    await saveProgress(false, false, false);
  });
}

if (saveButton) {
  saveButton.addEventListener("click", async () => {
    await saveProgress(true, true);
  });
}

if (openHtmlButton) {
  openHtmlButton.addEventListener("click", async () => {
    await openCodeFile();
  });
}

if (htmlFileInput) {
  htmlFileInput.addEventListener("change", async (event) => {
    const target = event.target;
    const file = target?.files?.[0];
    if (!file) return;
    const text = await file.text();
    applyOpenedFile(file.name || "archivo.txt", text);
    htmlFileInput.value = "";
    scheduleAutoSaveLocal();
  });
}

if (exportHtmlButton) {
  exportHtmlButton.addEventListener("click", async () => {
    await exportActiveFile();
  });
}

if (insertImageUrlButton) {
  insertImageUrlButton.addEventListener("click", () => {
    const inserted = insertImageTagFromUrl(imageUrlInput?.value || "", "Imagen por URL");
    if (inserted && imageUrlInput) imageUrlInput.value = "";
  });
}

if (imageUrlInput) {
  imageUrlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inserted = insertImageTagFromUrl(imageUrlInput.value, "Imagen por URL");
    if (inserted) imageUrlInput.value = "";
  });
}

if (newProjectButton) {
  newProjectButton.addEventListener("click", async () => {
    await createNewProject();
  });
}

if (signInGoogleButton) {
  signInGoogleButton.addEventListener("click", async () => {
    await signInWithGoogle();
  });
}

if (signOutButton) {
  signOutButton.addEventListener("click", async () => {
    await signOutCurrentUser();
  });
}

if (clearSessionButton) {
  clearSessionButton.addEventListener("click", async () => {
    await signOutCurrentUser();
  });
}

if (resetButton) {
  resetButton.addEventListener("click", async () => {
    lastResetSnapshot = buildPayloadFromUI();
    editorFiles = getDefaultFiles();
    activeFileId = editorFiles[0].id;
    if (hintText) hintText.hidden = true;
    syncInputFromActiveFile();
    renderFileTabs();
    renderCodeHighlight();
    renderPreview();
    refreshSuggestionProgress();
    if (undoResetButton) undoResetButton.disabled = false;
    await saveProgress(true, true, false);
  });
}

if (undoResetButton) {
  undoResetButton.addEventListener("click", () => {
    if (!lastResetSnapshot) return;
    restoreFromSnapshot(lastResetSnapshot);
    lastResetSnapshot = null;
    undoResetButton.disabled = true;
    if (savedAtText) savedAtText.textContent = "Reinicio deshecho y progreso restaurado.";
  });
}

if (autocompleteButton) {
  autocompleteButton.addEventListener("click", () => {
    const file = getActiveFile();
    if (!file || !htmlInput) return;
    htmlInput.value = getAutocompleteBaseByType(file.type);
    updateActiveFileFromInput();
    renderCodeHighlight();
    renderPreview();
    refreshSuggestionProgress();
    scheduleAutoSaveLocal();
    autocompleteButton.textContent = "Base insertada";
    setTimeout(() => {
      if (autocompleteButton) autocompleteButton.textContent = "Autocompletar base";
    }, 1000);
  });
}

if (exitWithoutSaveButton) {
  exitWithoutSaveButton.addEventListener("click", () => {
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (committedSnapshot) saveLocal(committedSnapshot);
    skipSaveOnUnload = true;
    window.location.href = buildReturnUrl();
  });
}

if (hintButton && hintText) {
  hintButton.addEventListener("click", () => {
    hintText.hidden = !hintText.hidden;
  });
}

if (htmlInput) {
  htmlInput.addEventListener("focus", () => {
    renderLineNumbers();
    openAutocomplete();
  });

  htmlInput.addEventListener("click", () => {
    renderLineNumbers();
    openAutocomplete();
  });

  htmlInput.addEventListener("scroll", () => {
    if (!codeHighlight) return;
    codeHighlight.scrollTop = htmlInput.scrollTop;
    codeHighlight.scrollLeft = htmlInput.scrollLeft;
    if (lineNumbers) lineNumbers.scrollTop = htmlInput.scrollTop;
    if (autocompleteState.visible) positionAutocompleteList();
  });

  htmlInput.addEventListener("input", () => {
    updateActiveFileFromInput();
    renderCodeHighlight();
    renderPreview();
    refreshSuggestionProgress();
    autoFixHtmlTypos();
    openAutocomplete();
    scheduleAutoSaveLocal();
  });

  htmlInput.addEventListener("keydown", async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
      event.preventDefault();
      renderPreview();
      refreshSuggestionProgress();
      await saveProgress(false, false, false);
      return;
    }

    if (autocompleteState.visible) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        autocompleteState.selectedIndex = (autocompleteState.selectedIndex + 1) % autocompleteState.items.length;
        renderAutocompleteList();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        autocompleteState.selectedIndex = (autocompleteState.selectedIndex - 1 + autocompleteState.items.length) % autocompleteState.items.length;
        renderAutocompleteList();
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        acceptAutocomplete();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeAutocomplete();
        return;
      }
    }

    if (maybeAutoCloseHtmlTag(event) || maybeAutoCloseCssBlock(event) || maybeAutoCloseJsBlock(event) || maybeAutoPair(event)) {
      updateActiveFileFromInput();
      renderCodeHighlight();
      renderPreview();
      refreshSuggestionProgress();
      openAutocomplete();
      scheduleAutoSaveLocal();
    }
  });

  htmlInput.addEventListener("blur", () => {
    setTimeout(() => closeAutocomplete(), 120);
  });

  htmlInput.addEventListener("keyup", () => {
    renderLineNumbers();
  });
}

window.addEventListener("beforeunload", () => {
  if (skipSaveOnUnload) return;
  saveDraftLocalOnly();
});

if (!htmlInput || !previewFrame) {
  console.warn("Editor HTML Kids: faltan elementos del DOM. Recarga la pagina.");
} else {
  applyReturnAccessPolicy();
  if (backLink && !backLink.classList.contains("is-disabled")) backLink.href = buildReturnUrl();
  renderImageResources();
  await bootstrapProgress();
  renderCodeHighlight();
  renderPreview();
  refreshSuggestionProgress();
}
