const fs = require('fs');

const ruta = 'src/routes/portalAfiliadoRutas.js';
let contenido = fs.readFileSync(ruta, 'utf8');

const reemplazar = (buscar, reemplazo, descripcion) => {
  if (!contenido.includes(buscar)) {
    throw new Error(`No se encontró el bloque para ${descripcion}`);
  }
  contenido = contenido.replace(buscar, reemplazo);
};

reemplazar(
  "const ErrorAplicacion = require('../exceptions/appError');\n",
  "const ErrorAplicacion = require('../exceptions/appError');\nconst { esTurnoProximo } = require('../utils/fechaTurnos');\n",
  'importar cálculo temporal de turnos'
);

reemplazar(
  '      cantidadTurnos,\n    ] = await Promise.all([',
  '      turnosReservados,\n    ] = await Promise.all([',
  'renombrar resultado de turnos'
);

reemplazar(
  `      Turno.countDocuments({\n        afiliadoId: { $in: idsVisibles },\n        estado: 'RESERVADO',\n        fecha: { $gte: ahora },\n      }),`,
  `      Turno.find({\n        afiliadoId: { $in: idsVisibles },\n        estado: 'RESERVADO',\n      }).select('fecha hora estado'),`,
  'obtener turnos reservados con hora'
);

reemplazar(
  '    respuesta.json({\n      pendientes,',
  `    const cantidadTurnos = turnosReservados.filter((turno) =>\n      esTurnoProximo(turno, ahora)\n    ).length;\n\n    respuesta.json({\n      pendientes,`,
  'calcular próximos por fecha y hora'
);

fs.writeFileSync(ruta, contenido);
