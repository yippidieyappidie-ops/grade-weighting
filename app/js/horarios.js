import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

let horariosConfig = { tramos: [], bloqueosClases: [], bloqueosProfes: [], cargaLectiva: [], aulas: [] };
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

window.showHorariosView = () => {
  window.hideAllViews();
  document.getElementById('horariosView').classList.remove('hidden');
  window.loadHorariosConfigData();
  
  // Añadir la opción "Toda la semana" al select de profesores (si no la tiene ya)
  const selProfDia = document.getElementById('bloqDia');
  if (selProfDia && !selProfDia.querySelector('option[value="Todos"]')) {
    selProfDia.insertAdjacentHTML('afterbegin', '<option value="Todos">Toda la semana</option>');
  }
};

window.toggleConfigHorarios = () => {
  const el = document.getElementById('horariosConfigArea');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    window.renderConfigPanels();
  }
};


window.loadHorariosConfigData = async () => {
  try {
    const docRef = doc(db, `colegios/${window.state.colegioId}/horariosConfig/main`);
    const snap = await getDoc(docRef);
    if (snap.exists()) { horariosConfig = { aulas: [], ...snap.data() }; } 
    else { horariosConfig = { tramos: [], bloqueosClases: [], bloqueosProfes: [], cargaLectiva: [], aulas: [] }; }
    
    // Rellenar selects
    window.rellenarSelectsHorarios();
    window.renderTimetable(); // Intentar cargar horario generado
  } catch (e) { console.error(e); }
};

window.rellenarSelectsHorarios = async () => {
  try {
    let tramosHtml = '';
    horariosConfig.tramos.forEach((t, i) => { tramosHtml += `<option value="${i}">${t}</option>`; });
    document.getElementById('bloqClaseTramo').innerHTML = tramosHtml;
    document.getElementById('bloqTramoProfe').innerHTML = tramosHtml;

    let clasesHtml = '';
    window.state.cachedClasses?.forEach(c => { clasesHtml += `<option value="${c.id}">${c.nombre}</option>`; });
    document.getElementById('bloqClaseId').innerHTML = clasesHtml;
    document.getElementById('schClase').innerHTML = clasesHtml;

    let profesHtml = '';
    window.state.cachedProfesores?.forEach(p => { profesHtml += `<option value="${p.id}">${p.nombre || p.id.split('@')[0]}</option>`; });
    document.getElementById('bloqProf').innerHTML = profesHtml;
    document.getElementById('schProfesor').innerHTML = profesHtml;
  } catch (e) { console.error("Error rellenando selects"); }
};

window.renderConfigPanels = () => {
  window.renderTramosUI();
  window.renderBloqueosClasesUI();
  window.renderBloqueosProfesUI();
  window.renderCargaLectivaUI();
  window.renderAulasUI();
};


window.generarTramosDesdeHoras = () => {
  const start = document.getElementById('quickTimeStart').value;
  const end = document.getElementById('quickTimeEnd').value;
  const dur = parseInt(document.getElementById('quickTimeDur').value);
  if (!start || !end || !dur) return alert("Rellena todos los campos de hora");

  let [h, m] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const endMin = eh * 60 + em;
  
  const nuevosTramos = [];
  let currentMin = h * 60 + m;

  while (currentMin + dur <= endMin) {
    const sh = Math.floor(currentMin / 60).toString().padStart(2, '0');
    const sm = (currentMin % 60).toString().padStart(2, '0');
    currentMin += dur;
    const fh = Math.floor(currentMin / 60).toString().padStart(2, '0');
    const fm = (currentMin % 60).toString().padStart(2, '0');
    nuevosTramos.push(`${sh}:${sm} - ${fh}:${fm}`);
  }
  
  horariosConfig.tramos = nuevosTramos;
  window.renderTramosUI();
};

window.addTramoUI = () => { horariosConfig.tramos.push(`00:00 - 00:00`); window.renderTramosUI(); };
window.updateTramoUI = (i, val) => { horariosConfig.tramos[i] = val; };
window.deleteTramoUI = (i) => { horariosConfig.tramos.splice(i, 1); window.renderTramosUI(); };

