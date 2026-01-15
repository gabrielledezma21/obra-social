const { Afiliado } = require("../models");
const direccionService = require("./direccionService");
const AppError = require("../exceptions/appError");
const { mongo } = require("../config/");

const createAfiliado = async (data) => {
    try {
        // 1. Crear Direccion (esperando resultados)
        const direccion = await direccionService.createDireccion(data.direccion);

        //FECHA DE ALTA, sino la envian es la fecha actual
        const fechaAlta = data.fechaAlta ? new Date(data.fechaAlta) : new Date();

        // plan solo puede ser 210, 310, 410 o 510
        const planOptions = ['210', '310', '410', '510'];
        const plan = planOptions.includes(data.plan) ? data.plan : '210';

        //parentesco solo puede ser Titular, Conyuge, Hijo, Familiar a cargo
        const parentescoOptions = ['Titular', 'Conyuge', 'Hijo', 'Familiar a cargo'];
        const parentesco = parentescoOptions.includes(data.parentesco) ? data.parentesco : 'Titular';

        //ver el ultimo numero de afiliado registrado y asignar ese valor mas uno
        const lastAfiliado = await Afiliado.findOne().sort({ numeroAfiliado: -1 });
        const numeroAfiliado = lastAfiliado ? lastAfiliado.numeroAfiliado + 1 : 1;

        // sies titular corresponde 1 como numero de integrante
        // sino corresponde el numero de integrante siguiente al ultimo familiar registrado
        const lastFamiliar = await Afiliado.findOne({ numeroAfiliado: numeroAfiliado }).sort({ numeroIntegrante: -1 });
        const numeroIntegrante = lastFamiliar ? lastFamiliar.numeroIntegrante + 1 : 1;


        // 2. Crear Afiliado
        const afiliado = await Afiliado.create(
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
                fechaAlta: fechaAlta
            }]
        );

        if (afiliado.parentesco !== 'Titular') {
            const titular = await Afiliado.findOne({ numeroAfiliado: afiliado.numeroAfiliado, parentesco: 'Titular' });
            afiliado.afiliadoTitularId = titular._id;
            await afiliado.save();
        }

        return afiliado[0];

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