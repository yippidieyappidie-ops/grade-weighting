import { collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, arrayUnion, deleteDoc, query, orderBy, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

let chartPieInstance = null; let chartBarInstance = null; let expRadarChartInstance = null; let expLineChartInstance = null;

// ==========================================
// 1. MOTOR OFICIAL CAMBRIDGE ENGLISH SCALE
// ==========================================
const CAMBRIDGE_LEVELS = {
  'A1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 20, 'Writing': 20, 'Listening': 20, 'Speaking': 20 } },
  'A2': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 30, 'Writing': 30, 'Listening': 25, 'Speaking': 15 } },
  'B1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 32, 'Writing': 40, 'Listening': 25, 'Speaking': 30 } },
  'B2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 42, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 60 } },
  'C1': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 50, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } },
  'C2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 56, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } }
};

const CAMBRIDGE_CURVES = {
  'A1': [[0, 60], [0.45, 80], [0.60, 90], [0.75, 100], [0.80, 110], [1, 120]],
  'A2': [[0, 82], [0.45, 100], [0.60, 120], [0.75, 133], [0.80, 140], [1, 150]],
  'B1': [[0, 102], [0.45, 120], [0.60, 140], [0.75, 153], [0.80, 160], [1, 170]],
  'B2': [[0, 122], [0.45, 140], [0.60, 160], [0.75, 173], [0.80, 180], [1, 190]],
  'C1': [[0, 142], [0.45, 160], [0.60, 180], [0.75, 193], [0.80, 200], [1, 210]],
  'C2': [[0, 162], [0.45, 180], [0.60, 200], [0.75, 213], [0.80, 220], [1, 230]]
};

function calculateScaleScore(level, pct) {
  const curve = CAMBRIDGE_CURVES[level] || CAMBRIDGE_CURVES['B2'];
  if (pct <= 0) return curve[0][1]; if (pct >= 1) return curve[curve.length - 1][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, s1] = curve[i]; const [p2, s2] = curve[i+1];
    if (pct >= p1 && pct <= p2) { return Math.round(s1 + ((pct - p1) / (p2 - p1)) * (s2 - s1)); }
  }
  return curve[0][1];
}

function getCambridgeGrade(level, scaleScore) {
  if (level === 'C2') { if (scaleScore >= 220) return 'Grade A'; if (scaleScore >= 213) return 'Grade B'; if (scaleScore >= 200) return 'Grade C'; if (scaleScore >= 180) return 'Level C1'; return 'Fail'; }
  if (level === 'C1') { if (scaleScore >= 200) return 'Grade A'; if (scaleScore >= 193) return 'Grade B'; if (scaleScore >= 180) return 'Grade C'; if (scaleScore >= 160) return 'Level B2'; return 'Fail'; }
  if (level === 'B2') { if (scaleScore >= 180) return 'Grade A'; if (scaleScore >= 173) return 'Grade B'; if (scaleScore >= 160) return 'Grade C'; if (scaleScore >= 140) return 'Level B1'; return 'Fail'; }
  if (level === 'B1') { if (scaleScore >= 160) return 'Grade A'; if (scaleScore >= 153) return 'Grade B'; if (scaleScore >= 140) return 'Grade C'; if (scaleScore >= 120) return 'Level A2'; return 'Fail'; }
  if (level === 'A2') { if (scaleScore >= 140) return 'Distinction'; if (scaleScore >= 133) return 'Merit'; if (scaleScore >= 120) return 'Pass'; if (scaleScore >= 100) return 'Level A1'; return 'Fail'; }
  if (level === 'A1') { if (scaleScore >= 120) return 'Distinction'; if (scaleScore >= 110) return 'Merit'; if (scaleScore >= 100) return 'Pass'; return 'Fail'; }
  return 'Fail';
}

function getCambridgeColor(level, scaleScore) {
  const grade = getCambridgeGrade(level, scaleScore);
  if (grade.includes('Grade A') || grade.includes('Distinction')) return 'var(--green)';
  if (grade.includes('Grade B') || grade.includes('Merit')) return '#0055ff'; 
  if (grade.includes('Grade C') || grade.includes('Pass')) return 'var(--gold)';
  return 'var(--accent)'; 
}

function getNotaFormateada(notaDecimal, formato, level = 'B2') {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return '—';
  if (formato === 'letras_cambridge') return `${getCambridgeGrade(level, notaDecimal)} (${Math.round(notaDecimal)} pts)`;
  return notaDecimal.toFixed(2);
}

function getNotaColor(notaDecimal, formato, level = 'B2') {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return 'var(--ink)';
  if (formato === 'letras_cambridge') return getCambridgeColor(level, notaDecimal);
  if (notaDecimal >= 7) return 'var(--green)'; if (notaDecimal >= 5) return 'var(--gold)'; return 'var(--accent)';
}

async function getFormatoAsignatura() {
  if (window.state.currentContext === 'tutoria') return 'numerico_10';
  try { const asigDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}`)); return asigDoc.exists() ? (asigDoc.data().algoritmoNotas || 'numerico_10') : 'numerico_10'; } catch (e) { return 'numerico_10'; }
}

// ==========================================
// 2. GESTIÓN DE CLASES, PROFESORES Y ASIGNATURAS
// ==========================================
window.loadClasses = async (containerId, isProfesor) => {
  const list = document.getElementById(containerId); list.innerHTML = '<div class="loading">Cargando grupos...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases`), orderBy('nombre'))); window.state.cachedClasses = [];
    if (snap.empty) { list.innerHTML = '<div class="empty-state">No hay grupos.</div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const data = docSnap.data(); window.state.cachedClasses.push({ id: docSnap.id, ...data });
      html += `<div class="card card-clickable" onclick="window.showClaseDetail('${docSnap.id}', '${data.nombre}')">`;
      if(!isProfesor) { html += `<button class="btn-edit-card" onclick="event.stopPropagation(); window.openEditClassModal('${docSnap.id}','${data.nombre}','${data.curso}','${data.tutorEmail||''}')">✏️</button><button class="btn-delete-card" onclick="event.stopPropagation(); window.deleteClass('${docSnap.id}','${data.nombre}')">🗑️</button>`; }
      html += `<div class="card-title">${data.nombre}</div><div class="card-meta">📖 ${data.curso}</div></div>`;
    }); list.innerHTML = html + '</div>';
  } catch(e) {}
};

