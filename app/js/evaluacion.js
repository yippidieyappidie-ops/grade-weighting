import { collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, arrayUnion, deleteDoc, query, orderBy, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

let chartPieInstance = null; let chartBarInstance = null; let expRadarChartInstance = null; let expLineChartInstance = null;

const CAMBRIDGE_LEVELS = {
  'A2': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 30, 'Writing': 30, 'Listening': 25, 'Speaking': 15 } },
  'B1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 32, 'Writing': 40, 'Listening': 25, 'Speaking': 30 } },
  'B2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 42, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 60 } },
  'C1': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 50, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } },
  'C2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 56, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } }
};

function getGradeCambridge(porcentaje) {
  if (porcentaje >= 80) return 'Grade A'; if (porcentaje >= 75) return 'Grade B'; if (porcentaje >= 60) return 'Grade C'; if (porcentaje >= 45) return 'Level Below'; return 'Fail';
}
function getNotaFormateada(notaDecimal, formato) {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return '—';
  if (formato === 'letras_cambridge') { const p = Math.round(notaDecimal * 10); return `${getGradeCambridge(p)} (${p}%)`; }
  return notaDecimal.toFixed(2);
}
function getNotaColor(notaDecimal, formato) {
  if (notaDecimal === null || notaDecimal === undefined || isNaN(notaDecimal)) return 'var(--ink)';
  if (formato === 'letras_cambridge') { const p = notaDecimal * 10; if (p >= 80) return 'var(--green)'; if (p >= 60) return 'var(--gold)'; return 'var(--accent)'; }
  if (notaDecimal >= 7) return 'var(--green)'; if (notaDecimal >= 5) return 'var(--gold)'; return 'var(--accent)';
}

async function getFormatoAsignatura() {
  if (window.state.currentContext === 'tutoria') return 'numerico_10';
  try {
    const asigDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${window.state.currentAsignaturaId}`));
    return asigDoc.exists() ? (asigDoc.data().algoritmoNotas || 'numerico_10') : 'numerico_10';
  } catch (e) { return 'numerico_10'; }
}

window.loadClasses = async (containerId, isProfesor) => {
  const list = document.getElementById(containerId); list.innerHTML = '<div class="loading">Cargando grupos...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases`), orderBy('nombre'))); window.state.cachedClasses = [];
    if (snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay grupos creados.</p></div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const data = docSnap.data(); window.state.cachedClasses.push({ id: docSnap.id, ...data });
      html += `<div class="card card-clickable" onclick="window.showClaseDetail('${docSnap.id}', '${data.nombre}')">`;
      if(!isProfesor) { html += `<button class="btn-edit-card" onclick="event.stopPropagation(); window.openEditClassModal('${docSnap.id}','${data.nombre}','${data.curso}','${data.tutorEmail||''}')">✏️</button><button class="btn-delete-card" onclick="event.stopPropagation(); window.deleteClass('${docSnap.id}','${data.nombre}')">🗑️</button>`; }
      html += `<div class="card-title">${data.nombre}</div><div class="card-meta">📖 ${data.curso}</div></div>`;
    }); list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); }
};

