# real-estate-manager-back

## Alta y activación de cuentas

### Registro e ingreso con Google

Configurar `GOOGLE_CLIENT_ID` en el backend y `VITE_GOOGLE_CLIENT_ID` en el frontend con el mismo ID de cliente OAuth de tipo **Aplicación web** (termina en `.apps.googleusercontent.com`). Autorizar los orígenes del frontend (incluido `http://localhost:5173` para desarrollo con Vite) en Google Cloud. No se requiere el secreto de cliente (`GOCSPX-...`) para este intercambio de ID tokens; nunca colocarlo en una variable `VITE_`.

Después de verificar el DNI desde una invitación, el titular puede registrarse con Google. Se vincula el identificador `sub` verificado, se genera un usuario único a partir del nombre de Google y no se crea una contraseña. Si la persona ya tiene un correo registrado, debe coincidir con el correo verificado de Google. `POST /api/auth/registro/google` recibe `verificacion` y `credential`. `POST /api/auth/login/google` recibe `credential`; en el primer acceso también vincula las cuentas activas existentes cuyo correo coincide con el correo verificado de Google, conservando su contraseña. Cuando la misma cuenta Google está vinculada a varias inmobiliarias, devuelve `cuentas` y el cliente repite la petición con `idUsuario` elegido. El servidor verifica la firma y las claims del ID token en cada acceso y emite el JWT de sesión habitual.

Una cuenta creada con Google puede establecer su primera contraseña desde Mi perfil mientras su sesión esté activa, dejando vacía la contraseña actual. Luego puede iniciar sesión tanto con Google como con su usuario y contraseña. Las modificaciones posteriores requieren la contraseña actual.

Las altas de agentes, propietarios e inquilinos requieren `dni` (7 u 8 dígitos).
El alta de un admin también requiere `idInmobiliaria`, que se obtiene de la
inmobiliaria seleccionada. Los demás datos personales son opcionales. La API
devuelve `activacion.enlace` para compartir con el titular. No se asignan usuario
ni contraseña durante el alta.
`FRONT_URL` debe ser la URL concreta del frontend para generar ese enlace.

El titular abre `/activar?codigo=...`, envía su DNI a
`POST /api/auth/invitacion/:codigo/verificar` y, si coincide, recibe un
comprobante temporal de 15 minutos. Luego `POST /api/auth/registro` acepta
`verificacion`, `usuario` y `password`, consume la invitación y activa la cuenta.
Tres DNI incorrectos agotan la invitación. Los datos personales restantes se
completan desde `/perfil`; el DNI de la invitación queda fijo.

En bases existentes, aplicar primero `db/migrations/20261111_registro_dni.sql`
si aún falta `tokensAcceso.intentosDni`, y después
`db/migrations/20261112_invitaciones_dni.sql`. Luego aplicar
`db/migrations/20261115_usuario_por_inmobiliaria.sql` para retirar la antigua
restricción global del nombre de usuario, si está presente. El mismo nombre
puede usarse en distintas inmobiliarias; si una contraseña coincide con varias
cuentas, el login pide elegir la inmobiliaria.

La instalación nueva usa `db/db.sql`. Este proyecto no ejecuta migraciones
automáticamente.

Para actualizar las zonas de agentes en una base existente, ejecutar una vez
`db/migrations/20261112_areas_ciudades_buenos_aires.sql`. La migración quita del
catálogo las categorías que no son localidades, deja sin zona a los agentes que
las tenían asignadas y carga las localidades disponibles. Después se puede
asignar la zona correcta a cada agente desde Agentes.

## Esquema de pagos y cobros

Las instalaciones nuevas usan `db/db.sql`. En una base existente, aplicar una vez
`db/migrations/20261110_pagos_cobros.sql` después de las migraciones anteriores.
No hay un ejecutor automático de migraciones en este proyecto. La migración
comprueba antes de cambiar tablas que no haya dos pagos del mismo contrato con
vencimiento en el mismo mes ni dos cobros del mismo pago para un propietario. Si
hay duplicados, se detiene antes del primer cambio permanente. Se pueden localizar
con estas consultas:

