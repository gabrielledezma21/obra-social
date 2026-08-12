const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");
const { minutosAString, convertirAMinutos } = require("../utils/conversionesDeHorarios");
const AppError = require("../exceptions/appError");

const bloqueSchema = new mongoose.Schema(
    {
        horaInicio: {
            type: Schema.Types.Number,
            required: true,
            min: [0, 'La hora de inicio debe ser mayor o igual a 0'],
            max: [1439, 'La hora de inicio debe ser menor o igual a 1439 minutos'],
            set: convertirAMinutos,
        },
        horaFin: {
            type: Schema.Types.Number,
            required: true,
            min: [1, 'La hora de fin debe ser mayor o igual a 1'],
            max: [1440, 'La hora de fin debe ser menor o igual a 1440 minutos'],
            set: convertirAMinutos,
        },
    },
    { _id: false }
);

//prevalidacion de horarios en un bloque
bloqueSchema.pre('validate', function (next) {
    if (this.horaInicio >= this.horaFin) {
        return next(new AppError('La hora de fin debe ser mayor a la hora de inicio', 400, 'RANGO_HORARIO_INVALIDO'));
    }
    if (this.horaFin - this.horaInicio < 10) {
        return next(new AppError('El rango horario debe ser mayor o igual a 10 minutos', 400, 'RANGO_HORARIO_INVALIDO'));
    }
    next();
});

const diaSchema = new mongoose.Schema(
    {
        atiende: {
            type: Schema.Types.Boolean,
            default: false
        },
        bloques: {
            type: [bloqueSchema],
            default: [],
        },
    },
    { _id: false }
);

//prevalidacion de bloques en un dia
diaSchema.pre('validate', function (next) {
    if (!this.atiende && this.bloques.length > 0) {
        return next(new AppError('No debe haber bloques si no atiende', 400, 'BLOQUES_INVALIDOS'));
    }
    if (this.atiende && this.bloques.length === 0) {
        return next(new AppError('Debe haber al menos un bloque si atiende', 400, 'BLOQUES_INVALIDOS'));
    }
    // Validación de solapamientos
    if (this.bloques.length > 1) {
        const ordenados = this.bloques
            .map(b => ({ inicio: b.horaInicio, fin: b.horaFin }))
            .sort((a, b) => a.inicio - b.inicio);

        for (let i = 1; i < ordenados.length; i++) {
            const anterior = ordenados[i - 1];
            const actual = ordenados[i];

            if (actual.inicio < anterior.fin) {
                return next(
                    new AppError(
                        `Solapamiento de bloques: ${minutosAString(anterior.inicio)}-${minutosAString(anterior.fin)} con ${minutosAString(actual.inicio)}-${minutosAString(actual.fin)}`,
                        400,
                        'SOLAPAMIENTO_BLOQUES'
                    )
                );
            }
        }
    }
    next();
});

const horarioSchema = new mongoose.Schema(
    {
        dias: {
            Lunes: { type: diaSchema, required: true },
            Martes: { type: diaSchema, required: true },
            Miercoles: { type: diaSchema, required: true },
            Jueves: { type: diaSchema, required: true },
            Viernes: { type: diaSchema, required: true },
            Sabado: { type: diaSchema, required: true },
            Domingo: { type: diaSchema, required: true },
        },
        duracionTurno: {
            type: Schema.Types.Number,
            default: null,
            min: [10, 'La duracion del turno debe ser mayor a 10 minutos'],
            max: [120, 'La duracion del turno debe ser menor a 120 minutos'],
        },
    },
    {
        collection: "horarios",
    }
);

horarioSchema.pre('validate', function (next) {
    const dias = Object.values(this.dias);

    if (dias.filter(d => d.atiende).length === 0) {
        return next(
            new AppError(
                'Debe haber al menos un día que atiende',
                400,
                'NO_ATIENDE'
            )
        );
    }

    next();
});


horarioSchema.set("toJSON", {
    transform: (_, ret) => {
        delete ret.__v;
        //delete ret._id;
    },
});

const Horario = mongoose.model("Horario", horarioSchema);
module.exports = { horarioSchema, Horario };