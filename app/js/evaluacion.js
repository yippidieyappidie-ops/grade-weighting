import { collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, arrayUnion, deleteDoc, query, orderBy, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

// Variables globales para las gráficas
let chartPieInstance = null;
let chartBarInstance = null;
let expRadarChartInstance = null;
let expLineChartInstance = null;

// ==========================================
// MOTOR DE CÁLCULO CAMBRIDGE (ESTRUCTURA OFICIAL)
// ==========================================
const CAMBRIDGE_LEVELS = {
  'A2': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 30, 'Writing': 30, 'Listening': 25, 'Speaking': 15 } },
  'B1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 32, 'Writing': 40, 'Listening': 25, 'Speaking': 30 } },
  'B2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 42, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 60 } },
  'C1': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 50, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } },
  'C2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 56, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } }
};

function getGradeCambridge(porcentaje) {
  if (porcentaje >= 80) return 'Grade A';
  if (porcentaje >= 75) return 'Grade B';
  if (porcentaje >= 60) return 'Grade C';
  if (porcentaje >= 45) return 'Level Below';
  return 'Fail';
}

function getNotaFormateada(notaDecimal, formato) {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return '—';
  if (formato === 'letras_cambridge') {
    const p = Math.round(notaDecimal * 10);
    return `${getGradeCambridge(p)} (${p}%)`;
  }
  return notaDecimal.toFixed(2);
}

function getNotaColor(notaDecimal, formato) {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return 'var(--ink)';
  if (formato === 'letras_cambridge') {
    const p = notaDecimal * 10;
    if (p >= 80) return 'var(--green)';
    if (p >= 60) return 'var(--gold)';
    return 'var(--accent)';
  }
  if (notaDecimal >= 7) return 'var(--green)';
  if (notaDecimal >= 5) return 'var(--gold)';
  return 'var(--accent)';
}

// ==========================================
// GESTIÓN DE CLASES, ASIGNATURAS Y ALUMNOS
// ==========================================
window.loadClasses = async (containerId, isProfesor) => {
  const list = document.getElementById(containerId);
  list.innerHTML = '<div class="loading">Cargando grupos...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases`), orderBy('nombre')));
    window.state.cachedClasses = [];
    if (snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay grupos creados.</p></div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const data = docSnap.data(); window.state.cachedClasses.push({ id: docSnap.id, ...data });
      html += `<div class="card card-clickable" onclick="window.showClaseDetail('${docSnap.id}', '${data.nombre}')">`;
      if(!isProfesor) { html += `<button class="btn-edit-card" onclick="event.stopPropagation(); window.openEditClassModal('${docSnap.id}','${data.nombre}','${data.curso}','${data.tutorEmail||''}')" title="Editar Clase">✏️</button><button class="btn-delete-card" onclick="event.stopPropagation(); window.deleteClass('${docSnap.id}','${data.nombre}')" title="Eliminar Clase">🗑️</button>`; }
      const tutorName = data.tutorEmail ? data.tutorEmail.split('@')[0] : 'Sin tutor'; html += `<div class="card-title">${data.nombre}</div><div class="card-meta">📖 ${data.curso} | Coord: ${tutorName}</div><div class="card-meta">${data.numAlumnos || 0} alumnos</div></div>`;
    });
    list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); }
};

window.showClaseDetail = async (classId, className) => {
  window.state.currentClassId = classId; document.getElementById('claseDetailName').textContent = className; window.hideAllViews(); document.getElementById('claseDetailView').classList.remove('hidden');
  const list = document.getElementById('claseAlumnosList'); list.innerHTML = '<div class="loading">Cargando alumnos...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/alumnos`), orderBy('apellidos'))); window.state.cachedAlumnos = []; 
    if(snap.empty) { let emptyHtml = '<div class="empty-state"><p>No hay alumnos en este grupo.</p>'; if(window.state.userRole === 'admin') { emptyHtml += `<button class="btn-secondary" onclick="document.getElementById('addStudentModal').classList.add('active')">+ Añadir Alumno</button>`; } list.innerHTML = emptyHtml + '</div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const a = docSnap.data(); window.state.cachedAlumnos.push({ id: docSnap.id, n: a.nombre, a: a.apellidos }); const fullName = `${a.nombre} ${a.apellidos}`.replace(/'/g, "\\'").replace(/"/g, "&quot;");
      html += `<div class="card card-clickable" onclick="window.initExpedienteGlobal('${classId}/${docSnap.id}', '${fullName}')"><div class="card-title">${a.apellidos}, ${a.nombre}</div><div class="card-meta">Ver Expediente (Notas) →</div>`;
      if(window.state.userRole === 'admin') { html += `<button class="btn-delete-card" onclick="event.stopPropagation(); window.deleteStudent('${classId}','${docSnap.id}','${fullName}')" title="Eliminar Alumno">🗑️</button>`; } html += `</div>`;
    });
    if(window.state.userRole === 'admin') { html += `<div class="card card-clickable" onclick="document.getElementById('addStudentModal').classList.add('active')" style="display:flex; align-items:center; justify-content:center; border:2px dashed var(--border); background:transparent;"><div style="font-weight:600; color:var(--ink-light);">+ Añadir Alumno</div></div>`; }
    list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); }
};

