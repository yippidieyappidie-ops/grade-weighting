import { collection, addDoc, getDocs, getDoc, doc, setDoc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

window.toggleConfigHorarios = () => {
  const el = document.getElementById('horariosConfigArea');
  const btn = document.getElementById('btnToggleConfig');
  if(el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    btn.innerHTML = 'Ocultar Ajustes';
  } else {
    el.classList.add('hidden');
    btn.innerHTML = '⚙️ Ajustes del Motor';
  }
};

window.showHorariosView = async () => {
  window.hideAllViews();
  document.getElementById('horariosView').classList.remove('hidden');
  document.getElementById('horariosConfigArea').classList.add('hidden');
  document.getElementById('btnToggleConfig').innerHTML = '⚙️ Ajustes del Motor';
  
  if(window.state.cachedClasses.length === 0) {
    const snapC = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases`));
    window.state.cachedClasses = snapC.docs.map(d => ({id: d.id, ...d.data()}));
  }
  if(window.state.cachedProfesores.length === 0) {
    const snapP = await getDocs(query(collection(db, 'profesores'), where('colegioId', '==', window.state.colegioId)));
    window.state.cachedProfesores = snapP.docs.map(d => ({id: d.id, ...d.data()}));
  }

  let clsHtml = '<option value="">Selecciona clase...</option>';
  window.state.cachedClasses.forEach(c => { clsHtml += `<option value="${c.id}">${c.nombre}</option>`; });
  
  document.getElementById('schClase').innerHTML = clsHtml;
  document.getElementById('visorHorarioSelect').innerHTML = clsHtml;
  document.getElementById('bloqClaseId').innerHTML = clsHtml;

  let profHtml = '<option value="">Selecciona profesor...</option>';
  window.state.cachedProfesores.forEach(p => { profHtml += `<option value="${p.id}">${p.nombre || p.id}</option>`; });
  
  document.getElementById('schProfesor').innerHTML = profHtml;
  document.getElementById('bloqProf').innerHTML = profHtml;

  await loadConfiguracionHorarios();
  await loadBloqueosProfesores();
  await loadBloqueosClases();
  await loadCargaLectiva();
  await loadHorariosGuardados();
};

// ==========================================
// PASO 1: HORAS DEL CENTRO
// ==========================================
window.generarTramosDesdeHoras = () => {
  const startStr = document.getElementById('quickTimeStart').value;
  const endStr = document.getElementById('quickTimeEnd').value;
  const duracion = parseInt(document.getElementById('quickTimeDur').value) || 55;

  if(!startStr || !endStr) return;

  let [startH, startM] = startStr.split(':').map(Number);
  let [endH, endM] = endStr.split(':').map(Number);
  
  let startTime = startH * 60 + startM;
  let endTime = endH * 60 + endM;

  let nuevosTramos = [];
  let current = startTime;

  while(current + duracion <= endTime) {
    let next = current + duracion;
    let sH = Math.floor(current / 60).toString().padStart(2, '0');
    let sM = (current % 60).toString().padStart(2, '0');
    let nH = Math.floor(next / 60).toString().padStart(2, '0');
    let nM = (next % 60).toString().padStart(2, '0');
    nuevosTramos.push(`${sH}:${sM} - ${nH}:${nM}`);
    current = next;
  }

  window.state.tramosHorarios = nuevosTramos;
  window.renderTramosUI();
  updateSelectTramosBloqueo();
  alert("Bloques de horas generados. Ahora guárdalos o edita alguno manualmente para añadir el texto 'Recreo'.");
};

async function loadConfiguracionHorarios() {
  try {
    const docRef = await getDoc(doc(db, `colegios/${window.state.colegioId}/horarios/config`));
    if (docRef.exists() && docRef.data().tramos) {
      window.state.tramosHorarios = docRef.data().tramos;
    }
    window.renderTramosUI();
    updateSelectTramosBloqueo();
  } catch(err) { console.error(err); }
}

window.renderTramosUI = () => {
  const container = document.getElementById('configTramosContainer');
  let html = '';
  window.state.tramosHorarios.forEach((tramo, index) => {
    html += `
      <div class="tramo-row">
        <span style="font-weight:600; width:20px; color:var(--ink-light);">${index + 1}.</span>
        <input type="text" class="tramo-input" value="${tramo}" onchange="window.updateTramoLocal(${index}, this.value)" placeholder="Ej. 8:00 - 9:00">
        <button class="btn-icon" onclick="window.removeTramoUI(${index})">🗑️</button>
      </div>
    `;
  });
  container.innerHTML = html;
};

window.updateTramoLocal = (index, val) => {
  window.state.tramosHorarios[index] = val;
  updateSelectTramosBloqueo();
};

window.addTramoUI = () => {
  window.state.tramosHorarios.push(`Bloque ${window.state.tramosHorarios.length + 1}`);
  window.renderTramosUI();
  updateSelectTramosBloqueo();
};

window.removeTramoUI = (index) => {
  if(window.state.tramosHorarios.length <= 1) return alert("Debe haber al menos un tramo de tiempo.");
  window.state.tramosHorarios.splice(index, 1);
  window.renderTramosUI();
  updateSelectTramosBloqueo();
};

window.saveTramosDB = async () => {
  try {
    await setDoc(doc(db, `colegios/${window.state.colegioId}/horarios/config`), { tramos: window.state.tramosHorarios });
    alert("✅ Horas del colegio actualizadas y guardadas.");
  } catch(e) { alert("Error guardando configuración."); }
};

function updateSelectTramosBloqueo() {
  const selectP = document.getElementById('bloqTramoProfe');
  const selectC = document.getElementById('bloqClaseTramo');
  let html = '';
  window.state.tramosHorarios.forEach((tramo, index) => {
    html += `<option value="${index}">${tramo}</option>`;
  });
  if(selectP) selectP.innerHTML = html;
  if(selectC) selectC.innerHTML = html;
}

// ==========================================
// PASO 2: AUSENCIAS DE PROFESORES
// ==========================================
async function loadBloqueosProfesores() {
  try {
    const snap = await getDocs(collection(db, `colegios/${window.state.colegioId}/horarios_bloqueos`));
    window.state.bloqueosProfesores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBloqueosList();
  } catch(err) { console.error(err); }
}

function renderBloqueosList() {
  const list = document.getElementById('bloqueosList');
  if (window.state.bloqueosProfesores.length === 0) {
    list.innerHTML = '<div style="color:var(--ink-light); font-size:13px; text-align:center; padding:10px;">Profesores disponibles siempre.</div>';
    return;
  }
  let html = '';
  window.state.bloqueosProfesores.forEach(b => {
    const prof = window.state.cachedProfesores.find(p => p.id === b.profesorId);
    const profName = prof ? (prof.nombre || prof.id.split('@')[0]) : b.profesorId;
    const tramoName = window.state.tramosHorarios[b.tramoIndex] || `Periodo ${b.tramoIndex + 1}`;
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; border-bottom:1px dashed var(--border);">
        <span style="font-size:13px;"><strong>${profName}</strong> ausente el <strong>${b.dia}</strong> (${tramoName})</span>
        <button class="btn-icon" style="padding:4px; font-size:12px;" onclick="window.borrarBloqueo('${b.id}')">✕</button>
      </div>
    `;
  });
  list.innerHTML = html;
}

