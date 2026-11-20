# Backend · Gestor inmobiliario AGI

API REST y servidor Socket.IO del gestor inmobiliario. Maneja autenticación, permisos por rol e inmobiliaria, datos en MySQL, documentos e imágenes locales, chat y notificaciones en tiempo real.

## Contenido

- [Tecnologías y estructura](#tecnologías-y-estructura)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Primer acceso y roles](#primer-acceso-y-roles)
- [Activación y autenticación](#activación-y-autenticación)
- [Respuestas y manejo de errores](#respuestas-y-manejo-de-errores)
- [Rutas de la API](#rutas-de-la-api)
- [Archivos y descargas](#archivos-y-descargas)
- [Tiempo real](#tiempo-real)
- [Esquema consolidado y bases existentes](#esquema-consolidado-y-bases-existentes)
- [Pruebas y resolución de problemas](#pruebas-y-resolución-de-problemas)

## Tecnologías y estructura

- Node.js con módulos CommonJS, Express 5, Zod, MySQL mediante `mysql2/promise` y Socket.IO.
- JWT para sesiones e invitaciones; `bcrypt` para contraseñas; `sharp` para procesar imágenes; `express-fileupload` para recibir archivos.
- La API escucha en `PORT` (habitualmente `3000`). Todos los endpoints HTTP están bajo `/api`.

```text
server.js                 Servidor HTTP, Express, Socket.IO y errores globales
api/api.js                Montaje de rutas públicas y protegidas
api/<módulo>/             Router, controlador, validación y servicio de cada módulo
config/roles.js           IDs de los cinco roles
db/conexion.js            Pool de conexiones MySQL
db/db.sql                 Esquema para instalaciones nuevas
middlewares/             Sesión, roles, CORS y carga de archivos
utils/res.js              Respuestas JSON y catálogo de errores de la API
sockets/                  Autenticación y eventos de tiempo real
uploads/                  Imágenes servidas públicamente, excepto chats
storage/documentos/       PDF descargados mediante rutas autenticadas
test/                     Pruebas con `node --test`
```

## Instalación local

Se necesitan Node.js/npm y una instancia MySQL compatible con el esquema (`JSON`, columnas generadas y `CHECK`; se recomienda MySQL 8). Usar Node.js `>=22.12.0` para cumplir los requisitos de la biblioteca de Google del backend y Vite 8 del frontend. Los comandos se ejecutan desde `real-estate-manager-back/`.

1. Crear una base vacía e importar [`db/db.sql`](db/db.sql), que contiene el esquema consolidado y los catálogos iniciales. El archivo **no** contiene `CREATE DATABASE` ni `USE`.
2. Copiar [`.env.example`](.env.example) a `.env` y completar la conexión, el secreto JWT, el puerto y la URL del frontend.
3. Instalar dependencias y levantar el servidor.

```powershell
mysql -u root -p -e "CREATE DATABASE real_estate_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p real_estate_manager -e "source db/db.sql"
Copy-Item .env.example .env
npm ci
npm run dev
```

También se puede importar el SQL desde un cliente gráfico de MySQL. Para desarrollo, la API queda en `http://localhost:3000/api`. `npm run dev` usa `node --watch server.js`; el proyecto no define un script `start` ni modifica el esquema al arrancar.

El esquema inicial crea tablas y catálogos, **sin usuarios de prueba**. La aplicación requiere aprovisionar una primera cuenta de superadministrador activa en un entorno controlado para acceder al panel y crear la primera inmobiliaria. No se incluye un comando de seed para esa cuenta.

## Variables de entorno

Los módulos cargan `.env` con `dotenv` y leen las variables desde `process.env`. Al arrancar, `server.js` exige `DB_HOST`, `DB_USER`, `DB_NAME`, `TOKEN_SECRET`, `FRONT_URL` y `PORT`. `DB_PASS` puede quedar vacío si la conexión local no usa contraseña.

| Variable | Uso | Ejemplo local |
| --- | --- | --- |
| `PORT` | Puerto HTTP y Socket.IO; **obligatoria**. | `3000` |
| `DB_HOST` | Host de MySQL. | `localhost` |
| `DB_USER` | Usuario de MySQL. | `agi_dev` |
| `DB_PASS` | Contraseña de MySQL. | valor privado |
| `DB_NAME` | Base importada desde `db/db.sql`. | `real_estate_manager` |
| `TOKEN_SECRET` | Firma de JWT de sesión, verificación y visitas. | secreto largo y aleatorio |
| `FRONT_URL` | Origen del frontend permitido por CORS y base de los enlaces de activación. | `http://localhost:5173` |
| `SALT_ROUNDS` | Costo de `bcrypt`; si falta, usa `10`. | `10` |
| `ACTIVATION_TOKEN_HOURS` | Duración de las invitaciones; si falta, usa `24`. | `24` |
| `GOOGLE_CLIENT_ID` | ID OAuth web usado para verificar ID tokens de Google. | opcional |

Ejemplo de `.env`:

```dotenv
PORT=3000
DB_HOST=localhost
DB_USER=agi_dev
DB_PASS=tu_password_local
DB_NAME=real_estate_manager
TOKEN_SECRET=reemplazar_por_un_secreto_largo_y_aleatorio
FRONT_URL=http://localhost:5173
SALT_ROUNDS=10
ACTIVATION_TOKEN_HOURS=24
GOOGLE_CLIENT_ID=
```

No publicar el `.env` ni reutilizar el secreto de desarrollo en producción. `FRONT_URL` debe coincidir con el origen exacto del navegador, incluido el puerto. El frontend local usa el proxy de Vite para `/api` y `/uploads`.

## Primer acceso y roles

| ID | Rol | Ámbito principal |
| --- | --- | --- |
| `1` | Superadministrador | Plataforma: inmobiliarias y administradores. |
| `2` | Administrador | Administración de su inmobiliaria. |
| `3` | Agente | Propiedades, visitas y operaciones que tiene autorizadas. |
| `4` | Propietario | Sus propiedades, contratos, cobros y reportes. |
| `5` | Inquilino | Su alquiler, pagos y reportes. |

Estos IDs deben coincidir exactamente con `roles.id` en la base de datos: `config/roles.js` los usa como valores fijos para asignar roles y comprobar permisos, y el frontend espera la misma correspondencia. `db/db.sql` inserta los roles sin especificar el ID, por lo que el orden de la tabla solo queda como se muestra al importarlo en una base vacía. Si ya existe una tabla `roles`, verificar `SELECT id, nombre FROM roles ORDER BY id;` y corregir cualquier diferencia antes de usar la aplicación.

Las rutas protegidas pasan por `middlewares/autenticar.js`; cada módulo añade sus controles de rol y alcance. Una cuenta de una inmobiliaria opera con su `idInmobiliaria`. La API no confía en los filtros de navegación del frontend para aplicar permisos.

Tras aprovisionar el primer superadministrador se puede crear una inmobiliaria (`POST /api/inmobiliarias`) y su administrador (`POST /api/admins`). Al dar de alta administradores, agentes, propietarios e inquilinos se exige un DNI de 7 u 8 dígitos y se devuelve `activacion.enlace`. El alta crea una cuenta pendiente; su titular completa el registro desde el enlace.

## Activación y autenticación

1. El administrador o superadministrador da de alta a la persona. Para un administrador, el alta incluye `idInmobiliaria`.
2. El titular abre `/activar?codigo=...` en el frontend y envía su DNI a `POST /api/auth/invitacion/:codigo/verificar` con `{ "dni": "12345678" }`.
3. Si coincide, recibe `verificacion`, un comprobante temporal de **15 minutos**. Tres DNI incorrectos agotan la invitación.
4. `POST /api/auth/registro` recibe `verificacion`, `usuario` y `password` y activa la cuenta. La contraseña debe tener al menos ocho caracteres, una mayúscula, una minúscula y un número; `bcrypt` admite hasta 72 bytes.
5. El usuario entra por `POST /api/auth/login` con `usuario` y `password`. Si esas credenciales corresponden a varias inmobiliarias, la respuesta trae `cuentas`; se repite el login con el `idUsuario` elegido.

Las invitaciones duran 24 horas por defecto (`ACTIVATION_TOKEN_HOURS`). Los datos personales opcionales se completan desde el perfil; el DNI de la invitación queda fijo.

### Acceso con Google

`POST /api/auth/registro/google` recibe `verificacion` y `credential`; `POST /api/auth/login/google` recibe `credential` y, cuando corresponde, `idUsuario`. El servidor verifica firma y claims del ID token en cada acceso. La cuenta se vincula al `sub` de Google; para vincular una cuenta activa existente, su correo debe coincidir con el correo verificado por Google. Una cuenta creada con Google puede establecer su primera contraseña desde el perfil sin indicar una contraseña anterior; después podrá usar ambos métodos.

Usar el mismo ID de cliente OAuth de tipo **Aplicación web** en `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` del frontend. Autorizar allí el origen del frontend, por ejemplo `http://localhost:5173`. Este flujo de ID tokens no usa el secreto de cliente de Google; nunca colocarlo en variables `VITE_`.

La verificación usa `OAuth2Client.verifyIdToken()` de `google-auth-library`, siguiendo la [guía oficial de Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). La biblioteca verifica la firma, el destinatario, el emisor y las fechas del token, y gestiona las claves públicas. La aplicación conserva además el rechazo inmediato de tokens vencidos, la tolerancia de emisión de 60 segundos y la exigencia de un `sub` válido.

### Sesiones

Un login correcto devuelve `data.token` y `data.usuario` dentro de la respuesta estándar. Las rutas protegidas reciben `Authorization: Bearer <token>`. Los JWT de sesión duran **14 días**; `POST /api/auth/logout` revoca el token vigente y los siguientes usos reciben `401`.

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"usuario":"usuario_activo","password":"TuPassword123"}
```

```json
{
  "status": "success",
  "data": {
    "token": "<jwt>",
    "usuario": { "id": 1, "usuario": "usuario_activo", "rol": 2, "idInmobi": 1 }
  }
}
```

## Respuestas y manejo de errores

Los controladores y middlewares comparten las funciones de respuesta JSON y el catálogo de errores de la API. [Ver `utils/res.js`](utils/res.js).

- `exito(res, data, opciones)` devuelve `status: "success"` y los datos en `data`. Usa HTTP `200` por defecto. Un controlador puede pasar `{ http: 201 }` al crear un recurso o incluir `paginacion` en un listado.
- `fallo(res, codigo, opciones)` usa el código del catálogo para elegir el estado HTTP y el mensaje predeterminado. Devuelve `status: "fail"` para errores `4xx` y `status: "error"` para errores `5xx`. El cuerpo contiene `error.codigo` y `error.mensaje`, y puede incluir `error.detalles`. El frontend puede usar `error.codigo` para decidir qué hacer y `error.mensaje` para explicar el problema.

Por ejemplo, `GET /api/propiedades` devuelve HTTP `200` aunque el listado esté vacío.

```json
{
  "status": "success",
  "data": [],
  "paginacion": { "pagina": 1, "limite": 12, "total": 0, "paginas": 0 }
}
```

Si la propiedad `42` no existe o está fuera del alcance del usuario, `GET /api/propiedades/42` devuelve HTTP `404`.

```json
{
  "status": "fail",
  "error": { "codigo": "NO_ENCONTRADO", "mensaje": "El recurso no existe" }
}
```

Los servicios pueden lanzar `problema(codigo, mensaje)` para comunicar un error previsto. El middleware global convierte los errores de Zod en HTTP `400` con `DATOS_INVALIDOS` y un arreglo `error.detalles` con `campo` y `problema`. Para las demás excepciones, `falloError` registra el error en el servidor y traduce los casos conocidos de MySQL, como un duplicado a `409 CONFLICTO`. Ante una excepción inesperada, devuelve `500 ERROR_INTERNO` con un mensaje genérico. [Ver `server.js`](server.js).

## Rutas de la API

Las siguientes son **rutas base**, no una especificación exhaustiva de parámetros. Para el detalle vigente, consultar los archivos `api/<módulo>/*.router.js` y sus esquemas Zod.

| Base | Acceso y funciones |
| --- | --- |
| `/api/auth` | Público: verificar invitación, registro y login; logout autenticado. |
| `/api/infoInmobiliaria/:id` | Público: información de la inmobiliaria, propiedades destacadas, catálogo y detalle publicado. |
| `/api/contVisitas` | `POST` público para contabilizar visitas a la landing; `GET` para administración y agentes. |
| `/api/perfil` | Perfil propio, contraseña y foto. |
| `/api/inmobiliarias`, `/api/admins` | Gestión de plataforma y de la inmobiliaria propia según rol. |
| `/api/agentes`, `/api/areas` | Equipo, zonas e invitaciones. |
| `/api/propietarios`, `/api/inquilinos` | Personas, asignaciones, invitaciones y archivos. |
| `/api/propiedades` | Catálogos, CRUD, imágenes y documentos; administración y agentes. |
| `/api/contratos`, `/api/documentos` | Contratos, renovaciones, rescisión y documentación versionada. |
| `/api/pagos`, `/api/cobros` | Períodos, conceptos, comprobantes y revisión de pagos y liquidaciones. |
| `/api/visitas`, `/api/indec` | Agenda, clientes de visitas e índices de ajuste. |
| `/api/reportes`, `/api/profesionales` | Mantenimiento, adjuntos y valoraciones de profesionales. |
| `/api/dashboard`, `/api/notificaciones`, `/api/chat` | Indicadores, avisos y conversaciones. |

Por ejemplo, `GET /api/propiedades/catalogos` devuelve tipos, estados y agentes; `GET /api/propiedades` y `GET /api/propiedades/:id` incluyen `imagenes`. El catálogo público devuelve únicamente propiedades publicadas y disponibles. `GET /api/reportes/catalogos` devuelve los estados, categorías y propiedades que el usuario puede consultar. Solo un inquilino crea reportes; administración y agentes pueden cambiarles el estado. Los propietarios ven reportes de sus propiedades y los inquilinos los de su propiedad asignada o alquiler vigente.

Los endpoints de **pagos y cobros están implementados**: listados, detalle, creación, edición, eliminación según rol, comprobantes y cambios de estado. Las rutas exactas y permisos están en [`api/pagos/pagos.router.js`](api/pagos/pagos.router.js) y [`api/cobros/cobros.router.js`](api/cobros/cobros.router.js).

## Archivos y descargas

Los adjuntos se envían como `multipart/form-data` **después** de crear la entidad. Una actualización JSON de la entidad no cambia sus adjuntos. El nombre del campo depende del tipo:

| Recurso | Ruta | Archivos |
| --- | --- | --- |
| Propiedades | `/api/propiedades/:id/archivos` | `imagenes`, `documentos` |
| Reportes | `/api/reportes/:id/archivos` | `imagenes`, `documentos` |
| Propietarios e inquilinos | `/api/{propietarios\|inquilinos}/:id/archivos` | `fotoPerfil`, `documentos` |
| Agentes y administradores | `/api/{agentes\|admins}/:id/archivos` | `fotoPerfil` |
| Perfil propio | `/api/perfil/foto` | Foto propia |

En las rutas de archivos, `GET /` devuelve metadatos; `POST /imagenes` o `POST /documentos` agrega archivos; `PUT /imagenes/:idArchivo` o `PUT /documentos/:idArchivo` reemplaza o versiona; `DELETE` elimina. `GET /documentos/:idArchivo` descarga la última versión del PDF. En propiedades, `PATCH /documentos/:idArchivo` modifica el título. `idArchivo` identifica la imagen o el documento, no una versión. Algunas combinaciones no están disponibles para todos los módulos: consultar su router.

- Imágenes JPEG, PNG o WebP: máximo **2 MiB cada una**, hasta **10 por solicitud**; foto de perfil: una. Se comprueba el contenido y se convierten a WebP de hasta 1600 × 1600 píxeles.
- PDF: máximo **10 MiB cada uno**, hasta **5 por solicitud** al crear documentos y uno al añadir una versión. Se comprueba la cabecera.
- En propiedades se puede enviar `titulo` al crear un único PDF. Los demás campos de texto ajenos al endpoint se rechazan.
- Las imágenes se guardan en `uploads/` y se sirven desde `/uploads`. La ruta `/uploads/chats` está bloqueada. Los PDF se guardan en `storage/documentos` y se descargan solo mediante la API autenticada.
- Las cargas se confirman como lote; si falla la validación o la operación SQL, se eliminan los archivos nuevos. Al borrar una entidad se limpian sus referencias a adjuntos dentro de la transacción.

Ejemplo desde el navegador:

```js
const datos = new FormData();
for (const imagen of imagenesSeleccionadas) datos.append("imagenes", imagen);

const respuesta = await fetch(`/api/propiedades/${idPropiedad}/archivos/imagenes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: datos,
});
const resultado = await respuesta.json();
```

No establecer `Content-Type` manualmente: el navegador genera el separador multipart. Los comprobantes de pagos y cobros usan el campo `comprobante` y un límite de **5 MiB**. La persistencia de `uploads/` y `storage/documentos/` debe mantenerse junto con la base de datos en copias de seguridad y despliegues.

## Tiempo real

Socket.IO comparte el servidor HTTP y exige `auth: { token }` al conectar. El token se valida contra la sesión vigente; el servidor asigna salas por usuario, inmobiliaria y conversación autorizada.

| Evento | Sentido | Uso |
| --- | --- | --- |
| `chat:unirse`, `chat:salir` | Cliente → servidor | Entrar o salir de una conversación; se verifica participación. |
| `chat:mensaje`, `chat:actualizada`, `chat:leida` | Servidor → cliente | Mensajes nuevos, cambios en la lista y estado de lectura. |
| `notificacion:nueva` | Servidor → cliente | Aviso dirigido al usuario. |

El historial y el envío de mensajes de texto usan `/api/chat/:id/mensajes`. El historial devuelve hasta los diez mensajes más recientes. `GET /api/chat` incluye `noLeidos` por conversación y `PATCH /api/chat/:id/leida` la marca como leída. Las notificaciones se guardan para cada destinatario y cada uno conserva su estado de lectura.

## Esquema consolidado y bases existentes

[`db/db.sql`](db/db.sql) contiene la estructura final y los catálogos necesarios para una instalación nueva. Importarlo **solo en una base vacía**. Incluye las tablas de sesiones, visitas, pagos, cobros, documentos, valoraciones, ciudades y notificaciones; las columnas y restricciones vigentes; y los estados comerciales separados por operación. Al crear una inmobiliaria, la API genera sus áreas a partir del catálogo de ciudades.

Para actualizar una instalación en uso, hacer una copia de seguridad, comparar su estructura y datos con `db/db.sql` y preparar un cambio específico para esa base. La migración de mensajes no leídos agrega el índice `idx_Mensajes_2` a la tabla `mensajes` en bases que aún no lo tienen. El esquema consolidado ya incluye ese índice. [Ver la migración](db/migrations/20261118_mensajes_no_leidos.sql).

`pagos.periodo` representa el primer día del mes facturado y los conceptos con `conceptosPago.idInmobiliaria = NULL` son globales.

## Pruebas y resolución de problemas

```powershell
npm test
```

Las pruebas en `test/` usan `node --test` y cubren, entre otros, autenticación, errores, permisos, adjuntos, chat, reportes y relaciones al borrar entidades. Simulan SQL y no modifican una base MySQL existente. La importación del esquema se debe validar además sobre una base de desarrollo vacía.

| Problema | Revisión sugerida |
| --- | --- |
| Falta una variable al arrancar | Completar las variables obligatorias de `.env`. |
| `401` en una ruta protegida | Enviar `Authorization: Bearer <token>` y comprobar activación, vigencia y revocación de la sesión. |
| `403` | Comprobar rol y pertenencia a la inmobiliaria correspondiente. |
| `409` al eliminar una entidad | Revisar relaciones activas; la respuesta puede indicar si hay propiedades, contratos, visitas u otros datos asociados. |
| La landing recibe error de CORS | Igualar `FRONT_URL` con el origen exacto del frontend. |
| Fallan consultas SQL tras actualizar código | Comparar la estructura de esa base con `db/db.sql`. |
| Falta una imagen o un PDF después de restaurar | Restaurar `uploads/` y `storage/documentos/` junto con MySQL. |

La configuración, rutas y comportamiento vigentes están en los archivos del proyecto. La guía de instalación y uso de la interfaz está en el [README del frontend](../real-estate-manager-front/README.md).
