const { prestadorRutas, especialidadRutas, agendaRutas, afiliadoRutas } = require("./routes");
const { logRequest } = require("./middlewares/genericMiddleware");

const configureApp = (APP) => {

  APP.use(logRequest); // se utiliza para ver que peticion se hizo y que se envio, es para debuggear

  //rutas
  APP.use("/prestadores", prestadorRutas);
  APP.use("/especialidades", especialidadRutas);
  APP.use("/agendas", agendaRutas);
  APP.use("/afiliados", afiliadoRutas);

  APP.use(
    (err, req, res, next) => {
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code ?? null });
    }
  ); // nuevo formato para manejar errores globales desde error

  return APP;
};

module.exports = { configureApp };
