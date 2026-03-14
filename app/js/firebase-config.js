import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// 1. CONEXIÓN A TU PROYECTO
const firebaseConfig = {
  apiKey: "AIzaSyC0trECUS1g7CpQjGQtvjFim5QgcKVBfUs",
  authDomain: "grade-weighting.firebaseapp.com",
  projectId: "grade-weighting"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 2. ESTADO GLOBAL (ADN Y DATOS)
// Lo ponemos en 'window' para que el resto de archivos JS puedan leerlo y modificarlo
window.state = {
  currentUser: null, 
  userRole: null, 
  colegioId: null,
  colegioConfig: null, // Aquí se guardará si usan letras o números
  currentClassId: null, 
  currentAsignaturaId: null, 
  currentAlumnoId: null,
  currentTrimestre: 'T1', 
  currentExpedienteTrimestre: 'T1', 
  currentAnalyticsTrimestre: 'T1',
  currentContext: null,
  cachedClasses: [], 
  cachedProfesores: [], 
  cachedAlumnos: [],
  currentAlumnosList: [], 
  expedienteData: null,
  analyticsData: null,
  
  // VARIABLES DE HORARIOS
  cargaLectiva: [], 
  horariosGenerados: null,
  tramosHorarios: [
    '08:00 - 08:55', '08:55 - 09:50', '09:50 - 10:45', 
    'Recreo', '11:15 - 12:10', '12:10 - 13:05'
  ],
  bloqueosProfesores: [],
  bloqueosClases: []
};

// 3. INICIO DE SESIÓN
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  try { 
    await signInWithPopup(auth, new GoogleAuthProvider()); 
  } catch(e) { 
    console.error(e); 
  }
});

// 4. CERRAR SESIÓN
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth); 
  location.reload();
});

// 5. DETECCIÓN DE ROLES AL ENTRAR
onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.state.currentUser = user;
    document.getElementById('loginScreen').classList.add('hidden'); 
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('userName').textContent = user.displayName || 'Usuario'; 
    document.getElementById('userEmail').textContent = user.email;
    
    try {
      const emailSeguro = user.email.trim().toLowerCase();
      const pDoc = await getDoc(doc(db, 'profesores', emailSeguro));
      
      if (pDoc.exists()) {
        window.state.userRole = pDoc.data().rol; 
        window.state.colegioId = pDoc.data().colegioId;
        
        // Si eres tú (Súper Admin)
        if(window.state.userRole === 'superadmin') {
           document.getElementById('roleBadge').textContent = 'Súper Admin';
           if(window.showSuperAdminView) window.showSuperAdminView();
           return;
        }

        // Descargar el ADN del centro actual
        const colDoc = await getDoc(doc(db, 'colegios', window.state.colegioId));
        if(colDoc.exists() && colDoc.data().configuracion) {
           window.state.colegioConfig = colDoc.data().configuracion;
        } else {
           // Por defecto si es un colegio antiguo
           window.state.colegioConfig = { moduloHorarios: true, algoritmoNotas: 'numerico_10' };
        }

        // Aplicar Feature Flags visuales
        if(window.state.colegioConfig.moduloHorarios === false) {
           document.querySelectorAll('.tab-horarios-feature').forEach(el => el.classList.add('hidden'));
        } else {
           document.querySelectorAll('.tab-horarios-feature').forEach(el => el.classList.remove('hidden'));
        }
        
        // Redirigir según el rol del usuario normal
        document.getElementById('roleBadge').textContent = window.state.userRole === 'admin' ? 'Coordinador' : 'Profesor';
        
        if (window.state.userRole === 'admin') {
          if(window.showDirectorView) window.showDirectorView();
        } else {
          if(window.showProfesorAsignaturasView) window.showProfesorAsignaturasView();
        }
        
      } else {
        alert('Sin acceso. Pide a la academia que te invite.'); 
        await signOut(auth);
      }
    } catch(e) { 
      alert(e.message); 
    }
  } else {
    document.getElementById('loginScreen').classList.remove('hidden'); 
    document.getElementById('dashboard').classList.add('hidden');
  }
});
