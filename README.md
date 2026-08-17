# 🏥 Obra Social - Backend

![Status](https://img.shields.io/badge/status-development-yellow) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Obra Social** es la API RESTful encargada de la gestión integral de una plataforma médica moderna. Administra afiliados, prestadores médicos, especialidades y el ciclo completo de agendas de turnos, asegurando la integridad de los datos y la coherencia del negocio.

---

## 🚀 Key Features

- **Gestión de Afiliados Inteligente**:
    - Generación automática de números de socio (Titulares vs Familiares).
    - Gestión de grupos familiares jerárquicos.
    - Validación estricta de Planes (`210`, `310`, etc.).
- **Prestadores y Centros Médicos**:
    - Vinculación de profesionales con Centros Médicos (relación `centroMedicoQueIntegra`).
    - Soporte completo para múltiples direcciones y esquemas de horarios complejos.
- **Agendas y Turnos**:
    - Validación robusta de superposición de horarios.
    - Chequeo de especialidades por centro de atención.
- **Portales por rol**:
    - Administración para gestionar afiliados, prestadores, agendas y reportes.
    - Afiliados con cartilla médica, turnos y solicitudes.
    - Prestadores con turnos, solicitudes, pacientes e historia clínica.
- **Autenticación por rol**:
    - Roles `ADMIN`, `AFILIADO` y `PRESTADOR`.
    - Activación de afiliados y prestadores mediante DNI + email previamente cargados en administración.
- **Documentación Viva**: Swagger UI integrado y autogenerado.

---

## 📑 Tabla de Contenidos

1. [Tecnologías](#-tecnologías)
2. [Prerrequisitos](#-prerrequisitos)
3. [Instalación y Configuración](#-instalación-y-configuración)
4. [Base de Datos y Seed](#-base-de-datos-y-seed)
5. [Documentación API (Swagger)](#-documentación-api)
6. [Testing](#-testing)

---

## 🛠 Tecnologías

El proyecto está construido sobre un stack robusto y escalable:

- **Runtime:** Node.js
- **Framework:** Express
- **Base de Datos:** MongoDB (Persistencia), Redis (Caché)
- **ORM:** Mongoose
- **Documentación:** Swagger (swagger-autogen)
- **Testing:** Scripts de integración nativos

---

## 📋 Prerrequisitos

- Node.js 20 o superior.
- MongoDB corriendo localmente o una base MongoDB Atlas.
- Redis opcional para optimización.

---

## ⚙ Instalación y Configuración

1. **Clonar el repositorio**
    ```bash
    git clone https://github.com/gabrielledezma21/obra-social.git
    cd obra-social
    ```

2. **Instalar dependencias**
    ```bash
    npm install
    ```

3. **Configurar Variables de Entorno**
    Copia `.env.example` como `.env` y completa la conexión a MongoDB:
    ```env
    PORT=3002
    MONGO_URI=mongodb://admin:admin123@localhost:27017/obraSocial?authSource=admin
    REDIS_URL=redis://localhost:6379
    SECRETO_AUTENTICACION=definir-en-el-entorno
    CORS_ORIGIN=http://localhost:5173
    ```

    `REDIS_URL` es opcional. Si no se configura, la API funciona sin caché.

4. **Iniciar Servidor**
    ```bash
    npm run dev
    ```

---

## 💾 Base de Datos y Seed

El proyecto incluye una seed completa para levantar un entorno demostrativo interconectado.

> ⚠️ **Importante:** `npm run db` elimina y reconstruye los datos de la base indicada en `MONGO_URI`. Usalo únicamente sobre una base local o de demostración que puedas reiniciar.

```bash
npm run db
```

La seed genera:

- 6 especialidades médicas.
- 5 situaciones terapéuticas.
- 5 centros de atención con direcciones y horarios.
- 8 prestadores, incluyendo 2 centros médicos.
- 7 agendas; algunos prestadores quedan deliberadamente sin agenda para alimentar los recordatorios administrativos.
- 10 afiliados organizados en 4 grupos familiares y distintos planes.
- Solicitudes de receta, reintegro y autorización en los estados `Recibido`, `En análisis`, `Observado`, `Aprobado` y `Rechazado`.
- Turnos `RESERVADO`, `ATENDIDO` y `CANCELADO`.
- Notas de historia clínica y situaciones terapéuticas activas/finalizadas.
- Cuentas demo para los tres roles.

### Cuentas demo

| Rol | Usuario | Contraseña |
|---|---|---|
| Administración | `admin@medintegral.com` | `Admin1234` |
| Afiliado | `10000001` o `homero@simpson.com` | `Demo1234` |
| Prestador | `12345678` o `house@medical.com` | `Demo1234` |

### Ejemplos para probar activación

Estas personas existen administrativamente pero no tienen una cuenta creada por la seed:

- **Afiliado:** Lucía Fernández — DNI `20000001` — `lucia@demo.com`.
- **Prestador:** Dra. Meredith Grey — DNI `23456789` — `grey@medical.com`.

Al activarlas, el sistema utiliza el DNI como contraseña temporal y obliga a cambiarla en el primer ingreso.

---

## 📚 Documentación API

La API cuenta con documentación interactiva generada automáticamente con Swagger.

1. **Generar/Actualizar Documentación**:
    ```bash
    npm run gendoc
    ```
    *Ejecutar siempre después de modificar rutas o definiciones.*

2. **Acceder a la UI**:
    Con el servidor corriendo, visita:
    👉 **http://localhost:3002/doc**

---

## 🧪 Testing

El proyecto cuenta con tests de integración para comprobar el flujo del negocio.

Para correr la verificación existente:

```bash
node test_integration_full.js
```

**Alcance del Test:**
- Reseteo completo de DB.
- Verificación de creación de Entidades (CRUD).
- Validación de **Campos Virtuales** (ej. ver agendas dentro de un prestador).
- Comprobación de integridad referencial.

---

## ☁️ Despliegue en Vercel

El proyecto incluye una entrada serverless en `api/index.js` y conserva `src/server.js` para el desarrollo local.

1. Importa este repositorio en Vercel.
2. Configura `MONGO_URI` o instala MongoDB Atlas para recibir `MONGODB_URI` automáticamente en Development, Preview y Production.
3. Opcionalmente configura `REDIS_URL` para habilitar la caché.
4. Configura `CORS_ORIGIN` con los orígenes permitidos separados por comas.
5. Despliega y comprueba `/health` y `/doc`.

La carga de datos de demostración se ejecuta manualmente con `npm run db` sobre la base seleccionada. No se ejecuta durante el build ni al iniciar cada Function.

---

## 👥 Autor

**Obra Social** es desarrollado por [Gabriel Ledezma](https://github.com/gabrielledezma21).
