const { spawn, exec } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
let serverProcess = null;

// Colores para la consola
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);
const success = (msg) => log(`✅ ${msg}`, colors.green);
const fail = (msg) => log(`❌ ${msg}`, colors.red);
const info = (msg) => log(`ℹ️  ${msg}`, colors.cyan);
const header = (msg) => log(`\n📋 ${msg}\n${'='.repeat(50)}`, colors.magenta);

async function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return reject(error);
            }
            if (stderr) console.error(`Stderr: ${stderr}`);
            resolve(stdout);
        });
    });
}

async function startServer() {
    info("Iniciando servidor...");
    return new Promise((resolve) => {
        serverProcess = spawn('node', ['src/main.js'], {
            cwd: process.cwd(),
            env: { ...process.env, PORT: 3002 }
        });

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // console.log(`[SERVER]: ${output}`);
            if (output.includes('Servidor escuchando')) {
                success("Servidor iniciado correctamente");
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`[SERVER ERROR]: ${data}`);
        });
    });
}

function stopServer() {
    if (serverProcess) {
        info("Deteniendo servidor...");
        serverProcess.kill();
        serverProcess = null;
    }
}

async function fetchJson(endpoint, options = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    if (response.status === 204) {
        return { status: response.status, data: null };
    }

    const data = await response.json();
    return { status: response.status, data };
}

