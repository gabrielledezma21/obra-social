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

- Node.js (v18+)
- MongoDB corriendo localmente (puerto 27017) o vía Docker.
- Redis (Opcional, para optimización).

---

## ⚙ Instalación y Configuración

1.  **Clonar el repositorio**
    ```bash
    git clone https://github.com/gabrielledezma21/obra-social.git
    cd obra-social
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno**
    Crea un archivo `.env` en la raíz:
    ```env
    PORT=3002
    MONGO_URI=mongodb://admin:admin123@localhost:27017/obraSocial?authSource=admin
    ```

4.  **Iniciar Servidor**
    ```bash
    npm run dev
    ```

---

## 💾 Base de Datos y Seed

El proyecto incluye un script de **Seed Inteligente** que no solo limpia la base de datos, sino que crea un entorno de pruebas completo e interconectado.

```bash
npm run db
```
**¿Qué genera este comando?**
- **Especialidades y Situaciones Terapéuticas** base.
- **Centros de Atención** con direcciones y horarios operativos.
- **Prestadores** con agendas asignadas y vinculaciones a Centros Médicos.
- **Afiliados** (Titulares y sus Familiares relacionados).

---

## 📚 Documentación API

La API cuenta con documentación interactiva generada automáticamente con Swagger.

1.  **Generar/Actualizar Documentación**:
    ```bash
    npm run gendoc
    ```
    *Ejecutar siempre después de modificar rutas o definiciones.*

2.  **Acceder a la UI**:
    Con el servidor corriendo, visita:
    👉 **http://localhost:3002/doc**

---

## 🧪 Testing

El proyecto cuenta con una suite de **Tests de Integración** que verifica el flujo completo del negocio, desde la base de datos hasta la respuesta HTTP.

Para correr la verificación completa:

```bash
node test_integration_full.js
```

**Alcance del Test:**
- Reseteo completo de DB.
- Verificación de creación de Entidades (CRUD).
- Validación de **Campos Virtuales** (ej. ver agendas dentro de un prestador).
- Comprobación de integridad referencial.

---

## 👥 Autor

**Obra Social** es desarrollado por [Gabriel Ledezma](https://github.com/gabrielledezma21).