window.addBloqueo = async (e) => {
  e.preventDefault();
  const profId = document.getElementById('bloqProf').value;
  const dia = document.getElementById('bloqDia').value;
  const tramoIndex = parseInt(document.getElementById('bloqTramoProfe').value);
  try {
    await addDoc(collection(db, `colegios/${window.state.colegioId}/horarios_bloqueos`), {
      profesorId: profId, dia: dia, tramoIndex: tramoIndex
    });
    await loadBloqueosProfesores();
  } catch(err) { alert("Error al bloquear hora."); }
};

window.borrarBloqueo = async (id) => {
  try {
    await deleteDoc(doc(db, `colegios/${window.state.colegioId}/horarios_bloqueos/${id}`));
    await loadBloqueosProfesores();
  } catch(err) {}
};

// ==========================================
// PASO 3: RECREOS ESCALONADOS
// ==========================================
async function loadBloqueosClases() {
  try {
    const snap = await getDocs(collection(db, `colegios/${window.state.colegioId}/horarios_bloqueos_clases`));
    window.state.bloqueosClases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBloqueosClasesList();
  } catch(err) { console.error(err); }
}

function renderBloqueosClasesList() {
  const list = document.getElementById('bloqueosClasesList');
  if (window.state.bloqueosClases.length === 0) {
    list.innerHTML = '<div style="color:var(--ink-light); font-size:13px; text-align:center; padding:10px;">Sin recreos configurados.</div>';
    return;
  }
  let html = '';
  window.state.bloqueosClases.forEach(b => {
    const claseInfo = window.state.cachedClasses.find(c => c.id === b.claseId);
    const claseName = claseInfo ? claseInfo.nombre : b.claseId;
    const tramoName = window.state.tramosHorarios[b.tramoIndex] || `Periodo ${b.tramoIndex + 1}`;
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; border-bottom:1px dashed var(--border);">
        <span style="font-size:13px;"><strong>${claseName}</strong> - ${b.motivo} el <strong>${b.dia}</strong> (${tramoName})</span>
        <button class="btn-icon" style="padding:4px; font-size:12px;" onclick="window.borrarBloqueoClase('${b.id}')">✕</button>
      </div>
    `;
  });
  list.innerHTML = html;
}

window.addBloqueoClase = async (e) => {
  e.preventDefault();
  const claseId = document.getElementById('bloqClaseId').value;
  const dia = document.getElementById('bloqClaseDia').value;
  const tramoIndex = parseInt(document.getElementById('bloqClaseTramo').value);
  const motivo = document.getElementById('bloqClaseMotivo').value;
  try {
    await addDoc(collection(db, `colegios/${window.state.colegioId}/horarios_bloqueos_clases`), {
      claseId: claseId, dia: dia, tramoIndex: tramoIndex, motivo: motivo
    });
    document.getElementById('bloqClaseMotivo').value = '';
    await loadBloqueosClases();
  } catch(err) { alert("Error al fijar recreo."); }
};

window.borrarBloqueoClase = async (id) => {
  try {
    await deleteDoc(doc(db, `colegios/${window.state.colegioId}/horarios_bloqueos_clases/${id}`));
    await loadBloqueosClases();
  } catch(err) {}
};

// ==========================================
// PASO 4: CARGA LECTIVA
// ==========================================
async function loadCargaLectiva() {
  const list = document.getElementById('cargaLectivaList');
  list.innerHTML = '<div style="padding:20px; text-align:center;">Cargando...</div>';
  const snap = await getDocs(collection(db, `colegios/${window.state.colegioId}/carga_lectiva`));
  window.state.cargaLectiva = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (window.state.cargaLectiva.length === 0) {
    list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--ink-light);">No hay asignaciones creadas. Añade la primera arriba.</div>';
    return;
  }
  let html = '<table class="table"><thead><tr><th>Clase</th><th>Asignatura</th><th>Profesor</th><th>Horas/Sem</th><th></th></tr></thead><tbody>';
  window.state.cargaLectiva.forEach(carga => {
    const claseInfo = window.state.cachedClasses.find(c => c.id === carga.claseId);
    const profInfo = window.state.cachedProfesores.find(p => p.id === carga.profesorId);
    html += `
      <tr>
        <td><strong>${claseInfo ? claseInfo.nombre : 'Desc.'}</strong></td>
        <td>${carga.asignatura}</td>
        <td>${profInfo ? (profInfo.nombre || profInfo.id) : carga.profesorId}</td>
        <td>${carga.horas} h</td>
        <td style="text-align:right;"><button class="btn-icon" onclick="window.borrarCarga('${carga.id}')">🗑️</button></td>
      </tr>
    `;
  });
  list.innerHTML = html + '</tbody></table>';
}

window.addCargaLectiva = async (e) => {
  e.preventDefault();
  const claseId = document.getElementById('schClase').value;
  const asignatura = document.getElementById('schAsignatura').value;
  const profesorId = document.getElementById('schProfesor').value;
  const horas = parseInt(document.getElementById('schHoras').value);
  try {
    await addDoc(collection(db, `colegios/${window.state.colegioId}/carga_lectiva`), {
      claseId, asignatura, profesorId, horas, createdAt: serverTimestamp()
    });
    document.getElementById('schAsignatura').value = '';
    loadCargaLectiva();
  } catch(err) { alert("Error al añadir carga lectiva."); }
};

window.borrarCarga = async (id) => {
  try {
    await deleteDoc(doc(db, `colegios/${window.state.colegioId}/carga_lectiva/${id}`));
    loadCargaLectiva();
  } catch(err) {}
};

// ==========================================
// PASO 5: EL ALGORITMO
// ==========================================
window.generarHorariosAutomaticos = async () => {
  if (window.state.cargaLectiva.length === 0) return alert("Primero debes añadir la carga lectiva (Paso 4).");
  
  document.getElementById('timetableContainer').innerHTML = '<div class="loading">⏳ El algoritmo está calculando todas las combinaciones posibles...</div>';
  
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const numHoras = window.state.tramosHorarios.length;
  
  let scheduleClase = {};
  let scheduleProfe = {};

  window.state.cachedClasses.forEach(c => {
      scheduleClase[c.id] = {};
      dias.forEach(d => scheduleClase[c.id][d] = Array(numHoras).fill(null));
  });
  
  window.state.cachedProfesores.forEach(p => {
      scheduleProfe[p.id] = {};
      dias.forEach(d => scheduleProfe[p.id][d] = Array(numHoras).fill(null));
  });

  // Fijar recreos
  window.state.bloqueosClases.forEach(bc => {
      if (!scheduleClase[bc.claseId]) return;
      const diasAfectados = bc.dia === 'Todos' ? dias : [bc.dia];
      diasAfectados.forEach(d => {
          if (bc.tramoIndex >= 0 && bc.tramoIndex < numHoras) {
              scheduleClase[bc.claseId][d][bc.tramoIndex] = { type: 'break', label: bc.motivo };
          }
      });
  });

  let cargas = [...window.state.cargaLectiva].sort((a,b) => b.horas - a.horas);
  let conflictos = 0;

  cargas.forEach(carga => {
    let horasColocadas = 0;
    let intentos = 0;

    while(horasColocadas < carga.horas && intentos < 100) {
      let colocado = false;

      for (let d of dias) {
        if (colocado) break;
        let yaTieneHoy = scheduleClase[carga.claseId][d].some(s => s && s.asignatura === carga.asignatura);
        
        if (!yaTieneHoy) {
          for (let h = 0; h < numHoras; h++) {
            let isProfBlocked = window.state.bloqueosProfesores.some(b => b.profesorId === carga.profesorId && b.dia === d && b.tramoIndex === h);
            if (!scheduleClase[carga.claseId][d][h] && !scheduleProfe[carga.profesorId][d][h] && !isProfBlocked) {
              scheduleClase[carga.claseId][d][h] = { asignatura: carga.asignatura, profesorId: carga.profesorId };
              scheduleProfe[carga.profesorId][d][h] = carga.claseId;
              colocado = true;
              horasColocadas++;
              break;
            }
          }
        }
      }

      if (!colocado) {
        for (let d of dias) {
          if (colocado) break;
          for (let h = 0; h < numHoras; h++) {
            let isProfBlocked = window.state.bloqueosProfesores.some(b => b.profesorId === carga.profesorId && b.dia === d && b.tramoIndex === h);
            if (!scheduleClase[carga.claseId][d][h] && !scheduleProfe[carga.profesorId][d][h] && !isProfBlocked) {
              scheduleClase[carga.claseId][d][h] = { asignatura: carga.asignatura, profesorId: carga.profesorId };
              scheduleProfe[carga.profesorId][d][h] = carga.claseId;
              colocado = true;
              horasColocadas++;
              break;
            }
          }
        }
      }

      if(!colocado) {
        conflictos++;
        break;
      }
      intentos++;
    }
  });

  window.state.horariosGenerados = scheduleClase;
  
  try {
    await setDoc(doc(db, `colegios/${window.state.colegioId}/horarios/actual`), {
      clases: scheduleClase,
      updatedAt: serverTimestamp()
    });

    if(conflictos > 0) {
      alert(`⚠️ El algoritmo ha terminado, pero hubo ${conflictos} hora(s) que no se pudieron encajar.\n\nEsto pasa si un profesor tiene demasiadas clases o si faltan horas en el colegio.`);
    } else {
      alert('✅ ¡Horario generado con éxito respetando los recreos y disponibilidades!');
    }
    
    document.getElementById('horariosConfigArea').classList.add('hidden');
    document.getElementById('btnToggleConfig').innerHTML = '⚙️ Ajustes del Motor';
    window.renderTimetable();
  } catch(err) { alert("Error al guardar el horario"); }
};

async function loadHorariosGuardados() {
  try {
    const docRef = await getDoc(doc(db, `colegios/${window.state.colegioId}/horarios/actual`));
    if (docRef.exists()) {
      window.state.horariosGenerados = docRef.data().clases;
    }
  } catch(err) { console.error(err); }
}

// ==========================================
// VISORES Y EXPORTACIÓN PDF
// ==========================================
window.cambiarTipoVisor = () => {
  const tipo = document.getElementById('visorTipoSelect').value;
  const select = document.getElementById('visorHorarioSelect');
  const label = document.getElementById('visorLabelDinamico');

  let html = '';
  if(tipo === 'clase') {
    label.textContent = "Selecciona clase:";
    html = '<option value="">Elige una clase...</option>';
    window.state.cachedClasses.forEach(c => html += `<option value="${c.id}">${c.nombre}</option>`);
  } else {
    label.textContent = "Selecciona profesor:";
    html = '<option value="">Elige un profesor...</option>';
    window.state.cachedProfesores.forEach(p => html += `<option value="${p.id}">${p.nombre || p.id}</option>`);
  }
  select.innerHTML = html;
  document.getElementById('timetableContainer').innerHTML = '<div class="empty-state">Selecciona una opción arriba.</div>';
};

window.renderTimetable = () => {
  const tipo = document.getElementById('visorTipoSelect').value;
  const valId = document.getElementById('visorHorarioSelect').value;
  if(tipo === 'clase') window.renderTimetableClase(valId);
  else window.renderTimetableProfesor(valId);
};

window.renderTimetableClase = (claseId) => {
  const container = document.getElementById('timetableContainer');
  if (!claseId) return container.innerHTML = '<div class="empty-state">Selecciona una clase arriba.</div>';
  if (!window.state.horariosGenerados || !window.state.horariosGenerados[claseId]) return container.innerHTML = '<div class="empty-state">No hay horario generado para esta clase.</div>';

  const horario = window.state.horariosGenerados[claseId];
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const tiempos = window.state.tramosHorarios;

  let html = '<table class="timetable" id="pdfTableTarget"><thead><tr><th style="width:120px;">Hora</th>';
  dias.forEach(d => { html += `<th>${d}</th>`; });
  html += '</tr></thead><tbody>';

  for (let h = 0; h < tiempos.length; h++) {
    html += `<tr><td class="tt-hour">${tiempos[h]}</td>`;
    for (let d of dias) {
      const bloque = horario[d][h];
      if (bloque) {
        if (bloque.type === 'break') {
          html += `<td><div class="tt-break">☕ ${bloque.label}</div></td>`;
        } else {
          const profInfo = window.state.cachedProfesores.find(p => p.id === bloque.profesorId);
          const profName = profInfo ? (profInfo.nombre || profInfo.id.split('@')[0]) : 'Profesor';
          html += `<td><div class="tt-slot"><div class="tt-subject">${bloque.asignatura}</div><div class="tt-teacher">${profName}</div></div></td>`;
        }
      } else {
        html += `<td style="background: var(--cream); border: 1px dashed var(--border);"></td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
};

window.renderTimetableProfesor = (profEmail) => {
  const container = document.getElementById('timetableContainer');
  if (!profEmail) return container.innerHTML = '<div class="empty-state">Selecciona un profesor arriba.</div>';
  if (!window.state.horariosGenerados) return container.innerHTML = '<div class="empty-state">El horario general aún no se ha generado.</div>';

  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const tiempos = window.state.tramosHorarios;
  const profSchedule = { 'Lunes':[], 'Martes':[], 'Miércoles':[], 'Jueves':[], 'Viernes':[] };
  dias.forEach(d => profSchedule[d] = Array(tiempos.length).fill(null));

  for(let cId in window.state.horariosGenerados) {
      dias.forEach(d => {
          window.state.horariosGenerados[cId][d].forEach((slot, h) => {
              if(slot && slot.profesorId === profEmail) {
                  const claseInfo = window.state.cachedClasses.find(c => c.id === cId);
                  profSchedule[d][h] = { asignatura: slot.asignatura, claseName: claseInfo ? claseInfo.nombre : 'Clase' };
              }
          });
      });
  }

  let html = '<table class="timetable" id="pdfTableTarget"><thead><tr><th style="width:120px;">Hora</th>';
  dias.forEach(d => { html += `<th>${d}</th>`; });
  html += '</tr></thead><tbody>';

  for (let h = 0; h < tiempos.length; h++) {
    html += `<tr><td class="tt-hour">${tiempos[h]}</td>`;
    for (let d of dias) {
      const bloque = profSchedule[d][h];
      let isProfBlocked = window.state.bloqueosProfesores.some(b => b.profesorId === profEmail && b.dia === d && b.tramoIndex === h);

      if (bloque) {
        html += `<td><div class="tt-slot"><div class="tt-subject">${bloque.asignatura}</div><div class="tt-teacher">${bloque.claseName}</div></div></td>`;
      } else if (isProfBlocked) {
        html += `<td><div class="tt-blocked">NO DISPONIBLE</div></td>`;
      } else {
        html += `<td style="background: var(--cream); border: 1px dashed var(--border);"></td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
};

window.exportarHorarioPDF = (isProfesorPropio = false) => {
  let titulo = "Horario";
  if (isProfesorPropio) { 
    titulo = "Mi Horario Semanal"; 
  } else { 
    const select = document.getElementById('visorHorarioSelect'); 
    if (select.selectedIndex >= 0) titulo = `Horario - ${select.options[select.selectedIndex].text}`; 
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(26, 26, 46); 
  doc.text(titulo, 14, 20);

  doc.autoTable({
    html: '#pdfTableTarget', startY: 30, theme: 'grid', 
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, valign: 'middle', halign: 'center' }, 
    headStyles: { fillColor: [26,26,46], textColor: [255,255,255], fontStyle: "bold" }, 
    columnStyles: { 0: { fontStyle: "bold", fillColor: [250,248,243] } },
    didParseCell: function(data) {
      if(data.section === 'body' && data.column.index > 0) {
        if(data.cell.text && data.cell.text.length > 0) {
          let txt = data.cell.text.join(' ').trim();
          if(txt.includes('NO DISPONIBLE')) { 
            data.cell.styles.fillColor = [255,238,238]; data.cell.styles.textColor = [200,75,49]; data.cell.styles.fontStyle = 'bold'; 
          } else if (txt.includes('☕')) { 
            data.cell.styles.fillColor = [240,240,240]; data.cell.styles.fontStyle = 'italic'; 
          } else if (txt !== '') { 
            data.cell.styles.fillColor = [245,237,233]; 
          }
        }
      }
    }
  });

  doc.save(`${titulo.replace(/ /g, "_")}.pdf`);
};

window.showMiHorarioView = async () => {
  window.hideAllViews();
  document.getElementById('miHorarioView').classList.remove('hidden');
  
  if(window.state.cachedClasses.length === 0) { 
    const snapC = await getDocs(collection(db, `colegios/${window.state.colegioId}/clases`)); 
    window.state.cachedClasses = snapC.docs.map(d => ({id: d.id, ...d.data()})); 
  }
  
  await loadConfiguracionHorarios(); 
  await loadHorariosGuardados(); 
  await loadBloqueosProfesores();

  const profEmail = window.state.currentUser.email.trim().toLowerCase();
  window.renderTimetableProfesor(profEmail);
  
  // Mover la tabla renderizada al contenedor correcto de la vista del profesor
  const tablaHTML = document.getElementById('timetableContainer').innerHTML;
  document.getElementById('miTimetableContainer').innerHTML = tablaHTML;
};