async function runTests() {
    try {
        header("PREPARACIÓN DEL ENTORNO");
        info("Reiniciando base de datos...");
        await runCommand('node src/reiniciarDB.js');
        success("Base de datos reiniciada");

        await startServer();

        // ---------------------------------------------------------
        header("TESTING: RUTAS DE ESPECIALIDADES");
        // ---------------------------------------------------------

        // 1. GET /especialidades
        let res = await fetchJson('/especialidades');
        if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
            success(`GET /especialidades: OK (${res.data.length} encontradas)`);
        } else {
            fail(`GET /especialidades: Falló - Status: ${res.status}`);
            console.log(res.data);
        }

        let especialidadId = res.data[0]._id;

        // ---------------------------------------------------------
        header("TESTING: RUTAS DE PRESTADORES");
        // ---------------------------------------------------------

        // 2. GET /prestadores
        res = await fetchJson('/prestadores');
        if (res.status === 200 && Array.isArray(res.data)) {
            success(`GET /prestadores: OK (${res.data.length} encontrados)`);
        } else {
            fail(`GET /prestadores: Falló - Status: ${res.status}`);
        }

        // 3. POST /prestadores (VALIDACIÓN CAMPOS FALTANTES)
        res = await fetchJson('/prestadores', {
            method: 'POST',
            body: JSON.stringify({ nombre: "Incompleto" })
        });
        if (res.status === 400 && (res.data.error.includes("inválidos") || res.data.error.includes("validation failed") || res.data.error.includes("obligatorio"))) {
            success("POST /prestadores (Validación campos inválidos/faltantes): OK");
        } else {
            fail(`POST /prestadores (Validación campos inválidos): Falló - Se esperaba 400, recibido ${res.status}`);
            console.log(res.data);
        }

        // 4. POST /prestadores (CREACIÓN EXITOSA)
        const nuevoPrestador = {
            nombre: 'Test Prestador',
            cuilCuit: '20999999999',
            emails: [{ direccion: 'test@mail.com' }],
            telefonos: [{ numero: '11234567890' }], // 11 dígitos? Modelo dice 10. Corregido a 10.
            especialidades: [especialidadId],
            centrosDeAtencion: [],
            agendas: [],
            esCentroMedico: false
        };
        // Corrección del teléfono a 10 dígitos exactos
        nuevoPrestador.telefonos[0].numero = '1123456789';

        res = await fetchJson('/prestadores', {
            method: 'POST',
            body: JSON.stringify(nuevoPrestador)
        });

        let prestadorId;
        if (res.status === 201) {
            success("POST /prestadores (Creación): OK");
            prestadorId = res.data._id;
        } else {
            fail(`POST /prestadores (Creación): Falló - Status: ${res.status}`);
            console.log(res.data);
        }

        // 5. POST /prestadores (DUPLICADO)
        res = await fetchJson('/prestadores', {
            method: 'POST',
            body: JSON.stringify(nuevoPrestador)
        });
        if (res.status === 400) { // Esperamos error por CUIL repetido
            success("POST /prestadores (Duplicado): OK - Detectado correctamente");
        } else {
            fail(`POST /prestadores (Duplicado): Falló - Se esperaba 400, recibido ${res.status}`);
        }

        if (prestadorId) {
            // 6. GET /prestadores/:id
            res = await fetchJson(`/prestadores/${prestadorId}`);
            if (res.status === 200 && res.data.nombre === 'Test Prestador') {
                success("GET /prestadores/:id: OK");
            } else {
                fail("GET /prestadores/:id: Falló");
            }

            // 7. PUT /prestadores/:id
            res = await fetchJson(`/prestadores/${prestadorId}`, {
                method: 'PUT',
                body: JSON.stringify({ ...nuevoPrestador, nombre: 'Test Prestador Modificado' })
            });

            if (res.status === 200 && res.data.nombre === 'Test Prestador Modificado') {
                success("PUT /prestadores/:id: OK");
            } else {
                fail(`PUT /prestadores/:id: Falló. Status: ${res.status}`);
                console.log(res.data);
            }

            // 8. DELETE /prestadores/:id
            res = await fetchJson(`/prestadores/${prestadorId}`, {
                method: 'DELETE'
            });
            if (res.status === 204) { // Corregido a 204
                success("DELETE /prestadores/:id: OK (204 No Content)");
            } else if (res.status === 200) {
                success("DELETE /prestadores/:id: OK (200 OK)");
            } else {
                fail(`DELETE /prestadores/:id: Falló - Status: ${res.status}`);
                console.log(res.data);
            }

            // Verificar que ya no existe
            res = await fetchJson(`/prestadores/${prestadorId}`);
            if (res.status === 404) {
                success("DELETE confirmación (404 al buscar): OK");
            } else {
                fail("DELETE confirmación: Falló, el recurso sigue existiendo");
            }
        }

        // ---------------------------------------------------------
        header("TESTING: RUTAS DE AGENDAS");
        // ---------------------------------------------------------

        // Obtener datos frescos para agenda
        const prestadoresRes = await fetchJson('/prestadores');
        // El seed crea prestadores, usemos uno de esos
        const prestadorExistente = prestadoresRes.data.find(p => p.centrosDeAtencion.length > 0 && p.especialidades.length > 0);

        if (prestadorExistente) {


            // Nota: Los middlewares de agenda suelen requerir validaciones complejas.
            // Probaremos el caso exitoso asumiendo que el seed tiene horarios compatibles.
            // Ojo: El middleware 'prestadorAtiendeEnEseRangoHorario' verifica contra el horario del Centro.
            // El seed definió Luneas 8:00 (480) a 12:00 (720).
            // Nuestro intento es 10:00 a 14:00. 14:00 son 840 min.
            const diasDefault = {
                atiende: false,
                bloques: []
            };

            const horarioCompleto = {
                Lunes: { ...diasDefault },
                Martes: { ...diasDefault },
                Miercoles: { ...diasDefault },
                Jueves: { ...diasDefault },
                Viernes: { ...diasDefault },
                Sabado: { ...diasDefault },
                Domingo: { ...diasDefault }
            };

            // Configurar Lunes 09:00 - 11:00
            horarioCompleto.Lunes = {
                atiende: true,
                bloques: [{ horaInicio: "09:00", horaFin: "11:00" }]
            };

            const agendaData = {
                prestadorId: prestadorExistente._id,
                centroDeAtencionId: prestadorExistente.centrosDeAtencion[0]._id,
                especialidadId: prestadorExistente.especialidades[0]._id,
                horario: {
                    dias: horarioCompleto,
                    duracionTurno: 20
                }
            };

            res = await fetchJson('/agendas', {
                method: 'POST',
                body: JSON.stringify(agendaData)
            });

            let agendaId;
            if (res.status === 201) {
                success("POST /agendas (Creación): OK");
                agendaId = res.data._id;
            } else {
                fail(`POST /agendas (Creación): Falló - Status: ${res.status}`);
                console.log("Error data:", JSON.stringify(res.data, null, 2));
            }

            if (agendaId) {
                // 10. GET /agendas
                res = await fetchJson('/agendas');
                if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
                    success(`GET /agendas: OK (${res.data.length} encontradas)`);
                } else {
                    fail(`GET /agendas: Falló - Status: ${res.status}`);
                }

                // 11. GET /agendas/:id
                res = await fetchJson(`/agendas/${agendaId}`);
                if (res.status === 200 && res.data._id === agendaId) {
                    success("GET /agendas/:id: OK");
                } else {
                    fail(`GET /agendas/:id: Falló - Status: ${res.status}`);
                }

                // 12. PUT /agendas/:id
                // Modificamos, por ejemplo, los minutos del bloque (si se permite) o el estado "atiende"
                // Ojo: validarCamposExactos en PUT agenda puede rechazar campos extra o faltantes si no es un PATCH
                // Genericmiddleware.validarCamposExactos comprueba keys.
                // Mongoose permite updates parciales, pero validarCamposExactos
                // verifica que NO haya campos en body que NO estén en esquema.
                // PERO... si es PUT, ¿reemplazo total o parcial?
                // El controller hace findByIdAndUpdate(id, data, {new: true}).
                // Probemos cambiar la duración del turno.

                // 12. PUT /agendas/:id

                // Caso 1: Intentar actualizar campos prohibidos (prestadorId) -> Espera 400
                const updateForbidden = { ...agendaData, prestadorId: "507f1f77bcf86cd799439011" };
                res = await fetchJson(`/agendas/${agendaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateForbidden)
                });

                if (res.status === 400 && res.data.code === 'CAMPOS_INVALIDOS') {
                    success("PUT /agendas/:id (Campos prohibidos): OK - Rechazado correctamente");
                } else {
                    fail(`PUT /agendas/:id (Campos prohibidos): Falló - Status: ${res.status}, Error: ${res.data?.code}`);
                }

                // Caso 2: Actualización válida de solo horario
                const updateValid = {
                    horario: {
                        dias: { ...agendaData.horario.dias },
                        duracionTurno: 30
                    }
                };
                // Modificamos algo en Lunes para asegurar cambio real
                updateValid.horario.dias.Lunes = {
                    atiende: true,
                    bloques: [{ horaInicio: "09:30", horaFin: "10:30" }]
                };

                res = await fetchJson(`/agendas/${agendaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateValid)
                });

                if (res.status === 200 && res.data.horario.duracionTurno === 30) {
                    success("PUT /agendas/:id (Horario válido): OK");
                } else {
                    fail(`PUT /agendas/:id (Horario válido): Falló - Status: ${res.status}`);
                    console.log(res.data);
                }

                // Caso 3: Actualización inválida (fuera del horario del prestador)
                const updateInvalid = {
                    horario: {
                        dias: { ...agendaData.horario.dias },
                        duracionTurno: 20
                    }
                };
                updateInvalid.horario.dias.Lunes = {
                    atiende: true,
                    bloques: [{ horaInicio: "13:00", horaFin: "14:00" }]
                };

                res = await fetchJson(`/agendas/${agendaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateInvalid)
                });

                if (res.status === 400 && res.data.code === 'BLOQUE_FUERA_DE_HORARIO') {
                    success("PUT /agendas/:id (Horario inválido): OK - Rechazado correctamente");
                } else {
                    fail(`PUT /agendas/:id (Horario inválido): Falló - Status: ${res.status}, Error: ${res.data?.code}`);
                }



                // 13. DELETE /agendas/:id
                res = await fetchJson(`/agendas/${agendaId}`, {
                    method: 'DELETE'
                });

                if (res.status === 204) {
                    success("DELETE /agendas/:id: OK (204)");
                } else if (res.status === 200) {
                    success("DELETE /agendas/:id: OK (200)");
                } else {
                    fail(`DELETE /agendas/:id: Falló - Status: ${res.status}`);
                }

                // Verificar 404
                res = await fetchJson(`/agendas/${agendaId}`);
                if (res.status === 404) {
                    success("DELETE confirmación /agendas/:id: OK");
                } else {
                    fail(`DELETE confirmación /agendas/:id: Falló - Status: ${res.status}`);
                }

            }


        } else {
            log("⚠️  No se encontró un prestador adecuado en el seed para probar agendas (con centro y especialidad)", colors.yellow);
        }

    } catch (error) {
        fail(`Error crítico en la ejecución de pruebas: ${error.message}`);
        console.error(error);
    } finally {
        stopServer();
        info("Pruebas finalizadas.");
        process.exit(0);
    }
}

runTests();