window.deleteClass = async (id, nombre) => { if(confirm(`⚠️ ¿Borrar el grupo "${nombre}"?`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/clases/${id}`)); window.loadClasses('classesList', false); } catch (e) {} } };
window.deleteStudent = async (cId, sId, name) => { if(confirm(`¿Eliminar al alumno "${name}"?`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/clases/${cId}/alumnos/${sId}`)); const cRef = doc(db, `colegios/${window.state.colegioId}/clases`, cId); const cDoc = await getDoc(cRef); if(cDoc.exists()) { await updateDoc(cRef, { numAlumnos: (cDoc.data().numAlumnos || 1) - 1 }); } window.showClaseDetail(cId, document.getElementById('claseDetailName').textContent); } catch (e) {} } };
window.deleteAsignatura = async (id, nombre) => { if(confirm(`¿Borrar asignatura "${nombre}"? Se perderán todas sus notas.`)) { try { await deleteDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${id}`)); window.loadAsignaturas(); } catch (e) {} } };
window.deleteProfesor = async (email) => { if(email === window.state.currentUser.email) return alert("No puedes borrarte a ti mismo."); if(confirm(`¿Revocar acceso al profesor ${email}?`)) { try { await deleteDoc(doc(db, 'profesores', email)); window.loadProfesores(); } catch (e) {} } };

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
    }); 
    list.innerHTML = html + '</tbody></table>'; 
  } catch(e) { console.error(e); }
};

window.loadAsignaturas = async () => { 
  const list = document.getElementById('asignaturasList'); list.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), orderBy('nombre'))); 
    if(snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay asignaturas creadas.</p></div>'; return; }
    let html = '<table class="table"><thead><tr><th>Asignatura</th><th>Profesores</th><th>Alumnos</th><th style="width:50px;">Acciones</th></tr></thead><tbody>'; 
    snap.forEach(docSnap => { 
      const d = docSnap.data(); const profes = d.profesorEmails ? d.profesorEmails.join(', ') : (d.profesorEmail || '—');
      html += `<tr><td><strong>${d.nombre}</strong></td><td>${profes}</td><td>${d.alumnos?.length || 0}</td><td style="text-align:center;"><button class="btn-icon" style="color:var(--accent);" onclick="window.deleteAsignatura('${docSnap.id}','${d.nombre}')">🗑️</button></td></tr>`; 
    }); 
    list.innerHTML = html + '</tbody></table>'; 
  } catch(e) { console.error(e); }
};

window.loadProfesorAsignaturas = async () => { 
  const list = document.getElementById('profesorAsignaturasList'); list.innerHTML = '<div class="loading">Buscando tus asignaturas...</div>';
  try {
    const snapAsig = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), where('profesorEmails', 'array-contains', window.state.currentUser.email))); 
    const snapTut = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases`), where('tutorEmail', '==', window.state.currentUser.email)));
    let html = '';
    if (!snapTut.empty) {
      html += `<h3 style="margin-bottom:16px;">📚 Mis Tutorías</h3><div class="cards-grid">`;
      snapTut.forEach(docSnap => {
        const d = docSnap.data(); html += `<div class="card card-clickable" style="border-left: 4px solid var(--gold);" onclick="window.showTutoriaDetail('${docSnap.id}','${d.nombre}')"><div class="card-title">Tutoría - ${d.nombre}</div><div class="card-meta">${d.numAlumnos || 0} alumnos</div></div>`;
      });
      html += `</div><br><br>`;
    }
    html += `<h3 style="margin-bottom:16px;">📖 Mis Asignaturas Normales</h3>`;
    if(snapAsig.empty) {
      html += '<p class="empty-state">No tienes asignaturas asignadas.</p>';
    } else {
      html += `<div class="cards-grid">`;
      snapAsig.forEach(docSnap => { 
        const d = docSnap.data(); html += `<div class="card card-clickable" onclick="window.showAsignaturaDetail('${docSnap.id}','${d.nombre}')"><div class="card-title">${d.nombre}</div><div class="card-meta">${d.alumnos?.length || 0} alumnos a evaluar</div></div>`; 
      }); 
      html += `</div>`;
    }
    list.innerHTML = html; 
  } catch(e) { console.error(e); }
};

// ==========================================
// ASISTENCIA
// ==========================================
window.showAsistenciaView = () => { window.hideAllViews(); document.getElementById('asistenciaView').classList.remove('hidden'); const td = new Date().toISOString().split('T')[0]; document.getElementById('asistenciaDateInput').value = td; window.loadAsistencia(td); };
window.loadAsistencia = async (date) => {
  const cont = document.getElementById('asistenciaListContainer'); cont.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const d = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/asistencia/${date}`));
    const r = d.exists() ? d.data() : {}; 
    let html = '';
    window.state.cachedAlumnos.forEach(a => {
      const s = r[a.id] || ''; 
      html += `<div class="attendance-row"><div class="ast-name">${a.a}, ${a.n}</div><div class="ast-toggles"><button id="btn-ast-${a.id}-P" class="ast-btn ${s==='P'?'active P':''}" onclick="window.markAsistencia('${a.id}', 'P', '${date}')">✅</button><button id="btn-ast-${a.id}-F" class="ast-btn ${s==='F'?'active F':''}" onclick="window.markAsistencia('${a.id}', 'F', '${date}')">❌</button><button id="btn-ast-${a.id}-R" class="ast-btn ${s==='R'?'active R':''}" onclick="window.markAsistencia('${a.id}', 'R', '${date}')">⏰</button></div></div>`;
    });
    cont.innerHTML = html;
  } catch(e) { console.error(e); }
};
window.markAsistencia = async (id, st, date) => {
  ['P','F','R'].forEach(s => { document.getElementById(`btn-ast-${id}-${s}`).className = 'ast-btn'; });
  document.getElementById(`btn-ast-${id}-${st}`).classList.add('active', st);
  try { await setDoc(doc(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/asistencia/${date}`), { [id]: st }, { merge: true }); } catch(e) {}
};

// ==========================================
// PONDERACIÓN Y PANEL DE NOTAS (STANDARD + CAMBRIDGE)
// ==========================================
function getPonderacionPath(t) { return window.state.currentContext === 'tutoria' ? `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/ponderacionesTutoria/${t}` : `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}/ponderaciones/${t}`; }
function getNotasPath(studentRefStr, t) { return window.state.currentContext === 'tutoria' ? `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/notasTutoria/${studentRefStr}-${t}` : `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}/notas/${studentRefStr.replace('/','-')}-${t}`; }

let currentCategorias = [];
let currentCambridgeLevel = 'B2';

window.showTrimestreDetail = async (t) => {
  window.state.currentTrimestre = t; window.hideAllViews(); document.getElementById('trimestreDetailView').classList.remove('hidden');
  await window.loadPonderacion(t); await window.loadAlumnosParaEvaluar();
  const names = { 'T1': '1º Trimestre', 'T2': '2º Trimestre', 'T3': '3º Trimestre' };
  document.getElementById('currentTrimestre').textContent = names[t]; document.getElementById('trimestreDetailTitle').textContent = names[t]; document.getElementById('trimestreDetailContext').textContent = document.getElementById('currentAsignaturaNombre').textContent;
};

window.loadPonderacion = async (t) => {
  try {
    const d = await getDoc(doc(db, getPonderacionPath(t)));
    const data = d.exists() ? d.data() : {};
    const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';

    if (formato === 'letras_cambridge') {
      currentCambridgeLevel = data.cambridgeLevel || 'B2';
      const config = CAMBRIDGE_LEVELS[currentCambridgeLevel];
      const pesoPorParte = 100 / config.parts.length;
      currentCategorias = config.parts.map(p => ({ nombre: p, peso: pesoPorParte }));
    } else {
      if (window.state.currentContext === 'tutoria') { currentCategorias = data.categorias || [{nombre:"Actitud", peso:100}]; } else { currentCategorias = data.categorias || [{nombre:"Exámenes", peso:40}, {nombre:"Deberes", peso:60}]; }
    }
    window.renderCategorias(); window.updatePesoTotal();
  } catch(e) { console.error(e); }
};

