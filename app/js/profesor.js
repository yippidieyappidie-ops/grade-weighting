// Profesor Module - Vista de asignaturas y alumnos
import { db, state } from './config.js';
import { collection, getDocs, getDoc, doc, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function hideAllViews() {
  ['directorView', 'profesorView', 'studentsView', 'profesoresView', 'asignaturasView', 'asignaturaDetailView', 'notasView'].forEach(id => {
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

// Show asignatura detail (lista de alumnos)
export async function showAsignaturaDetail(asignaturaId, nombre) {
  state.currentAsignaturaId = asignaturaId;
  document.getElementById('currentAsignaturaNombre').textContent = nombre;
  document.getElementById('asignaturaDetailTitle').textContent = `Alumnos - ${nombre}`;
  hideAllViews();
  document.getElementById('asignaturaDetailView').classList.remove('hidden');
  await loadAsignaturaAlumnos(asignaturaId);
}

// Load asignatura alumnos
async function loadAsignaturaAlumnos(asignaturaId) {
  const alumnosList = document.getElementById('asignaturaAlumnosList');
  
  try {
    const asigDoc = await getDoc(doc(db, `colegios/${state.colegioId}/asignaturas`, asignaturaId));
    const asigData = asigDoc.data();
    const alumnosIds = asigData.alumnos || [];
    
    if (alumnosIds.length === 0) {
      alumnosList.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p><strong>No hay alumnos</strong></p></div>';
      return;
    }
    
    let alumnos = [];
    for (const alumnoRef of alumnosIds) {
      const [claseId, alumnoId] = alumnoRef.split('/');
      const alumnoDoc = await getDoc(doc(db, `colegios/${state.colegioId}/clases/${claseId}/alumnos`, alumnoId));
      if (alumnoDoc.exists()) {
        alumnos.push({ id: alumnoRef, ...alumnoDoc.data() });
      }
    }
    
    alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    
    let html = '<div class="cards-grid">';
    alumnos.forEach(alumno => {
      html += `<div class="card card-clickable" onclick="window.showNotasView('${alumno.id}', '${alumno.nombre} ${alumno.apellidos}')">
        <div class="card-title">${alumno.apellidos}, ${alumno.nombre}</div>
        <div class="card-meta">Ver notas →</div>
      </div>`;
    });
    html += '</div>';
    alumnosList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando alumnos:', error);
    alumnosList.innerHTML = '<p style="color: red;">Error</p>';
  }
}

// Back to asignatura detail
export function backToAsignaturaDetail() {
  const asigNombre = document.getElementById('currentAsignaturaNombre').textContent;
  showAsignaturaDetail(state.currentAsignaturaId, asigNombre);
}
