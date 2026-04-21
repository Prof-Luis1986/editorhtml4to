# Editor HTML Aislado

Esta carpeta contiene una copia independiente del editor HTML Kids.

Archivos principales:
- `index.html`
- `editor.css`
- `editor.js`
- `publicacion.html`
- `publicacion.css`
- `publicacion.js`
- `firebase-config.js`
- `firestore.rules`

Uso:
1. Abre `index.html` desde esta carpeta.
2. En Firebase Authentication activa el proveedor Google.
3. En Firestore publica las reglas del archivo `firestore.rules`.
4. Si quieres usar sincronizacion en nube, conserva `firebase-config.js`.
5. Cada cuenta Google guarda sus proyectos en `users/{uid}/projects/{projectId}`.
6. Las paginas publicadas se guardan en `publishedPages/{pageId}` y se abren desde `publicacion.html?page=...`.
7. Publica tambien las reglas nuevas de `firestore.rules` para permitir lectura publica de las paginas ya publicadas.