window.renderCategorias = () => {
  const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';
  const container = document.getElementById('categoriasConfig');

  if (formato === 'letras_cambridge') {
    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <label>Nivel del Examen (Plantilla Oficial Cambridge):</label>
        <select id="cambridgeLevelSelect" style="padding:12px 16px; width:100%; border-radius:8px; border:2px solid var(--ink); font-weight:bold; font-size:15px; cursor:pointer;" onchange="window.changeCambridgeLevel(this.value)">
          <option value="A2" ${currentCambridgeLevel==='A2'?'selected':''}>A2 Key (KET)</option>
          <option value="B1" ${currentCambridgeLevel==='B1'?'selected':''}>B1 Preliminary (PET)</option>
          <option value="B2" ${currentCambridgeLevel==='B2'?'selected':''}>B2 First (FCE)</option>
          <option value="C1" ${currentCambridgeLevel==='C1'?'selected':''}>C1 Advanced (CAE)</option>
          <option value="C2" ${currentCambridgeLevel==='C2'?'selected':''}>C2 Proficiency (CPE)</option>
        </select>
      </div>
      <div style="background:var(--cream); padding:20px; border-radius:8px; border: 1.5px dashed var(--border);">
        <p style="margin-bottom:12px; color:var(--ink); font-weight:600;">Papers evaluados automáticamente:</p>
        <ul style="margin-left: 0; list-style:none; color:var(--ink-light); font-size:14px; line-height:1.8;">
           ${currentCategorias.map(p => `<li>✔️ ${p.nombre} (${p.peso.toFixed(1)}%)</li>`).join('')}
        </ul>
        <p style="margin-top:16px; font-size:13px; font-style:italic;">* En el panel del alumno, introduce la puntuación cruda obtenida (Ej. 34 / 42) y el sistema calculará el Grade exacto.</p>
      </div>
    `;
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'none';
  } else {
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'inline-flex';
    let html = '<div class="ponderacion-config">';
    currentCategorias.forEach((cat, i) => { html += `<div class="categoria-row"><input type="text" value="${cat.nombre}" onchange="window.updateCategoriaNombre(${i}, this.value)" placeholder="Categoría"><input type="number" value="${cat.peso}" onchange="window.updateCategoriaPeso(${i}, this.value)"><button class="btn-icon" onclick="window.eliminarCategoria(${i})" title="Borrar">🗑️</button></div>`; });
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
window.añadirCategoria = () => { currentCategorias.push({nombre: "", peso: 0}); window.renderCategorias(); window.updatePesoTotal(); };
window.eliminarCategoria = (i) => { if(currentCategorias.length <= 1) return alert('Debes dejar al menos una categoría.'); currentCategorias.splice(i, 1); window.renderCategorias(); window.updatePesoTotal(); };

window.guardarPonderacion = async () => {
  const total = currentCategorias.reduce((s,c) => s + (parseFloat(c.peso) || 0), 0);
  if(Math.round(total) !== 100) return alert('La suma de los porcentajes debe ser exactamente 100%.'); 
  if(currentCategorias.some(c => !c.nombre.trim())) return alert('Todas las categorías necesitan nombre.');
  try { await setDoc(doc(db, getPonderacionPath(window.state.currentTrimestre)), { categorias: currentCategorias, cambridgeLevel: currentCambridgeLevel, updatedAt: serverTimestamp() }); alert('✅ Configuración guardada.'); } catch(e) { alert("Error guardando"); }
};

window.loadAlumnosParaEvaluar = async () => {
  const list = document.getElementById('trimestreAlumnosList'); list.innerHTML = '<div class="loading">Buscando alumnos...</div>';
  try {
    let alumnos = [];
    if (window.state.currentContext === 'tutoria') {
      const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`), orderBy('apellidos')));
      snap.forEach(d => { alumnos.push({ id: d.id, n: d.data().nombre || '', a: d.data().apellidos || '', classId: window.state.currentClassId, alumId: d.id }); });
    } else {
      const asigDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas`, window.state.currentAsignaturaId));
      const alumnosRefs = asigDoc.data()?.alumnos || [];
      if (alumnosRefs.length === 0) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos en este grupo.</p></div>'; return; }
      for (const ref of alumnosRefs) {
        const partes = ref.split('/');
        if (partes.length === 2) {
          const aDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${partes[0]}/alumnos`, partes[1]));
          if (aDoc.exists()) { alumnos.push({ id: ref, n: aDoc.data().nombre || '', a: aDoc.data().apellidos || '', classId: partes[0], alumId: partes[1] }); }
        }
      }
    }
    if (alumnos.length === 0) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos.</p></div>'; return; }
    alumnos.sort((a,b) => (a.a || '').localeCompare(b.a || ''));
    window.state.currentAlumnosList = alumnos;

    let html = '<div class="cards-grid">';
    alumnos.forEach(alum => {
      const nLimpio = (alum.n + ' ' + alum.a).replace(/'/g, "\\'").replace(/"/g, "&quot;");
      html += `<div class="card card-clickable" onclick="window.showNotasView('${alum.id}', '${nLimpio}', '${alum.classId}', '${alum.alumId}')"><div class="card-title">${alum.a}, ${alum.n}</div><div class="card-meta">Evaluar →</div></div>`;
    });
    list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); list.innerHTML = '<p style="color:red">Error cargando lista</p>'; }
};

