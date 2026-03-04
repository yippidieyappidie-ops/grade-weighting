// Director Module - Gestión de clases, alumnos, profesores y asignaturas
import { db, state } from './config.js';
import { collection, addDoc, getDocs, getDoc, doc, setDoc, serverTimestamp, query, orderBy, where, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Navigation
function hideAllViews() {
  ['directorView', 'profesorView', 'studentsView', 'profesoresView', 'asignaturasView', 'asignaturaDetailView', 'notasView', 'trimestreDetailView'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

export function showDirectorView() {
  hideAllViews();
  document.getElementById('directorView').classList.remove('hidden');
  
  // Update navigation tabs
  updateNavTabs('clases');
  
  loadClasses();
}

export function showProfesoresView() {
  hideAllViews();
  document.getElementById('profesoresView').classList.remove('hidden');
  
  // Update navigation tabs
  updateNavTabs('profesores');
  
  loadProfesores();
}

export function showAsignaturasView() {
  hideAllViews();
  document.getElementById('asignaturasView').classList.remove('hidden');
  
  // Update navigation tabs
  updateNavTabs('asignaturas');
  
  loadAsignaturas();
}

// Update navigation tabs active state
function updateNavTabs(activeTab) {
  // Remove active from all tabs
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  
  // Add active to current tab
  if (activeTab === 'clases') {
    const tab = document.getElementById('navClases');
    if (tab) tab.classList.add('active');
  } else if (activeTab === 'asignaturas') {
    const tab = document.getElementById('navAsignaturasActive');
    if (tab) tab.classList.add('active');
  } else if (activeTab === 'profesores') {
    const tab = document.getElementById('navProfesoresActive');
    if (tab) tab.classList.add('active');
  }
}

export function showStudentsView(classId) {
  state.currentClassId = classId;
  state.currentContext = 'clase'; // Para saber desde dónde vinimos
  hideAllViews();
  document.getElementById('studentsView').classList.remove('hidden');
  
  getDoc(doc(db, `colegios/${state.colegioId}/clases`, classId)).then(classDoc => {
    const classData = classDoc.data();
    document.getElementById('currentClassName').textContent = classData.nombre;
    document.getElementById('studentsViewTitle').textContent = `Trimestres - ${classData.nombre}`;
    // Ya no cargamos estudiantes aquí, se mostrarán los cards de trimestres desde el HTML
  });
}

// Load classes
async function loadClasses() {
  const classesList = document.getElementById('classesList');
  
  try {
    const q = query(collection(db, `colegios/${state.colegioId}/clases`), orderBy('nombre'));
    const snapshot = await getDocs(q);
    state.cachedClasses = [];
    
    if (snapshot.empty) {
      classesList.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><p><strong>No hay clases creadas</strong></p></div>';
      return;
    }

    let html = '<div class="cards-grid">';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      state.cachedClasses.push({ id: docSnap.id, ...data });
      html += `<div class="card card-clickable" onclick="window.showStudentsView('${docSnap.id}')">
        <div class="card-title">${data.nombre}</div>
        <div class="card-meta">📖 ${data.curso}</div>
        <div class="card-meta">${data.numAlumnos || 0} alumnos</div>
      </div>`;
    });
    html += '</div>';
    classesList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando clases:', error);
    classesList.innerHTML = '<p style="color: red;">Error al cargar clases</p>';
  }
}

// Load students
async function loadStudents(classId) {
  const studentsList = document.getElementById('studentsList');
  
  try {
    const q = query(collection(db, `colegios/${state.colegioId}/clases/${classId}/alumnos`), orderBy('apellidos'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      studentsList.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p><strong>No hay alumnos</strong></p></div>';
      return;
    }

    let html = '<table class="table"><thead><tr><th>Alumno</th></tr></thead><tbody>';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      html += `<tr><td><strong>${data.apellidos}, ${data.nombre}</strong></td></tr>`;
    });
    html += '</tbody></table>';
    studentsList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando alumnos:', error);
    studentsList.innerHTML = '<p style="color: red;">Error</p>';
  }
}

