// Profesor Module - Vista de asignaturas y trimestres
import { db, state } from './config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function hideAllViews() {
  ['directorView', 'profesorView', 'studentsView', 'profesoresView', 'asignaturasView', 'asignaturaDetailView', 'notasView', 'trimestreDetailView'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// Show profesor view
export function showProfesorView() {
  hideAllViews();
  document.getElementById('profesorView').classList.remove('hidden');
  loadProfesorAsignaturas();
}

// Load profesor asignaturas
async function loadProfesorAsignaturas() {
  const profesorAsignaturasList = document.getElementById('profesorAsignaturasList');
  
  try {
    const q = query(collection(db, `colegios/${state.colegioId}/asignaturas`), where('profesorEmail', '==', state.currentUser.email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      profesorAsignaturasList.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><p><strong>No tienes asignaturas asignadas</strong></p></div>';
      return;
    }
    
    let html = '<div class="cards-grid">';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      html += `<div class="card card-clickable" onclick="window.showAsignaturaDetail('${docSnap.id}', '${data.nombre}')">
        <div class="card-title">${data.nombre}</div>
        <div class="card-meta">${data.alumnos?.length || 0} alumnos</div>
      </div>`;
    });
    html += '</div>';
    
    profesorAsignaturasList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando asignaturas:', error);
    profesorAsignaturasList.innerHTML = '<p style="color: red;">Error</p>';
  }
}

// Show asignatura detail (trimestres cards)
export function showAsignaturaDetail(asignaturaId, nombre) {
  state.currentAsignaturaId = asignaturaId;
  state.currentContext = 'asignatura';
  document.getElementById('currentAsignaturaNombre').textContent = nombre;
  document.getElementById('asignaturaDetailTitle').textContent = `Trimestres - ${nombre}`;
  hideAllViews();
  document.getElementById('asignaturaDetailView').classList.remove('hidden');
  
  const alumnosList = document.getElementById('asignaturaAlumnosList');
  alumnosList.innerHTML = `
    <div class="cards-grid">
      <div class="card card-clickable" onclick="window.showTrimestreDetail('T1')">
        <div class="card-title">1º Trimestre</div>
        <div class="card-meta">Configurar ponderación y notas →</div>
      </div>
      <div class="card card-clickable" onclick="window.showTrimestreDetail('T2')">
        <div class="card-title">2º Trimestre</div>
        <div class="card-meta">Configurar ponderación y notas →</div>
      </div>
      <div class="card card-clickable" onclick="window.showTrimestreDetail('T3')">
        <div class="card-title">3º Trimestre</div>
        <div class="card-meta">Configurar ponderación y notas →</div>
      </div>
    </div>
  `;
}

// Back to asignatura detail
export function backToAsignaturaDetail() {
  const asigNombre = document.getElementById('currentAsignaturaNombre').textContent;
  showAsignaturaDetail(state.currentAsignaturaId, asigNombre);
}
