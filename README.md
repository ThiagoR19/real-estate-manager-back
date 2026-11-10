# real-estate-manager-back

## Frontend de login y propiedades

El frontend usa `POST /api/auth/login`, `GET /api/propiedades/catalogos`, el CRUD de `/api/propiedades` y las rutas `/api/propiedades/:id/archivos`. Las rutas de propiedades requieren una cuenta de administrador o agente. La respuesta de catálogos contiene `tipos`, `estados` y `agentes` con sus IDs reales.

En una base existente, ejecutar `db/migrations/20261109_tipos_propiedades.sql` una vez para cargar los tipos de propiedad. También debe estar aplicada `db/migrations/20261109_archivos.sql` para los adjuntos. La base nueva usa `db/db.sql`.

Para el cierre de sesión, ejecutar una vez `db/migrations/20261109_sesiones_revocadas.sql` en bases existentes. `POST /api/auth/logout` revoca el token activo; las siguientes peticiones con ese token reciben 401.

Configurar `.env` con la conexión MySQL, `TOKEN_SECRET`, `PORT=3000` y `FRONT_URL` (origen del frontend o `*` para desarrollo). Luego iniciar con `npm run dev`.

## Archivos

La implementación reutiliza `express-fileupload` y `utils/archivos.js`, como inmobiliarias. Primero se crea la entidad con los endpoints JSON existentes y después se cargan sus archivos con `multipart/form-data`. Las actualizaciones JSON no modifican los adjuntos.

Para una base existente, ejecutar una vez `db/migrations/20261109_archivos.sql` antes de iniciar la API. Las instalaciones nuevas ya incluyen `personas.fotoPerfil` en `db/db.sql`. Se reutilizan `propiedadesImagenes`, `reportesImagenes`, `documentos` y `versionesDocumentos`.

Todas las rutas requieren `Authorization: Bearer <token>` y conservan el alcance por inmobiliaria.

| Entidad | Ruta base | Archivos disponibles |
| --- | --- | --- |
| Inquilinos | `/api/inquilinos/:id/archivos` | Foto de perfil y PDF |
| Propietarios | `/api/propietarios/:id/archivos` | Foto de perfil y PDF |
| Propiedades | `/api/propiedades/:id/archivos` | Imágenes y PDF |
| Reportes | `/api/reportes/:id/archivos` | Imágenes y PDF |
| Admins | `/api/admins/:id/archivos` | Foto de perfil (gestionada por superadmin) |
| Agentes | `/api/agentes/:id/archivos` | Foto de perfil |
| Mi perfil de admin | `/api/perfil/archivos` | Foto de perfil propia |

Los propietarios e inquilinos pueden gestionar adjuntos de sus propios reportes; admins y agentes, los de su inmobiliaria. Los permisos de administración de las demás entidades se mantienen.

| Método y sufijo de la ruta base | Uso |
| --- | --- |
| `GET /` | Consultar foto, imágenes y metadatos de documentos |
| `PUT /foto` | Crear o reemplazar la foto; campo `fotoPerfil` |
| `DELETE /foto` | Quitar la foto |
| `POST /imagenes` | Agregar imágenes; repetir el campo `imagenes` |
| `DELETE /imagenes/:idArchivo` | Eliminar una imagen |
| `POST /documentos` | Agregar PDF; repetir el campo `documentos` |
| `GET /documentos/:idArchivo` | Descargar el PDF autenticado (última versión) |
| `DELETE /documentos/:idArchivo` | Eliminar el documento y sus versiones |

Las rutas de foto se habilitan para personas y las de imágenes para propiedades/reportes. Las rutas de documentos se habilitan donde indica la tabla. `idArchivo` es el `id` de la imagen o del documento devuelto por la API, no el identificador de su versión.

Imágenes: JPEG, PNG o WebP, máximo **2 MiB por archivo**, hasta **10 por petición** (una sola foto de perfil). Se valida el contenido y se convierte a WebP de hasta 1600 × 1600. PDF: máximo **10 MiB por archivo**, hasta **5 por petición**, usando la validación de cabecera del helper existente. Cada PDF crea un documento con su primera versión, nombre original, MIME, tamaño y usuario autor. No se aceptan campos de texto en las peticiones de carga.

Las imágenes se guardan en `uploads/perfiles`, `uploads/propiedades` o `uploads/reportes`. Los GET de agentes, admins, propietarios e inquilinos incluyen `fotoPerfil` y `urlFotoPerfil`; los GET de reportes incluyen `imagenes`, con `id`, `nombre` y `url`. La ruta de archivos devuelve también estos datos junto con los metadatos de documentos. Los PDF se guardan en `storage/documentos`, fuera de `/uploads`, y se descargan por la ruta autenticada. Ambas carpetas están excluidas de Git.

`GET /api/propiedades` y `GET /api/propiedades/:id` incluyen `imagenes` en cada propiedad. Cada imagen contiene `id`, `nombre`, `orden` y `url`; si no hay imágenes, el valor es `[]`. La ruta `GET /api/propiedades/:id/archivos` sigue disponible para consultar también los documentos.

Un lote se confirma completo o se descarta. Si falla la validación o SQL, se eliminan los nuevos archivos. Las fotos reemplazadas y los adjuntos eliminados se borran del disco después del commit. El borrado de una entidad también elimina sus referencias a archivos dentro de la misma transacción; si otra relación impide borrarla, se conservan sus adjuntos.

Ejemplo desde el frontend:

```js
const datos = new FormData()
for (const imagen of imagenesSeleccionadas) datos.append("imagenes", imagen)

const respuesta = await fetch(`/api/propiedades/${idPropiedad}/archivos/imagenes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: datos,
})
const resultado = await respuesta.json()
```

No establecer `Content-Type` manualmente: el navegador genera el boundary multipart. Para fotos usar `PUT` y `fotoPerfil`; para PDF usar `POST` y `documentos`.

## Pruebas

`npm test` ejecuta pruebas de archivos reales y peticiones HTTP locales, con SQL simulado. Verifican formato, límites, alcance por inmobiliaria, permisos, almacenamiento privado y limpieza ante fallos. No modifican una base MySQL existente; la migración y las consultas deben validarse también en la base de desarrollo.