```sql
SELECT idInmobiliaria, idContrato, YEAR(fechaVencimiento) AS anio,
       MONTH(fechaVencimiento) AS mes, COUNT(*) AS cantidad
FROM pagos
GROUP BY idInmobiliaria, idContrato, YEAR(fechaVencimiento), MONTH(fechaVencimiento)
HAVING COUNT(*) > 1;

SELECT idInmobiliaria, idPago, idPropietario, COUNT(*) AS cantidad
FROM cobros
GROUP BY idInmobiliaria, idPago, idPropietario
HAVING COUNT(*) > 1;
```

`pagos.periodo` es el primer día del mes facturado. Para pagos anteriores, la
migración lo deduce del mes de `fechaVencimiento`; revisar los períodos históricos
si alguna fecha de vencimiento cae en un mes distinto del facturado. Los conceptos
con `conceptosPago.idInmobiliaria = NULL` son globales. Al insertar un concepto en
`pagosConceptos`, usar `conceptoTenantClave = 0` para uno global o el ID de la
inmobiliaria para uno propio. La clave foránea impide referenciar conceptos de
otra inmobiliaria. El importe neto del cobro se calcula como bruto menos comisión
y descuentos. El recibo PDF de transferencia al propietario se vincula mediante
`documentos.idCobro`; los comprobantes del inquilino continúan en `comprobantes`.

Las rutas de `pagos` y `cobros` todavía responden 501; esta migración prepara el
esquema para implementarlas.

## Frontend de login y propiedades

El frontend usa `POST /api/auth/login`, `GET /api/propiedades/catalogos`, el CRUD de `/api/propiedades` y las rutas `/api/propiedades/:id/archivos`. Las rutas de propiedades requieren una cuenta de administrador o agente. La respuesta de catálogos contiene `tipos`, `estados` y `agentes` con sus IDs reales.

En una base existente, ejecutar `db/migrations/20261109_tipos_propiedades.sql` una vez para cargar los tipos de propiedad. También debe estar aplicada `db/migrations/20261109_archivos.sql` para los adjuntos. La base nueva usa `db/db.sql`.

Para el cierre de sesión, ejecutar una vez `db/migrations/20261109_sesiones_revocadas.sql` en bases existentes. `POST /api/auth/logout` revoca el token activo; las siguientes peticiones con ese token reciben 401.

Configurar `.env` con la conexión MySQL, `TOKEN_SECRET`, `PORT=3000` y `FRONT_URL` (origen del frontend o `*` para desarrollo). Luego iniciar con `npm run dev`.

## Archivos

Cada módulo gestiona sus rutas, controladores y servicios de archivos. Se reutilizan `express-fileupload`, `middlewares/archivos.js` y las utilidades de almacenamiento. Primero se crea la entidad con los endpoints JSON existentes y después se cargan sus archivos con `multipart/form-data`. Las actualizaciones JSON no modifican los adjuntos.

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
| Mi perfil | `/api/perfil/foto` | Foto de perfil propia (PUT y DELETE) |

Los propietarios e inquilinos pueden gestionar adjuntos de sus propios reportes; admins y agentes, los de su inmobiliaria. Los permisos de administración de las demás entidades se mantienen.

La eliminación de un agente o administrador con propiedades, visitas, chats,
documentos u otros datos asociados responde 409 e informa qué relación impide
la baja. Los avisos recibidos se desvinculan automáticamente al eliminar la
persona.