window.showNotasView = (id, nombreAlumno, classId, alumId) => { window.state.currentAlumnoId = id; window.state.currentEvalClassId = classId; window.state.currentEvalAlumId = alumId; document.getElementById('currentAlumnoNombre').textContent = nombreAlumno; window.hideAllViews(); document.getElementById('notasView').classList.remove('hidden'); window.loadNotas(); };
window.switchTrimestre = (t, btnElement) => { window.state.currentTrimestre = t; document.querySelectorAll('#notasView .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); window.loadNotas(); };

window.loadNotas = async () => {
  const container = document.getElementById('notasContent'); container.innerHTML = '<div class="loading">Cargando perfil de evaluación...</div>';
  let faltas = 0; let retrasos = 0;
  try { 
    const snapAst = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentEvalClassId}/asistencia`)); 
    snapAst.forEach(docSnap => { const d = docSnap.data(); if(d[window.state.currentEvalAlumId] === 'F') faltas++; if(d[window.state.currentEvalAlumId] === 'R') retrasos++; }); 
    document.getElementById('attendanceSummary').innerHTML = `<div class="ast-stat">❌ Faltas en clase: <strong style="color:var(--accent);">${faltas}</strong></div><div class="ast-stat">⏰ Retrasos: <strong style="color:var(--gold);">${retrasos}</strong></div>`; 
  } catch(e) {}

  try {
    const pDoc = await getDoc(doc(db, getPonderacionPath(window.state.currentTrimestre)));
    const nDoc = await getDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)));
    
    const pondData = pDoc.exists() ? pDoc.data() : {};
    let cats = pondData.categorias || []; 
    const data = nDoc.exists() ? nDoc.data() : { categorias: {}, comentarioTutor: "" };
    const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';
    
    let html = `<div class="professional-comment"><div class="comment-header"><strong>📝 Observaciones</strong><span id="saveStatusIndicator" style="font-size:12px; color:var(--green); opacity:0; transition:opacity 0.3s;">Guardado ✓</span></div><textarea id="comentarioArea" rows="3" placeholder="Añade observaciones para el boletín..." onchange="window.guardarComentario()">${data.comentarioTutor || ""}</textarea></div>`;
    
    let notaFinalGlobal = 0; let pesoTotalGlobal = 0;

    if (formato === 'letras_cambridge') {
      const level = pondData.cambridgeLevel || 'B2';
      const maxScores = CAMBRIDGE_LEVELS[level].max;
      
      html += `<div class="card" style="border-left:5px solid var(--accent); padding:24px;">
        <h3 style="margin-bottom:16px;">Calculadora Mock Exam: <span style="color:var(--accent);">${level}</span></h3>
        <p style="font-size:13px; color:var(--ink-light); margin-bottom:24px;">Introduce los puntos crudos (Raw Score) obtenidos por el alumno en cada parte.</p>
      `;
      
      let sumPuntos = 0;
      let sumMax = 0;

      cats.forEach((cat) => {
        let notaObj = data.categorias?.[cat.nombre]?.[0] || { valor: 0, maximo: maxScores[cat.nombre] };
        const puntosAlcanzados = parseFloat(notaObj.valor) || 0;
        const puntosMaximos = maxScores[cat.nombre];
        sumPuntos += puntosAlcanzados;
        sumMax += puntosMaximos;

        const subMedia = (puntosAlcanzados / puntosMaximos) * 10;
        notaFinalGlobal += subMedia * (cat.peso / 100);
        pesoTotalGlobal += cat.peso;

        html += `
          <div class="record-row" style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed var(--border);">
            <div style="flex:1; font-weight:600; font-size:15px;">${cat.nombre}</div>
            <div class="record-val" style="display:flex; align-items:center;">
              <input type="number" value="${puntosAlcanzados}" step="0.5" min="0" max="${puntosMaximos}" onchange="window.updateCambridgeScore('${cat.nombre}', this.value, ${puntosMaximos})" style="width:70px; font-size:16px; font-weight:bold; text-align:center; border:2px solid var(--accent); padding:8px; border-radius:6px;">
              <span style="font-weight:bold; margin: 0 12px; color:var(--ink-light);">/</span>
              <span style="background:var(--cream); padding:8px 16px; border-radius:6px; font-weight:bold; color:var(--ink-light); border:1px solid var(--border);">${puntosMaximos}</span>
            </div>
          </div>`;
      });
      html += `</div>`;
      
      const porcentaje = sumMax > 0 ? (sumPuntos / sumMax) * 100 : 0;
      const finalFormat = `${getGradeCambridge(porcentaje)} (${Math.round(porcentaje)}%)`;
      const finalColor = getNotaColor(notaFinalGlobal, formato);
      
      html += `<div class="nota-final-display" style="background:var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:24px;">
        <h3 style="color:var(--cream); font-size:14px; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Resultado Global Ponderado</h3>
        <div style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:16px;">Total Raw Score: ${sumPuntos} / ${sumMax}</div>
        <div class="nota" style="font-size:42px; font-weight:700; color:${finalColor}; font-family:'Playfair Display',serif;">${finalFormat}</div>
      </div>`; 

    } else {
      // MODO ESTÁNDAR
      cats.forEach((cat, idx) => {
        let notasArr = data.categorias?.[cat.nombre] || []; notasArr = notasArr.map(n => typeof n === 'number' ? { valor: n, maximo: 10, descripcion: '' } : n);
        const sumaBase10 = notasArr.reduce((acc, obj) => { let val = obj.valor === '' ? 0 : parseFloat(obj.valor || 0); let max = parseFloat(obj.maximo || 10); if (max <= 0) max = 10; return acc + ((val / max) * 10); }, 0);
        const mediaCategoria = notasArr.length > 0 ? (sumaBase10 / notasArr.length) : 0;
        if (notasArr.length > 0) { notaFinalGlobal += mediaCategoria * (cat.peso / 100); pesoTotalGlobal += cat.peso; }
        const mediaFormat = getNotaFormateada(mediaCategoria, formato);
        html += `<div class="accordion-card"><div class="accordion-header" onclick="window.toggleAccordion('acc-${idx}', 'icon-${idx}')"><div class="accordion-title">${cat.nombre} <span style="font-size:11px; background:var(--cream); border:1px solid var(--border); padding:2px 8px; border-radius:10px; margin-left:8px; color:var(--ink-light);">${cat.peso}%</span></div><div class="accordion-stats"><span class="accordion-media" style="margin-right:12px;">Result: <strong style="color:var(--ink);">${mediaFormat}</strong></span><span id="icon-${idx}" class="accordion-chevron">▼</span></div></div><div class="accordion-body" id="acc-${idx}"><div style="padding-top:15px;">`;
        if (notasArr.length === 0) { html += `<div style="font-size:13px; color:var(--ink-light); margin-bottom:12px;">Sin registros evaluados. Pulsa Añadir.</div>`; }
        notasArr.forEach((nObj, i) => { html += `<div class="record-row"><div class="record-desc" style="flex:1;"><input type="text" placeholder="Concepto (ej. Tema 1)" value="${nObj.descripcion || ''}" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'descripcion',this.value)" style="width:100%;"></div><div class="record-val"><input type="number" class="val-nota" min="0" step="0.1" value="${nObj.valor !== undefined ? nObj.valor : ''}" placeholder="Ptos" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'valor',this.value)"><span style="font-weight:600;">/</span><input type="number" class="val-max" min="0.1" step="0.1" value="${nObj.maximo || 10}" title="Max" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'maximo',this.value)"></div><div class="record-actions"><button class="btn-icon" onclick="window.deleteNota('${cat.nombre}',${i})">🗑️</button></div></div>`; });
        html += `<button class="btn-secondary btn-sm" style="margin-top:16px;" onclick="window.addNota('${cat.nombre}')">+ Añadir puntuación</button></div></div></div>`;
      });
      const calculoFinalSeguro = pesoTotalGlobal > 0 ? notaFinalGlobal : null;
      const finalFormat = getNotaFormateada(calculoFinalSeguro, formato);
      const finalColor = getNotaColor(calculoFinalSeguro, formato);
      html += `<div class="nota-final-display" style="background:var(--paper); border:2px solid var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:32px;"><h3 style="color:var(--ink); font-size:16px; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Resultado Global Ponderado</h3><div class="nota" style="font-size:48px; font-weight:700; color:${finalColor}; font-family:'Playfair Display',serif;">${finalFormat}</div></div>`; 
    }
    
    container.innerHTML = html;
  } catch(e) { console.error(e); }
};

