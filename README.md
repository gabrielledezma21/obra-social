# 🏥 MedIntegral - Backend

![Status](https://img.shields.io/badge/status-development-yellow) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**MedIntegral** es la API RESTful encargada de la gestión de datos y lógica de negocio para la plataforma médica integral. Este proyecto permite la administración de afiliados, prestadores médicos y sus agendas de turnos. Además se puede generar el reporte de la situacion terapeutica de los afiliados.

> Proyecto desarrollado para la materia **Desarrollo de Aplicaciones** - 2do Cuatrimestre 2025 - **Grupo 3**.

---

## 📑 Tabla de Contenidos

1. [Tecnologías](#-tecnologías)
2. [Prerrequisitos](#-prerrequisitos)
3. [Instalación](#-instalación)
4. [Configuración](#-configuración)
5. [Ejecución](#-ejecución)
6. [API Endpoints](#-api-endpoints)
7. [Autor](#-autor)

---

## 🚀 Tecnologías

El proyecto está construido con el siguiente stack tecnológico:

- **Lenguaje:** Node.js
- **Framework:** Express
- **Base de Datos:** PostgreSQL
- **ORM:** Sequelize
- **Herramientas:** Docker, Joi

---

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado en tu entorno local:

- Node.js
- npm
- Motor de Base de Datos corriendo localmente o Docker instalado.

---

## 🛠 Instalación

Sigue estos pasos para obtener una copia local del proyecto:

1.  **Clonar el repositorio**

    ```bash
    git clone [https://github.com/DesApp-2025c2-Grupo3/MedIntegral-backend.git](https://github.com/DesApp-2025c2-Grupo3/MedIntegral-backend.git)
    cd MedIntegral-backend
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    ```

---

## ⚙ Configuración

1.  Crea un archivo `.env` en la raíz del proyecto (puedes basarte en `.env.example`).
2.  Define las siguientes variables de entorno:

    ```env
    PORT=3002
    DB_USERNAME=postgres
    DB_PASS=12345
    DB_NAME=MedIntegral
    DB_HOST=localhost
    DB_PORT=5432
    DB_DIALECT=postgres
    ```

---

## ▶ Ejecución

### Base de Datos

Antes de iniciar, corre las migraciones y seeders (datos de prueba):

```bash
# Migraciones
npx sequelize-cli db:migrate

# Seeders (Datos iniciales, incluye prestadores, afiliados y agendas de ejemplos)
npx sequelize-cli db:seed:all
```

### Servidor

Para iniciar el servidor en modo desarrollo:

```bash
npm run dev
```

### Docker

Si prefieres usar Docker, asegúrate de tener el daemon corriendo y ejecuta:

```bash
docker-compose up --build
```

---

## 📡 API Endpoints

Algunos de los endpoints disponibles:

- **Obtener todos los afiliados:** `GET /api/afiliados`
- **Crear un nuevo afiliado:** `POST /api/afiliados`
- **Actualizar datos personales del afiliado:** `PUT /api/afiliados/:id/datos-personales`
- **Eliminar afiliado:** `DELETE /api/afiliados/:id`
---
- **Obtener todos los prestadores:** `GET /api/prestadores`
- **Crear un nuevo prestador:** `POST /api/prestadores`
- **Actualizar datos personales del prestador:** `PUT /api/prestadores/:id/datos-personales`
- **Eliminar prestador:** `DELETE /api/prestadores/:id`
---
- **Obtener todas los agendas de turnos:** `GET /api/agenda-turnos`
- **Crear una nueva agenda de turnos:** `POST /api/agenda-turnos`
- **Actualizar los horarios de la agenda de turnos:** `PUT /api/agenda-turnos/:id/horarios`
- **Eliminar agenda de turnos:** `DELETE /api/agenda-turnos/:id`

Ejemplo de petición para obtener todos los prestadores:

```bash
curl -X GET "http://localhost:8080/api/prestadores" -H "Accept: application/json"
```

---

## 👥 Autor

**MedIntegral** es desarrollado por:

- [Gabriel Ledezma](https://github.com/gabrielledezma21)
