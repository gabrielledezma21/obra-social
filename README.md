# MedIntegral - Backend

API REST de **MedIntegral**, una plataforma para la gestión administrativa y asistencial de una obra social. El backend concentra autenticación por roles, afiliados y grupos familiares, prestadores, centros médicos, agendas, turnos, solicitudes, historia clínica, situaciones terapéuticas y reportes.

## Estado del proyecto

El proyecto se encuentra en etapa de integración y validación. La rama de trabajo incluye pruebas automáticas de integración, persistencia, seguridad e integridad referencial ejecutadas también mediante GitHub Actions.

## Tecnologías

- Node.js 20+
- Express 5
- MongoDB + Mongoose
- Redis opcional para caché
- Swagger / OpenAPI
- `node:test`
- GitHub Actions

## Módulos principales

### Administración

Las rutas administrativas requieren un usuario con rol `ADMIN` y contraseña actualizada.

- Gestión de afiliados y grupos familiares.
- Alta, edición, baja y reincorporación.
- Planes, vigencias, domicilios, teléfonos y emails.
- Gestión de prestadores profesionales y centros médicos.
- Especialidades, centros de atención y horarios.
- Gestión de agendas.
- Reportes administrativos.
- Protección de relaciones e historial antes de eliminar datos.

Rutas principales:

```text
/afiliados
/prestadores
/especialidades
/agendas
/situaciones-terapeuticas
/reportes
```

### Portal del afiliado

Las rutas bajo `/portal-afiliado` requieren rol `AFILIADO`.

Incluyen:

- Perfil y grupo familiar.
- Cartilla médica.
- Solicitudes de receta, autorización y reintegro.
- Respuesta a solicitudes observadas.
- Consulta de turnos próximos y anteriores.
- Búsqueda de disponibilidad.
- Reserva y cancelación de turnos.

La disponibilidad puede filtrarse por:

- profesional;
- especialidad;
- localidad;
- día de la semana;
- franja horaria.

Si no se indica un día específico, la API devuelve los próximos espacios libres dentro del horizonte configurado por la aplicación.

El cálculo de turnos considera **fecha + hora de Argentina**, evitando clasificar como próximo un turno cuya hora ya pasó durante el día actual.

### Portal del prestador

Las rutas bajo `/portal-prestador` requieren rol `PRESTADOR`.

Incluyen:

- Perfil profesional.
- Bandeja de solicitudes.
- Gestión de estados de solicitudes.
- Turnos.
- Registro de notas clínicas.
- Historia clínica.
- Situaciones terapéuticas.
- Búsqueda clínica de afiliados.

El buscador clínico permite localizar pacientes por:

- nombre;
- apellido;
- DNI;
- número de afiliado o credencial;
- teléfono.

### Autenticación y autorización

MedIntegral utiliza roles:

```text
ADMIN
AFILIADO
PRESTADOR
```

El flujo contempla:

- inicio de sesión;
- activación de cuenta mediante DNI + email;
- contraseña temporal;
- cambio obligatorio de contraseña antes de acceder al portal;
- autorización por rol;
- tokens firmados con un secreto privado.

`SECRETO_AUTENTICACION` es obligatorio en producción. La aplicación no utiliza un secreto de desarrollo como respaldo cuando `NODE_ENV=production`.

## Integridad de datos

El backend incluye validaciones destinadas a evitar datos huérfanos o inconsistentes. Entre otras reglas:

- no se elimina una agenda con turnos asociados;
- no se elimina físicamente un afiliado con historial operativo o clínico;
- no se elimina físicamente un prestador con historial;
- no se puede quitar a un prestador una especialidad utilizada por una agenda;
- no se puede desactivar un centro médico mientras tenga profesionales asociados;
- las referencias a especialidades y situaciones terapéuticas deben existir;
- las operaciones con varias escrituras realizan limpieza o rollback cuando una etapa falla;
- los recursos compartidos se conservan mientras continúen referenciados.

## Instalación

```bash
git clone https://github.com/gabrielledezma21/obra-social.git
cd obra-social
npm install
```

Copiá `.env.example` como `.env` y configurá tus variables.

Ejemplo de desarrollo local:

```env
PORT=3002
MONGO_URI=mongodb://127.0.0.1:27017/medintegral
SECRETO_AUTENTICACION=definir-un-secreto-privado
CORS_ORIGIN=http://localhost:5173
```

Redis es opcional:

```env
REDIS_URL=redis://127.0.0.1:6379
```

Si `REDIS_URL` no está definida, la API continúa funcionando sin caché.

### MongoDB con autenticación

Si el servidor MongoDB requiere usuario y contraseña, la URI debe incluir también el `authSource` correspondiente. Ejemplo:

```env
MONGO_URI=mongodb://USUARIO:CLAVE@127.0.0.1:27017/medintegral?authSource=admin
```

No guardes credenciales reales en el repositorio.

## Ejecución local

Desarrollo con recarga automática:

```bash
npm run dev
```

Ejecución normal:

```bash
npm start
```

Por defecto la API se utiliza en:

```text
http://localhost:3002
```

Endpoints públicos de comprobación:

```text
GET /
GET /health
GET /doc
```

## Base de datos y seed de demostración

El proyecto incluye una seed interconectada para probar los tres roles y los principales flujos funcionales.

