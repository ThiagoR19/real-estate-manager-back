# Backend · Gestor inmobiliario AGI

API REST y servidor Socket.IO del gestor inmobiliario. Maneja autenticación, permisos por rol e inmobiliaria, datos en MySQL, documentos e imágenes locales, chat y notificaciones en tiempo real.

## Contenido

- [Tecnologías y estructura](#tecnologías-y-estructura)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Primer acceso y roles](#primer-acceso-y-roles)
- [Activación y autenticación](#activación-y-autenticación)
- [Rutas de la API](#rutas-de-la-api)
- [Archivos y descargas](#archivos-y-descargas)
- [Tiempo real](#tiempo-real)
- [Bases existentes y migraciones](#bases-existentes-y-migraciones)
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
db/migrations/            Migraciones manuales para bases existentes
middlewares/             Sesión, roles, CORS y carga de archivos
sockets/                  Autenticación y eventos de tiempo real
uploads/                  Imágenes servidas públicamente, excepto chats
storage/documentos/       PDF descargados mediante rutas autenticadas
test/                     Pruebas con `node --test`
```

## Instalación local

Se necesitan Node.js/npm y una instancia MySQL compatible con el esquema (`JSON`, columnas generadas y `CHECK`; se recomienda MySQL 8). Para mantener la misma versión de Node en ambos proyectos, usar una versión aceptada por Vite 8: `^20.19.0` o `>=22.12.0`. Los comandos se ejecutan desde `real-estate-manager-back/`.

1. Crear una base vacía e importar [`db/db.sql`](db/db.sql). El archivo **no** contiene `CREATE DATABASE` ni `USE`.
2. Copiar [`.env.example`](.env.example) a `.env` y completar la conexión, el secreto JWT, el puerto y la URL del frontend.
3. Instalar dependencias y levantar el servidor.

```powershell
mysql -u root -p -e "CREATE DATABASE real_estate_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p real_estate_manager -e "source db/db.sql"
Copy-Item .env.example .env
npm ci
npm run dev
```

También se puede importar el SQL desde un cliente gráfico de MySQL. Para desarrollo, la API queda en `http://localhost:3000/api`. `npm run dev` usa `node --watch server.js`; el proyecto no define un script `start` ni ejecuta migraciones al arrancar.

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

### Sesiones y respuestas

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

Las respuestas exitosas usan `{ "status": "success", "data": ... }`, a veces con `paginacion`. Los errores usan `status: "fail"` para errores de cliente o `"error"` para errores del servidor y contienen `error.codigo` y `error.mensaje`. La validación puede agregar `error.detalles`. Códigos HTTP habituales: `400` datos inválidos, `401` sesión/credenciales, `403` permisos, `404` recurso inexistente, `409` conflicto, `413` tamaño, `415` formato y `500` error interno. No se exponen detalles internos de SQL en la respuesta.

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

La historia y el envío del chat también usan `/api/chat`; los mensajes aceptan texto. El historial devuelve inicialmente los diez mensajes más recientes. Las notificaciones se guardan para cada destinatario y cada uno conserva su estado de lectura.

## Bases existentes y migraciones

`db/db.sql` es para una **instalación nueva**. No ejecutarlo encima de una base en uso como sustituto de las migraciones: muchas tablas usan `CREATE TABLE IF NOT EXISTS`, que no actualiza columnas existentes. El proyecto no lleva un registro automático de migraciones. Antes de actualizar una base, hacer copia de seguridad y aplicar **solo los archivos pendientes**, en orden cronológico y respetando las dependencias. Algunas migraciones modifican datos o eliminan estructuras; revisar su SQL antes de ejecutarlas.

| Archivo en `db/migrations/` | Finalidad |
| --- | --- |
| `20261109_archivos.sql` | Foto de perfil y soporte de adjuntos. |
| `20261109_contratos_condiciones.sql` | Condiciones, aumentos y rescisión de contratos. |
| `20261109_sesiones_revocadas.sql` | Revocación al cerrar sesión. |
| `20261109_tipos_propiedades.sql` | Catálogo inicial de tipos de inmueble. |
| `20261110_cont_visitas.sql` | Contador de visitas a la landing. |
| `20261110_documentos_archivo_visibilidad.sql` | Visibilidad y archivo de documentos. |
| `20261110_pagos_cobros.sql` | Períodos, conceptos y restricciones de pagos/cobros. |
| `20261111_registro_dni.sql` | Intentos de DNI en invitaciones. |
| `20261112_areas_ciudades_buenos_aires.sql` | Localidades y limpieza de zonas anteriores de agentes. |
| `20261112_invitaciones_dni.sql` | Datos personales opcionales durante el alta. |
| `20261112_sin_asignar.sql` | Cambios de asignación de agentes; incluye eliminación de `tareas`. |
| `20261113_cobros_conceptos.sql` | Conceptos y comprobantes de cobros. |
| `20261114_inmobiliaria_imagenes.sql` | Banner e imagen principal de inmobiliaria. |
| `20261115_chat_lectura.sql` | Lectura individual de mensajes. |
| `20261115_propiedades_operacion.sql` | Operación de venta o alquiler. |
| `20261115_usuario_por_inmobiliaria.sql` | Usuario único por inmobiliaria, no global. |
| `20261117_categorias_reportes.sql` | Categorías de mantenimiento. |
| `20261117_inquilinos_propiedad.sql` | Propiedad asignada a un inquilino. |
| `20261117_notificaciones_automaticas.sql` | Avisos generados por operaciones. |
| `20261117_propiedades_formulario.sql` | Datos de contrato del formulario y servicios. |
| `20261117_votos_profesionales.sql` | Voto de agente por profesional. |
| `20261118_propiedades_estado_contratos.sql` | Sincronización del estado comercial con contratos previos. |
| `20261118_propiedades_disponibilidad.sql` | Separa Disponible Venta y Disponible Alquiler, y sincroniza la operación de las propiedades existentes. |
| `20261118_reportes_imagen.sql` | Imagen por defecto para reportes antiguos sin foto. |
| `20261118_ciudades_catalogo.sql` | Crea y carga el catálogo de ciudades y vincula las áreas existentes sin cambiar sus IDs. |
| `20261118_eliminar_superadmins_notificaciones.sql` | Elimina los avisos exclusivos de superadministradores y su tabla de vínculo. |

Aplicar `20261118_propiedades_disponibilidad.sql` antes de iniciar la API actualizada. Requiere `20261115_propiedades_operacion.sql`; conserva la operación de las propiedades con estado Disponible y las pasa a Disponible Venta o Disponible Alquiler.

En particular, aplicar `20261111_registro_dni.sql` **antes** de `20261112_invitaciones_dni.sql`. La migración `20261110_pagos_cobros.sql` comprueba que no haya dos pagos del mismo contrato con vencimiento en el mismo mes ni dos cobros del mismo pago para un propietario. Si encuentra duplicados, se detiene antes de sus cambios permanentes. Para localizarlos:

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

`pagos.periodo` representa el primer día del mes facturado. Para datos históricos, la migración lo deduce de `fechaVencimiento`; revisar los casos en que el vencimiento cae en otro mes. Los conceptos con `conceptosPago.idInmobiliaria = NULL` son globales; `pagosConceptos.conceptoTenantClave` vale `0` para ellos o el ID de la inmobiliaria para conceptos propios.

`20261112_areas_ciudades_buenos_aires.sql` deja sin zona a agentes asignados a categorías que no son localidades; reasignarlas después desde Agentes. Para `20261118_reportes_imagen.sql` se debe conservar `uploads/reportes/8414853068_a71ec481ef_b.jpg` en el servidor; esa migración evita duplicar imágenes si se ejecuta de nuevo. Las demás migraciones **no** deben presumirse idempotentes.

Aplicar `20261118_ciudades_catalogo.sql` después de `20261112_areas_ciudades_buenos_aires.sql` y antes de iniciar la API actualizada. Conserva `areas.id` y las asignaciones de `agentes.idArea`. Si quedan áreas cuyo nombre no corresponde al catálogo, la migración se detiene antes de quitar `areas.nombre`.

## Pruebas y resolución de problemas

```powershell
npm test
```

Las pruebas en `test/` usan `node --test` y cubren, entre otros, autenticación, errores, permisos, adjuntos, chat, reportes y relaciones al borrar entidades. Simulan SQL y no modifican una base MySQL existente. La importación y las migraciones se deben validar además sobre una base de desarrollo.

| Problema | Revisión sugerida |
| --- | --- |
| Falta una variable al arrancar | Completar las variables obligatorias de `.env`. |
| `401` en una ruta protegida | Enviar `Authorization: Bearer <token>` y comprobar activación, vigencia y revocación de la sesión. |
| `403` | Comprobar rol y pertenencia a la inmobiliaria correspondiente. |
| `409` al eliminar una entidad | Revisar relaciones activas; la respuesta puede indicar si hay propiedades, contratos, visitas u otros datos asociados. |
| La landing recibe error de CORS | Igualar `FRONT_URL` con el origen exacto del frontend. |
| Fallan consultas SQL tras actualizar código | Revisar qué migraciones faltan en esa base. |
| Falta una imagen o un PDF después de restaurar | Restaurar `uploads/` y `storage/documentos/` junto con MySQL. |

La configuración, rutas y comportamiento vigentes están en los archivos del proyecto. La guía de instalación y uso de la interfaz está en el [README del frontend](../real-estate-manager-front/README.md).