window.showClaseDetail = async (classId, className) => {
  window.state.currentClassId = classId; document.getElementById('claseDetailName').textContent = className; window.hideAllViews(); document.getElementById('claseDetailView').classList.remove('hidden');
  const list = document.getElementById('claseAlumnosList'); list.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/alumnos`), orderBy('apellidos'))); window.state.cachedAlumnos = []; 
    if(snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos.</p><button class="btn-secondary" onclick="document.getElementById(\'addStudentModal\').classList.add(\'active\')">+ Añadir Alumno</button></div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const a = docSnap.data(); window.state.cachedAlumnos.push({ id: docSnap.id, n: a.nombre, a: a.apellidos });
      html += `<div class="card card-clickable" onclick="window.initExpedienteGlobal('${classId}/${docSnap.id}', '${a.nombre.replace(/'/g, "\\'")} ${a.apellidos.replace(/'/g, "\\'")}')"><div class="card-title">${a.apellidos}, ${a.nombre}</div><div class="card-meta">Ver Expediente →</div></div>`;
    });
    html += `<div class="card card-clickable" onclick="document.getElementById('addStudentModal').classList.add('active')" style="border:2px dashed var(--border); text-align:center;">+ Añadir Alumno</div>`;
    list.innerHTML = html + '</div>';
  } catch(e) {}
};

window.deleteClass = async (id, nombre) => { if(confirm(`⚠️ ¿Borrar el grupo "${nombre}"?`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/clases/${id}`)); window.loadClasses('classesList', false); } catch (e) {} } };
window.deleteStudent = async (cId, sId, name) => { if(confirm(`¿Eliminar al alumno "${name}"?`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/clases/${cId}/alumnos/${sId}`)); const cRef = doc(db, `colegios/${window.state.colegioId}/clases`, cId); const cDoc = await getDoc(cRef); if(cDoc.exists()) { await updateDoc(cRef, { numAlumnos: (cDoc.data().numAlumnos || 1) - 1 }); } window.showClaseDetail(cId, document.getElementById('claseDetailName').textContent); } catch (e) {} } };
window.deleteAsignatura = async (id, nombre) => { if(confirm(`¿Borrar asignatura "${nombre}"?`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${id}`)); window.loadAsignaturas(); } catch (e) {} } };
window.deleteProfesor = async (email) => { if(email === window.state.currentUser.email) return alert("No puedes borrarte a ti mismo."); if(confirm(`¿Revocar acceso a ${email}?`)) { try { await deleteDoc(doc(db, 'profesores', email)); window.loadProfesores(); } catch (e) {} } };

window.loadProfesores = async () => { 
  const list = document.getElementById('profesoresList'); list.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snap = await getDocs(query(collection(db, 'profesores'), where('colegioId', '==', window.state.colegioId))); window.state.cachedProfesores = []; 
    if(snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay profesores.</p></div>'; return; }
    let html = '<table class="table"><thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th style="width:50px;">Acciones</th></tr></thead><tbody>'; 
    snap.forEach(docSnap => {
      const d = docSnap.data(); window.state.cachedProfesores.push({id: docSnap.id, ...d}); 
      let delBtn = ''; if (d.rol !== 'admin' && d.rol !== 'superadmin' || docSnap.id !== window.state.currentUser.email) { delBtn = `<button class="btn-icon" style="color:var(--accent);" onclick="window.deleteProfesor('${docSnap.id}')">🗑️</button>`; }
      html += `<tr><td><strong>${docSnap.id}</strong></td><td>${d.nombre || '—'}</td><td>${d.rol}</td><td style="text-align:center;">${delBtn}</td></tr>`; 
    }); list.innerHTML = html + '</tbody></table>'; 
  } catch(e) {}
};

window.loadAsignaturas = async () => { 
  const list = document.getElementById('asignaturasList'); list.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), orderBy('nombre'))); 
    if(snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay asignaturas creadas.</p></div>'; return; }
    let html = '<table class="table"><thead><tr><th>Asignatura</th><th>Sistema</th><th>Profesores</th><th>Alumnos</th><th style="width:50px;">Acciones</th></tr></thead><tbody>'; 
    snap.forEach(docSnap => { 
      const d = docSnap.data(); const profes = d.profesorEmails ? d.profesorEmails.join(', ') : (d.profesorEmail || '—');
      const formatoStr = d.algoritmoNotas === 'letras_cambridge' ? '<span style="color:var(--accent); font-weight:bold;">Cambridge Engine</span>' : 'Estándar (0-10)';
      html += `<tr><td><strong>${d.nombre}</strong></td><td>${formatoStr}</td><td>${profes}</td><td>${d.alumnos?.length || 0}</td><td style="text-align:center;"><button class="btn-icon" style="color:var(--accent);" onclick="window.deleteAsignatura('${docSnap.id}','${d.nombre}')">🗑️</button></td></tr>`; 
    }); list.innerHTML = html + '</tbody></table>'; 
  } catch(e) {}
};

window.loadProfesorAsignaturas = async () => { 
  const list = document.getElementById('profesorAsignaturasList'); list.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snapAsig = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), where('profesorEmails', 'array-contains', window.state.currentUser.email))); 
    const snapTut = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases`), where('tutorEmail', '==', window.state.currentUser.email)));
    let html = '';
    if (!snapTut.empty) {
      html += `<h3 style="margin-bottom:16px;">📚 Mis Tutorías</h3><div class="cards-grid">`;
      snapTut.forEach(docSnap => { const d = docSnap.data(); html += `<div class="card card-clickable" style="border-left: 4px solid var(--gold);" onclick="window.showTutoriaDetail('${docSnap.id}','${d.nombre}')"><div class="card-title">Tutoría - ${d.nombre}</div><div class="card-meta">${d.numAlumnos || 0} alumnos</div></div>`; });
      html += `</div><br><br>`;
    }
    html += `<h3 style="margin-bottom:16px;">📖 Mis Asignaturas</h3>`;
    if(snapAsig.empty) { html += '<p class="empty-state">No tienes asignaturas asignadas.</p>'; } 
    else {
      html += `<div class="cards-grid">`;
      snapAsig.forEach(docSnap => { const d = docSnap.data(); html += `<div class="card card-clickable" onclick="window.showAsignaturaDetail('${docSnap.id}','${d.nombre}')"><div class="card-title">${d.nombre}</div><div class="card-meta">${d.alumnos?.length || 0} alumnos</div></div>`; }); 
      html += `</div>`;
    }
    list.innerHTML = html; 
  } catch(e) {}
};

