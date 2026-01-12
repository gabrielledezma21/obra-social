const swaggerAutogen = require('swagger-autogen')();
require('dotenv').config();

const doc = {
    info: {
        title: 'Obra Social API',
        description: 'API para la gestión de prestadores médicos, especialidades y agendas de turnos.',
        version: '1.0.0'
    },
    host: `localhost:${process.env.PORT || 3002}`,
    schemes: ['http'],
    tags: [
        {
            name: "Prestadores",
            description: "Gestión de prestadores médicos"
        },
        {
            name: "Especialidades",
            description: "Catálogo de especialidades médicas"
        },
        {
            name: "Agendas",
            description: "Gestión de agendas y turnos"
        }
    ],
    definitions: {
        PrestadorInput: {
            nombre: "Consultorio Dr. Ejemplo",
            cuilCuit: "20123456789",
            esCentroMedico: false,
            emails: [{ direccion: "email@ejemplo.com" }],
            telefonos: [{ numero: "1112345678" }],
            especialidades: ["60d5ecb8b48734356891f79f"],
            centrosDeAtencion: [{
                direccion: {
                    calle: "Av. Siempreviva",
                    altura: 742,
                    localidad: "Springfield",
                    provincia: "Buenos Aires"
                },
                horario: {
                    dias: {
                        Lunes: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "17:00" }] },
                        Martes: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "17:00" }] },
                        Miercoles: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "17:00" }] },
                        Jueves: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "17:00" }] },
                        Viernes: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "17:00" }] },
                        Sabado: { atiende: false, bloques: [] },
                        Domingo: { atiende: false, bloques: [] }
                    },
                    duracionTurno: 20
                }
            }]
        },
        AgendaInput: {
            prestadorId: "60d5ecb8b48734356891f79f",
            centroDeAtencionId: "60d5ecb8b48734356891f79f",
            especialidadId: "60d5ecb8b48734356891f79f",
            horario: {
                dias: {
                    Lunes: { atiende: true, bloques: [{ horaInicio: "09:00", horaFin: "12:00" }] },
                    Martes: { atiende: false, bloques: [] },
                    Miercoles: { atiende: false, bloques: [] },
                    Jueves: { atiende: false, bloques: [] },
                    Viernes: { atiende: false, bloques: [] },
                    Sabado: { atiende: false, bloques: [] },
                    Domingo: { atiende: false, bloques: [] }
                },
                duracionTurno: 30
            }
        }
    }
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/routes/prestadorRoutes.js', './src/routes/especialidadRoutes.js', './src/routes/agendaRoutes.js'];

/* NOTE: if you use the express Router, you must pass in the 
   'endpointsFiles' only the root file where the route starts,
   such as: index.js, app.js, routes.js, ... */

swaggerAutogen(outputFile, endpointsFiles, doc);