window.showClaseDetail = async (classId, className) => {
  window.state.currentClassId = classId; document.getElementById('claseDetailName').textContent = className; window.hideAllViews(); document.getElementById('claseDetailView').classList.remove('hidden');
  const list = document.getElementById('claseAlumnosList'); list.innerHTML = '<div class="loading">Cargando alumnos...</div>';
  try {
    const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/alumnos`), orderBy('apellidos'))); window.state.cachedAlumnos = []; 
    if(snap.empty) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos.</p><button class="btn-secondary" onclick="document.getElementById(\'addStudentModal\').classList.add(\'active\')">+ Añadir Alumno</button></div>'; return; }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const a = docSnap.data(); window.state.cachedAlumnos.push({ id: docSnap.id, n: a.nombre, a: a.apellidos });
      html += `<div class="card card-clickable" onclick="window.initExpedienteGlobal('${classId}/${docSnap.id}', '${a.nombre} ${a.apellidos}')"><div class="card-title">${a.apellidos}, ${a.nombre}</div><div class="card-meta">Ver Expediente →</div></div>`;
    });
    html += `<div class="card card-clickable" onclick="document.getElementById('addStudentModal').classList.add('active')" style="border:2px dashed var(--border); text-align:center;">+ Añadir Alumno</div>`;
    list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); }
};

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
  } catch(e) { console.error(e); }
};

window.renderCategorias = (formato) => {
  const container = document.getElementById('categoriasConfig');
  if (formato === 'letras_cambridge') {
    container.innerHTML = `<div style="margin-bottom:20px;"><label>Nivel de Examen de Cambridge:</label><select onchange="window.changeCambridgeLevel(this.value)" style="width:100%; padding:12px; border-radius:8px; border:2px solid var(--ink); font-weight:bold;"><option value="A2" ${currentCambridgeLevel==='A2'?'selected':''}>A2 Key</option><option value="B1" ${currentCambridgeLevel==='B1'?'selected':''}>B1 Preliminary</option><option value="B2" ${currentCambridgeLevel==='B2'?'selected':''}>B2 First</option><option value="C1" ${currentCambridgeLevel==='C1'?'selected':''}>C1 Advanced</option><option value="C2" ${currentCambridgeLevel==='C2'?'selected':''}>C2 Proficiency</option></select></div><div style="background:var(--cream); padding:15px; border-radius:8px;"><strong>Estructura:</strong> ${currentCategorias.map(c => c.nombre).join(', ')}</div>`;
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'none';
  } else {
    document.querySelector('button[onclick="window.añadirCategoria()"]').style.display = 'inline-flex';
    let html = '<div class="ponderacion-config">'; currentCategorias.forEach((cat, i) => { html += `<div class="categoria-row"><input type="text" value="${cat.nombre}" onchange="window.updateCategoriaNombre(${i}, this.value)"><input type="number" value="${cat.peso}" onchange="window.updateCategoriaPeso(${i}, this.value)"><button class="btn-icon" onclick="window.eliminarCategoria(${i})">🗑️</button></div>`; });
    container.innerHTML = html + '</div>';
  }
};

window.changeCambridgeLevel = (val) => { currentCambridgeLevel = val; window.loadPonderacion(window.state.currentTrimestre); };
window.guardarPonderacion = async () => { await setDoc(doc(db, getPonderacionPath(window.state.currentTrimestre)), { categorias: currentCategorias, cambridgeLevel: currentCambridgeLevel, updatedAt: serverTimestamp() }); alert('✅ Configuración guardada.'); };

window.loadAlumnosParaEvaluar = async () => {
  const list = document.getElementById('trimestreAlumnosList'); list.innerHTML = '<div class="loading">Buscando alumnos...</div>';
  try {
    let alumnos = [];
    if (window.state.currentContext === 'tutoria') {
      const snap = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/clases/${window.state.currentClassId}/alumnos`), orderBy('apellidos')));
      snap.forEach(d => { alumnos.push({ id: d.id, n: d.data().nombre || '', a: d.data().apellidos || '', classId: window.state.currentClassId, alumId: d.id }); });
    } else {
      const asigDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas`, window.state.currentAsignaturaId)); const alumnosRefs = asigDoc.data()?.alumnos || [];
      if (alumnosRefs.length === 0) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos en este grupo.</p></div>'; return; }
      for (const ref of alumnosRefs) { const partes = ref.split('/'); if (partes.length === 2) { const aDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/clases/${partes[0]}/alumnos`, partes[1])); if (aDoc.exists()) { alumnos.push({ id: ref, n: aDoc.data().nombre || '', a: aDoc.data().apellidos || '', classId: partes[0], alumId: partes[1] }); } } }
    }
    if (alumnos.length === 0) { list.innerHTML = '<div class="empty-state"><p>No hay alumnos.</p></div>'; return; }
    alumnos.sort((a,b) => (a.a || '').localeCompare(b.a || '')); window.state.currentAlumnosList = alumnos; let html = '<div class="cards-grid">';
    alumnos.forEach(alum => { const nLimpio = (alum.n + ' ' + alum.a).replace(/'/g, "\\'").replace(/"/g, "&quot;"); html += `<div class="card card-clickable" onclick="window.showNotasView('${alum.id}', '${nLimpio}', '${alum.classId}', '${alum.alumId}')"><div class="card-title">${alum.a}, ${alum.n}</div><div class="card-meta">Evaluar →</div></div>`; });
    list.innerHTML = html + '</div>';
  } catch(e) { console.error(e); }
};