window.renderTramosUI = () => {
  const container = document.getElementById('configTramosContainer');
  let html = '';
  horariosConfig.tramos.forEach((t, i) => {
    html += `<div style="display:flex; gap:8px; margin-bottom:8px;">
      <span style="background:var(--ink); color:#fff; border-radius:4px; padding:6px 10px; font-size:12px; font-weight:bold;">Tramo ${i+1}</span>
      <input type="text" value="${t}" onchange="window.updateTramoUI(${i}, this.value)" style="flex:1; padding:6px; font-weight:bold;">
      <button class="btn-icon" onclick="window.deleteTramoUI(${i})">🗑️</button>
    </div>`;
  });
  container.innerHTML = html;
};


window.renderAulasUI = () => {
  let container = document.getElementById('aulasConfigContainer');
  if (!container) {
    // Inyectar el contenedor de Aulas en el DOM si no existe
    const grid = document.querySelector('#horariosConfigArea');
    const aulasHtml = `
      <div class="card" style="margin-top:20px; border-color:var(--green);">
        <h3 style="margin-bottom:8px;">5. Espacios Físicos (Aulas)</h3>
        <p style="color:var(--ink-light); font-size:13px; margin-bottom:16px;">El algoritmo nunca solapará más clases a la misma hora que aulas tengas disponibles.</p>
        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <input type="text" id="nuevaAulaNombre" placeholder="Ej. Aula 1 - Principal" style="flex:1; padding:8px;">
          <button class="btn-secondary" onclick="window.addAula()" style="color:var(--green); border-color:var(--green);">+ Añadir Aula</button>
        </div>
        <div id="aulasConfigContainer" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', aulasHtml);
    container = document.getElementById('aulasConfigContainer');
  }

  let html = '';
  if (!horariosConfig.aulas) horariosConfig.aulas = [];
  horariosConfig.aulas.forEach((a, i) => {
    html += `<div style="background:var(--cream); border:1px solid var(--border); padding:6px 12px; border-radius:99px; font-size:13px; display:flex; align-items:center; gap:8px;">
      <strong>${a}</strong> <span style="cursor:pointer; color:var(--accent);" onclick="window.deleteAula(${i})">✕</span>
    </div>`;
  });
  if (horariosConfig.aulas.length === 0) html = '<span style="color:var(--ink-light); font-size:13px;">No hay aulas limitadas (Capacidad infinita).</span>';
  container.innerHTML = html;
};

window.addAula = () => {
  const input = document.getElementById('nuevaAulaNombre');
  if (!input.value.trim()) return;
  if (!horariosConfig.aulas) horariosConfig.aulas = [];
  horariosConfig.aulas.push(input.value.trim());
  input.value = '';
  window.renderAulasUI();
  window.saveConfigSinAviso();
};
window.deleteAula = (i) => { horariosConfig.aulas.splice(i, 1); window.renderAulasUI(); window.saveConfigSinAviso(); };

window.addBloqueoClase = (e) => {
  e.preventDefault();
  const cId = document.getElementById('bloqClaseId').value;
  const dia = document.getElementById('bloqClaseDia').value;
  const tramo = parseInt(document.getElementById('bloqClaseTramo').value);
  const motivo = document.getElementById('bloqClaseMotivo').value;
  const cName = document.getElementById('bloqClaseId').options[document.getElementById('bloqClaseId').selectedIndex].text;
  const tName = horariosConfig.tramos[tramo];
  
  if (dia === 'Todos') { DIAS_SEMANA.forEach(d => horariosConfig.bloqueosClases.push({ claseId: cId, claseName: cName, dia: d, tramo, tramoName: tName, motivo })); } 
  else { horariosConfig.bloqueosClases.push({ claseId: cId, claseName: cName, dia, tramo, tramoName: tName, motivo }); }
  
  window.renderBloqueosClasesUI(); e.target.reset(); window.saveConfigSinAviso();
};

window.addBloqueo = (e) => {
  e.preventDefault();
  const pId = document.getElementById('bloqProf').value;
  const dia = document.getElementById('bloqDia').value;
  const tramo = parseInt(document.getElementById('bloqTramoProfe').value);
  const pName = document.getElementById('bloqProf').options[document.getElementById('bloqProf').selectedIndex].text;
  const tName = horariosConfig.tramos[tramo];

  if (dia === 'Todos') { DIAS_SEMANA.forEach(d => horariosConfig.bloqueosProfes.push({ profeId: pId, profeName: pName, dia: d, tramo, tramoName: tName })); } 
  else { horariosConfig.bloqueosProfes.push({ profeId: pId, profeName: pName, dia, tramo, tramoName: tName }); }
  
  window.renderBloqueosProfesUI(); e.target.reset(); window.saveConfigSinAviso();
};

window.deleteBloqueoClase = (i) => { horariosConfig.bloqueosClases.splice(i, 1); window.renderBloqueosClasesUI(); window.saveConfigSinAviso(); };
window.deleteBloqueoProfe = (i) => { horariosConfig.bloqueosProfes.splice(i, 1); window.renderBloqueosProfesUI(); window.saveConfigSinAviso(); };

window.renderBloqueosClasesUI = () => {
  let html = '';
  horariosConfig.bloqueosClases.forEach((b, i) => { html += `<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid #ddd; padding:4px 0;"><span><strong>${b.claseName}</strong>: ${b.dia} (${b.tramoName}) - ${b.motivo}</span><span style="cursor:pointer; color:red;" onclick="window.deleteBloqueoClase(${i})">✕</span></div>`; });
  document.getElementById('bloqueosClasesList').innerHTML = html;
};
window.renderBloqueosProfesUI = () => {
  let html = '';
  horariosConfig.bloqueosProfes.forEach((b, i) => { html += `<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid #ddd; padding:4px 0;"><span><strong>${b.profeName}</strong> ausente: ${b.dia} (${b.tramoName})</span><span style="cursor:pointer; color:red;" onclick="window.deleteBloqueoProfe(${i})">✕</span></div>`; });
  document.getElementById('bloqueosList').innerHTML = html;
};

window.addCargaLectiva = (e) => {
  e.preventDefault();
  const cId = document.getElementById('schClase').value;
  const cName = document.getElementById('schClase').options[document.getElementById('schClase').selectedIndex].text;
  const pId = document.getElementById('schProfesor').value;
  const pName = document.getElementById('schProfesor').options[document.getElementById('schProfesor').selectedIndex].text;
  const asig = document.getElementById('schAsignatura').value;
  const horas = parseInt(document.getElementById('schHoras').value);

  horariosConfig.cargaLectiva.push({ claseId: cId, claseName: cName, profeId: pId, profeName: pName, asig, horas });
  window.renderCargaLectivaUI(); e.target.reset(); window.saveConfigSinAviso();
};
window.deleteCarga = (i) => { horariosConfig.cargaLectiva.splice(i, 1); window.renderCargaLectivaUI(); window.saveConfigSinAviso(); };

window.renderCargaLectivaUI = () => {
  const container = document.getElementById('cargaLectivaList');
  if (horariosConfig.cargaLectiva.length === 0) { container.innerHTML = '<div style="padding:16px; color:var(--ink-light); font-size:13px; text-align:center;">No hay horas asignadas.</div>'; return; }
  
  // Agrupar por Clase para que sea visual
  const grupos = {};
  horariosConfig.cargaLectiva.forEach((c, index) => {
    if (!grupos[c.claseName]) grupos[c.claseName] = [];
    grupos[c.claseName].push({ ...c, index });
  });

  let html = '<div style="padding:10px;">';
  for (const [clase, asignaciones] of Object.entries(grupos)) {
    html += `<div style="margin-bottom:12px; border:1px solid var(--border); border-radius:8px; overflow:hidden;">
              <div style="background:var(--ink); color:white; padding:8px 12px; font-weight:bold; font-size:14px;">🎓 ${clase}</div>
              <div style="padding:8px; background:var(--paper);">`;
    asignaciones.forEach(a => {
      html += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; border-bottom:1px dashed var(--border); padding:6px 0;">
                <span><strong>${a.horas}h</strong> de ${a.asig} (Prof: <span style="color:var(--accent);">${a.profeName}</span>)</span>
                <button class="btn-icon" style="color:red;" onclick="window.deleteCarga(${a.index})">✕</button>
               </div>`;
    });
    html += `</div></div>`;
  }
  html += '</div>';
  container.innerHTML = html;
};

window.saveTramosDB = async () => { await setDoc(doc(db, `colegios/${window.state.colegioId}/horariosConfig/main`), horariosConfig); alert("✅ Horas y configuración guardadas"); window.rellenarSelectsHorarios(); };
window.saveConfigSinAviso = async () => { await setDoc(doc(db, `colegios/${window.state.colegioId}/horariosConfig/main`), horariosConfig); window.rellenarSelectsHorarios(); };

window.generarHorariosAutomaticos = async () => {
  if (horariosConfig.tramos.length === 0 || horariosConfig.cargaLectiva.length === 0) return alert("Faltan horas o carga lectiva para generar el horario.");
  
  const btn = document.querySelector('button[onclick="window.generarHorariosAutomaticos()"]');
  btn.textContent = "🧠 Calculando cuadre..."; btn.disabled = true;

  try {
    
    let horarioGlobal = {};
    DIAS_SEMANA.forEach(d => {
      horarioGlobal[d] = {};
      horariosConfig.tramos.forEach((_, t) => { horarioGlobal[d][t] = []; });
    });

    const esClaseLibre = (cId, dia, tramo) => {
      if (horarioGlobal[dia][tramo].some(h => h.claseId === cId)) return false; // Ya tiene clase
      if (horariosConfig.bloqueosClases.some(b => b.claseId === cId && b.dia === dia && b.tramo === tramo)) return false; // Recreo
      return true;
    };
    
    const esProfeLibre = (pId, dia, tramo) => {
      if (horarioGlobal[dia][tramo].some(h => h.profeId === pId)) return false; // Ya da clase a otro
      if (horariosConfig.bloqueosProfes.some(b => b.profeId === pId && b.dia === dia && b.tramo === tramo)) return false; // Ausente
      return true;
    };

    const hayAulaLibre = (dia, tramo) => {
      if (!horariosConfig.aulas || horariosConfig.aulas.length === 0) return true; // Capacidad infinita
      return horarioGlobal[dia][tramo].length < horariosConfig.aulas.length; // Comprueba si se llegó al límite
    };

    let fallos = [];
    horariosConfig.cargaLectiva.forEach(carga => {
      let horasColocadas = 0;
      let diasUsados = new Set(); // Para no poner 3 mates el mismo día
      
      for (let intento = 0; intento < 100 && horasColocadas < carga.horas; intento++) {
        // Buscar un día (priorizando los que no tienen esta asignatura aún)
        let diaIdeal = DIAS_SEMANA.find(d => !diasUsados.has(d));
        if (!diaIdeal) diaIdeal = DIAS_SEMANA[Math.floor(Math.random() * DIAS_SEMANA.length)];

        let tramoLibre = -1;
        for (let t = 0; t < horariosConfig.tramos.length; t++) {
          if (esClaseLibre(carga.claseId, diaIdeal, t) && esProfeLibre(carga.profeId, diaIdeal, t) && hayAulaLibre(diaIdeal, t)) {
            tramoLibre = t; break;
          }
        }

        if (tramoLibre !== -1) {
          // Asignar aula si existen
          let aulaAsignada = "Sin aula";
          if (horariosConfig.aulas && horariosConfig.aulas.length > 0) {
            aulaAsignada = horariosConfig.aulas[horarioGlobal[diaIdeal][tramoLibre].length];
          }

          horarioGlobal[diaIdeal][tramoLibre].push({
            claseId: carga.claseId, claseName: carga.claseName,
            profeId: carga.profeId, profeName: carga.profeName,
            asig: carga.asig, aula: aulaAsignada
          });
          horasColocadas++;
          diasUsados.add(diaIdeal);
        }
      }
      if (horasColocadas < carga.horas) { fallos.push(`${carga.claseName} - ${carga.asig} (Solo encajaron ${horasColocadas}/${carga.horas}h)`); }
    });

    await setDoc(doc(db, `colegios/${window.state.colegioId}/horariosGlobales/current`), { data: JSON.stringify(horarioGlobal), updatedAt: serverTimestamp() });
    
    if (fallos.length > 0) { alert(`⚠️ Horario generado con avisos. No había hueco físico/aulas para:\n\n${fallos.join('\n')}`); } 
    else { alert("✨ ¡Cuadrante Mágico generado con éxito! Todas las clases y aulas cuadran."); }

    window.rellenarVisorSelect();
    window.renderTimetable();
  } catch (e) { alert("Error en el algoritmo"); } 
  finally { btn.textContent = "✨ Generar Automático"; btn.disabled = false; }
};

let horarioDataCache = null;

window.rellenarVisorSelect = () => {
  const tipo = document.getElementById('visorTipoSelect').value;
  const select = document.getElementById('visorHorarioSelect');
  document.getElementById('visorLabelDinamico').textContent = tipo === 'clase' ? 'Selecciona clase:' : 'Selecciona profesor:';
  
  let html = '<option value="">-- Elige --</option>';
  if (tipo === 'clase') { window.state.cachedClasses?.forEach(c => html += `<option value="${c.id}">${c.nombre}</option>`); } 
  else { window.state.cachedProfesores?.forEach(p => html += `<option value="${p.id}">${p.nombre || p.id.split('@')[0]}</option>`); }
  select.innerHTML = html;
};

window.cambiarTipoVisor = () => { window.rellenarVisorSelect(); window.renderTimetable(); };

window.renderTimetable = async () => {
  const container = document.getElementById('timetableContainer');
  const targetId = document.getElementById('visorHorarioSelect')?.value;
  const tipo = document.getElementById('visorTipoSelect')?.value;

  if (!horariosConfig.tramos || horariosConfig.tramos.length === 0) { container.innerHTML = '<div class="empty-state">Configura las horas de apertura en "Ajustes del Motor" primero.</div>'; return; }
  if (!targetId) { container.innerHTML = '<div class="empty-state">Selecciona arriba a quién quieres verle el horario.</div>'; return; }

  try {
    if (!horarioDataCache) {
      const snap = await getDoc(doc(db, `colegios/${window.state.colegioId}/horariosGlobales/current`));
      if (snap.exists()) { horarioDataCache = JSON.parse(snap.data().data); } 
      else { container.innerHTML = '<div class="empty-state">Aún no se ha generado ningún horario automático.</div>'; return; }
    }

    let html = '<table class="timetable"><thead><tr><th>Hora</th>';
    DIAS_SEMANA.forEach(d => html += `<th>${d}</th>`);
    html += '</tr></thead><tbody>';

    horariosConfig.tramos.forEach((tramoName, tIndex) => {
      html += `<tr><td class="time-cell">${tramoName}</td>`;
      DIAS_SEMANA.forEach(dia => {
        let cellHtml = ''; let cellClass = 'empty-cell';
        const clasesEnTramo = horarioDataCache[dia][tIndex] || [];
        
        if (tipo === 'clase') {
          // Buscamos si la clase tiene recreo
          const recreo = horariosConfig.bloqueosClases.find(b => b.claseId === targetId && b.dia === dia && b.tramo === tIndex);
          if (recreo) {
            cellClass = 'break-cell'; cellHtml = `<div style="color:var(--gold); font-weight:bold;">☕ ${recreo.motivo}</div>`;
          } else {
            const miClase = clasesEnTramo.find(c => c.claseId === targetId);
            if (miClase) { cellClass = 'class-cell'; cellHtml = `<strong>${miClase.asig}</strong><br><span style="font-size:11px; opacity:0.8;">👨‍🏫 ${miClase.profeName}</span><br><span style="font-size:11px; color:var(--accent); font-weight:bold;">📍 ${miClase.aula}</span>`; }
          }
        } else {
          // Visor por profesor
          const ausencia = horariosConfig.bloqueosProfes.find(b => b.profeId === targetId && b.dia === dia && b.tramo === tIndex);
          if (ausencia) {
            cellClass = 'break-cell'; cellHtml = `<div style="color:var(--accent); font-weight:bold;">⛔ No disponible</div>`;
          } else {
            const misClases = clasesEnTramo.filter(c => c.profeId === targetId);
            if (misClases.length > 0) { cellClass = 'class-cell'; misClases.forEach(m => { cellHtml += `<strong>${m.asig}</strong><br><span style="font-size:11px; opacity:0.8;">🎓 ${m.claseName}</span><br><span style="font-size:11px; color:var(--accent); font-weight:bold;">📍 ${m.aula}</span><hr style="border-top:1px dashed #ccc; margin:4px 0;">`; }); cellHtml = cellHtml.slice(0, -51); }
          }
        }
        html += `<td class="${cellClass}">${cellHtml}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { container.innerHTML = '<p>Error cargando horario.</p>'; }
};

window.showMiHorarioView = async () => {
  window.hideAllViews(); document.getElementById('miHorarioView').classList.remove('hidden');
  const container = document.getElementById('miTimetableContainer'); container.innerHTML = '<div class="loading">Cargando tu cuadrante...</div>';
  
  try {
    const mainConfig = await getDoc(doc(db, `colegios/${window.state.colegioId}/horariosConfig/main`));
    if (!mainConfig.exists()) { container.innerHTML = '<div class="empty-state">El centro aún no ha configurado los horarios.</div>'; return; }
    const tramosList = mainConfig.data().tramos || [];
    
    const snap = await getDoc(doc(db, `colegios/${window.state.colegioId}/horariosGlobales/current`));
    if (!snap.exists()) { container.innerHTML = '<div class="empty-state">Aún no se han generado los horarios.</div>'; return; }
    const horarioGlobal = JSON.parse(snap.data().data);
    
    let html = '<table class="timetable"><thead><tr><th>Hora</th>';
    DIAS_SEMANA.forEach(d => html += `<th>${d}</th>`);
    html += '</tr></thead><tbody>';

    tramosList.forEach((tramoName, tIndex) => {
      html += `<tr><td class="time-cell">${tramoName}</td>`;
      DIAS_SEMANA.forEach(dia => {
        let cellHtml = ''; let cellClass = 'empty-cell';
        const clasesEnTramo = horarioGlobal[dia][tIndex] || [];
        const misClases = clasesEnTramo.filter(c => c.profeId === window.state.currentUser.email);
        
        if (misClases.length > 0) { cellClass = 'class-cell'; misClases.forEach(m => { cellHtml += `<strong>${m.asig}</strong><br><span style="font-size:11px; opacity:0.8;">🎓 ${m.claseName}</span><br><span style="font-size:11px; color:var(--accent); font-weight:bold;">📍 ${m.aula}</span><hr style="border-top:1px dashed #ccc; margin:4px 0;">`; }); cellHtml = cellHtml.slice(0, -51); }
        html += `<td class="${cellClass}">${cellHtml}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { container.innerHTML = '<p>Error.</p>'; }
};

window.exportarHorarioPDF = (esMiHorario = false) => {
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape" });
  let titulo = "Horario Escolar";
  
  if (esMiHorario) { titulo = `Mi Cuadrante Semanal - ${window.state.currentUser.email.split('@')[0]}`; } 
  else {
    const sel = document.getElementById('visorHorarioSelect');
    if(sel && sel.value) titulo = `Horario: ${sel.options[sel.selectedIndex].text}`;
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(titulo, 14, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Generado por Grade Weighting el ${new Date().toLocaleDateString()}`, 14, 28);

  const htmlTable = esMiHorario ? document.querySelector('#miTimetableContainer table') : document.querySelector('#timetableContainer table');
  if (!htmlTable) return alert("Genera el horario en pantalla primero.");

  doc.autoTable({ html: htmlTable, startY: 35, theme: 'grid', styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'center' }, headStyles: { fillColor: [26, 26, 46] } });
  doc.save(`Horario_${titulo.replace(/ /g, '_')}.pdf`);
};
