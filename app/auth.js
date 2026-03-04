// Authentication Module
import { auth, db, state } from './config.js';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Login with Google
export function initLogin() {
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      console.log('🔄 Iniciando login con Google (popup)...');
      const result = await signInWithPopup(auth, provider);
      console.log('✅ Login exitoso:', result.user.email);
    } catch (error) {
      console.error('❌ Error al hacer login:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('Error al iniciar sesión: ' + error.message);
      }
    }
  });
}

// Logout
export function initLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    location.reload();
  });
}

// Detect user role
async function detectUserRole(email) {
  try {
    console.log('🔍 Detectando rol para email:', email);
    const profesorDoc = await getDoc(doc(db, 'profesores', email));
    console.log('📄 Documento existe:', profesorDoc.exists());

    if (profesorDoc.exists()) {
      const data = profesorDoc.data();
      console.log('✅ Datos del profesor:', data);
      state.userRole = data.rol;
      state.colegioId = data.colegioId;

      const roleBadge = document.getElementById('roleBadge');
      roleBadge.textContent = state.userRole === 'admin' ? 'Director' : 'Profesor';

      console.log('👤 Rol detectado:', state.userRole, '| Colegio:', state.colegioId);

      return { role: state.userRole, colegioId: state.colegioId };
    } else {
      console.error('❌ Documento del profesor NO existe para:', email);
      alert('No tienes acceso a este sistema. Contacta con tu director/a.');
      await signOut(auth);
      return null;
    }
  } catch (error) {
    console.error('❌ Error detectando rol:', error);
    alert('Error al verificar tu cuenta: ' + error.message);
    return null;
  }
}

// Auth state listener
export function initAuthListener(onDirectorView, onProfesorView) {
  onAuthStateChanged(auth, async (user) => {
    console.log('🔍 Auth state changed. User:', user?.email || 'null');

    if (user) {
      state.currentUser = user;
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      document.getElementById('userName').textContent = user.displayName || 'Usuario';
      document.getElementById('userEmail').textContent = user.email;

      const roleData = await detectUserRole(user.email);
      
      if (roleData) {
        if (roleData.role === 'admin') {
          console.log('📊 Mostrando vista de director');
          onDirectorView();
        } else {
          console.log('📚 Mostrando vista de profesor');
          onProfesorView();
        }
      }
    } else {
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
    }
  });
}