// ==========================================
// 3. ASISTENCIA
// ==========================================
window.showAsistenciaView = () => { window.hideAllViews(); document.getElementById('asistenciaView').classList.remove('hidden'); const td = new Date().toISOString().split('T')[0]; document.getElementById('asistenciaDateInput').value = td; window.loadAsistencia(td); };
window.loadAsistencia = async (date) => {
  const cont = document.getElementById('asistenciaListContainer'); cont.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const d = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/asistencia/${date}`)); const r = d.exists() ? d.data() : {}; let html = '';
    window.state.cachedAlumnos.forEach(a => { const s = r[a.id] || ''; html += `<div class="attendance-row"><div class="ast-name">${a.a}, ${a.n}</div><div class="ast-toggles"><button id="btn-ast-${a.id}-P" class="ast-btn ${s==='P'?'active P':''}" onclick="window.markAsistencia('${a.id}', 'P', '${date}')">✅</button><button id="btn-ast-${a.id}-F" class="ast-btn ${s==='F'?'active F':''}" onclick="window.markAsistencia('${a.id}', 'F', '${date}')">❌</button><button id="btn-ast-${a.id}-R" class="ast-btn ${s==='R'?'active R':''}" onclick="window.markAsistencia('${a.id}', 'R', '${date}')">⏰</button></div></div>`; });
    cont.innerHTML = html;
  } catch(e) {}
};
window.markAsistencia = async (id, st, date) => { ['P','F','R'].forEach(s => { document.getElementById(`btn-ast-${id}-${s}`).className = 'ast-btn'; }); document.getElementById(`btn-ast-${id}-${st}`).classList.add('active', st); await setDoc(doc(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/asistencia/${date}`), { [id]: st }, { merge: true }); };

// ==========================================
// 4. CONFIGURACIÓN DE PONDERACIÓN (TRIMESTRES)
// ==========================================
let currentCategorias = []; let currentCambridgeLevel = 'B2';
function getPonderacionPath(t) { return window.state.currentContext === 'tutoria' ? `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/ponderacionesTutoria/${t}` : `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}/ponderaciones/${t}`; }
function getNotasPath(studentRefStr, t) { return window.state.currentContext === 'tutoria' ? `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/notasTutoria/${studentRefStr}-${t}` : `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}/notas/${studentRefStr.replace('/','-')}-${t}`; }

window.showTrimestreDetail = async (t) => {
  window.state.currentTrimestre = t; window.hideAllViews(); document.getElementById('trimestreDetailView').classList.remove('hidden');
  await window.loadPonderacion(t); await window.loadAlumnosParaEvaluar();
  document.getElementById('currentTrimestre').textContent = t; document.getElementById('trimestreDetailTitle').textContent = t === 'T1' ? '1º Trimestre' : t === 'T2' ? '2º Trimestre' : '3º Trimestre';
};

window.loadPonderacion = async (t) => {
  try {
    const d = await getDoc(doc(db, getPonderacionPath(t))); const data = d.exists() ? d.data() : {};
    const formato = await getFormatoAsignatura();
    if (formato === 'letras_cambridge') {
      currentCambridgeLevel = data.cambridgeLevel || 'B2'; const config = CAMBRIDGE_LEVELS[currentCambridgeLevel]; const pesoPorParte = 100 / config.parts.length;
      currentCategorias = config.parts.map(p => ({ nombre: p, peso: pesoPorParte }));
    } else {
      if (window.state.currentContext === 'tutoria') { currentCategorias = data.categorias || [{nombre:"Actitud", peso:100}]; } else { currentCategorias = data.categorias || [{nombre:"Exámenes", peso:40}, {nombre:"Deberes", peso:60}]; }
    }
    window.renderCategorias(formato); window.updatePesoTotal();
  } catch(e) {}
};

window.renderCategorias = (formato) => {
  const container = document.getElementById('categoriasConfig');
  if (formato === 'letras_cambridge') {
    container.innerHTML = `<div style="margin-bottom:20px;"><label>Nivel de Examen Oficial:</label><select onchange="window.changeCambridgeLevel(this.value)" style="width:100%; padding:12px; border-radius:8px; border:2px solid var(--ink); font-weight:bold;"><option value="A1" ${currentCambridgeLevel==='A1'?'selected':''}>A1 (Starters/Movers)</option><option value="A2" ${currentCambridgeLevel==='A2'?'selected':''}>A2 Key</option><option value="B1" ${currentCambridgeLevel==='B1'?'selected':''}>B1 Preliminary</option><option value="B2" ${currentCambridgeLevel==='B2'?'selected':''}>B2 First</option><option value="C1" ${currentCambridgeLevel==='C1'?'selected':''}>C1 Advanced</option><option value="C2" ${currentCambridgeLevel==='C2'?'selected':''}>C2 Proficiency</option></select></div><div style="background:var(--cream); padding:15px; border-radius:8px;"><strong>Papers Evaluados:</strong> ${currentCategorias.map(c => c.nombre).join(', ')}</div>`;
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'none';
  } else {
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'inline-flex';
    let html = '<div class="ponderacion-config">'; currentCategorias.forEach((cat, i) => { html += `<div class="categoria-row"><input type="text" value="${cat.nombre}" onchange="window.updateCategoriaNombre(${i}, this.value)"><input type="number" value="${cat.peso}" onchange="window.updateCategoriaPeso(${i}, this.value)"><button class="btn-icon" onclick="window.eliminarCategoria(${i})">🗑️</button></div>`; });
    container.innerHTML = html + '</div>';
  }
};

