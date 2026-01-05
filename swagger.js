// swagger.js

//TODO: falta adaptarlo a mongoose

const swaggerAutogen = require('swagger-autogen')();
require('dotenv').config();

const doc = {
    info: {
        title: 'MedIntegral API',
        description: 'Documentación de la API para la gestión de afiliados, prestadores médicos y sus agendas de turnos.',
    },
    host: `localhost:${process.env.PORT || 3002}`,
    schemes: ['http'],
    tags: [
        { name: 'Afiliados' },
        { name: 'Prestadores' },
        { name: 'Agendas de Turnos' },
        { name: 'Provincias' },
        { name: 'Planes Medicos' },
        { name: 'Parentescos' },
        { name: 'Tipos de Documentos' },
        { name: 'Situaciones Terapeuticas' },
        { name: 'Especialidades' },
        { name: 'Dashboard' }
    ],
    definitions: {
        AfiliadoInput: {
            tipoDocumentoId: 1,
            numeroDocumento: "12345678",
            fechaNacimiento: "1990-01-01",
            nombre: "Juan",
            apellido: "Perez",
            planId: 1,
            vigenciaInicio: "2023-01-01",
            vigenciaFin: "2024-01-01",
            tieneGrupoFamiliar: true,
            grupoFamiliar: [],
            emails: [{ direccion: "jp@email.com" }, { direccion: "jp@gmail.com" }],
            telefonos: [{ numero: "123456789" }, { numero: "987654321" }],
            direcciones: [{
                calle: "Calle Falsa",
                altura: 123,
                pisoDepto: "1A",
                codigoPostal: "C1234",
                localidad: "Springfield",
                provincia: 1
            }],
            tieneSituacionTerapeutica: true,
            situacionesTerapeuticas: [{ situacionId: 1, fechaInicio: "2020-01-01", fechaFin: "2025-01-01" }],
        },
        AfiliadoDependientesInput: {
            tipoDocumentoId: 2,
            numeroDocumento: "87654321",
            fechaNacimiento: "2010-05-15",
            nombre: "Ana",
            apellido: "Perez",
            parentescoId: "2",
            vigenciaInicio: "2023-01-01",
            vigenciaFin: "2024-01-01",
            emails: [{ direccion: "ap@email.com" }],
            telefonos: [{ numero: "123123123" }],
            direcciones: [{
                calle: "Calle Verdadera",
                altura: 123,
                pisoDepto: "1A",
                codigoPostal: "C1234",
                localidad: "Springfield",
                provincia: 1
            }],
            tieneSituacionTerapeutica: false,
            situacionesTerapeuticas: [],
        },
        PrestadorInput: {
            nombre: "Algun Nombre",
            cuilCuit: "12123456781",
            esCentroMedico: false,
            integraCentroMedico: true,
            centroMedicoQueIntegra: 2,
            especialidades: [1, 2, 3],
            emails: [{ direccion: "algun@gmail.com" }, { direccion: "nombre@gmail.com" }],
            telefonos: [{ numero: "1212341234" }, { numero: "1212345678" }],
            lugaresAtencion: [
                {
                    calle: "Calle Falsa",
                    altura: 123,
                    pisoDepto: null,
                    codigoPostal: "C123",
                    localidad: "Cerro Largo",
                    provincia: 1,
                    horarios: [
                        { horaInicio: "10:00", horaFin: "16:00", dias: ["Lunes", "Martes"] },
                        { horaInicio: "10:00", horaFin: "14:00", dias: ["Miercoles"] }
                    ]
                },
                {
                    calle: "Avenida Siempre Viva",
                    altura: 456,
                    pisoDepto: null,
                    codigoPostal: "C456",
                    localidad: "Cerro Corto",
                    provincia: 1,
                    horarios: [
                        { horaInicio: "12:00", horaFin: "18:00", dias: ["Viernes"] }
                    ]
                }

            ]
        },
        AgendaDeTurnosInput: {
            prestadorId: 4,
            especialidadId: 2,
            lugaratencionId: 4,
            horarios: [{
                "horaInicio": "10:00",
                "horaFin": "12:00",
                "duracion": 30,
                "dias": ["Lunes"]
            }
            ]
        },
        AfiliadoDatosPersonalesUpdateInput: {
            tipoDocumentoId: 1,
            numeroDocumento: "12345678",
            nombre: "Nuevo Nombre",
            apellido: "Nuevo Apellido",
            fechaNacimiento: "1991-02-02",
            vigenciaInicio: "2023-01-01",
        },
        AfiliadoPlanMedicoUpdateInput: {
            planId: 2,
        },
        AfiliadoDatosContactoUpdateInput: {
            emails: [{ direccion: "nuevoemail1@gmail.com" }, { direccion: "nuevoemail2@gmail.com" }],
            telefonos: [{ numero: "9999999999" }, { numero: "8888888888" }]
        },
        AfiliadoDireccionesUpdateInput: {
            direcciones: [{
                calle: "Calle Nueva",
                altura: 456,
                pisoDepto: "2B",
                codigoPostal: "C5678",
                localidad: "Shelbyville",
                provincia: 2
            }]
        },
        AfiliadoFechaBajaUpdateInput: {
            fechaBaja: "2024-06-30"
        },
        AfiliadoReincorporarUpdateInput: {
            reincorporarGrupoFamiliar: false
        },
        PrestadorDatosPersonalesUpdateInput: {
            nombre: "nuevo nombre",
            cuilCuit: "12345654321",
            emails: [{ direccion: "pepeg@gmail.com" }, { direccion: "drpepe@gmail.com" }],
            telefonos: [{ numero: "1111111111" }, { numero: "2222222222" }]
        },
        PrestadorLugaresAtencionUpdateInput: {
            lugaresAtencion: [{
                calle: "Avenida San Martin",
                altura: 9616,
                codigoPostal: "1746",
                pisoDepto: "1A",
                localidad: "Francisco Alvarez",
                provincia: 1,
                horarios: [{ horaInicio: "08:00", horaFin: "20:00", dias: ["Lunes"] }]
            }]
        },
        PrestadorEspecialidadesUpdateInput: {
            especialidades: [2, 3]
        },
        PrestadorCentroMedicoUpdateInput: {
            esCentroMedico: false,
            integraCentroMedico: false,
            centroMedicoQueIntegra: null
        },
        AgendaDeTurnosHorariosUpdateInput: {
            horarios: [{
                horaInicio: "13:00",
                horaFin: "16:00",
                duracion: 15,
                dias: ["Lunes"]
            }
            ]
        },
        AgendaDeTurnosEspecialidadesUpdateInput: {
            especialidadId: 4
        },

    }
};

const outputFile = './swagger-output.json'; // archivo que se generará
const endpointsFiles = [
    './src/main.js',
    './src/app.js',
    './src/routes/afiliadoRoutes.js',
    './src/routes/prestadorRoutes.js',
    './src/routes/agendaTurnosRoutes.js',
    './src/routes/provinciaRoutes.js',
    './src/routes/planMedicoRoutes.js',
    './src/routes/parentescoRoutes.js',
    './src/routes/tipoDocumentoRoutes.js',
    './src/routes/situacionTerapeuticaRoutes.js',
    './src/routes/especialidadRoutes.js',
    './src/routes/dashboardRoutes.js'
];
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log('Swagger generado en', outputFile);
});