> **Advertencia:** `npm run db` elimina y reconstruye los datos de la base indicada por `MONGO_URI`. No lo ejecutes sobre una base que contenga información que necesites conservar.

```bash
npm run db
```

La seed genera, entre otros datos:

- especialidades;
- situaciones terapéuticas;
- prestadores y centros médicos;
- agendas;
- afiliados organizados en grupos familiares;
- solicitudes en distintos estados;
- turnos reservados, atendidos y cancelados;
- notas de historia clínica;
- situaciones terapéuticas de afiliados;
- usuarios demo para los tres roles.

### Usuarios demo

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administración | `admin@medintegral.com` | `Admin1234` |
| Afiliado | `10000001` o `homero@simpson.com` | `Demo1234` |
| Prestador | `12345678` o `house@medical.com` | `Demo1234` |

Para probar la activación existen además usuarios sin cuenta activa dentro de la seed.

## Pruebas automatizadas

La suite utiliza una base MongoDB **exclusiva para pruebas**.

En `.env`:

```env
MONGO_URI_TEST=mongodb://127.0.0.1:27017/medintegral_test
SECRETO_AUTENTICACION_TEST=secreto-solo-para-pruebas
```

Si MongoDB requiere autenticación:

```env
MONGO_URI_TEST=mongodb://USUARIO:CLAVE@127.0.0.1:27017/medintegral_test?authSource=admin
```

El nombre de la base debe contener `test` o `prueba`. El precheck se detiene antes de ejecutar la suite si la URI no apunta a una base identificada como de pruebas o si MongoDB no permite las operaciones necesarias.

Ejecutar:

```bash
npm test
```

El runner carga automáticamente `.env`, valida MongoDB y ejecuta los archivos `tests/*.test.js` de forma secuencial.

Durante `npm test` los logs internos se silencian para que el resultado sea legible. Para habilitarlos temporalmente:

```bash
LOG_PRUEBAS=true npm test
```

En PowerShell:

```powershell
$env:LOG_PRUEBAS="true"
npm test
Remove-Item Env:LOG_PRUEBAS -ErrorAction SilentlyContinue
```

### Cobertura funcional de la suite

Las pruebas cubren, entre otros escenarios:

- salud de la API;
- autenticación y autorización por rol;
- activación y cambio obligatorio de contraseña;
- tokens alterados, vencidos y secreto obligatorio en producción;
- GET administrativos principales y listados vacíos;
- reportes;
- creación, consulta, edición y persistencia de afiliados;
- grupos familiares, baja y reincorporación;
- creación, consulta y edición de prestadores;
- creación, consulta y edición de agendas;
- integridad de especialidades, centros médicos y referencias;
- disponibilidad de turnos por profesional, especialidad, localidad, día y horario;
- reserva, doble reserva y cancelación;
- clasificación temporal de turnos;
- solicitudes y flujo `Observado -> respuesta del afiliado -> resolución`;
- historia clínica y notas de atención;
- situaciones terapéuticas;
- búsqueda clínica de afiliados;
- rollback de operaciones fallidas;
- limpieza de recursos exclusivos y preservación de recursos compartidos;
- ocultamiento de contraseñas y tokens en logs.

## Integración continua

El workflow `.github/workflows/pruebas-backend.yml` ejecuta sobre un MongoDB 7 aislado:

```bash
npm ci
npm audit --audit-level=high
npm test
```

La CI falla si aparece una vulnerabilidad alta o si cualquier prueba de integración falla.

## Swagger

Para regenerar la documentación:

```bash
npm run gendoc
```

Con el servidor iniciado:

```text
http://localhost:3002/doc
```

## CORS

`CORS_ORIGIN` acepta una lista separada por comas:

```env
CORS_ORIGIN=http://localhost:5173,https://tu-frontend.example.com
```

Si la variable queda vacía, el servidor admite cualquier origen sin credenciales. En producción se recomienda definir explícitamente los orígenes permitidos.

## Despliegue

El repositorio incluye `api/index.js` como entrada serverless y `src/server.js` para ejecución local.

Para desplegar el backend deben configurarse al menos:

```text
MONGO_URI o MONGODB_URI
SECRETO_AUTENTICACION
CORS_ORIGIN
```

`REDIS_URL` es opcional.

Después del despliegue conviene verificar:

```text
/health
/doc
```

La seed no debe utilizarse automáticamente sobre una base productiva.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | servidor local con nodemon |
| `npm start` | servidor sin recarga automática |
| `npm test` | precheck de Mongo + suite completa |
| `npm run db` | reconstruye la base configurada |
| `npm run crear-admin` | crea un administrador usando variables de entorno |
| `npm run gendoc` | regenera Swagger |
| `npm run start:doc` | regenera Swagger e inicia la API |

## Seguridad

- No subir `.env` al repositorio.
- Rotar secretos si fueron compartidos accidentalmente.
- Utilizar una base independiente para pruebas.
- No reutilizar credenciales de desarrollo en producción.
- Configurar `SECRETO_AUTENTICACION` con un valor largo y aleatorio.
- Restringir `CORS_ORIGIN` en producción.

## Autor

Desarrollado y mantenido por [Gabriel Ledezma](https://github.com/gabrielledezma21).

Licencia declarada por el proyecto: **ISC**.
