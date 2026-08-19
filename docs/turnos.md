# Turnos profesionales

## Objetivo

El módulo de turnos utiliza una única lógica de negocio para reservar, cancelar y reagendar. La misma lógica podrá ser reutilizada por el portal del afiliado, Administración y los enlaces públicos enviados por correo.

## Identificadores

Cada turno nuevo posee dos identificadores diferentes:

- `codigoReserva`: identificador público y legible, por ejemplo `MED-8F4K2P`.
- `tokenGestion`: secreto aleatorio utilizado para autorizar la autogestión sin iniciar sesión.

El token en texto plano se entrega únicamente al crear la reserva y se envía por correo. MongoDB guarda solamente `tokenGestionHash`, calculado con SHA-256. La verificación usa una comparación de tiempo constante.

Los turnos creados antes de esta implementación pueden no tener todavía código y token. No se habilita autogestión pública para ellos hasta que se migren o regeneren sus credenciales.

## Enlace seguro

El correo dirige al frontend con un enlace de este estilo:

```text
/turnos/gestionar?codigo=MED-8F4K2P#token=<token>&accion=ver
```

El token se coloca en el fragmento (`#`) para evitar que forme parte de la query enviada automáticamente al servidor web. El frontend deberá leerlo y enviarlo al backend dentro del cuerpo de las peticiones POST.

## API pública

Base: `/publico/turnos`

### Consultar

`POST /consultar`

```json
{
  "codigoReserva": "MED-8F4K2P",
  "tokenGestion": "token-seguro"
}
```

La respuesta no expone `_id`, DNI, número de afiliado, email ni el hash del token.

### Buscar horarios para reagendar

`POST /disponibilidad`

Recibe las mismas credenciales y devuelve horarios disponibles de la misma agenda. Se conserva de esta manera el prestador, la especialidad y el centro del turno original.

### Reagendar

`POST /reagendar`

```json
{
  "codigoReserva": "MED-8F4K2P",
  "tokenGestion": "token-seguro",
  "fecha": "2026-08-26",
  "hora": "15:30"
}
```

El backend vuelve a validar la agenda y la disponibilidad antes de guardar el cambio.

### Cancelar

`POST /cancelar`

```json
{
  "codigoReserva": "MED-8F4K2P",
  "tokenGestion": "token-seguro"
}
```

Nunca se modifica el estado de un turno mediante un `GET`.

## Reglas

- Solo se pueden cancelar o reagendar turnos en estado `RESERVADO`.
- La autogestión requiere al menos 24 horas de anticipación.
- Un reagendamiento modifica el mismo turno; no crea una reserva nueva ni borra el historial anterior.
- La disponibilidad se valida nuevamente en el backend inmediatamente antes de guardar.
- El índice único de agenda + fecha + hora para turnos reservados continúa siendo la última defensa frente a reservas simultáneas.
- Los endpoints públicos aplican un límite básico de intentos por IP. Para una instalación distribuida se recomienda mover este límite a Redis o a la infraestructura perimetral.

## Historial

El turno conserva eventos embebidos con estas acciones:

- `CREADO`
- `REAGENDADO`
- `CANCELADO`
- `ATENDIDO`
- `CREDENCIALES_REGENERADAS`

Cada evento registra fecha y tipo de actor (`AFILIADO`, `ADMIN`, `PRESTADOR`, `PUBLICO` o `SISTEMA`). Los reagendamientos guardan además la fecha/hora anterior y la nueva.

Este historial pertenece al turno. Una colección de auditoría transversal para cambios de afiliados, agendas, prestadores y otros dominios se agregará en una etapa posterior.

## Correos

El servicio de correo está desacoplado de la lógica de turnos. Actualmente puede utilizar Resend mediante estas variables:

```env
URL_FRONTEND=https://tu-frontend.vercel.app
RESEND_API_KEY=re_xxxxxxxxx
CORREO_DESDE=MedIntegral <turnos@tu-dominio.com>
```

Si el proveedor no está configurado o el envío falla, la reserva no se revierte: la API devuelve el estado de la notificación para permitir reintentos o diagnóstico posterior.

Se contemplan correos de:

- confirmación de reserva;
- confirmación de reagendamiento;
- confirmación de cancelación.

Los recordatorios automáticos de 24 h y 2 h forman parte de una etapa posterior.
