# Módulo de inquilinos

Este módulo es el ejemplo para replicar la organización en los demás módulos de `api`.

## Flujo de una petición

```text
router -> controller -> service -> base de datos
```

- `inquilinos.router.js`: declara endpoints y permisos.
- `inquilinos.controller.js`: trabaja con `req`, `res` y `next`.
- `inquilinos.service.js`: contiene reglas de negocio, validaciones de contexto, hash de contraseñas y acceso SQL.
- `inquilinos.validation.js`: valida y normaliza los datos de entrada.

## Modelo de datos usado

El esquema histórico del proyecto no tiene una tabla `Inquilinos` independiente. Un inquilino se representa con:

1. Un registro en `Personas`.
2. Un registro relacionado en `Usuarios` con `id_rol = 5` (`INQUILINO`).

Por eso el alta, la modificación y la baja usan una transacción para mantener ambas tablas sincronizadas.

## Endpoints

Todos requieren autenticación y rol `ADMIN` o `AGENTE`.

```text
GET    /api/inquilinos?page=1&limit=20&q=juan
GET    /api/inquilinos/:id
POST   /api/inquilinos
PUT    /api/inquilinos/:id
DELETE /api/inquilinos/:id
```

Ejemplo de `POST`:

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "correo": "ana@example.com",
  "dni": "30111222",
  "telefono": "1155555555",
  "direccion": "Av. Siempre Viva 123",
  "usuario": "ana.perez",
  "password": "una-clave-segura"
}
```

`idInmobiliaria` no se recibe desde el cliente: se toma de `req.usuario.idInmobi`, que viene en el token. Así un administrador o agente no puede consultar ni modificar inquilinos de otra inmobiliaria.

Al crear un inquilino, la cuenta queda en estado `PENDIENTE_ACTIVACION`. La respuesta incluye un código de activación y su fecha de vencimiento:

```json
{
  "activacion": {
    "codigo": "...",
    "enlace": "http://localhost:5173/activar?codigo=...",
    "expiraEn": "2026-11-03T00:00:00.000Z"
  }
}
```

El código se genera de forma aleatoria y en la base de datos solo se guarda su hash.

El usuario debe activar la cuenta mediante:

```text
POST /api/auth/activar/:codigo
```

También está disponible la ruta equivalente `POST /api/auth/invitacion/:codigo`. El cuerpo debe incluir una contraseña nueva de al menos 8 caracteres. El código vence por defecto en 24 horas y solo puede utilizarse una vez. Luego de activar la cuenta, el login se realiza con:

```text
POST /api/auth/login
```

```json
{
  "usuario": "ana.perez",
  "password": "una-clave-segura"
}
```