// Load profesores
async function loadProfesores() {
  const profesoresList = document.getElementById('profesoresList');
  
  try {
    const q = query(collection(db, 'profesores'), where('colegioId', '==', state.colegioId));
    const snapshot = await getDocs(q);
    state.cachedProfesores = [];
    
    if (snapshot.empty) {
      profesoresList.innerHTML = '<div class="empty-state"><div class="empty-icon">👨‍🏫</div><p><strong>No hay profesores</strong></p></div>';
      return;
    }

    let html = '<table class="table"><thead><tr><th>Email</th><th>Nombre</th><th>Rol</th></tr></thead><tbody>';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      state.cachedProfesores.push({ id: docSnap.id, ...data });
      const rolText = data.rol === 'admin' ? 'Director' : 'Profesor';
      html += `<tr><td><strong>${docSnap.id}</strong></td><td>${data.nombre || '—'}</td><td>${rolText}</td></tr>`;
    });
    html += '</tbody></table>';
    profesoresList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando profesores:', error);
    profesoresList.innerHTML = '<p style="color: red;">Error</p>';
  }
}

// Load asignaturas
async function loadAsignaturas() {
  const asignaturasList = document.getElementById('asignaturasList');
  
  try {
    const q = query(collection(db, `colegios/${state.colegioId}/asignaturas`), orderBy('nombre'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      asignaturasList.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><p><strong>No hay asignaturas</strong></p></div>';
      return;
    }
    
    let html = '<table class="table"><thead><tr><th>Asignatura</th><th>Profesor</th><th>Alumnos</th></tr></thead><tbody>';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      html += `<tr><td><strong>${data.nombre}</strong></td><td>${data.profesorEmail}</td><td>${data.alumnos?.length || 0} alumnos</td></tr>`;
    });
    html += '</tbody></table>';
    asignaturasList.innerHTML = html;
  } catch (error) {
    console.error('Error cargando asignaturas:', error);
    asignaturasList.innerHTML = '<p style="color: red;">Error</p>';
  }
}

// Create class
export async function createClass(nombre, curso) {
  await addDoc(collection(db, `colegios/${state.colegioId}/clases`), {
    nombre,
    curso,
    numAlumnos: 0,
    createdAt: serverTimestamp(),
    createdBy: state.currentUser.email
  });
  loadClasses();
}

// Add student
export async function addStudent(nombre, apellidos) {
  const classDoc = await getDoc(doc(db, `colegios/${state.colegioId}/clases`, state.currentClassId));
  const currentCount = classDoc.data().numAlumnos || 0;
  
  await addDoc(collection(db, `colegios/${state.colegioId}/clases/${state.currentClassId}/alumnos`), {
    nombre,
    apellidos,
    orden: currentCount + 1,
    createdAt: serverTimestamp()
  });
  
  await setDoc(doc(db, `colegios/${state.colegioId}/clases`, state.currentClassId), {
    numAlumnos: currentCount + 1
  }, { merge: true });
  
  loadStudents(state.currentClassId);
}

// Create asignatura with specific students
export async function createAsignatura(nombre, profesorEmail, alumnos) {
  const asignaturaRef = await addDoc(collection(db, `colegios/${state.colegioId}/asignaturas`), {
    nombre,
    profesorEmail,
    alumnos, // Array de referencias: ["claseId/alumnoId", ...]
    trimestres: ['T1', 'T2', 'T3'],
    createdAt: serverTimestamp(),
    createdBy: state.currentUser.email
  });
  
  await updateDoc(doc(db, 'profesores', profesorEmail), {
    asignaturas: arrayUnion(asignaturaRef.id)
  });
  
  loadAsignaturas();
  return asignaturaRef.id;
}