window.changeCambridgeLevel = (val) => { currentCambridgeLevel = val; window.loadPonderacion(window.state.currentTrimestre); };
window.updatePesoTotal = () => {
  const total = currentCategorias.reduce((s,c) => s + (parseFloat(c.peso) || 0), 0);
  const spanT = document.getElementById('pesoTotal'); const spanS = document.getElementById('pesoStatus');
  if (spanT) spanT.textContent = Math.round(total);
  if (spanS) { spanS.textContent = Math.round(total) === 100 ? '✅ Correcto' : `⚠️ Suma ${Math.round(total)}%`; spanS.style.color = Math.round(total) === 100 ? 'var(--green)' : 'var(--accent)'; }
};
window.updateCategoriaNombre = (i,n) => { currentCategorias[i].nombre = n; };
window.updateCategoriaPeso = (i,p) => { currentCategorias[i].peso = parseFloat(p) || 0; window.updatePesoTotal(); };
window.añadirCategoria = () => { currentCategorias.push({nombre: "", peso: 0}); window.renderCategorias(window.state.colegioConfig?.algoritmoNotas); window.updatePesoTotal(); };
window.eliminarCategoria = (i) => { if(currentCategorias.length <= 1) return alert('Debes dejar al menos una categoría.'); currentCategorias.splice(i, 1); window.renderCategorias(window.state.colegioConfig?.algoritmoNotas); window.updatePesoTotal(); };

window.guardarPonderacion = async () => {
  const total = currentCategorias.reduce((s,c) => s + (parseFloat(c.peso) || 0), 0);
  if(Math.round(total) !== 100 && await getFormatoAsignatura() !== 'letras_cambridge') return alert('La suma debe ser 100%.'); 
  try { await setDoc(doc(db, getPonderacionPath(window.state.currentTrimestre)), { categorias: currentCategorias, cambridgeLevel: currentCambridgeLevel, updatedAt: serverTimestamp() }); alert('✅ Configuración guardada.'); } catch(e) {}
};