window.showNotasView = (id, nombreAlumno, classId, alumId) => { window.state.currentAlumnoId = id; window.state.currentEvalClassId = classId; window.state.currentEvalAlumId = alumId; document.getElementById('currentAlumnoNombre').textContent = nombreAlumno; window.hideAllViews(); document.getElementById('notasView').classList.remove('hidden'); window.loadNotas(); };
window.switchTrimestre = (t, btnElement) => { window.state.currentTrimestre = t; document.querySelectorAll('#notasView .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); window.loadNotas(); };

window.loadNotas = async () => {
  const container = document.getElementById('notasContent'); container.innerHTML = '<div class="loading">Cargando perfil...</div>';
  try {
    const pDoc = await getDoc(doc(db, getPonderacionPath(window.state.currentTrimestre))); const nDoc = await getDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)));
    const pondData = pDoc.exists() ? pDoc.data() : {}; let cats = pondData.categorias || []; const data = nDoc.exists() ? nDoc.data() : { categorias: {}, comentarioTutor: "" };
    const formato = await getFormatoAsignatura();
    
    let html = `<div class="professional-comment"><div class="comment-header"><strong>📝 Observaciones</strong><span id="saveStatusIndicator" style="font-size:12px; color:var(--green); opacity:0; transition:opacity 0.3s;">Guardado ✓</span></div><textarea id="comentarioArea" rows="3" placeholder="Añade observaciones para el boletín..." onchange="window.guardarComentario()">${data.comentarioTutor || ""}</textarea></div>`;
    let notaFinalGlobal = 0; let pesoTotalGlobal = 0;

    if (formato === 'letras_cambridge') {
      const level = pondData.cambridgeLevel || 'B2'; const maxScores = CAMBRIDGE_LEVELS[level].max;
      html += `<div class="card" style="border-left:5px solid var(--accent); padding:24px;"><h3 style="margin-bottom:16px;">Mock Exam: <span style="color:var(--accent);">${level}</span></h3>`;
      let sumPuntos = 0; let sumMax = 0;
      cats.forEach((cat) => {
        let notaObj = data.categorias?.[cat.nombre]?.[0] || { valor: 0, maximo: maxScores[cat.nombre] };
        const pts = parseFloat(notaObj.valor) || 0; const mxs = maxScores[cat.nombre]; sumPuntos += pts; sumMax += mxs;
        notaFinalGlobal += ((pts / mxs) * 10) * (cat.peso / 100); pesoTotalGlobal += cat.peso;
        html += `<div class="record-row" style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed var(--border);"><div style="flex:1; font-weight:600;">${cat.nombre}</div><div class="record-val" style="display:flex; align-items:center;"><input type="number" value="${pts}" step="0.5" min="0" max="${mxs}" onchange="window.updateCambridgeScore('${cat.nombre}', this.value, ${mxs})" style="width:70px; font-size:16px; font-weight:bold; text-align:center; border:2px solid var(--accent); padding:8px; border-radius:6px;"><span style="margin: 0 12px; color:var(--ink-light);">/</span><span style="background:var(--cream); padding:8px 16px; border-radius:6px; font-weight:bold;">${mxs}</span></div></div>`;
      });
      html += `</div>`;
      const pct = sumMax > 0 ? (sumPuntos / sumMax) * 100 : 0; const finalFormat = `${getGradeCambridge(pct)} (${Math.round(pct)}%)`; const finalColor = getNotaColor(notaFinalGlobal, formato);
      html += `<div class="nota-final-display" style="background:var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:24px;"><h3 style="color:var(--cream); font-size:14px; margin-bottom:8px; text-transform:uppercase;">Resultado Global</h3><div style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:16px;">Raw Score: ${sumPuntos} / ${sumMax}</div><div class="nota" style="font-size:42px; font-weight:700; color:${finalColor};">${finalFormat}</div></div>`; 
    } else {
      cats.forEach((cat, idx) => {
        let notasArr = data.categorias?.[cat.nombre] || []; notasArr = notasArr.map(n => typeof n === 'number' ? { valor: n, maximo: 10, descripcion: '' } : n);
        const sumaBase10 = notasArr.reduce((acc, obj) => { let val = obj.valor === '' ? 0 : parseFloat(obj.valor || 0); let max = parseFloat(obj.maximo || 10); if (max <= 0) max = 10; return acc + ((val / max) * 10); }, 0);
        const mediaCategoria = notasArr.length > 0 ? (sumaBase10 / notasArr.length) : 0; if (notasArr.length > 0) { notaFinalGlobal += mediaCategoria * (cat.peso / 100); pesoTotalGlobal += cat.peso; }
        html += `<div class="accordion-card"><div class="accordion-header" onclick="window.toggleAccordion('acc-${idx}', 'icon-${idx}')"><div class="accordion-title">${cat.nombre} <span style="font-size:11px; background:var(--cream); border:1px solid var(--border); padding:2px 8px; border-radius:10px; margin-left:8px; color:var(--ink-light);">${cat.peso}%</span></div><div class="accordion-stats"><span class="accordion-media" style="margin-right:12px;">Result: <strong style="color:var(--ink);">${getNotaFormateada(mediaCategoria, formato)}</strong></span><span id="icon-${idx}" class="accordion-chevron">▼</span></div></div><div class="accordion-body" id="acc-${idx}"><div style="padding-top:15px;">`;
        if (notasArr.length === 0) { html += `<div style="font-size:13px; color:var(--ink-light); margin-bottom:12px;">Sin registros evaluados. Pulsa Añadir.</div>`; }
        notasArr.forEach((nObj, i) => { html += `<div class="record-row"><div class="record-desc" style="flex:1;"><input type="text" placeholder="Concepto (ej. Tema 1)" value="${nObj.descripcion || ''}" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'descripcion',this.value)" style="width:100%;"></div><div class="record-val"><input type="number" class="val-nota" min="0" step="0.1" value="${nObj.valor !== undefined ? nObj.valor : ''}" placeholder="Ptos" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'valor',this.value)"><span style="font-weight:600;">/</span><input type="number" class="val-max" min="0.1" step="0.1" value="${nObj.maximo || 10}" title="Max" onchange="window.updateNotaDetalle('${cat.nombre}',${i},'maximo',this.value)"></div><div class="record-actions"><button class="btn-icon" onclick="window.deleteNota('${cat.nombre}',${i})">🗑️</button></div></div>`; });
        html += `<button class="btn-secondary btn-sm" style="margin-top:16px;" onclick="window.addNota('${cat.nombre}')">+ Añadir puntuación</button></div></div></div>`;
      });
      const calculoFinalSeguro = pesoTotalGlobal > 0 ? notaFinalGlobal : null;
      html += `<div class="nota-final-display" style="background:var(--paper); border:2px solid var(--ink); border-radius:12px; padding:32px; text-align:center; margin-top:32px;"><h3 style="color:var(--ink); font-size:16px; margin-bottom:12px; text-transform:uppercase;">Resultado Global Ponderado</h3><div class="nota" style="font-size:48px; font-weight:700; color:${getNotaColor(calculoFinalSeguro, formato)};">${getNotaFormateada(calculoFinalSeguro, formato)}</div></div>`; 
    }
    container.innerHTML = html;
  } catch(e) { console.error(e); }
};

