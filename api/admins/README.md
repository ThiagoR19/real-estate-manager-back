# Módulo de administradores

Los administradores no tienen una tabla propia: se almacenan en `Usuarios` con `id_rol = 2` y se relacionan con `Personas`.

Todos los endpoints requieren una sesión con rol `SUPERADMIN`.

```text
GET    /api/admins?page=1&limit=20&q=ana
POST   /api/admins
DELETE /api/admins/:id
```

Para crear un administrador:

```json
{
  "idInmobiliaria": 1,
  "nombre": "Ana",
  "apellido": "Pérez",
  "correo": "ana.admin@example.com",
  "dni": "30111222",
  "telefono": "1155555555",
  "direccion": "Av. Siempre Viva 123",
  "usuario": "ana.admin",
  "password": "ClaveTemporal123"
}
```

La cuenta se crea como `PENDIENTE_ACTIVACION`. El código de activación se devuelve en `data.activacion.codigo` y se activa mediante `POST /api/auth/activar/:codigo`.

La eliminación es física: elimina el token de activación, la cuenta y la persona.
