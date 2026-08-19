# Autogestión segura de turnos

Cada turno nuevo recibe dos credenciales:

- un código legible con formato `MED-XXXXXX`;
- una clave de gestión aleatoria de alta entropía.

La clave se devuelve únicamente al crear o regenerar las credenciales. En la base de datos se persiste solo su hash SHA-256.

## Operaciones públicas

Las rutas bajo `/autogestion-turnos` no requieren iniciar sesión, pero exigen código y clave válidos en cada petición:

- `POST /consultar`: muestra los datos del turno;
- `POST /disponibilidad`: devuelve horarios alternativos de la misma agenda;
- `POST /reagendar`: cambia fecha y hora;
- `POST /cancelar`: cancela el turno.

Cancelar y reagendar requieren al menos 24 horas de anticipación. Los errores de credenciales son deliberadamente genéricos para no revelar si un código existe.

## Portal del afiliado

Los turnos creados desde el portal reciben automáticamente las credenciales. El afiliado autenticado conserva además sus operaciones habituales y dispone de un endpoint protegido para reagendar.

## Administración

Las rutas protegidas bajo `/turnos` permiten listar y consultar turnos, cancelar, reagendar y regenerar credenciales. Al regenerar una clave, la anterior deja de ser válida inmediatamente.

## Historial

El turno conserva un historial de creación, reagendado, cancelación y atención. La respuesta pública omite los identificadores internos de los actores.