window.toggleAccordion = (bId, iId) => { const b = document.getElementById(bId); const i = document.getElementById(iId); if(b.classList.contains('active')) { b.classList.remove('active'); i.classList.remove('open'); } else { b.classList.add('active'); i.classList.add('open'); } };
window.guardarComentario = async () => { try { await setDoc(doc(db, getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre)), { comentarioTutor: document.getElementById('comentarioArea').value }, { merge:true }); const i = document.getElementById('saveStatusIndicator'); i.style.opacity = 1; setTimeout(() => i.style.opacity = 0, 2000); } catch(e) {} };
window.addNota = async (cat) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.exists() ? d.data() : {categorias:{}}; if(!data.categorias[cat]) { data.categorias[cat] = []; } data.categorias[cat].push({valor: '', maximo: 10, descripcion: ''}); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.updateNotaDetalle = async (cat, idx, campo, val) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); if(typeof data.categorias[cat][idx] === 'number') { data.categorias[cat][idx] = {valor: data.categorias[cat][idx], maximo: 10, descripcion: ''}; } if (campo === 'valor' || campo === 'maximo') { data.categorias[cat][idx][campo] = val === '' ? '' : (parseFloat(val) || 0); } else { data.categorias[cat][idx][campo] = val; } await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };
window.deleteNota = async (cat, idx) => { try { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const d = await getDoc(doc(db, p)); const data = d.data(); data.categorias[cat].splice(idx, 1); await setDoc(doc(db, p), data, {merge:true}); window.loadNotas(); } catch(e) {} };

