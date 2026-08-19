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

const enviarConfirmacionTurno = async ({
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

  const urlVer = construirUrlGestionTurno({
    codigoReserva: codigo,
    tokenGestion,
    accion: 'ver',
  });
  const urlReagendar = construirUrlGestionTurno({
    codigoReserva: codigo,
    tokenGestion,
    accion: 'reagendar',
  });
  const urlCancelar = construirUrlGestionTurno({
    codigoReserva: codigo,
    tokenGestion,
    accion: 'cancelar',
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937">
      <h2 style="color:#0f766e">Turno confirmado — MedIntegral</h2>
      <p>Hola ${escaparHtml(nombreAfiliado || 'paciente')},</p>
      <p>Tu turno quedó confirmado.</p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:20px 0">
        <strong>${escaparHtml(nombrePrestador)}</strong><br />
        ${escaparHtml(nombreEspecialidad)}<br />
        ${escaparHtml(nombreCentro)}<br />
        ${escaparHtml(fecha)} — ${escaparHtml(hora)}
      </div>
      <p>Código de reserva: <strong>${escaparHtml(codigo)}</strong></p>
      <p style="margin-top:24px">
        <a href="${escaparHtml(urlVer)}" style="margin-right:12px">Ver turno</a>
        <a href="${escaparHtml(urlReagendar)}" style="margin-right:12px">Reagendar</a>
        <a href="${escaparHtml(urlCancelar)}">Cancelar</a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:28px">
        No compartas estos enlaces: permiten gestionar tu reserva sin iniciar sesión.
      </p>
    </div>
  `;

  const texto = [
    `Hola ${nombreAfiliado || 'paciente'},`,
    '',
    'Tu turno quedó confirmado.',
    `${nombrePrestador} - ${nombreEspecialidad}`,
    nombreCentro,
    `${fecha} - ${hora}`,
    '',
    `Código de reserva: ${codigo}`,
    `Ver turno: ${urlVer}`,
    `Reagendar: ${urlReagendar}`,
    `Cancelar: ${urlCancelar}`,
  ].join('\n');

  return enviarCorreo({
    destinatario,
    asunto: `Turno confirmado — ${codigo}`,
    html,
    texto,
    idempotencia: `turno-confirmado-${codigo}`,
  });
};

module.exports = {
  construirUrlGestionTurno,
  enviarConfirmacionTurno,
};
