# 🏥 Obra Social - Backend

![Status](https://img.shields.io/badge/status-development-yellow) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Obra Social** es la API RESTful encargada de la gestión de datos y lógica de negocio para la plataforma médica integral. Este proyecto permite la administración de afiliados, prestadores médicos y sus agendas de turnos. Además se puede generar el reporte de la situacion terapeutica de los afiliados.

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
- **Base de Datos:** MongoDB, Redis
- **ORM:** Mongoose
- **Herramientas:** Docker

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
    git clone [https://github.com/gabrielledezma21/obra-social.git](https://github.com/gabrielledezma21/obra-social.git)
    cd obra-social
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
    PORT = 3002
    MONGO_URI=mongodb://admin:admin123@localhost:27017/obraSocial?authSource=admin
    ```

---

## ▶ Ejecución

### Base de Datos

Antes de iniciar, corre las migraciones y seeders (datos de prueba):

```bash
# Migraciones
npm run db
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

- **Obtener todos los prestadores:** `GET /prestadores`
- **Crear un nuevo prestador:** `POST /prestadores`
- **Eliminar prestador:** `DELETE /prestadores/:id`
---
- **Obtener todas las especialidades:** `GET /especialidades`


Ejemplo de petición para obtener todos los prestadores:

```bash
curl -X GET "http://localhost:3002/prestadores" -H "Accept: application/json"
```

---

## 👥 Autor

**Obra Social** es desarrollado por:

- [Gabriel Ledezma](https://github.com/gabrielledezma21)