window.toggleAccordion = (bId, iId) => { const b = document.getElementById(bId); const i = document.getElementById(iId); if(b.classList.contains('active')) { b.classList.remove('active'); i.classList.remove('open'); } else { b.classList.add('active'); i.classList.add('open'); } };
window.guardarComentario = async () => { try { await setDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)), { comentarioTutor: document.getElementById('comentarioArea').value }, { merge:true }); const i = document.getElementById('saveStatusIndicator'); i.style.opacity = 1; setTimeout(() => i.style.opacity = 0, 2000); } catch(e) {} };
window.addNota = async (cat) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.exists() ? d.data() : {categorias:{}}; if(!data.categorias[cat]) { data.categorias[cat] = []; } data.categorias[cat].push({valor: '', maximo: 10, descripcion: ''}); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.updateNotaDetalle = async (cat, idx, campo, val) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); if(typeof data.categorias[cat][idx] === 'number') { data.categorias[cat][idx] = {valor: data.categorias[cat][idx], maximo: 10, descripcion: ''}; } if (campo === 'valor' || campo === 'maximo') { data.categorias[cat][idx][campo] = val === '' ? '' : (parseFloat(val) || 0); } else { data.categorias[cat][idx][campo] = val; } await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.deleteNota = async (cat, idx) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); data.categorias[cat].splice(idx, 1); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };

window.updateCambridgeScore = async (catName, value, max) => {
  const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre);
  const valNum = parseFloat(value) || 0;
  await setDoc(doc(db, p), { categorias: { [catName]: [{ valor: valNum, maximo: max, descripcion: 'Mock Part' }] } }, { merge: true });
  window.loadNotas();
};

// ==========================================
// EXPEDIENTE GLOBAL (INFORME PADRES)
// ==========================================
function calcFinalGradeForChart(categorias, notasData) {
  let notaFinal = 0; let pesoTotal = 0;
  categorias.forEach(cat => {
    let cNotas = notasData.categorias?.[cat.nombre] || []; cNotas = cNotas.map(n => typeof n === 'number' ? { valor: n, maximo: 10 } : n);
    const suma = cNotas.reduce((acc, curr) => { let v = curr.valor === '' ? 0 : parseFloat(curr.valor || 0); let m = parseFloat(curr.maximo || 10); if(m <= 0) m = 10; return acc + ((v/m) * 10); }, 0);
    if (cNotas.length > 0) { notaFinal += (suma/cNotas.length) * (cat.peso/100); pesoTotal += cat.peso; }
  }); return pesoTotal > 0 ? notaFinal : null;
}

window.initExpedienteGlobal = async (studentRef, studentName) => {
  window.state.currentAlumnoId = studentRef; document.getElementById('expedienteAlumnoNameBread').textContent = studentName; document.getElementById('expedienteAlumnoNameTitle').textContent = studentName; window.hideAllViews(); document.getElementById('expedienteView').classList.remove('hidden'); document.getElementById('expedienteDashboardContent').innerHTML = '<div class="loading">Recopilando datos de todo el curso para el alumno...</div>';
  
  try {
    window.state.expedienteData = { averages: { T1: [], T2: [], T3: [] }, subjects: [], attendance: {F:0, R:0} };
    const [classId, alumnoId] = studentRef.split('/');
    const snapAst = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/asistencia`)); 
    snapAst.forEach(docSnap => { const d = docSnap.data(); if(d[alumnoId] === 'F') window.state.expedienteData.attendance.F++; if(d[alumnoId] === 'R') window.state.expedienteData.attendance.R++; }); 

    const classDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${classId}`));
    if (classDoc.exists()) {
      let tutRecord = { name: "🎓 Tutoría y Actitud", profe: classDoc.data().tutorEmail || 'Sin Tutor', grades: {}, comments: {} };
      for (const t of ['T1', 'T2', 'T3']) {
        const pDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${classId}/ponderacionesTutoria/${t}`)); const nDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${classId}/notasTutoria/${alumnoId}-${t}`));
        const cats = pDoc.exists() ? (pDoc.data().categorias || []) : []; const notasData = nDoc.exists() ? nDoc.data() : { categorias: {} };
        tutRecord.comments[t] = notasData.comentarioTutor || ""; tutRecord.grades[t] = calcFinalGradeForChart(cats, notasData);
      }
      window.state.expedienteData.subjects.push(tutRecord);
    }

    const snapAsig = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), where('alumnos', 'array-contains', studentRef)));
    for (const d of snapAsig.docs) {
      const asig = d.data(); const profeStr = asig.profesorEmails ? asig.profesorEmails.join(', ') : asig.profesorEmail; let subRecord = { name: asig.nombre, profe: profeStr, grades: {}, comments: {} };
      for (const t of ['T1', 'T2', 'T3']) {
        const pDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/ponderaciones/${t}`)); const nDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/notas/${studentRef.replace('/','-')}-${t}`));
        const cats = pDoc.exists() ? (pDoc.data().categorias || []) : []; const notasData = nDoc.exists() ? nDoc.data() : { categorias: {} };
        subRecord.comments[t] = notasData.comentarioTutor || ""; const final = calcFinalGradeForChart(cats, notasData); subRecord.grades[t] = final;
        if (final !== null) { window.state.expedienteData.averages[t].push(final); }
      }
      window.state.expedienteData.subjects.push(subRecord);
    }
    const btn1 = document.querySelector('#expedienteTrimestreTabs .trimestre-tab'); window.switchExpedienteTrimestre('T1', btn1);
  } catch(e) { console.error(e); }
};

