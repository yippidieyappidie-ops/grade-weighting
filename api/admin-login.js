export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Verificar credenciales desde variables de entorno
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD no configurada en Vercel');
      return res.status(500).json({ error: 'Configuración incorrecta del servidor' });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

  } catch (error) {
    console.error('Error en admin login:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}