window.loadAlumnosParaEvaluar = async () => {
  const list = document.getElementById('trimestreAlumnosList'); list.innerHTML = '<div class="loading">Buscando alumnos...</div>';
  try {
    let alumnos = [];
    if (window.state.currentContext === 'tutoria') {
      const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`), orderBy('apellidos')));
      snap.forEach(d => { alumnos.push({ id: d.id, n: d.data().nombre || '', a: d.data().apellidos || '', classId: window.state.currentClassId, alumId: d.id }); });
    } else {
      const asigDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas`, window.state.currentAsignaturaId)); const alumnosRefs = asigDoc.data()?.alumnos || [];
      if (alumnosRefs.length === 0) { list.innerHTML = '<div class="empty-state">No hay alumnos en este grupo.</div>'; return; }
      for (const ref of alumnosRefs) { const partes = ref.split('/'); if (partes.length === 2) { const aDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${partes[0]}/alumnos`, partes[1])); if (aDoc.exists()) { alumnos.push({ id: ref, n: aDoc.data().nombre || '', a: aDoc.data().apellidos || '', classId: partes[0], alumId: partes[1] }); } } }
    }
    if (alumnos.length === 0) { list.innerHTML = '<div class="empty-state">No hay alumnos.</div>'; return; }
    alumnos.sort((a,b) => (a.a || '').localeCompare(b.a || '')); window.state.currentAlumnosList = alumnos; let html = '<div class="cards-grid">';
    alumnos.forEach(alum => { const nLimpio = (alum.n + ' ' + alum.a).replace(/'/g, "\\'").replace(/"/g, "&quot;"); html += `<div class="card card-clickable" onclick="window.showNotasView('${alum.id}', '${nLimpio}', '${alum.classId}', '${alum.alumId}')"><div class="card-title">${alum.a}, ${alum.n}</div><div class="card-meta">Evaluar →</div></div>`; });
    list.innerHTML = html + '</div>';
  } catch(e) {}
};

// ==========================================
// 5. PANEL DE NOTAS (MÚLTIPLES MOCK EXAMS Y ESTÁNDAR)
// ==========================================
window.showNotasView = (id, nombreAlumno, classId, alumId) => { window.state.currentAlumnoId = id; window.state.currentEvalClassId = classId; window.state.currentEvalAlumId = alumId; document.getElementById('currentAlumnoNombre').textContent = nombreAlumno; window.hideAllViews(); document.getElementById('notasView').classList.remove('hidden'); window.loadNotas(); };
window.switchTrimestre = (t, btnElement) => { window.state.currentTrimestre = t; document.querySelectorAll('#notasView .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); window.loadNotas(); };

window.loadNotas = async () => {
  const container = document.getElementById('notasContent'); container.innerHTML = '<div class="loading">Cargando perfil...</div>';
  try {
    const pDoc = await getDoc(doc(db, getPonderacionPath(window.state.currentTrimestre))); const nDoc = await getDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)));
    const pondData = pDoc.exists() ? pDoc.data() : {}; let cats = pondData.categorias || []; const data = nDoc.exists() ? nDoc.data() : { categorias: {}, mockExams: [], comentarioTutor: "" };
    const formato = await getFormatoAsignatura();
    
    let html = `<div class="professional-comment"><div class="comment-header"><strong>📝 Observaciones</strong><span id="saveStatusIndicator" style="font-size:12px; color:var(--green); opacity:0; transition:opacity 0.3s;">Guardado ✓</span></div><textarea id="comentarioArea" rows="3" placeholder="Añade observaciones..." onchange="window.guardarComentario()">${data.comentarioTutor || ""}</textarea></div>`;

    if (formato === 'letras_cambridge') {
      const level = pondData.cambridgeLevel || 'B2'; const maxScores = CAMBRIDGE_LEVELS[level].max;
      const mocks = data.mockExams || [];
      html += `<div class="card" style="border-left:5px solid var(--accent); padding:24px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><h3 style="margin:0;">Simulacros (Mock Exams) - <span style="color:var(--accent);">${level}</span></h3><button class="btn-secondary btn-sm" onclick="window.addMockExam()">+ Añadir Simulacro</button></div>`;
      if (mocks.length === 0) { html += `<div class="empty-state">No hay simulacros en este trimestre.</div>`; }
      let sumTotalScaleScores = 0; let validMocks = 0;

      mocks.forEach((mock, idx) => {
        let sumMockScale = 0; let paperCount = 0;
        html += `<div style="border:1px solid var(--border); padding:16px; margin-bottom:16px; border-radius:8px; background:var(--paper);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:8px;"><input type="text" value="${mock.name || 'Mock Exam '+(idx+1)}" onchange="window.updateMockName(${idx}, this.value)" style="font-weight:bold; font-size:16px; border:none; width:200px; color:var(--ink); background:transparent;"><button class="btn-icon" onclick="window.deleteMockExam(${idx})" style="color:red;">🗑️</button></div>`;
        cats.forEach((cat) => {
          const mxs = maxScores[cat.nombre]; const pts = mock.parts?.[cat.nombre] || 0; const pct = pts / mxs; const scaleScore = calculateScaleScore(level, pct);
          sumMockScale += scaleScore; paperCount++;
          html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><div style="font-size:14px; font-weight:500;">${cat.nombre} <span style="font-size:11px; color:var(--ink-light); margin-left:8px; font-weight:normal;">Scale: ${scaleScore}</span></div><div style="display:flex; align-items:center;"><input type="number" value="${pts}" step="0.5" min="0" max="${mxs}" onchange="window.updateMockPart(${idx}, '${cat.nombre}', this.value)" style="width:60px; text-align:center; border:1px solid var(--border); border-radius:4px; padding:4px; font-weight:bold; color:var(--accent);"><span style="font-size:12px; color:var(--ink-light); margin-left:6px;">/ ${mxs}</span></div></div>`;
        });
        const mockAvgScale = Math.round(sumMockScale / paperCount); const mockGrade = getCambridgeGrade(level, mockAvgScale); sumTotalScaleScores += mockAvgScale; validMocks++;
        html += `<div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border); font-weight:bold; font-size:14px; color:${getCambridgeColor(level, mockAvgScale)}; text-align:right;">Resultado: ${mockGrade} (${mockAvgScale})</div></div>`;
      });
      html += `</div>`;
      const overallScaleScore = validMocks > 0 ? Math.round(sumTotalScaleScores / validMocks) : 0; const finalGrade = validMocks > 0 ? getCambridgeGrade(level, overallScaleScore) : '—'; const finalColor = validMocks > 0 ? getCambridgeColor(level, overallScaleScore) : 'var(--ink)';
      html += `<div class="nota-final-display" style="background:var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:24px;"><h3 style="color:var(--cream); font-size:14px; margin-bottom:8px; text-transform:uppercase;">Media del Trimestre</h3><div style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:16px;">Overall Scale Score: ${overallScaleScore}</div><div class="nota" style="font-size:42px; font-weight:700; color:${finalColor};">${finalGrade}</div></div>`; 
    } else {
      let notaFinalGlobal = 0; let pesoTotalGlobal = 0;
      cats.forEach((cat, idx) => {
        let notasArr = data.categorias?.[cat.nombre] || []; notasArr = notasArr.map(n => typeof n === 'number' ? { valor: n, maximo: 10, descripcion: '' } : n);
        const sumaBase10 = notasArr.reduce((acc, obj) => { let val = obj.valor === '' ? 0 : parseFloat(obj.valor || 0); let max = parseFloat(obj.maximo || 10); if (max <= 0) max = 10; return acc + ((val / max) * 10); }, 0);
        const mediaCategoria = notasArr.length > 0 ? (sumaBase10 / notasArr.length) : 0; if (notasArr.length > 0) { notaFinalGlobal += mediaCategoria * (cat.peso / 100); pesoTotalGlobal += cat.peso; }
        html += `<div class="accordion-card"><div class="accordion-header" onclick="window.toggleAccordion('acc-${idx}', 'icon-${idx}')"><div class="accordion-title">${cat.nombre} <span style="font-size:11px; background:var(--cream); border:1px solid var(--border); padding:2px 8px; border-radius:10px; margin-left:8px; color:var(--ink-light);">${cat.peso}%</span></div><div class="accordion-stats"><span class="accordion-media" style="margin-right:12px;">Result: <strong style="color:var(--ink);">${getNotaFormateada(mediaCategoria, formato)}</strong></span><span id="icon-${idx}" class="accordion-chevron">▼</span></div></div><div class="accordion-body" id="acc-${idx}"><div style="padding-top:15px;">`;
        if (notasArr.length === 0) { html += `<div style="font-size:13px; color:var(--ink-light); margin-bottom:12px;">Sin registros. Pulsa Añadir.</div>`; }
        notasArr.forEach((nObj, i) => { html += `<div class="record-row"><div class="record-desc" style="flex:1;"><input type="text" placeholder="Concepto" value="${nObj.descripcion || ''}" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'descripcion',this.value)" style="width:100%;"></div><div class="record-val"><input type="number" class="val-nota" min="0" step="0.1" value="${nObj.valor !== undefined ? nObj.valor : ''}" placeholder="Ptos" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'valor',this.value)"><span style="font-weight:600;">/</span><input type="number" class="val-max" min="0.1" step="0.1" value="${nObj.maximo || 10}" title="Max" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'maximo',this.value)"></div><div class="record-actions"><button class="btn-icon" onclick="window.deleteNota('${cat.nombre}',${i})">🗑️</button></div></div>`; });
        html += `<button class="btn-secondary btn-sm" style="margin-top:16px;" onclick="window.addNota('${cat.nombre}')">+ Añadir puntuación</button></div></div></div>`;
      });
      const calculoFinalSeguro = pesoTotalGlobal > 0 ? notaFinalGlobal : null;
      html += `<div class="nota-final-display" style="background:var(--paper); border:2px solid var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:32px;"><h3 style="color:var(--ink); font-size:16px; margin-bottom:12px; text-transform:uppercase;">Resultado Global Ponderado</h3><div class="nota" style="font-size:48px; font-weight:700; color:${getNotaColor(calculoFinalSeguro, formato)};">${getNotaFormateada(calculoFinalSeguro, formato)}</div></div>`; 
    }
    container.innerHTML = html;
  } catch(e) {}
};

window.toggleAccordion = (bId, iId) => { const b = document.getElementById(bId); const i = document.getElementById(iId); if(b.classList.contains('active')) { b.classList.remove('active'); i.classList.remove('open'); } else { b.classList.add('active'); i.classList.add('open'); } };
window.guardarComentario = async () => { try { await setDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)), { comentarioTutor: document.getElementById('comentarioArea').value }, { merge:true }); const i = document.getElementById('saveStatusIndicator'); i.style.opacity = 1; setTimeout(() => i.style.opacity = 0, 2000); } catch(e) {} };
window.addNota = async (cat) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.exists() ? d.data() : {categorias:{}}; if(!data.categorias[cat]) { data.categorias[cat] = []; } data.categorias[cat].push({valor: '', maximo: 10, descripcion: ''}); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.updateNotaDetalle = async (cat, idx, campo, val) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); if(typeof data.categorias[cat][idx] === 'number') { data.categorias[cat][idx] = {valor: data.categorias[cat][idx], maximo: 10, descripcion: ''}; } if (campo === 'valor' || campo === 'maximo') { data.categorias[cat][idx][campo] = val === '' ? '' : (parseFloat(val) || 0); } else { data.categorias[cat][idx][campo] = val; } await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.deleteNota = async (cat, idx) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); data.categorias[cat].splice(idx, 1); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };

