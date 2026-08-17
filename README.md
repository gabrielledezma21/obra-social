# 🏥 Obra Social - Backend

![Status](https://img.shields.io/badge/status-development-yellow) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Obra Social** es la API RESTful encargada de la gestión integral de una plataforma médica moderna. Administra afiliados, prestadores médicos, especialidades y el ciclo completo de agendas de turnos, asegurando la integridad de los datos y la coherencia del negocio.

---

## 🚀 Funcionalidades principales

- **Gestión de afiliados**:
  - Generación automática de números de afiliado.
  - Gestión de titulares y grupos familiares.
  - Planes y vigencias.
  - Situaciones terapéuticas.
- **Prestadores y centros médicos**:
  - Especialidades.
  - Centros de atención, direcciones y horarios.
  - Vinculación de profesionales con centros médicos.
- **Agendas y turnos**:
  - Validación de horarios.
  - Prevención de agendas duplicadas.
  - Disponibilidad, reserva y cancelación.
- **Portales por rol**:
  - Administración.
  - Afiliados.
  - Prestadores.
- **Solicitudes**:
  - Recetas, reintegros y autorizaciones.
  - Estados `Recibido`, `En análisis`, `Observado`, `Aprobado` y `Rechazado`.
- **Historia clínica**:
  - Notas por atención.
  - Situaciones terapéuticas activas y finalizadas.
- **Autenticación y permisos**:
  - Roles `ADMIN`, `AFILIADO` y `PRESTADOR`.
  - Activación mediante DNI + email.
  - Cambio obligatorio de contraseña en el primer ingreso.
- **Reportes administrativos**.
- **Swagger UI** para documentación de API.

---

## 🛠 Tecnologías

- Node.js 20+
- Express
- MongoDB + Mongoose
- Redis opcional para caché
- Swagger
- `node:test` para pruebas automatizadas
- GitHub Actions para integración continua

---

## 📋 Prerrequisitos

- Node.js 20 o superior.
- MongoDB local o MongoDB Atlas.
- Redis es opcional.

---

## ⚙ Instalación y configuración

```bash
git clone https://github.com/gabrielledezma21/obra-social.git
cd obra-social
npm install
```

Copiá `.env.example` como `.env` y configurá el entorno:

```env
PORT=3002
MONGO_URI=mongodb://127.0.0.1:27017/medintegral
REDIS_URL=redis://127.0.0.1:6379
SECRETO_AUTENTICACION=definir-en-el-entorno
CORS_ORIGIN=http://localhost:5173
```

`REDIS_URL` es opcional. Si no está definida, la API sigue funcionando sin caché.

Para iniciar el servidor:

```bash
npm run dev
```

---

## 💾 Base de datos y seed

El proyecto incluye una seed completa para levantar un entorno demostrativo interconectado.

> ⚠️ **Importante:** `npm run db` elimina y reconstruye los datos de la base indicada en `MONGO_URI`. Usalo únicamente sobre una base local o de demostración que puedas reiniciar.

```bash
npm run db
```

La seed genera:

- 6 especialidades médicas.
- 5 situaciones terapéuticas.
- 5 centros de atención.
- 8 prestadores, incluyendo 2 centros médicos.
- 7 agendas.
- 10 afiliados organizados en 4 grupos familiares.
- Solicitudes en todos los estados principales.
- Turnos reservados, atendidos y cancelados.
- Historia clínica y situaciones terapéuticas.
- Cuentas demo para los tres roles.

### Cuentas demo

| Rol | Usuario | Contraseña |
|---|---|---|
| Administración | `admin@medintegral.com` | `Admin1234` |
| Afiliado | `10000001` o `homero@simpson.com` | `Demo1234` |
| Prestador | `12345678` o `house@medical.com` | `Demo1234` |

### Ejemplos para probar activación

- **Afiliado:** Lucía Fernández — DNI `20000001` — `lucia@demo.com`.
- **Prestador:** Dra. Meredith Grey — DNI `23456789` — `grey@medical.com`.

Al activar una cuenta, el DNI se utiliza como contraseña temporal y debe cambiarse antes de acceder al portal.

---

## 🧪 Pruebas automatizadas

La suite utiliza una base MongoDB **exclusiva de pruebas** y nunca debe apuntar a desarrollo o producción.

Definí en `.env` o en la terminal:

```env
MONGO_URI_TEST=mongodb://127.0.0.1:27017/medintegral_test
SECRETO_AUTENTICACION_TEST=secreto-solo-para-pruebas
```

Por seguridad, el nombre de la base configurada en `MONGO_URI_TEST` debe contener `test` o `prueba`. Si no se cumple, la suite se detiene antes de modificar MongoDB.

Ejecutar todo:

```bash
npm test
```

La suite actual comprueba:

- salud de la API;
- login correcto e incorrecto;
- permisos de `ADMIN`, `AFILIADO` y `PRESTADOR`;
- activación y cambio obligatorio de contraseña;
- todos los GET administrativos principales;
- reportes;
- creación, consulta, edición y eliminación de afiliados;
- persistencia de integrantes del grupo familiar;
- creación, consulta y edición de prestadores;
- creación, consulta y edición de agendas;
- disponibilidad, reserva, doble reserva y cancelación de turnos;
- creación, edición y flujo de estados de solicitudes;
- historia clínica;
- situaciones terapéuticas;
- integridad referencial final;
- consistencia de la seed;
- listados vacíos con respuesta `200 []`;
- protección contra borrado de afiliados, prestadores y agendas con historial;
- limpieza de centros, direcciones y horarios sin referencias;
- preservación de centros compartidos;
- validación de referencias inexistentes;
- ocultamiento de contraseñas y tokens en los logs.

### Integración continua

`.github/workflows/pruebas-backend.yml` levanta MongoDB 7 de forma aislada en GitHub Actions y ejecuta automáticamente:

```bash
npm ci
npm test
```

La base utilizada por CI es `medintegral_test` y se destruye al finalizar el job.

---

## 📚 Documentación API

Generar o actualizar Swagger:

```bash
npm run gendoc
```

Con el servidor iniciado, la documentación está disponible en:

```text
http://localhost:3002/doc
```

---

## ☁️ Despliegue en Vercel

El proyecto incluye una entrada serverless en `api/index.js` y conserva `src/server.js` para desarrollo local.

1. Importá el repositorio en Vercel.
2. Configurá `MONGO_URI` o `MONGODB_URI`.
3. Opcionalmente configurá `REDIS_URL`.
4. Configurá `SECRETO_AUTENTICACION`.
5. Configurá `CORS_ORIGIN` con los orígenes permitidos separados por comas.
6. Comprobá `/health` y `/doc` luego del despliegue.

La seed nunca se ejecuta automáticamente durante el build de producción salvo que se configure explícitamente ese comportamiento.

---

## 👥 Autor

**Obra Social** es desarrollado por [Gabriel Ledezma](https://github.com/gabrielledezma21).