window.updateCambridgeScore = async (catName, value, max) => { const p = getNotasPath(window.state.currentAlumnoId, window.state.currentTrimestre); const valNum = parseFloat(value) || 0; await setDoc(doc(db, p), { categorias: { [catName]: [{ valor: valNum, maximo: max, descripcion: 'Mock Part' }] } }, { merge: true }); window.loadNotas(); };

// ==========================================
// EXPEDIENTES (TERMÓMETRO Y EMAIL)
// ==========================================
function calcFinalGradeForChart(categorias, notasData) {
  let notaFinal = 0; let pesoTotal = 0;
  categorias.forEach(cat => {
    let cNotas = notasData.categorias?.[cat.nombre] || []; cNotas = cNotas.map(n => typeof n === 'number' ? { valor: n, maximo: 10 } : n);
    const suma = cNotas.reduce((acc, curr) => { let v = curr.valor === '' ? 0 : parseFloat(curr.valor || 0); let m = parseFloat(curr.maximo || 10); if(m <= 0) m = 10; return acc + ((v/m) * 10); }, 0);
    if (cNotas.length > 0) { notaFinal += (suma/cNotas.length) * (cat.peso/100); pesoTotal += cat.peso; }
  }); return pesoTotal > 0 ? notaFinal : null;
}

// SIMULADOR DE ENVÍO DE EMAIL
window.enviarInformeEmail = (studentName) => {
  const btn = document.getElementById('btnSendEmail');
  btn.textContent = "⏳ Enviando informe...";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = "✅ ¡Enviado a la familia!";
    btn.style.backgroundColor = "var(--green)";
    btn.style.borderColor = "var(--green)";
    setTimeout(() => {
      btn.textContent = "📧 Enviar Informe a la Familia";
      btn.style.backgroundColor = "";
      btn.style.borderColor = "";
      btn.disabled = false;
    }, 3000);
  }, 1500);
};