| Método y sufijo de la ruta base | Uso |
| --- | --- |
| `GET /` | Consultar foto, imágenes y metadatos de documentos |
| `PUT /foto` | Crear o reemplazar la foto; campo `fotoPerfil` |
| `DELETE /foto` | Quitar la foto |
| `POST /imagenes` | Agregar imágenes; repetir el campo `imagenes` |
| `PUT /imagenes/:idArchivo` | Reemplazar una imagen; campo `imagenes` |
| `DELETE /imagenes/:idArchivo` | Eliminar una imagen |
| `POST /documentos` | Agregar PDF; repetir el campo `documentos` |
| `PUT /documentos/:idArchivo` | Agregar una nueva versión PDF; campo `documentos` |
| `GET /documentos/:idArchivo` | Descargar el PDF autenticado (última versión) |
| `DELETE /documentos/:idArchivo` | Eliminar el documento y sus versiones |

Las rutas de foto se habilitan para personas y las de imágenes para propiedades/reportes. Las rutas de documentos se habilitan para inquilinos, propietarios, propiedades y reportes. `idArchivo` es el `id` de la imagen o del documento devuelto por la API, no el identificador de su versión.

Imágenes: JPEG, PNG o WebP, máximo **2 MiB por archivo**, hasta **10 por petición** (una sola foto de perfil). Se valida el contenido y se convierte a WebP de hasta 1600 × 1600. PDF: máximo **10 MiB por archivo**, hasta **5 por petición** al crear documentos y uno al agregar una versión. Se valida la cabecera. Cada PDF nuevo crea un documento con su primera versión, nombre original, MIME, tamaño y usuario autor. No se aceptan campos de texto en las peticiones de carga.

Las imágenes se guardan en `uploads/perfiles`, `uploads/propiedades` o `uploads/reportes`. Los GET de agentes, admins, propietarios e inquilinos incluyen `fotoPerfil` y `urlFotoPerfil`; los GET de reportes incluyen `imagenes`, con `id`, `nombre` y `url`. La ruta de archivos devuelve también estos datos junto con los metadatos de documentos. Los PDF se guardan en `storage/documentos`, fuera de `/uploads`, y se descargan por la ruta autenticada. Ambas carpetas están excluidas de Git.

`GET /api/propiedades` y `GET /api/propiedades/:id` incluyen `imagenes` en cada propiedad. Cada imagen contiene `id`, `nombre`, `orden` y `url`; si no hay imágenes, el valor es `[]`. La ruta `GET /api/propiedades/:id/archivos` consulta también los documentos.

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

## Notificaciones automáticas

En bases existentes, aplicar `db/migrations/20261117_notificaciones_automaticas.sql`
una vez antes de iniciar esta versión de la API. Las instalaciones nuevas usan
`db/db.sql`.

Los avisos se guardan al confirmar la operación que los genera. La bandeja es
individual y cada destinatario conserva su propio estado de lectura.

| Rol | Avisos |
| --- | --- |
| Superadmin | Altas y activaciones de administradores, con la inmobiliaria correspondiente. |
| Administrador | Altas y activaciones de agentes, propietarios e inquilinos, reportes, contratos y pagos para revisar. |
| Agente | Reportes, contratos y pagos para revisar de propiedades a su cargo, novedades de sus visitas y mensajes. |
| Propietario | Reportes de sus propiedades, contratos en los que participa, liquidaciones y mensajes. |
| Inquilino | Reportes del alquiler, contratos en los que participa, pagos nuevos o revisados y mensajes. |

Al terminar el registro, cada cuenta de inmobiliaria recibe también su aviso de
activación. La campana se actualiza al abrirla, al volver a la ventana y cada
30 segundos. Los avisos se generan desde la instalación de esta versión.

## Pruebas

Para las lecturas de chat en bases existentes, ejecutar una vez
`db/migrations/20261115_chat_lectura.sql` antes de iniciar esta versión de la API.
Las instalaciones nuevas ya incluyen la columna en `db/db.sql`.
El historial de chat devuelve los diez mensajes más recientes. El envío de
mensajes acepta texto en JSON; el chat no admite archivos adjuntos.

`npm test` cubre autenticación, permisos de reportes, respuestas de errores y
consultas de chat con SQL simulado. No modifica una base MySQL existente; las
migraciones y consultas deben validarse también en la base de desarrollo.
