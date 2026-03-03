export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { centro, contacto, email, telefono, numProfes, comentarios, idioma, fecha } = req.body;

    // Validación básica
    if (!centro || !contacto || !email) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Preparar datos como objeto plano para Web3Forms
    const formData = {
      access_key: process.env.WEB3FORMS_ACCESS_KEY,
      subject: `Nueva solicitud de colegio: ${centro}`,
      from_name: contacto,
      Centro: centro,
      Contacto: contacto,
      Email: email,
      'Teléfono': telefono || 'No proporcionado',
      'Número de profesores': numProfes || 'No especificado',
      Comentarios: comentarios || 'Sin comentarios',
      Idioma: idioma,
      Fecha: fecha
    };

    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true, message: 'Email enviado correctamente' });
    } else {
      console.error('Web3Forms error:', data);
      throw new Error('Error en Web3Forms: ' + JSON.stringify(data));
    }

  } catch (error) {
    console.error('Error completo:', error);
    return res.status(500).json({ error: 'Error al enviar el email', details: error.message });
  }
}