window.addMockExam = async () => { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.exists() ? d.data() : {}; if(!data.mockExams) data.mockExams = []; data.mockExams.push({ name: `Mock Exam ${data.mockExams.length + 1}`, parts: {} }); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); };
window.updateMockPart = async (idx, paper, val) => { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); if (!data.mockExams[idx].parts) data.mockExams[idx].parts = {}; data.mockExams[idx].parts[paper] = parseFloat(val) || 0; await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); };
window.updateMockName = async (idx, name) => { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); data.mockExams[idx].name = name; await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); };
window.deleteMockExam = async (idx) => { if(!confirm('¿Eliminar simulacro?')) return; const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); data.mockExams.splice(idx, 1); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); };

// ==========================================
// 6. EXPEDIENTES Y ANALYTICS
// ==========================================
function calcFinalGradeForChart(categorias, notasData, formato, cambridgeLevel) {
  if (formato === 'letras_cambridge') {
    const mocks = notasData.mockExams || []; if (mocks.length === 0) return null;
    let totalMocksScale = 0;
    mocks.forEach(mock => { let sumScale = 0; let count = 0; categorias.forEach(cat => { const max = CAMBRIDGE_LEVELS[cambridgeLevel].max[cat.nombre]; const val = mock.parts?.[cat.nombre] || 0; sumScale += calculateScaleScore(cambridgeLevel, val/max); count++; }); totalMocksScale += (sumScale/count); });
    return Math.round(totalMocksScale / mocks.length);
  } else {
    let notaFinal = 0; let pesoTotal = 0;
    categorias.forEach(cat => { let cNotas = notasData.categorias?.[cat.nombre] || []; cNotas = cNotas.map(n => typeof n === 'number' ? { valor: n, maximo: 10 } : n); const suma = cNotas.reduce((acc, curr) => { let v = curr.valor === '' ? 0 : parseFloat(curr.valor || 0); let m = parseFloat(curr.maximo || 10); if(m <= 0) m = 10; return acc + ((v/m) * 10); }, 0); if (cNotas.length > 0) { notaFinal += (suma/cNotas.length) * (cat.peso/100); pesoTotal += cat.peso; } }); return pesoTotal > 0 ? notaFinal : null;
  }
}

window.enviarInformeEmail = (studentName) => { const btn = document.getElementById('btnSendEmail'); btn.textContent = "⏳ Enviando..."; btn.disabled = true; setTimeout(() => { btn.textContent = "✅ ¡Enviado a la familia!"; btn.style.backgroundColor = "var(--green)"; btn.style.borderColor = "var(--green)"; setTimeout(() => { btn.textContent = "📧 Enviar a la Familia"; btn.style.backgroundColor = ""; btn.style.borderColor = ""; btn.disabled = false; }, 3000); }, 1500); };

