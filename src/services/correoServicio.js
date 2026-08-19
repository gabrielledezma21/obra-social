const obtenerBaseFrontend = () =>
  String(process.env.URL_FRONTEND || 'http://localhost:5173').replace(/\/$/, '');

const escaparHtml = (valor) =>
  String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const construirUrlGestionTurno = ({ codigoReserva, tokenGestion, accion }) => {
  const base = obtenerBaseFrontend();
  const codigo = encodeURIComponent(codigoReserva);
  const token = encodeURIComponent(tokenGestion);
  const accionCodificada = encodeURIComponent(accion || 'ver');

  return `${base}/turnos/gestionar?codigo=${codigo}#token=${token}&accion=${accionCodificada}`;
};

const enviarCorreo = async ({ destinatario, asunto, html, texto, idempotencia }) => {
  if (!destinatario) {
    return { enviado: false, motivo: 'SIN_DESTINATARIO' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { enviado: false, motivo: 'RESEND_NO_CONFIGURADO' };
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MedIntegral/1.0',
      ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
    },
    body: JSON.stringify({
      from: process.env.CORREO_DESDE || 'MedIntegral <onboarding@resend.dev>',
      to: [destinatario],
      subject: asunto,
      html,
      text: texto,
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(
      `No se pudo enviar el correo (${respuesta.status}): ${detalle.slice(0, 300)}`
    );
  }

  const datos = await respuesta.json();
  return { enviado: true, id: datos.id || null };
};

const obtenerDatosPresentacion = ({
  turno,
  tokenGestion,
  afiliado,
  prestador,
  especialidad,
  centro,
}) => {
  const destinatario = afiliado?.emails?.[0]?.direccion;
  const nombreAfiliado = [afiliado?.nombre, afiliado?.apellido]
    .filter(Boolean)
    .join(' ');
  const nombrePrestador = prestador?.nombre || 'Prestador a confirmar';
  const nombreEspecialidad = especialidad?.nombre || 'Especialidad a confirmar';
  const nombreCentro = centro?.nombre || 'Centro de atención';
  const fecha = turno.fechaTexto || '';
  const hora = turno.hora || '';
  const codigo = turno.codigoReserva;

  return {
    destinatario,
    nombreAfiliado,
    nombrePrestador,
    nombreEspecialidad,
    nombreCentro,
    fecha,
    hora,
    codigo,
    urlVer: construirUrlGestionTurno({
      codigoReserva: codigo,
      tokenGestion,
      accion: 'ver',
    }),
    urlReagendar: construirUrlGestionTurno({
      codigoReserva: codigo,
      tokenGestion,
      accion: 'reagendar',
    }),
    urlCancelar: construirUrlGestionTurno({
      codigoReserva: codigo,
      tokenGestion,
      accion: 'cancelar',
    }),
  };
};

const construirDetalleHtml = (datos) => `
  <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:20px 0">
    <strong>${escaparHtml(datos.nombrePrestador)}</strong><br />
    ${escaparHtml(datos.nombreEspecialidad)}<br />
    ${escaparHtml(datos.nombreCentro)}<br />
    ${escaparHtml(datos.fecha)} — ${escaparHtml(datos.hora)}
  </div>
  <p>Código de reserva: <strong>${escaparHtml(datos.codigo)}</strong></p>
`;

const construirAccionesHtml = (datos) => `
  <p style="margin-top:24px">
    <a href="${escaparHtml(datos.urlVer)}" style="margin-right:12px">Ver turno</a>
    <a href="${escaparHtml(datos.urlReagendar)}" style="margin-right:12px">Reagendar</a>
    <a href="${escaparHtml(datos.urlCancelar)}">Cancelar</a>
  </p>
  <p style="font-size:12px;color:#64748b;margin-top:28px">
    No compartas estos enlaces: permiten gestionar tu reserva sin iniciar sesión.
  </p>
`;

const enviarConfirmacionTurno = async (parametros) => {
  const datos = obtenerDatosPresentacion(parametros);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937">
      <h2 style="color:#0f766e">Turno confirmado — MedIntegral</h2>
      <p>Hola ${escaparHtml(datos.nombreAfiliado || 'paciente')},</p>
      <p>Tu turno quedó confirmado.</p>
      ${construirDetalleHtml(datos)}
      ${construirAccionesHtml(datos)}
    </div>
  `;
  const texto = [
    `Hola ${datos.nombreAfiliado || 'paciente'},`,
    '',
    'Tu turno quedó confirmado.',
    `${datos.nombrePrestador} - ${datos.nombreEspecialidad}`,
    datos.nombreCentro,
    `${datos.fecha} - ${datos.hora}`,
    '',
    `Código de reserva: ${datos.codigo}`,
    `Ver turno: ${datos.urlVer}`,
    `Reagendar: ${datos.urlReagendar}`,
    `Cancelar: ${datos.urlCancelar}`,
  ].join('\n');

  return enviarCorreo({
    destinatario: datos.destinatario,
    asunto: `Turno confirmado — ${datos.codigo}`,
    html,
    texto,
    idempotencia: `turno-confirmado-${datos.codigo}-${datos.fecha}-${datos.hora}`,
  });
};

const enviarReagendamientoTurno = async (parametros) => {
  const datos = obtenerDatosPresentacion(parametros);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937">
      <h2 style="color:#0f766e">Turno reagendado — MedIntegral</h2>
      <p>Hola ${escaparHtml(datos.nombreAfiliado || 'paciente')},</p>
      <p>Tu turno fue reagendado. Estos son los nuevos datos:</p>
      ${construirDetalleHtml(datos)}
      ${construirAccionesHtml(datos)}
    </div>
  `;
  const texto = [
    `Hola ${datos.nombreAfiliado || 'paciente'},`,
    '',
    'Tu turno fue reagendado.',
    `${datos.nombrePrestador} - ${datos.nombreEspecialidad}`,
    datos.nombreCentro,
    `${datos.fecha} - ${datos.hora}`,
    '',
    `Código de reserva: ${datos.codigo}`,
    `Ver turno: ${datos.urlVer}`,
    `Reagendar: ${datos.urlReagendar}`,
    `Cancelar: ${datos.urlCancelar}`,
  ].join('\n');

  return enviarCorreo({
    destinatario: datos.destinatario,
    asunto: `Turno reagendado — ${datos.codigo}`,
    html,
    texto,
    idempotencia: `turno-reagendado-${datos.codigo}-${datos.fecha}-${datos.hora}`,
  });
};

const enviarCancelacionTurno = async (parametros) => {
  const datos = obtenerDatosPresentacion(parametros);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937">
      <h2 style="color:#0f766e">Turno cancelado — MedIntegral</h2>
      <p>Hola ${escaparHtml(datos.nombreAfiliado || 'paciente')},</p>
      <p>Tu turno fue cancelado correctamente.</p>
      ${construirDetalleHtml(datos)}
    </div>
  `;
  const texto = [
    `Hola ${datos.nombreAfiliado || 'paciente'},`,
    '',
    'Tu turno fue cancelado correctamente.',
    `${datos.nombrePrestador} - ${datos.nombreEspecialidad}`,
    datos.nombreCentro,
    `${datos.fecha} - ${datos.hora}`,
    `Código de reserva: ${datos.codigo}`,
  ].join('\n');

  return enviarCorreo({
    destinatario: datos.destinatario,
    asunto: `Turno cancelado — ${datos.codigo}`,
    html,
    texto,
    idempotencia: `turno-cancelado-${datos.codigo}`,
  });
};

module.exports = {
  construirUrlGestionTurno,
  enviarCancelacionTurno,
  enviarConfirmacionTurno,
  enviarReagendamientoTurno,
};
