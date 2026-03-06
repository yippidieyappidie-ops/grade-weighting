export default async function handler(req, res) {
  // Solo permitimos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Usamos el nombre exacto de la variable que ya tienes en Vercel
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;

    if (!accessKey) {
      console.error('Falta la variable de entorno WEB3FORMS_ACCESS_KEY');
      return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    // Inyectamos la llave secreta a los datos que vienen del frontend
    const payload = {
      ...req.body,
      access_key: accessKey
    };

    // Hacemos la petición a web3forms desde el backend (oculto al público)
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: data.message || 'Error en Web3Forms' });
    }

  } catch (error) {
    console.error('Error en el endpoint de contacto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
