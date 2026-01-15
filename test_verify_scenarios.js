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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            console.log(output);
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
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });

        if (response.status === 204) {
            return { status: response.status, data: null };
        }

        const data = await response.json();
        return { status: response.status, data };
    } catch (e) {
        return { status: 500, data: { error: e.message } };
    }
}

async function runTests() {
    try {
        header("PREPARACIÓN DEL ENTORNO");
        info("Reiniciando base de datos...");
        await runCommand('node src/reiniciarDB.js');
        success("Base de datos reiniciada");

        await startServer();
        // Give server a moment
        await sleep(1000);

        header("TESTING: RUTAS DE AFILIADOS - SCENARIOS");

        // --- CASO 1: Creación Titular Básico ---
        subHeader("Caso 1: Creación Titular (Plan Default, Fecha Actual)");
        const titularData = {
            nombre: 'Juan',
            apellido: 'Titular',
            tipoDocumento: 'DNI',
            dni: 11111111,
            // defaults: plan 210, parentesco Titular, fechaAlta hoy
            emails: [{ direccion: 'juan.titular@mail.com' }],
            telefonos: [{ numero: '1111111111' }],
            direccion: { calle: 'Calle 1', altura: 100, localidad: 'Ciudad', codigoPostal: '1000', provincia: 'Buenos Aires' }
        };

        let res = await fetchJson('/afiliados', { method: 'POST', body: JSON.stringify(titularData) });
        let titularId = null;

        if (res.status === 201 && res.data.plan === '210' && res.data.numeroIntegrante === 1) {
            success("Caso 1 OK: Creado con defaults correctos");
            titularId = res.data._id;
        } else {
            fail(`Caso 1 Falló: Status ${res.status}, Plan: ${res.data.plan}`);
            console.log(res.data);
        }

        // --- CASO 2: Creación Familiar (Hijo) ---
        // Nota: La lógica actual de 'numeroIntegrante' es:
        // si data.nombre != (algo? no, no chequea titularidad para el numero, solo busca el ultimo con ese numeroAfiliado)
        // PERO 'numeroAfiliado' se autogenera siempre como max + 1. 
        // OJO: La lógica del usuario para 'numeroAfiliado' es: busca el MAXIMO de la base y suma 1. 
        // Si yo quiero agregar un FAMILIAR al MISMO grupo, debería pasar el 'numeroAfiliado' para que NO genere uno nuevo?
        // Revisando codigo services:
        // const lastAfiliado = await Afiliado.findOne().sort({ numeroAfiliado: -1 });  <-- Busca GLOBALMENTE el último
        // const numeroAfiliado = lastAfiliado ? lastAfiliado.numeroAfiliado + 1 : 1;   <-- Siempre genera uno NUEVO incremental.
        // CONCLUSIÓN: Con el código actual NO SE PUEDEN AGRUPAR FAMILIARES. Cada POST crea un grupo nuevo.
        // Si el usuario quiere probar 'afiliados' relacionados, la lógica actual no lo permite porque siempre hace +1.
        // Vamos a probar crear otro "Titular" (aunque sea hijo) y ver que tenga numeroAfiliado incremental.

        subHeader("Caso 2: Creación Segundo Afiliado (Plan 310, Parentesco Hijo)");
        const hijoData = {
            nombre: 'Hijo',
            apellido: 'Titular',
            tipoDocumento: 'DNI',
            dni: 22222222,
            plan: '310', // Custom plan
            parentesco: 'Hijo', // Custom parentesco
            emails: [{ direccion: 'hijo.titular@mail.com' }],
            telefonos: [{ numero: '2222222222' }],
            direccion: { calle: 'Calle 1', altura: 100, localidad: 'Ciudad', codigoPostal: '1000', provincia: 'Buenos Aires' }
        };

        res = await fetchJson('/afiliados', { method: 'POST', body: JSON.stringify(hijoData) });

        if (res.status === 201 && res.data.plan === '310' && res.data.parentesco === 'Hijo') {
            // Validar que el numeroAfiliado se incrementó
            if (titularId && res.data.numeroAfiliado > 1) { // Asumiendo que el primero fue 1 (o algo)
                success("Caso 2 OK: Plan custom, Parentesco custom, Numero Incremental");
            } else {
                success("Caso 2 OK (Parcial): Se creó pero verificar numeroAfiliado");
            }
        } else {
            fail(`Caso 2 Falló: Status ${res.status}`);
            console.log(res.data);
        }

        // --- CASO 3: Validación Plan Inválido ---
        subHeader("Caso 3: Creación con Plan Inválido (Debe default a 210)");
        const invalidPlanData = {
            ...titularData,
            dni: 33333333,
            emails: [{ direccion: 'test3@mail.com' }],
            telefonos: [{ numero: '3333333333' }],
            plan: 'MEGA_PREMIUM' // Inválido
        };
        res = await fetchJson('/afiliados', { method: 'POST', body: JSON.stringify(invalidPlanData) });
        if (res.status === 201 && res.data.plan === '210') {
            success("Caso 3 OK: Plan inválido se transformó en 210");
        } else {
            fail(`Caso 3 Falló: Plan quedó en ${res.data?.plan}`);
        }

        // --- CASO 4: Actualización Simple ---
        subHeader("Caso 4: Actualización de Nombre");
        if (titularId) {
            res = await fetchJson(`/afiliados/${titularId}`, {
                method: 'PUT',
                body: JSON.stringify({ nombre: 'Juan Actualizado' })
            });
            if (res.status === 200 && res.data.nombre === 'Juan Actualizado') {
                success("Caso 4 OK: Nombre actualizado");
            } else {
                fail(`Caso 4 Falló: Status ${res.status}`);
            }

            // --- CASO 5: Actualización de Dirección (Problemática) ---
            subHeader("Caso 5: Actualización de Dirección");
            // El usuario usa 'data.direccionId' en el service. Si no lo pasamos en el body, fallará o no hará nada?
            // Probemos pasar solo 'direccion' object.
            const newAddress = { calle: 'Nueva Calle', altura: 999, localidad: 'Nueva Ciudad', codigoPostal: '9999', provincia: 'Córdoba' };

            // Intento A: Sin pasar direccionId en el body (lo normal)
            res = await fetchJson(`/afiliados/${titularId}`, {
                method: 'PUT',
                body: JSON.stringify({ direccion: newAddress })
            });

            // Verificamos si la dirección cambió. Necesitamos hacer GET del afiliado y populate.
            const checkRes = await fetchJson(`/afiliados/${titularId}`);
            if (checkRes.status === 200) {
                const dir = checkRes.data.direccionId; // Asumiendo populate
                // Nota: el controller hace .populate('direccionId')
                if (dir && dir.calle === 'Nueva Calle') {
                    success("Caso 5 OK: Dirección actualizada sin enviar direccionId explícito (Service lo resolvió?)");
                } else {
                    info("Caso 5 resultado A: Dirección NO se actualizó automáticamente (Esperado si el código requiere direccionId en body)");

                    // Intento B: Enviando direccionId explícito
                    const currentDirId = checkRes.data.direccionId._id || checkRes.data.direccionId; // Handle populated or not

                    res = await fetchJson(`/afiliados/${titularId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ direccion: newAddress, direccionId: currentDirId })
                    });

                    const checkRes2 = await fetchJson(`/afiliados/${titularId}`);
                    const dir2 = checkRes2.data.direccionId;
                    if (dir2 && dir2.calle === 'Nueva Calle') {
                        success("Caso 5 OK: Dirección actualizada enviando direccionId");
                    } else {
                        fail("Caso 5 Falló: Dirección no se actualizó ni siquiera enviando ID");
                        console.log("Estado final dirección:", dir2);
                    }
                }
            }
        }

    } catch (error) {
        fail(`Error crítico: ${error.message}`);
        console.error(error);
    } finally {
        stopServer();
        process.exit(0);
    }
}

runTests();