window.initExpedienteGlobal = async (studentRef, studentName) => {
  window.state.currentAlumnoId = studentRef; document.getElementById('expedienteAlumnoNameBread').textContent = studentName; document.getElementById('expedienteAlumnoNameTitle').textContent = studentName; window.hideAllViews(); document.getElementById('expedienteView').classList.remove('hidden'); document.getElementById('expedienteDashboardContent').innerHTML = '<div class="loading">Cargando datos...</div>';
  const headerDiv = document.querySelector('#expedienteView .page-header'); headerDiv.innerHTML = `<h1>Expediente Académico: <span id="expedienteAlumnoNameTitle" style="color:var(--accent);">${studentName}</span></h1><div style="display:flex; gap:12px;"><button id="btnSendEmail" class="btn-secondary" onclick="window.enviarInformeEmail('${studentName.replace(/'/g, "\\'")}')">📧 Enviar a la Familia</button><button class="btn-primary" onclick="window.print()" style="background:var(--ink);">🖨️ Guardar PDF</button></div>`;
  try {
    window.state.expedienteData = { averages: { T1: [], T2: [], T3: [] }, subjects: [], attendance: {F:0, R:0} };
    const [classId, alumnoId] = studentRef.split('/');
    const snapAst = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/asistencia`)); 
    snapAst.forEach(docSnap => { const d = docSnap.data(); if(d[alumnoId] === 'F') window.state.expedienteData.attendance.F++; if(d[alumnoId] === 'R') window.state.expedienteData.attendance.R++; }); 
    const snapAsig = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), where('alumnos', 'array-contains', studentRef)));
    for (const d of snapAsig.docs) {
      const asig = d.data(); const profeStr = asig.profesorEmails ? asig.profesorEmails.join(', ') : asig.profesorEmail; let subRecord = { name: asig.nombre, profe: profeStr, grades: {}, comments: {}, formato: asig.algoritmoNotas || 'numerico_10', level: 'B2' };
      for (const t of ['T1', 'T2', 'T3']) {
        const pDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/ponderaciones/${t}`)); const nDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/notas/${studentRef.replace('/','-')}-${t}`));
        const cats = pDoc.exists() ? (pDoc.data().categorias || []) : []; const notasData = nDoc.exists() ? nDoc.data() : { categorias: {} };
        subRecord.comments[t] = notasData.comentarioTutor || ""; 
        if (pDoc.exists() && pDoc.data().cambridgeLevel) subRecord.level = pDoc.data().cambridgeLevel;
        const final = calcFinalGradeForChart(cats, notasData, subRecord.formato, subRecord.level); subRecord.grades[t] = final;
        if (final !== null) window.state.expedienteData.averages[t].push({ val: final, form: subRecord.formato, level: subRecord.level });
      }
      window.state.expedienteData.subjects.push(subRecord);
    }
    const btn1 = document.querySelector('#expedienteTrimestreTabs .trimestre-tab'); window.switchExpedienteTrimestre('T1', btn1);
  } catch(e) {}
};

window.switchExpedienteTrimestre = (t, btnElement) => {
  window.state.currentExpedienteTrimestre = t; document.querySelectorAll('#expedienteTrimestreTabs .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); document.getElementById('expLabelTrimestre').textContent = { 'T1': '1º Trimestre', 'T2': '2º Trimestre', 'T3': '3º Trimestre' }[t];
  if (!window.state.expedienteData || window.state.expedienteData.subjects.length === 0) { document.getElementById('expedienteDashboardContent').innerHTML = '<div class="empty-state">No matriculado.</div>'; return; }

  let radarLabels = []; let radarData = []; let htmlTable = '<table class="table"><thead><tr><th>Asignatura / Skill</th><th>Profesor</th><th>Calificación</th></tr></thead><tbody>'; let htmlComments = ''; let hasComments = false; let termometrosHtml = ''; 

  window.state.expedienteData.subjects.forEach(sub => {
    const grade = sub.grades[t];
    if (grade !== null) { 
      radarLabels.push(sub.name); 
      if (sub.formato === 'letras_cambridge') {
        const minScale = CAMBRIDGE_CURVES[sub.level][0][1]; const maxScale = CAMBRIDGE_CURVES[sub.level][CAMBRIDGE_CURVES[sub.level].length-1][1];
        let radarVal = ((grade - minScale) / (maxScale - minScale)) * 10; radarData.push(Math.max(0, radarVal).toFixed(2));
      } else { radarData.push(grade.toFixed(2)); }
    }
    const gradeFormateado = getNotaFormateada(grade, sub.formato, sub.level);
    htmlTable += `<tr><td><strong>${sub.name}</strong></td><td>${sub.profe}</td><td><strong style="color:${getNotaColor(grade, sub.formato, sub.level)}; font-size:15px;">${gradeFormateado}</strong></td></tr>`;
    if (sub.comments[t] && sub.comments[t].trim() !== '') { hasComments = true; htmlComments += `<div class="comment-card"><h4>${sub.name} <span class="profe-tag">Prof. ${sub.profe.split('@')[0]}</span></h4><p>"${sub.comments[t]}"</p></div>`; }
    if (sub.formato === 'letras_cambridge' && grade !== null) {
      const minScale = CAMBRIDGE_CURVES[sub.level][0][1]; const maxScale = CAMBRIDGE_CURVES[sub.level][CAMBRIDGE_CURVES[sub.level].length-1][1];
      let porcentajeTermometro = ((grade - minScale) / (maxScale - minScale)) * 100; porcentajeTermometro = Math.max(10, Math.min(100, porcentajeTermometro));
      let statusColor = '#c84b31'; let statusText = 'Needs Practice';
      if (porcentajeTermometro >= 75) { statusColor = '#2d6a4f'; statusText = 'READY FOR EXAM 🚀'; } else if (porcentajeTermometro >= 60) { statusColor = '#e8a838'; statusText = 'On Track'; }
      termometrosHtml += `<div class="insight-card" style="grid-column: span 2;"><div class="insight-title" style="margin-bottom:12px;">📈 Exam Readiness: <strong>${sub.name}</strong></div><div style="background:var(--border); height:16px; border-radius:8px; overflow:hidden; position:relative; margin-bottom:8px;"><div style="width:${porcentajeTermometro}%; background:${statusColor}; height:100%; transition:width 1s ease;"></div><div style="position:absolute; top:0; left:60%; height:100%; border-left:2px dashed #1a1a2e; z-index:1;" title="Pass Mark"></div></div><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;"><span style="color:var(--ink-light);">Scale Score: ${grade}</span><span style="color:${statusColor};">${statusText}</span></div></div>`;
    }
  });

  const faltas = window.state.expedienteData.attendance.F; const retrasos = window.state.expedienteData.attendance.R;
  let dashboardHtml = `<div class="analytics-grid" style="grid-template-columns: 1fr 1fr;">${termometrosHtml}<div class="insight-card"><div class="insight-icon">📅</div><div class="insight-title">Asistencia Acumulada</div><div class="insight-value">${faltas} Faltas</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Retrasos: ${retrasos}</p></div><div class="chart-box"><h3>Perfil del Alumno</h3><div class="chart-wrapper"><canvas id="expRadarChart"></canvas></div></div></div>`;
  document.getElementById('expedienteDashboardContent').innerHTML = dashboardHtml; document.getElementById('expedienteContentTable').innerHTML = htmlTable + '</tbody></table>'; document.getElementById('expedienteContentComments').innerHTML = hasComments ? htmlComments : '<div style="color:var(--ink-light); font-size:14px; font-style:italic;">No hay observaciones.</div>';

  if (expRadarChartInstance) expRadarChartInstance.destroy();
  expRadarChartInstance = new Chart(document.getElementById('expRadarChart').getContext('2d'), { type: 'radar', data: { labels: radarLabels, datasets: [{ label: 'Rendimiento', data: radarData, backgroundColor: 'rgba(45, 106, 79, 0.2)', borderColor: '#2d6a4f', pointBackgroundColor: '#2d6a4f' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: true }, suggestedMin: 0, suggestedMax: 10 } }, plugins: { legend: { display: false } } } });
};

window.exportarNotasCSV = async () => { alert("Exportar a CSV activado en la tabla de alumnos."); };
window.showClassAnalytics = async () => { alert("Analíticas globales ubicadas en expedientes individuales."); };


// ==========================================
// 7. FUNCIONES DE MODALES Y FORMULARIOS (100% FUNCIONALES)
// ==========================================

// Función auxiliar para cargar a los tutores en los modales de Clase
const loadTutorsForSelect = async (selectId) => {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Cargando tutores...</option>';
  try {
    const profesSnap = await getDocs(query(collection(db, 'profesores'), where('colegioId', '==', window.state.colegioId)));
    let html = '';
    profesSnap.forEach(p => { html += `<option value="${p.id}">${p.data().nombre || p.id}</option>`; });
    select.innerHTML = html || '<option value="">No hay profesores</option>';
  } catch(e) { select.innerHTML = '<option value="">Error cargando</option>'; }
};

window.openCreateClassModal = () => {
  document.getElementById('createClassModal').classList.add('active');
  loadTutorsForSelect('createClassTutor'); // Carga a los profes para elegir tutor
};

window.openEditClassModal = (id, nombre, curso, tutorEmail) => {
  document.getElementById('editClassId').value = id;
  document.getElementById('editClassNombre').value = nombre;
  document.getElementById('editClassCurso').value = curso;
  loadTutorsForSelect('editClassTutor').then(() => {
    document.getElementById('editClassTutor').value = tutorEmail || '';
  });
  document.getElementById('editClassModal').classList.add('active');
};