window.switchExpedienteTrimestre = (t, btnElement) => {
  window.state.currentExpedienteTrimestre = t; document.querySelectorAll('#expedienteTrimestreTabs .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); document.getElementById('expLabelTrimestre').textContent = { 'T1': '1º Trimestre', 'T2': '2º Trimestre', 'T3': '3º Trimestre' }[t];
  
  if (!window.state.expedienteData || window.state.expedienteData.subjects.length === 0) { document.getElementById('expedienteDashboardContent').innerHTML = '<div class="empty-state">No matriculado.</div>'; return; }

  const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';
  let sum = 0; let count = 0; let best = { name: '-', grade: -1 }; let worst = { name: '-', grade: 11 }; let radarLabels = []; let radarData = [];
  let htmlTable = '<table class="table"><thead><tr><th>Asignatura / Skill</th><th>Profesor</th><th>Calificación</th></tr></thead><tbody>'; let htmlComments = ''; let hasComments = false;

  window.state.expedienteData.subjects.forEach(sub => {
    const grade = sub.grades[t];
    if (grade !== null) {
      sum += grade; count++; radarLabels.push(sub.name); radarData.push((formato==='letras_cambridge'?grade*10:grade).toFixed(2));
      if (grade > best.grade) { best = { name: sub.name, grade }; }
      if (grade < worst.grade) { worst = { name: sub.name, grade }; }
    }
    
    const gradeFormateado = getNotaFormateada(grade, formato);
    const color = getNotaColor(grade, formato);

    htmlTable += `<tr><td><strong>${sub.name}</strong></td><td>${sub.profe}</td><td><strong style="color:${color}; font-size:15px;">${gradeFormateado}</strong></td></tr>`;
    if (sub.comments[t] && sub.comments[t].trim() !== '') { hasComments = true; htmlComments += `<div class="comment-card"><h4>${sub.name} <span class="profe-tag">Prof. ${sub.profe.split('@')[0]}</span></h4><p>"${sub.comments[t]}"</p></div>`; }
  });

  const mediaNumTrimestre = count > 0 ? (sum/count) : null;
  const mediaFormateada = getNotaFormateada(mediaNumTrimestre, formato);
  const bestFormateada = getNotaFormateada(best.grade !== -1 ? best.grade : null, formato);
  const worstFormateada = getNotaFormateada(worst.grade !== 11 ? worst.grade : null, formato);
  const faltas = window.state.expedienteData.attendance.F; const retrasos = window.state.expedienteData.attendance.R;

  let dashboardHtml = `
    <div class="analytics-grid">
      <div class="insight-card"><div class="insight-icon">📊</div><div class="insight-title">Media del Trimestre</div><div class="insight-value">${mediaFormateada}</div></div>
      <div class="insight-card"><div class="insight-icon">🏆</div><div class="insight-title">Mejor Área</div><div class="insight-value insight-good">${best.name}</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Nota: ${bestFormateada}</p></div>
      <div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-title">Área de Mejora</div><div class="insight-value" style="color:var(--accent); font-weight:bold;">${worst.name}</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Nota: ${worstFormateada}</p></div>
      <div class="insight-card"><div class="insight-icon">📅</div><div class="insight-title">Asistencia Acumulada</div><div class="insight-value">${faltas} Faltas</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Retrasos registrados: ${retrasos}</p></div>
    </div>
    <div class="analytics-grid">
      <div class="chart-box"><h3>Perfil del Alumno (Radar)</h3><div class="chart-wrapper"><canvas id="expRadarChart"></canvas></div></div>
      <div class="chart-box"><h3>Evolución Global (Anual)</h3><div class="chart-wrapper"><canvas id="expLineChart"></canvas></div></div>
    </div>
  `;

  document.getElementById('expedienteDashboardContent').innerHTML = dashboardHtml; document.getElementById('expedienteContentTable').innerHTML = htmlTable + '</tbody></table>'; document.getElementById('expedienteContentComments').innerHTML = hasComments ? htmlComments : '<div style="color:var(--ink-light); font-size:14px; font-style:italic;">No hay observaciones del equipo docente en este trimestre.</div>';

  if (expRadarChartInstance) { expRadarChartInstance.destroy(); } if (expLineChartInstance) { expLineChartInstance.destroy(); }

  expRadarChartInstance = new Chart(document.getElementById('expRadarChart').getContext('2d'), { type: 'radar', data: { labels: radarLabels, datasets: [{ label: 'Rendimiento', data: radarData, backgroundColor: 'rgba(45, 106, 79, 0.2)', borderColor: '#2d6a4f', pointBackgroundColor: '#2d6a4f', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#2d6a4f' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: true }, suggestedMin: 0, suggestedMax: formato==='letras_cambridge'?100:10 } }, plugins: { legend: { display: false } } } });

  const avgT1 = window.state.expedienteData.averages.T1.length ? (window.state.expedienteData.averages.T1.reduce((a,b)=>a+b,0)/window.state.expedienteData.averages.T1.length) : null;
  const avgT2 = window.state.expedienteData.averages.T2.length ? (window.state.expedienteData.averages.T2.reduce((a,b)=>a+b,0)/window.state.expedienteData.averages.T2.length) : null;
  const avgT3 = window.state.expedienteData.averages.T3.length ? (window.state.expedienteData.averages.T3.reduce((a,b)=>a+b,0)/window.state.expedienteData.averages.T3.length) : null;

  const isCam = formato === 'letras_cambridge';
  const gMax = isCam ? 100 : 10; const mult = isCam ? 10 : 1;

  expLineChartInstance = new Chart(document.getElementById('expLineChart').getContext('2d'), { type: 'line', data: { labels: ['1º Trimestre', '2º Trimestre', '3º Trimestre'], datasets: [{ label: 'Rendimiento Global', data: [avgT1 ? avgT1*mult : null, avgT2 ? avgT2*mult : null, avgT3 ? avgT3*mult : null], borderColor: '#c84b31', backgroundColor: 'rgba(200, 75, 49, 0.1)', borderWidth: 3, pointBackgroundColor: '#1a1a2e', pointRadius: 6, fill: true, tension: 0.3, spanGaps: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: gMax } }, plugins: { legend: { display: false } } } });
};

// ==========================================
// ANÁLISIS DE LA CLASE
// ==========================================
window.showClassAnalytics = async () => {
  document.getElementById('analyticsClassName').textContent = document.getElementById('claseDetailName').textContent; window.hideAllViews(); document.getElementById('classAnalyticsView').classList.remove('hidden'); document.getElementById('analyticsContent').innerHTML = '<div class="loading">⏳ Recopilando datos de las asignaturas...</div>';
  try {
    let alumnos = []; const snapAlumnos = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`))); snapAlumnos.forEach(d => { alumnos.push({ id: d.id, name: `${d.data().nombre} ${d.data().apellidos}` }); });
    if(alumnos.length === 0) { document.getElementById('analyticsContent').innerHTML = '<div class="empty-state">No hay alumnos en la clase.</div>'; return; }
    const asignaturasClase = []; const snapAsig = await getDocs(collection(db, `colegios/${window.state.colegioId}/asignaturas`));
    snapAsig.forEach(docAsig => { const data = docAsig.data(); const alumnosAsig = data.alumnos || []; const match = alumnos.some(al => alumnosAsig.includes(`${window.state.currentClassId}/${al.id}`)); if(match) { asignaturasClase.push({ id: docAsig.id, nombre: data.nombre }); } });
    if (asignaturasClase.length === 0) { document.getElementById('analyticsSubjectSelect').innerHTML = '<option>Sin asignaturas</option>'; document.getElementById('analyticsContent').innerHTML = '<div class="empty-state">La clase no tiene asignaturas asociadas.</div>'; return; }

    const selectEl = document.getElementById('analyticsSubjectSelect'); selectEl.innerHTML = ''; asignaturasClase.forEach(asig => { selectEl.innerHTML += `<option value="${asig.id}">${asig.nombre}</option>`; });
    window.state.analyticsData = {};

    for (const asig of asignaturasClase) {
      window.state.analyticsData[asig.id] = { T1: [], T2: [], T3: [] };
      for (const t of ['T1', 'T2', 'T3']) {
        const pDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${asig.id}/ponderaciones/${t}`)); const catsPond = pDoc.exists() ? (pDoc.data().categorias || []) : [];
        for (const al of alumnos) {
          const nDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${asig.id}/notas/${window.state.currentClassId}-${al.id}-${t}`));
          if (nDoc.exists()) {
            const dataNotas = nDoc.data().categorias || {}; let finalGrade = 0; let totalPeso = 0; let catsAverages = {};
            catsPond.forEach(cat => {
              let notasArr = dataNotas[cat.nombre] || []; notasArr = notasArr.map(n => typeof n === 'number' ? { valor: n, maximo: 10 } : n);
              if (notasArr.length > 0) { const sumaBase10 = notasArr.reduce((acc, obj) => { let val = obj.valor === '' ? 0 : parseFloat(obj.valor || 0); let max = parseFloat(obj.maximo || 10); if (max <= 0) max = 10; return acc + ((val / max) * 10); }, 0); const avgCat = sumaBase10 / notasArr.length; finalGrade += avgCat * (cat.peso / 100); totalPeso += cat.peso; catsAverages[cat.nombre] = avgCat; }
            });
            if (totalPeso > 0) { window.state.analyticsData[asig.id][t].push({ studentId: al.id, studentName: al.name, finalGrade: finalGrade, categories: catsAverages }); }
          }
        }
      }
    }
    window.state.currentAnalyticsTrimestre = 'T1'; const btn1 = document.querySelector('#analyticsTrimestreTabs .trimestre-tab'); document.querySelectorAll('#analyticsTrimestreTabs .trimestre-tab').forEach(t=>t.classList.remove('active')); if(btn1) btn1.classList.add('active'); window.renderAnalyticsData();
  } catch(e) { console.error(e); document.getElementById('analyticsContent').innerHTML = '<p style="color:red">Error procesando el análisis.</p>'; }
};

window.switchAnalyticsTrimestre = (t, btnElement) => { window.state.currentAnalyticsTrimestre = t; document.querySelectorAll('#analyticsTrimestreTabs .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); window.renderAnalyticsData(); };

window.renderAnalyticsData = () => {
  const subjectId = document.getElementById('analyticsSubjectSelect').value; const t = window.state.currentAnalyticsTrimestre; if (!window.state.analyticsData || !window.state.analyticsData[subjectId]) return;
  const dataT = window.state.analyticsData[subjectId][t]; const content = document.getElementById('analyticsContent');
  if (!dataT || dataT.length === 0) { content.innerHTML = '<div class="empty-state">No hay notas registradas en esta asignatura para este trimestre.</div>'; return; }

  const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';
  let sumaClase = 0; let distribution = { Sobresaliente: 0, Notable: 0, Aprobado: 0, Suspenso: 0 }; let categoryAverages = {}; let studentAverages = {}; 

  dataT.forEach(record => {
    sumaClase += record.finalGrade;
    if(!studentAverages[record.studentId]) { studentAverages[record.studentId] = { name: record.studentName, sum: 0, count: 0 }; }
    studentAverages[record.studentId].sum += record.finalGrade; studentAverages[record.studentId].count += 1;

    if (formato === 'letras_cambridge') {
      const p = record.finalGrade * 10;
      if (p >= 80) { distribution.Sobresaliente++; } else if (p >= 75) { distribution.Notable++; } else if (p >= 60) { distribution.Aprobado++; } else { distribution.Suspenso++; }
    } else {
      if (record.finalGrade >= 9) { distribution.Sobresaliente++; } else if (record.finalGrade >= 7) { distribution.Notable++; } else if (record.finalGrade >= 5) { distribution.Aprobado++; } else { distribution.Suspenso++; }
    }

    for (const [catName, val] of Object.entries(record.categories)) {
      if(!categoryAverages[catName]) { categoryAverages[catName] = { sum: 0, count: 0 }; }
      categoryAverages[catName].sum += val; categoryAverages[catName].count += 1;
    }
  });

  const mediaGlobalClase = sumaClase / dataT.length; let topStudent = { name: '-', avg: 0 };
  for (const [id, data] of Object.entries(studentAverages)) { const avg = data.sum / data.count; if (avg > topStudent.avg) { topStudent = { name: data.name, avg: avg }; } }
  let bestCat = { name: '-', avg: 0 }; let worstCat = { name: '-', avg: 10 }; let catLabels = []; let catData = [];
  for (const [catName, data] of Object.entries(categoryAverages)) {
    const avg = data.sum / data.count; catLabels.push(catName); catData.push((formato==='letras_cambridge'?avg*10:avg).toFixed(2));
    if (avg > bestCat.avg) { bestCat = { name: catName, avg: avg }; } if (avg < worstCat.avg) { worstCat = { name: catName, avg: avg }; }
  }

  const lblD1 = formato==='letras_cambridge'?'Grade A':'Sobresaliente';
  const lblD2 = formato==='letras_cambridge'?'Grade B':'Notable';
  const lblD3 = formato==='letras_cambridge'?'Grade C':'Aprobado';
  const lblD4 = formato==='letras_cambridge'?'Fail':'Suspenso';

  let html = `
    <div class="analytics-grid">
      <div class="insight-card"><div class="insight-icon">🎯</div><div class="insight-title">Media de la Clase</div><div class="insight-value">${getNotaFormateada(mediaGlobalClase, formato)}</div></div>
      <div class="insight-card"><div class="insight-icon">🏆</div><div class="insight-title">Alumno Destacado</div><div class="insight-value insight-highlight">${topStudent.name}</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Media: ${getNotaFormateada(topStudent.avg, formato)}</p></div>
      <div class="insight-card"><div class="insight-icon">💪</div><div class="insight-title">Punto Fuerte</div><div class="insight-value insight-good">${bestCat.name}</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Media: ${getNotaFormateada(bestCat.avg, formato)}</p></div>
      <div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-title">Punto de Mejora</div><div class="insight-value" style="color:var(--accent); font-weight:bold;">${worstCat.name}</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Media: ${getNotaFormateada(worstCat.avg, formato)}</p></div>
    </div>
    <div class="analytics-grid">
      <div class="chart-box"><h3>Distribución de Notas</h3><div class="chart-wrapper"><canvas id="pieChartDistribucion"></canvas></div></div>
      <div class="chart-box"><h3>Rendimiento por Categorías</h3><div class="chart-wrapper"><canvas id="barChartCategorias"></canvas></div></div>
    </div>
  `;
  content.innerHTML = html;

  if(chartPieInstance) { chartPieInstance.destroy(); } if(chartBarInstance) { chartBarInstance.destroy(); }

  chartPieInstance = new Chart(document.getElementById('pieChartDistribucion').getContext('2d'), { type: 'doughnut', data: { labels: [lblD1, lblD2, lblD3, lblD4], datasets: [{ data: [distribution.Sobresaliente, distribution.Notable, distribution.Aprobado, distribution.Suspenso], backgroundColor: ['#2d6a4f', '#e8a838', '#4a4a6a', '#c84b31'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  chartBarInstance = new Chart(document.getElementById('barChartCategorias').getContext('2d'), { type: 'bar', data: { labels: catLabels, datasets: [{ label: 'Rendimiento', data: catData, backgroundColor: '#1a1a2e', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: formato==='letras_cambridge'?100:10 } }, plugins: { legend: { display: false } } } });
};

// ==========================================
// EXPORTACIÓN A EXCEL
// ==========================================
window.exportarNotasCSV = async () => {
  const btn = document.getElementById('btnExportarNotas');
  if (btn) { btn.textContent = '⏳ Generando Excel...'; btn.disabled = true; }
  try {
    const subjectName = document.getElementById('currentAsignaturaNombre').textContent;
    const trimName = window.state.currentTrimestre;
    const formato = window.state.colegioConfig?.algoritmoNotas || 'numerico_10';
    const pDoc = await getDoc(doc(db, getPonderacionPath(window.state.currentTrimestre)));
    const cats = pDoc.exists() ? (pDoc.data().categorias || []) : [];
    let csvContent = "\uFEFF" + "Apellidos;Nombre;Asignatura;Trimestre;Nota Final;Observaciones\n";

    for (const alum of window.state.currentAlumnosList) {
      const nDoc = await getDoc(doc(db, getNotasPath(alum.id, window.state.currentTrimestre)));
      const notasData = nDoc.exists() ? nDoc.data() : { categorias: {} };
      let finalGrade = 0; let pesoTotal = 0;
      
      cats.forEach(cat => {
        let cNotas = notasData.categorias?.[cat.nombre] || []; 
        cNotas = cNotas.map(n => typeof n === 'number' ? { valor: n, maximo: 10 } : n);
        if (cNotas.length > 0) {
          const suma = cNotas.reduce((acc, curr) => { let v = curr.valor === '' ? 0 : parseFloat(curr.valor || 0); let m = parseFloat(curr.maximo || 10); if(m <= 0) m = 10; return acc + ((v/m) * 10); }, 0);
          finalGrade += (suma/cNotas.length) * (cat.peso/100); pesoTotal += cat.peso; 
        }
      });
      
      let notaFinalStr = 'Sin evaluar';
      if(pesoTotal > 0) {
        if(formato === 'letras_cambridge') {
          notaFinalStr = getNotaFormateada(finalGrade, formato);
        } else {
          notaFinalStr = finalGrade.toFixed(2).replace('.', ',');
        }
      }
      
      const obsRaw = notasData.comentarioTutor || "";
      const obsLimpia = obsRaw.replace(/\n/g, " ").replace(/;/g, ",");
      
      csvContent += `"${alum.a}";"${alum.n}";"${subjectName}";"${trimName}";"${notaFinalStr}";"${obsLimpia}"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Plantilla_Notas_${subjectName}_${trimName}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  } catch (e) { alert("Hubo un error exportando las notas."); } finally { if (btn) { btn.textContent = '📥 Exportar a Excel (CSV)'; btn.disabled = false; } }
};

// ==========================================
// FORMULARIOS BÁSICOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createClassForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; 
    try { await addDoc(collection(db, `colegios/${window.state.colegioId}/clases`), { nombre: e.target.nombre.value, curso: e.target.curso.value, tutorEmail: e.target.tutorEmail.value, numAlumnos: 0, createdAt: serverTimestamp(), createdBy: window.state.currentUser.email }); window.loadClasses('classesList', false); document.getElementById('createClassModal').classList.remove('active'); e.target.reset(); } catch(err) { alert(err.message); } btn.disabled = false; 
  });
  document.getElementById('editClassForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; 
    try { await updateDoc(doc(db, `colegios/${window.state.colegioId}/clases`, e.target.classId.value), { nombre: e.target.nombre.value, curso: e.target.curso.value, tutorEmail: e.target.tutorEmail.value }); window.loadClasses('classesList', false); document.getElementById('editClassModal').classList.remove('active'); } catch(err) { alert(err.message); } btn.disabled = false; 
  });
  document.getElementById('addStudentForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Añadiendo...";
    try { const cDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases`, window.state.currentClassId)); const c = cDoc.data().numAlumnos || 0; await addDoc(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`), { nombre: e.target.nombre.value, apellidos: e.target.apellidos.value, orden: c + 1, createdAt: serverTimestamp() }); await setDoc(doc(db, `colegios/${window.state.colegioId}/clases`, window.state.currentClassId), { numAlumnos: c + 1 }, { merge: true }); document.getElementById('addStudentModal').classList.remove('active'); e.target.reset(); window.showClaseDetail(window.state.currentClassId, document.getElementById('claseDetailName').textContent); } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Añadir"; } 
  });
  document.getElementById('createAsignaturaForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Creando...";
    const alumnosChecked = Array.from(document.querySelectorAll('input[name="alumnos"]:checked')).map(cb => cb.value); const profesChecked = Array.from(document.querySelectorAll('input[name="profesoresAsig"]:checked')).map(cb => cb.value);
    if(alumnosChecked.length === 0) { alert('Selecciona al menos un alumno.'); btn.disabled = false; btn.textContent = "Crear"; return; }
    if(profesChecked.length === 0) { alert('Selecciona al menos un profesor.'); btn.disabled = false; btn.textContent = "Crear"; return; }
    try { const ref = await addDoc(collection(db, `colegios/${window.state.colegioId}/asignaturas`), { nombre: e.target.nombre.value, profesorEmails: profesChecked, alumnos: alumnosChecked, trimestres: ['T1','T2','T3'], createdAt: serverTimestamp() }); for(const p of profesChecked) { await updateDoc(doc(db, 'profesores', p), { asignaturas: arrayUnion(ref.id) }); } window.loadAsignaturas(); document.getElementById('createAsignaturaModal').classList.remove('active'); e.target.reset(); } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Crear"; } 
  });
  document.getElementById('inviteProfesorForm')?.addEventListener('submit', async(e) => { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Enviando...";
    try { const email = e.target.email.value.trim().toLowerCase(); const ref = doc(db, 'profesores', email); const d = await getDoc(ref); if(d.exists()) { if(d.data().colegioId === window.state.colegioId) throw new Error('Ya añadido a tu colegio.'); else throw new Error('Registrado en otro colegio.'); } await setDoc(ref, { nombre: e.target.nombre.value || '', colegioId: window.state.colegioId, rol: 'profesor', asignaturas: [], createdAt: serverTimestamp() }); window.loadProfesores(); alert('Profesor invitado correctamente.'); document.getElementById('inviteProfesorModal').classList.remove('active'); e.target.reset(); } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Invitar"; } 
  });
});
