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

    // Verificar que la access key existe
    console.log('Access key existe:', !!process.env.WEB3FORMS_ACCESS_KEY);
    console.log('Access key (primeros 10 chars):', process.env.WEB3FORMS_ACCESS_KEY?.substring(0, 10));

    // Preparar datos
    const formData = {
      access_key: process.env.WEB3FORMS_ACCESS_KEY,
      subject: `Nueva solicitud de colegio: ${centro}`,
      from_name: contacto,
      email: email,
      message: `Centro: ${centro}\nContacto: ${contacto}\nEmail: ${email}\nTeléfono: ${telefono || 'No proporcionado'}\nNúmero de profesores: ${numProfes || 'No especificado'}\nComentarios: ${comentarios || 'Sin comentarios'}\nIdioma: ${idioma}\nFecha: ${fecha}`
    };

    console.log('Enviando datos a Web3Forms...');

    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const textResponse = await response.text();
    console.log('Response body (primeros 200 chars):', textResponse.substring(0, 200));

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (e) {
      console.error('No se pudo parsear JSON. Respuesta completa:', textResponse);
      throw new Error('Web3Forms devolvió HTML en vez de JSON');
    }

    if (data.success) {
      return res.status(200).json({ success: true, message: 'Email enviado correctamente' });
    } else {
      console.error('Web3Forms error:', data);
      throw new Error('Error en Web3Forms: ' + JSON.stringify(data));
    }

  } catch (error) {
    console.error('Error completo:', error.message);
    return res.status(500).json({ error: 'Error al enviar el email', details: error.message });
  }
}