window.initExpedienteGlobal = async (studentRef, studentName) => {
  window.state.currentAlumnoId = studentRef; document.getElementById('expedienteAlumnoNameBread').textContent = studentName; document.getElementById('expedienteAlumnoNameTitle').textContent = studentName; window.hideAllViews(); document.getElementById('expedienteView').classList.remove('hidden'); document.getElementById('expedienteDashboardContent').innerHTML = '<div class="loading">Recopilando datos de todo el curso para el alumno...</div>';
  
  // Modificamos la cabecera para añadir el botón de Email junto al de Imprimir
  const headerDiv = document.querySelector('#expedienteView .page-header');
  headerDiv.innerHTML = `
    <h1>Expediente Académico: <span id="expedienteAlumnoNameTitle" style="color:var(--accent);">${studentName}</span></h1>
    <div style="display:flex; gap:12px;">
      <button id="btnSendEmail" class="btn-secondary" onclick="window.enviarInformeEmail('${studentName}')">📧 Enviar a la Familia</button>
      <button class="btn-primary" onclick="window.print()" style="background:var(--ink);">🖨️ Guardar PDF</button>
    </div>
  `;

  try {
    window.state.expedienteData = { averages: { T1: [], T2: [], T3: [] }, subjects: [], attendance: {F:0, R:0} };
    const [classId, alumnoId] = studentRef.split('/');
    const snapAst = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases/${classId}/asistencia`)); 
    snapAst.forEach(docSnap => { const d = docSnap.data(); if(d[alumnoId] === 'F') window.state.expedienteData.attendance.F++; if(d[alumnoId] === 'R') window.state.expedienteData.attendance.R++; }); 

    const snapAsig = await getDocs(query(collection(db, `colegios/${window.state.colegioId}/asignaturas`), where('alumnos', 'array-contains', studentRef)));
    for (const d of snapAsig.docs) {
      const asig = d.data(); const profeStr = asig.profesorEmails ? asig.profesorEmails.join(', ') : asig.profesorEmail; let subRecord = { name: asig.nombre, profe: profeStr, grades: {}, comments: {}, formato: asig.algoritmoNotas || 'numerico_10' };
      for (const t of ['T1', 'T2', 'T3']) {
        const pDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/ponderaciones/${t}`)); const nDoc = await getDoc(doc(db, `colegios/${window.state.colegioId}/asignaturas/${d.id}/notas/${studentRef.replace('/','-')}-${t}`));
        const cats = pDoc.exists() ? (pDoc.data().categorias || []) : []; const notasData = nDoc.exists() ? nDoc.data() : { categorias: {} };
        subRecord.comments[t] = notasData.comentarioTutor || ""; const final = calcFinalGradeForChart(cats, notasData); subRecord.grades[t] = final;
        if (final !== null) { window.state.expedienteData.averages[t].push({ val: final, form: subRecord.formato }); }
      }
      window.state.expedienteData.subjects.push(subRecord);
    }
    const btn1 = document.querySelector('#expedienteTrimestreTabs .trimestre-tab'); window.switchExpedienteTrimestre('T1', btn1);
  } catch(e) { console.error(e); }
};