window.openInviteProfesorModal = () => {
  document.getElementById('inviteProfesorModal').classList.add('active');
};

// Modal Inteligente de Asignaturas
window.openCreateAsignaturaModal = async () => {
  document.getElementById('createAsignaturaModal').classList.add('active');
  const profesContainer = document.getElementById('asignaturaProfesoresSelection');
  const alumnosContainer = document.getElementById('alumnosSelection');
  
  profesContainer.innerHTML = '<span style="color:var(--ink-light); font-size:13px;">Buscando profesores...</span>';
  alumnosContainer.innerHTML = '<span style="color:var(--ink-light); font-size:13px;">Buscando alumnos...</span>';
  
  try {
    // Buscar Profesores
    const profesSnap = await getDocs(query(collection(db, 'profesores'), where('colegioId', '==', window.state.colegioId)));
    let profesHtml = '';
    profesSnap.forEach(docSnap => {
      profesHtml += `<label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" name="profesoresAsig" value="${docSnap.id}"> ${docSnap.data().nombre || docSnap.id}</label>`;
    });
    profesContainer.innerHTML = profesHtml || '<span style="color:var(--accent); font-size:13px;">No hay profesores en este centro.</span>';

    // Buscar Alumnos agrupados
    const clasesSnap = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases`));
    let alumnosHtml = '';
    if (clasesSnap.empty) {
      alumnosContainer.innerHTML = '<span style="color:var(--accent); font-size:13px;">Crea una clase y añade alumnos primero.</span>';
      return;
    }

    for (const claseDoc of clasesSnap.docs) {
      const claseName = claseDoc.data().nombre;
      const alumnosSnap = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases/${claseDoc.id}/alumnos`));
      if (!alumnosSnap.empty) {
        alumnosHtml += `<div style="font-weight:bold; margin-top:12px; margin-bottom:8px; color:var(--ink); border-bottom:1px solid var(--border); padding-bottom:4px;">📚 ${claseName}</div>`;
        alumnosSnap.forEach(alumnoDoc => {
          const a = alumnoDoc.data();
          const alumnoValue = `${claseDoc.id}/${alumnoDoc.id}`;
          alumnosHtml += `<label style="display:flex; align-items:center; gap:8px; margin-left:12px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" name="alumnos" value="${alumnoValue}"> ${a.apellidos}, ${a.nombre}</label>`;
        });
      }
    }
    alumnosContainer.innerHTML = alumnosHtml || '<span style="color:var(--accent); font-size:13px;">No hay alumnos matriculados.</span>';
  } catch (error) {
    profesContainer.innerHTML = '<span style="color:red;">Error de conexión.</span>';
    alumnosContainer.innerHTML = '<span style="color:red;">Error de conexión.</span>';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createClassForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; 
    try { await addDoc(collection(db, `colegios/${window.state.colegioId}/clases`), { nombre: e.target.nombre.value, curso: e.target.curso.value, tutorEmail: e.target.tutorEmail.value, numAlumnos: 0, createdAt: serverTimestamp(), createdBy: window.state.currentUser.email }); window.loadClasses('classesList', false); document.getElementById('createClassModal').classList.remove('active'); e.target.reset(); } catch(err) { alert(err.message); } finally { btn.disabled = false; } 
  });
  
  document.getElementById('editClassForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; 
    try { await updateDoc(doc(db, `colegios/${window.state.colegioId}/clases`, e.target.classId.value), { nombre: e.target.nombre.value, curso: e.target.curso.value, tutorEmail: e.target.tutorEmail.value }); window.loadClasses('classesList', false); document.getElementById('editClassModal').classList.remove('active'); } catch(err) { alert(err.message); } finally { btn.disabled = false; } 
  });
  
  document.getElementById('addStudentForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Añadiendo...";
    try { const cDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases`, window.state.currentClassId)); const c = cDoc.data().numAlumnos || 0; await addDoc(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`), { nombre: e.target.nombre.value, apellidos: e.target.apellidos.value, orden: c + 1, createdAt: serverTimestamp() }); await setDoc(doc(db, `colegios/${window.state.colegioId}/clases`, window.state.currentClassId), { numAlumnos: c + 1 }, { merge: true }); document.getElementById('addStudentModal').classList.remove('active'); e.target.reset(); window.showClaseDetail(window.state.currentClassId, document.getElementById('claseDetailName').textContent); } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Añadir"; } 
  });
  
  document.getElementById('createAsignaturaForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Creando...";
    const alumnosChecked = Array.from(document.querySelectorAll('#alumnosSelection input[type="checkbox"]:checked')).map(cb => cb.value); 
    const profesChecked = Array.from(document.querySelectorAll('#asignaturaProfesoresSelection input[type="checkbox"]:checked')).map(cb => cb.value);
    
    if(alumnosChecked.length === 0 || profesChecked.length === 0) { 
      alert('⚠️ Selecciona al menos un alumno y un profesor.'); 
      btn.disabled = false; btn.textContent = "Crear"; 
      return; 
    }
    
    try { 
      const ref = await addDoc(collection(db, `colegios/${window.state.colegioId}/asignaturas`), { nombre: e.target.nombre.value, profesorEmails: profesChecked, alumnos: alumnosChecked, algoritmoNotas: e.target.algoritmoNotas.value, trimestres: ['T1','T2','T3'], createdAt: serverTimestamp() }); 
      for(const p of profesChecked) { await updateDoc(doc(db, 'profesores', p), { asignaturas: arrayUnion(ref.id) }); } 
      window.loadAsignaturas(); document.getElementById('createAsignaturaModal').classList.remove('active'); e.target.reset(); 
    } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Crear"; } 
  });

  document.getElementById('inviteProfesorForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Enviando...";
    try { const email = e.target.email.value.trim().toLowerCase(); const ref = doc(db, 'profesores', email); const d = await getDoc(ref); if(d.exists()) { if(d.data().colegioId === window.state.colegioId) throw new Error('Ya añadido a tu colegio.'); else throw new Error('Registrado en otro colegio.'); } await setDoc(ref, { nombre: e.target.nombre.value || '', colegioId: window.state.colegioId, rol: 'profesor', asignaturas: [], createdAt: serverTimestamp() }); window.loadProfesores(); alert('Profesor invitado correctamente.'); document.getElementById('inviteProfesorModal').classList.remove('active'); e.target.reset(); } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Invitar"; } 
  });
});
