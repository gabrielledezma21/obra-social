const fs = require('fs');

const ruta = 'src/routes/portalPrestadorRutas.js';
let contenido = fs.readFileSync(ruta, 'utf8');

const reemplazarObligatorio = (patron, reemplazo, descripcion) => {
  const actualizado = contenido.replace(patron, reemplazo);
  if (actualizado === contenido) {
    throw new Error(`No se pudo aplicar: ${descripcion}`);
  }
  contenido = actualizado;
};

reemplazarObligatorio(
  "const { Afiliado, Prestador } = require('../models');",
  "const { Afiliado, Prestador, SituacionTerapeutica } = require('../models');",
  'importar catálogo de situaciones terapéuticas'
);

reemplazarObligatorio(
  "const rutas = Router();\nrutas.use(autenticar, requerirRol('PRESTADOR'));",
  `const rutas = Router();\nrutas.use(autenticar, requerirRol('PRESTADOR'));\n\nconst escaparRegex = (valor) => String(valor || '').replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');`,
  'agregar escape seguro para búsquedas'
);

reemplazarObligatorio(
  /rutas\.get\('\/afiliados\/buscar',[\s\S]*?\n\}\);\n\nrutas\.get\('\/situaciones\/:afiliadoId'/,
  `rutas.get('/afiliados/buscar', async (peticion, respuesta, siguiente) => {\n  try {\n    const textoBusqueda = String(peticion.query.busqueda || '').trim();\n    if (!textoBusqueda) {\n      return respuesta.json([]);\n    }\n\n    const textoSeguro = escaparRegex(textoBusqueda);\n    const digitosBusqueda = textoBusqueda.replace(/\\D/g, '');\n    const numeroBusqueda = Number(digitosBusqueda);\n    const credencial = /^(\\d{1,7})-(\\d{1,2})$/.exec(textoBusqueda);\n    const condiciones = [\n      { nombre: { $regex: textoSeguro, $options: 'i' } },\n      { apellido: { $regex: textoSeguro, $options: 'i' } },\n    ];\n\n    if (digitosBusqueda) {\n      condiciones.push({\n        'telefonos.numero': { $regex: escaparRegex(digitosBusqueda) },\n      });\n    }\n\n    if (Number.isFinite(numeroBusqueda) && numeroBusqueda > 0) {\n      condiciones.push({ dni: numeroBusqueda });\n      condiciones.push({ numeroAfiliado: numeroBusqueda });\n    }\n\n    if (credencial) {\n      condiciones.push({\n        numeroAfiliado: Number(credencial[1]),\n        numeroIntegrante: Number(credencial[2]),\n      });\n    }\n\n    const afiliados = await Afiliado.find({ $or: condiciones })\n      .sort({ apellido: 1, nombre: 1 })\n      .limit(20)\n      .select(\n        'nombre apellido dni numeroAfiliado numeroIntegrante telefonos plan fechaBaja parentesco afiliadoTitularId'\n      );\n\n    respuesta.json(afiliados);\n  } catch (error) {\n    siguiente(error);\n  }\n});\n\nrutas.get('/situaciones-terapeuticas', async (_peticion, respuesta, siguiente) => {\n  try {\n    const situaciones = await SituacionTerapeutica.find().sort({ nombre: 1 });\n    respuesta.json(situaciones);\n  } catch (error) {\n    siguiente(error);\n  }\n});\n\nrutas.get('/situaciones/:afiliadoId'`,
  'ampliar búsqueda clínica y exponer catálogo'
);

fs.writeFileSync(ruta, contenido);