// Invite profesor
export async function inviteProfesor(email, nombre) {
  const profesorDoc = await getDoc(doc(db, 'profesores', email));
  
  if (profesorDoc.exists()) {
    throw new Error('Este profesor ya existe');
  }
  
  await setDoc(doc(db, 'profesores', email), {
    nombre: nombre || '',
    colegioId: state.colegioId,
    rol: 'profesor',
    asignaturas: [],
    createdAt: serverTimestamp(),
    invitedBy: state.currentUser.email
  });
  
  loadProfesores();
}

// Load alumnos for selection (multi-class selector)
export async function loadAlumnosForSelection() {
  if (state.cachedClasses.length === 0) await loadClasses();
  
  let html = '';
  for (const clase of state.cachedClasses) {
    const q = query(collection(db, `colegios/${state.colegioId}/clases/${clase.id}/alumnos`), orderBy('apellidos'));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      html += `<div class="clase-group">
        <div class="clase-group-header">
          <span>${clase.nombre} (${clase.curso})</span>
          <span class="select-all-btn" onclick="window.selectAllFromClase('${clase.id}')">Seleccionar todos</span>
        </div>`;
      
      snapshot.forEach(alumnoDoc => {
        const alumno = alumnoDoc.data();
        const alumnoRef = `${clase.id}/${alumnoDoc.id}`;
        html += `<div class="checkbox-item">
          <input type="checkbox" id="alumno-${alumnoRef.replace('/', '-')}" value="${alumnoRef}" name="alumnos">
          <label for="alumno-${alumnoRef.replace('/', '-')}">${alumno.apellidos}, ${alumno.nombre}</label>
        </div>`;
      });
      
      html += '</div>';
    }
  }
  
  return html || '<div class="empty-state" style="padding:40px;"><p>No hay alumnos disponibles</p></div>';
}

// Select all from clase
export function selectAllFromClase(claseId) {
  const checkboxes = document.querySelectorAll(`input[value^="${claseId}/"]`);
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);
}

// Show trimestre detail (ponderación + alumnos)
export async function showTrimestreDetail(trimestre) {
  state.currentTrimestre = trimestre;
  hideAllViews();
  document.getElementById('trimestreDetailView').classList.remove('hidden');
  
  // Cargar ponderación guardada
  await loadPonderacion(trimestre);
  
  // Cargar lista de alumnos
  await loadAlumnosForTrimestre(trimestre);
  
  // Actualizar títulos
  const trimestreNames = { 'T1': '1º Trimestre', 'T2': '2º Trimestre', 'T3': '3º Trimestre' };
  document.getElementById('currentTrimestre').textContent = trimestreNames[trimestre];
  document.getElementById('trimestreDetailTitle').textContent = trimestreNames[trimestre];
  
  // Actualizar breadcrumb context
  if (state.currentContext === 'clase') {
    const className = document.getElementById('currentClassName').textContent;
    document.getElementById('trimestreDetailContext').textContent = className;
  } else {
    const asignaturaName = document.getElementById('currentAsignaturaNombre').textContent;
    document.getElementById('trimestreDetailContext').textContent = asignaturaName;
  }
}

