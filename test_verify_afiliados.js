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

        header("TESTING: RUTAS DE AFILIADOS");

        // 1. Crear Afiliado Exitoso (con campos minimos para probar auto-generacion)
        const nuevoAfiliado = {
            nombre: 'Test',
            apellido: 'Afiliado',
            tipoDocumento: 'DNI',
            dni: 12345678,
            // numeroAfiliado: 12345, // Auto-generated
            // numeroIntegrante: 1,   // Auto-generated
            // parentesco: 'Titular', // Auto-generated default
            // plan: 'Plan A',        // Auto-generated/validated
            // fechaAlta: '2023-01-01', // Auto-generated default
            emails: [{ direccion: 'test.afiliado@mail.com' }],
            telefonos: [{ numero: '1123456789' }],
            direccion: {
                calle: 'Calle Falsa',
                altura: 123,
                pisoDepto: '1',
                localidad: 'Springfield',
                codigoPostal: '1111',
                provincia: 'Buenos Aires'
            }
        };

        info("Intentando crear afiliado...");
        let res = await fetchJson('/afiliados', {
            method: 'POST',
            body: JSON.stringify(nuevoAfiliado)
        });

        let afiliadoId;

        if (res.status === 201) {
            success("POST /afiliados: OK");
            afiliadoId = res.data._id;
        } else {
            fail(`POST /afiliados: Falló - Status: ${res.status}`);
            console.log("Error data:", JSON.stringify(res.data, null, 2));
        }

        if (afiliadoId) {
            // 2. Obtener Afiliado
            res = await fetchJson(`/afiliados/${afiliadoId}`);
            if (res.status === 200 && res.data.dni === 12345678) {
                success("GET /afiliados/:id: OK");
            } else {
                fail(`GET /afiliados/:id: Falló - Status: ${res.status}`);
            }

            // 3. Modificar Afiliado
            res = await fetchJson(`/afiliados/${afiliadoId}`, {
                method: 'PUT',
                body: JSON.stringify({ ...nuevoAfiliado, nombre: 'Test Modificado' })
            });
            if (res.status === 200 && res.data.nombre === 'Test Modificado') {
                success("PUT /afiliados/:id: OK");
            } else {
                fail(`PUT /afiliados/:id: Falló - Status: ${res.status}`);
                console.log("Error data:", JSON.stringify(res.data, null, 2));
            }

            // 4. Eliminar Afiliado
            res = await fetchJson(`/afiliados/${afiliadoId}`, {
                method: 'DELETE'
            });
            if (res.status === 204) {
                success("DELETE /afiliados/:id: OK");
            } else {
                fail(`DELETE /afiliados/:id: Falló - Status: ${res.status}`);
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
