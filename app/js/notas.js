// Sistema de Notas Module
import { db, state } from './config.js';
import { getDoc, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function hideAllViews() {
  ['directorView', 'profesorView', 'studentsView', 'profesoresView', 'asignaturasView', 'asignaturaDetailView', 'notasView'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// Show notas view
export function showNotasView(alumnoId, nombre) {
  state.currentAlumnoId = alumnoId;
  document.getElementById('currentAlumnoNombre').textContent = nombre;
  document.getElementById('notasViewTitle').textContent = `Notas - ${nombre}`;
  hideAllViews();
  document.getElementById('notasView').classList.remove('hidden');
  loadNotas();
}

// Switch trimestre
export function switchTrimestre(trimestre) {
  state.currentTrimestre = trimestre;
  document.querySelectorAll('.trimestre-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  loadNotas();
}

// Load notas
async function loadNotas() {
  const notasContent = document.getElementById('notasContent');
  notasContent.innerHTML = '<div class="loading">Cargando notas...</div>';
  
  try {
    const alumnoRef = state.currentAlumnoId.replace('/', '-');
    const notasDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/notas/${alumnoRef}/${state.currentTrimestre}`;
    const notasDoc = await getDoc(doc(db, notasDocPath));
    
    const categorias = [
      { nombre: 'Exámenes', peso: 70 },
      { nombre: 'Tareas', peso: 20 },
      { nombre: 'Participación', peso: 10 }
    ];
    
    const notasData = notasDoc.exists() ? notasDoc.data() : { categorias: {} };
    
    let html = '';
    categorias.forEach(cat => {
      const catNotas = notasData.categorias?.[cat.nombre] || [];
      html += `<div class="categoria-section">
        <div class="categoria-header">${cat.nombre} (${cat.peso}%)</div>
        <div id="notas-${cat.nombre.replace(/\s/g, '')}">`;
      
      catNotas.forEach((nota, idx) => {
        html += `<div class="nota-input-row">
          <input type="number" min="0" max="10" step="0.1" value="${nota}" 
            onchange="window.updateNota('${cat.nombre}', ${idx}, this.value)">
          <button class="btn-icon" onclick="window.deleteNota('${cat.nombre}', ${idx})">🗑️</button>
        </div>`;
      });
      
      html += `</div>
        <button class="btn-secondary" onclick="window.addNota('${cat.nombre}')" style="margin-top: 8px;">+ Añadir nota</button>
      </div>`;
    });
    
    const notaFinal = calcularNotaFinal(notasData, categorias);
    html += `<div class="nota-final-display">
      <h3>Nota Final ${state.currentTrimestre}</h3>
      <div class="nota">${notaFinal.toFixed(2)}</div>
    </div>`;
    
    notasContent.innerHTML = html;
  } catch (error) {
    console.error('Error cargando notas:', error);
    notasContent.innerHTML = '<p style="color: red;">Error al cargar notas</p>';
  }
}

// Calcular nota final ponderada
function calcularNotaFinal(notasData, categorias) {
  let notaFinal = 0;
  let pesoTotal = 0;
  
  categorias.forEach(cat => {
    const catNotas = notasData.categorias?.[cat.nombre] || [];
    if (catNotas.length > 0) {
      const promedio = catNotas.reduce((a, b) => a + b, 0) / catNotas.length;
      notaFinal += promedio * (cat.peso / 100);
      pesoTotal += cat.peso;
    }
  });
  
  return pesoTotal > 0 ? notaFinal : 0;
}

// Add nota
export async function addNota(categoria) {
  try {
    const alumnoRef = state.currentAlumnoId.replace('/', '-');
    const notasDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/notas/${alumnoRef}/${state.currentTrimestre}`;
    const notasDoc = await getDoc(doc(db, notasDocPath));
    const notasData = notasDoc.exists() ? notasDoc.data() : { categorias: {} };
    
    if (!notasData.categorias[categoria]) {
      notasData.categorias[categoria] = [];
    }
    notasData.categorias[categoria].push(5);
    
    await setDoc(doc(db, notasDocPath), notasData);
    loadNotas();
  } catch (error) {
    console.error('Error añadiendo nota:', error);
    alert('Error al añadir nota');
  }
}

// Update nota
export async function updateNota(categoria, index, valor) {
  try {
    const alumnoRef = state.currentAlumnoId.replace('/', '-');
    const notasDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/notas/${alumnoRef}/${state.currentTrimestre}`;
    const notasDoc = await getDoc(doc(db, notasDocPath));
    const notasData = notasDoc.data();
    
    notasData.categorias[categoria][index] = parseFloat(valor);
    await setDoc(doc(db, notasDocPath), notasData);
    loadNotas();
  } catch (error) {
    console.error('Error actualizando nota:', error);
    alert('Error al actualizar nota');
  }
}

// Delete nota
export async function deleteNota(categoria, index) {
  try {
    const alumnoRef = state.currentAlumnoId.replace('/', '-');
    const notasDocPath = `colegios/${state.colegioId}/asignaturas/${state.currentAsignaturaId}/notas/${alumnoRef}/${state.currentTrimestre}`;
    const notasDoc = await getDoc(doc(db, notasDocPath));
    const notasData = notasDoc.data();
    
    notasData.categorias[categoria].splice(index, 1);
    await setDoc(doc(db, notasDocPath), notasData);
    loadNotas();
  } catch (error) {
    console.error('Error eliminando nota:', error);
    alert('Error al eliminar nota');
  }
}