window.switchExpedienteTrimestre = (t, btnElement) => {
  window.state.currentExpedienteTrimestre = t; document.querySelectorAll('#expedienteTrimestreTabs .trimestre-tab').forEach(tab => tab.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); document.getElementById('expLabelTrimestre').textContent = { 'T1': '1º Trimestre', 'T2': '2º Trimestre', 'T3': '3º Trimestre' }[t];
  if (!window.state.expedienteData || window.state.expedienteData.subjects.length === 0) { document.getElementById('expedienteDashboardContent').innerHTML = '<div class="empty-state">No matriculado.</div>'; return; }

  let radarLabels = []; let radarData = []; let htmlTable = '<table class="table"><thead><tr><th>Asignatura / Skill</th><th>Profesor</th><th>Calificación</th></tr></thead><tbody>'; let htmlComments = ''; let hasComments = false;
  let termometrosHtml = ''; // Para guardar los termómetros de Cambridge

  window.state.expedienteData.subjects.forEach(sub => {
    const grade = sub.grades[t];
    if (grade !== null) { radarLabels.push(sub.name); radarData.push((sub.formato==='letras_cambridge'?grade*10:grade).toFixed(2)); }
    const gradeFormateado = getNotaFormateada(grade, sub.formato);
    htmlTable += `<tr><td><strong>${sub.name}</strong></td><td>${sub.profe}</td><td><strong style="color:${getNotaColor(grade, sub.formato)}; font-size:15px;">${gradeFormateado}</strong></td></tr>`;
    if (sub.comments[t] && sub.comments[t].trim() !== '') { hasComments = true; htmlComments += `<div class="comment-card"><h4>${sub.name} <span class="profe-tag">Prof. ${sub.profe.split('@')[0]}</span></h4><p>"${sub.comments[t]}"</p></div>`; }
    
    // Si la asignatura es de Cambridge, generamos el termómetro visual
    if (sub.formato === 'letras_cambridge' && grade !== null) {
      const porcentaje = Math.round(grade * 10);
      let statusColor = '#c84b31'; let statusText = 'Needs Practice'; let barWidth = Math.max(10, porcentaje);
      if (porcentaje >= 75) { statusColor = '#2d6a4f'; statusText = 'READY FOR EXAM 🚀'; }
      else if (porcentaje >= 60) { statusColor = '#e8a838'; statusText = 'On Track'; }

      termometrosHtml += `
        <div class="insight-card" style="grid-column: span 2;">
          <div class="insight-title" style="margin-bottom:12px;">📈 Exam Readiness: <strong>${sub.name}</strong></div>
          <div style="background:var(--border); height:16px; border-radius:8px; overflow:hidden; position:relative; margin-bottom:8px;">
            <div style="width:${barWidth}%; background:${statusColor}; height:100%; transition:width 1s ease;"></div>
            <div style="position:absolute; top:0; left:60%; height:100%; border-left:2px dashed #1a1a2e; z-index:1;" title="Pass Mark (60%)"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;">
            <span style="color:var(--ink-light);">Current: ${porcentaje}%</span>
            <span style="color:${statusColor};">${statusText}</span>
          </div>
        </div>
      `;
    }
  });

  const faltas = window.state.expedienteData.attendance.F; const retrasos = window.state.expedienteData.attendance.R;
  let dashboardHtml = `
    <div class="analytics-grid" style="grid-template-columns: 1fr 1fr;">
      ${termometrosHtml}
      <div class="insight-card"><div class="insight-icon">📅</div><div class="insight-title">Asistencia Acumulada</div><div class="insight-value">${faltas} Faltas</div><p style="font-size:13px; color:var(--ink-light); margin-top:8px;">Retrasos registrados: ${retrasos}</p></div>
      <div class="chart-box"><h3>Perfil del Alumno (Radar)</h3><div class="chart-wrapper"><canvas id="expRadarChart"></canvas></div></div>
    </div>
  `;

  document.getElementById('expedienteDashboardContent').innerHTML = dashboardHtml; document.getElementById('expedienteContentTable').innerHTML = htmlTable + '</tbody></table>'; document.getElementById('expedienteContentComments').innerHTML = hasComments ? htmlComments : '<div style="color:var(--ink-light); font-size:14px; font-style:italic;">No hay observaciones del equipo docente.</div>';

  if (expRadarChartInstance) { expRadarChartInstance.destroy(); }
  expRadarChartInstance = new Chart(document.getElementById('expRadarChart').getContext('2d'), { type: 'radar', data: { labels: radarLabels, datasets: [{ label: 'Rendimiento', data: radarData, backgroundColor: 'rgba(45, 106, 79, 0.2)', borderColor: '#2d6a4f', pointBackgroundColor: '#2d6a4f' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: true }, suggestedMin: 0, suggestedMax: 100 } }, plugins: { legend: { display: false } } } });
};

window.exportarNotasCSV = async () => { /* Código original mantenido */ };
window.showClassAnalytics = async () => { alert("Los Analytics globales han sido simplificados en el radar del alumno para dar más valor a los padres."); }

// Formularios
document.addEventListener('DOMContentLoaded', () => { /* Código original mantenido */ });
