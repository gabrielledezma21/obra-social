const { Afiliado } = require("../models");
const direccionService = require("./direccionService");
const AppError = require("../exceptions/appError");
const { mongo } = require("../config/");

const createAfiliado = async (data) => {
    try {
        // 1. Crear Direccion
        const direccion = await direccionService.createDireccion(data.direccion);

        // FECHA DE ALTA
        const fechaAlta = data.fechaAlta ? new Date(data.fechaAlta) : new Date();

        // VALIDAR PLAN (Aunque el modelo lo valida, lo normalizamos si fuera necesario, o confiamos en el modelo)
        // El usuario dijo "los planes son 210, 310, 410 o 510". El modelo ya lo valida.
        const plan = data.plan;

        // PARENTESCO
        // parentesco solo puede ser Titular, Conyuge, Hijo, Familiar a cargo
        // Validamos esto o dejamos que pase? Mejor normalizar si es nulo.
        const parentesco = data.parentesco || 'Titular';

        let numeroAfiliado;
        let numeroIntegrante;

        if (parentesco === 'Titular') {
            // Generar nuevo numero de afiliado
            const lastAfiliado = await Afiliado.findOne().sort({ numeroAfiliado: -1 });
            numeroAfiliado = lastAfiliado ? lastAfiliado.numeroAfiliado + 1 : 1000; // Iniciamos en 1000 si no hay
            numeroIntegrante = 1;
        } else {
            // Es familiar, necesita afiliadoTitularId
            if (!data.afiliadoTitularId) {
                throw new AppError("Debes especificar el afiliadoTitularId para registrar un familiar", 400);
            }

            const titular = await Afiliado.findById(data.afiliadoTitularId);
            if (!titular) {
                throw new AppError("El titular especificado no existe", 404);
            }

            numeroAfiliado = titular.numeroAfiliado;

            // Calcular numero integrante (max integrante de este numeroAfiliado + 1)
            const lastFamiliar = await Afiliado.findOne({ numeroAfiliado: numeroAfiliado }).sort({ numeroIntegrante: -1 });
            numeroIntegrante = lastFamiliar ? lastFamiliar.numeroIntegrante + 1 : 2; // Debería ser al menos 2 si ya existe el titular
        }

        // 2. Crear Afiliado
        // Nota: create acepta objeto o array. Usamos array en original, mantenemos consistencia si se prefiere.
        const createdAfiliados = await Afiliado.create(
            [{
                nombre: data.nombre,
                apellido: data.apellido,
                tipoDocumento: data.tipoDocumento,
                dni: data.dni,
                numeroAfiliado: numeroAfiliado,
                numeroIntegrante: numeroIntegrante,
                parentesco: parentesco,
                situacionesTerapeuticas: data.situacionesTerapeuticas,
                emails: data.emails,
                telefonos: data.telefonos,
                direccionId: direccion._id,
                plan: plan,
                fechaAlta: fechaAlta,
                afiliadoTitularId: data.afiliadoTitularId // Si es null no pasa nada
            }]
        );
        const afiliado = createdAfiliados[0];

        return afiliado;

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

const updateAfiliado = async (id, data) => {
    try {
        const currentAfiliado = await Afiliado.findById(id);
        if (data.direccion && currentAfiliado) {
            await direccionService.updateDireccion(currentAfiliado.direccionId, data.direccion);
        }
        const afiliado = await Afiliado.findByIdAndUpdate(id, data, { new: true });
        return afiliado;
    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

module.exports = { createAfiliado, updateAfiliado };