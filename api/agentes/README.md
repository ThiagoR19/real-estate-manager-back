# Módulo de agentes

Los agentes se almacenan en `Personas`, `Usuarios` con `id_rol = 3` y `Agentes`. El campo `idArea` es opcional.

Los administradores trabajan únicamente dentro de la inmobiliaria asociada a su sesión. El `SUPERADMIN` puede consultar todas las inmobiliarias y debe indicar `idInmobiliaria` al crear un agente.

```text
GET    /api/agentes?page=1&limit=20&q=ana
GET    /api/agentes/:id
POST   /api/agentes
PUT    /api/agentes/:id
PATCH  /api/agentes/:id/:rol    (solo SUPERADMIN; rol ADMIN o AGENTE)
DELETE /api/agentes/:id
```

Ejemplo para un `ADMIN`:

```json
{
  "nombre": "Carlos",
  "apellido": "Gómez",
  "correo": "carlos.agente@example.com",
  "dni": "30999888",
  "telefono": "1166666666",
  "direccion": "Calle 123",
  "idArea": 2,
  "usuario": "carlos.agente",
  "password": "ClaveTemporal123"
}
```

Ejemplo adicional para un `SUPERADMIN`:

```json
{
  "idInmobiliaria": 1,
  "nombre": "Carlos",
  "apellido": "Gómez",
  "correo": "carlos.agente@example.com",
  "dni": "30999888",
  "idArea": 2,
  "usuario": "carlos.agente",
  "password": "ClaveTemporal123"
}
```

Las altas generan un código de activación en `data.activacion.codigo`. La baja es física y elimina el agente, su persona, su cuenta y sus tokens de acceso.
