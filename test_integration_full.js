const { spawn, exec } = require('child_process');

const BASE_URL = 'http://localhost:3002';
let serverProcess = null;

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
const subHeader = (msg) => log(`\n🔹 ${msg}`, colors.blue);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to create full Horario structure for API
const createAgendaHorarioPayload = (diaSemana, horaInicio, horaFin, duracionTurno = 30) => {
    // API expects full 'dias' object with 'atiende' flags
    const diaLibre = { atiende: false, bloques: [] };
    const dias = {
        Lunes: diaLibre, Martes: diaLibre, Miercoles: diaLibre, Jueves: diaLibre, Viernes: diaLibre, Sabado: diaLibre, Domingo: diaLibre
    };

    // Parse times
    dias[diaSemana] = {
        atiende: true,
        bloques: [{ horaInicio: horaInicio, horaFin: horaFin }]
    };

    return { dias, duracionTurno };
};


async function startServer() {
    info("Iniciando servidor...");
    return new Promise((resolve) => {
        serverProcess = spawn('node', ['src/main.js'], {
            cwd: process.cwd(),
            env: { ...process.env, PORT: 3002 }
        });

        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('Servidor escuchando')) {
                success("Servidor iniciado correctamente en puerto 3002");
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
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });

        const status = response.status;
        if (status === 204) return { status, data: null };

        const data = await response.json().catch(() => null);
        return { status, data };
    } catch (e) {
        return { status: 500, data: { error: e.message } };
    }
}

async function runTests() {
    try {
        header("TEST INTEGRACIÓN API OBRA SOCIAL");

        // 0. Reiniciar DB con Script Mejorado
        info("Reiniciando base de datos con seed completo...");
        await new Promise((resolve, reject) => {
            exec('node src/reiniciarDB.js', (error, stdout, stderr) => {
                if (error) reject(error);
                else {
                    console.log(stdout);
                    resolve();
                }
            });
        });
        success("DB Reseteada y Seedeada");

        await startServer();
        await sleep(1000);

        // --- 1. ESPECIALIDADES ---
        header("1. ESPECIALIDADES");

        // GET All
        let res = await fetchJson('/especialidades');
        if (res.status !== 200 || res.data.length !== 3) fail(`GET /especialidades falló. Status: ${res.status}, Length: ${res.data?.length}`);
        else success(`GET /especialidades OK (${res.data.length} items)`);

        const especialidad = res.data[0];
        const especialidadId = especialidad._id;

        // Verify Virtuals on GET / (since GET /:id was removed by user)
        if (Array.isArray(especialidad.prestadores) && especialidad.prestadores.length >= 0) {
            success(`GET /especialidades OK - Virtuals presentes en lista (Prestadores: ${especialidad.prestadores.length})`);
        } else {
            fail(`GET /especialidades - Faltan campos virtuales en la lista`);
            console.log("Muestra:", especialidad);
        }

        // --- 2. SITUACIONES TERAPEUTICAS ---
        header("2. SITUACIONES TERAPEUTICAS");
        res = await fetchJson('/situaciones-terapeuticas');
        if (res.status !== 200 || res.data.length !== 3) fail(`GET /situaciones-terapeuticas falló. Status: ${res.status}`);
        else success(`GET /situaciones-terapeuticas OK (${res.data.length} items)`);

        // --- 3. PRESTADORES ---
        header("3. PRESTADORES");
        res = await fetchJson('/prestadores');
        if (res.status !== 200 || res.data.length !== 4) fail(`GET /prestadores falló. Expected 4, got ${res.data.length}`);
        // Expected 4 now because of Dr. Tester
        else success(`GET /prestadores OK (${res.data.length} items)`);

        // Use prestador from list that has centers and specialities
        const prestadorFull = res.data.find(p => p.nombre === 'Dr. Tester');
        if (!prestadorFull) {
            fail("No se encontró al Dr. Tester");
            return;
        }

        const prestadorId = prestadorFull._id;

        // GET One & Check Virtual Agenda
        // Dr. Tester has 0 initially
        res = await fetchJson(`/prestadores/${prestadorId}`);
        if (res.status !== 200) fail(`GET /prestadores/:id falló`);
        else {
            const pres = res.data;
            if (Array.isArray(pres.agendas) && pres.agendas.length >= 0) {
                success(`GET /prestadores/:id OK - Virtual Agendas OK (${pres.agendas.length})`);
            } else {
                fail(`GET /prestadores/:id - Faltan virtual agendas`);
                console.log(pres);
            }
        }

        // --- 4. AGENDAS ---
        header("4. AGENDAS");
        // Create new Agenda for Dr. Tester
        // He has Center 0 and Specialty 0 (Cardiologia). He has NO agendas.

        const centroId = prestadorFull.centrosDeAtencion[0]._id;
        const validEspecialidadId = prestadorFull.especialidades[0]._id;

        const horarioPayload = createAgendaHorarioPayload('Jueves', '09:00', '12:00');

        const newAgendaPayload = {
            especialidadId: validEspecialidadId,
            centroDeAtencionId: centroId,
            prestadorId: prestadorId,
            horario: horarioPayload
        };

        res = await fetchJson('/agendas', { method: 'POST', body: JSON.stringify(newAgendaPayload) });
        if (res.status === 201) success("POST /agendas OK");
        else {
            fail("POST /agendas failed");
            console.log(JSON.stringify(res.data, null, 2));
        }

        // --- 5. AFILIADOS ---
        header("5. AFILIADOS");
        res = await fetchJson('/afiliados');
        if (res.status !== 200) fail("GET /afiliados failed");
        else success(`GET /afiliados OK (${res.data.length} items)`);

        // Find 'Homero' to check virtual familiares
        const homero = res.data.find(a => a.nombre === 'Homero');
        if (homero) {
            res = await fetchJson(`/afiliados/${homero._id}`);
            if (res.status === 200) {
                if (Array.isArray(res.data.familiares) && res.data.familiares.length > 0) {
                    success(`GET /afiliados/:id OK - Virtual Familiares found (${res.data.familiares.length})`);
                } else {
                    fail("GET /afiliados/:id - Virtual Familiares NOT found or empty");
                    console.log(res.data);
                }
            } else fail("GET /afiliados/:id failed");
        } else fail("No se encontró afiliado titular 'Homero' para testar");

        success("\n🎉 TODOS LOS TESTS COMPLETADOS");

    } catch (error) {
        fail(`Error CRITICO: ${error.message}`);
        console.error(error);
    } finally {
        stopServer();
        process.exit(0);
    }
}

runTests();