// Load ponderación for trimestre
async function loadPonderacion(trimestre) {
  try {
    let ponderacionDocPath;
    if (state.currentContext === 'clase') {
      ponderacionDocPath = `colegios/${state.colegioId}/clases/${state.currentClassId}/ponderaciones/${trimestre}`;
    } else {
      ponderacionDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/ponderaciones/${trimestre}`;
    }
    
    const ponderacionDoc = await getDoc(doc(db, ponderacionDocPath));
    
    if (ponderacionDoc.exists()) {
      const data = ponderacionDoc.data();
      document.getElementById('pesoExamenes').value = data.Exámenes || 70;
      document.getElementById('pesoTareas').value = data.Tareas || 20;
      document.getElementById('pesoParticipacion').value = data.Participación || 10;
    } else {
      // Valores por defecto
      document.getElementById('pesoExamenes').value = 70;
      document.getElementById('pesoTareas').value = 20;
      document.getElementById('pesoParticipacion').value = 10;
    }
    
    updatePesoTotal();
  } catch (error) {
    console.error('Error cargando ponderación:', error);
  }
}

// Update peso total display
function updatePesoTotal() {
  const examenes = parseInt(document.getElementById('pesoExamenes').value) || 0;
  const tareas = parseInt(document.getElementById('pesoTareas').value) || 0;
  const participacion = parseInt(document.getElementById('pesoParticipacion').value) || 0;
  const total = examenes + tareas + participacion;
  
  document.getElementById('pesoTotal').textContent = total;
  document.getElementById('pesoTotal').style.color = total === 100 ? 'var(--green)' : 'var(--accent)';
}

// Auto-update total when inputs change
['pesoExamenes', 'pesoTareas', 'pesoParticipacion'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', updatePesoTotal);
  }
});

// Save ponderación
export async function guardarPonderacion() {
  try {
    const examenes = parseInt(document.getElementById('pesoExamenes').value) || 0;
    const tareas = parseInt(document.getElementById('pesoTareas').value) || 0;
    const participacion = parseInt(document.getElementById('pesoParticipacion').value) || 0;
    const total = examenes + tareas + participacion;
    
    if (total !== 100) {
      alert('La suma de los porcentajes debe ser 100%');
      return;
    }
    
    let ponderacionDocPath;
    if (state.currentContext === 'clase') {
      ponderacionDocPath = `colegios/${state.colegioId}/clases/${state.currentClassId}/ponderaciones/${state.currentTrimestre}`;
    } else {
      ponderacionDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/ponderaciones/${state.currentTrimestre}`;
    }
    
    await setDoc(doc(db, ponderacionDocPath), {
      'Exámenes': examenes,
      'Tareas': tareas,
      'Participación': participacion,
      updatedAt: serverTimestamp()
    });
    
    alert('✅ Ponderación guardada correctamente');
  } catch (error) {
    console.error('Error guardando ponderación:', error);
    alert('Error al guardar la ponderación');
  }
}

// Load alumnos for trimestre
async function loadAlumnosForTrimestre(trimestre) {
  const alumnosList = document.getElementById('trimestreAlumnosList');
  
  try {
    let alumnos = [];
    
    if (state.currentContext === 'clase') {
      // Cargar alumnos de la clase
      const q = query(collection(db, `colegios/${state.colegioId}/clases/${state.currentClassId}/alumnos`), orderBy('apellidos'));
      const snapshot = await getDocs(q);
      
      snapshot.forEach(alumnoDoc => {
        const alumno = alumnoDoc.data();
        alumnos.push({
          id: `${state.currentClassId}/${alumnoDoc.id}`,
          nombre: alumno.nombre,
          apellidos: alumno.apellidos
        });
      });
    } else {
      // Cargar alumnos de la asignatura
      const asigDoc = await getDoc(doc(db, `colegios/${state.colegioId}/asignaturas`, state.currentAsignaturaId));
      const alumnosIds = asigDoc.data().alumnos || [];
      
      for (const alumnoRef of alumnosIds) {
        const [claseId, alumnoId] = alumnoRef.split('/');
        const alumnoDoc = await getDoc(doc(db, `colegios/${state.colegioId}/clases/${claseId}/alumnos`, alumnoId));
        if (alumnoDoc.exists()) {
          const alumno = alumnoDoc.data();
          alumnos.push({
            id: alumnoRef,
            nombre: alumno.nombre,
            apellidos: alumno.apellidos
          });
        }
      }
    }
    
    if (alumnos.length === 0) {
      alumnosList.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p><strong>No hay alumnos</strong></p></div>';
      return;
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
    alumnosList.innerHTML = '<p style="color:red;">Error al cargar alumnos</p>';
  }
}

// Back to class or asignatura
export function backToClassOrAsignatura() {
  if (state.currentContext === 'clase') {
    showStudentsView(state.currentClassId);
  } else {
    // Implementar en profesor.js
    window.showAsignaturaDetail(state.currentAsignaturaId, document.getElementById('currentAsignaturaNombre').textContent);
  }
}
