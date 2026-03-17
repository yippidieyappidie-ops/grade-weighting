import { collection, getDocs, getDoc, addDoc, setDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

// ==========================================
// VISTA PRINCIPAL DEL SUPER ADMIN
// ==========================================
window.showSuperAdminView = () => {
  window.hideAllViews();
  document.getElementById('superAdminView').classList.remove('hidden');
  window.loadColegios();
};

window.loadColegios = async () => {
  const list = document.getElementById('superAdminCentrosList');
  list.innerHTML = '<div class="loading">Cargando centros...</div>';
  try {
    const snap = await getDocs(collection(db, 'colegios'));
    if (snap.empty) {
      list.innerHTML = '<div class="empty-state">No hay centros registrados. Crea el primero.</div>';
      return;
    }
    let html = '<div class="cards-grid">';
    snap.forEach(docSnap => {
      const d = docSnap.data();
      html += `
        <div class="card">
          <div class="card-title">${d.nombre}</div>
          <div class="card-meta">Director: ${d.directorEmail}</div>
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn-secondary btn-sm" onclick="window.openConfigColegioModal('${docSnap.id}', '${d.nombre}')">⚙️ Ajustes ADN</button>
            <button class="btn-secondary btn-sm" style="color:var(--accent); border-color:var(--accent);" onclick="window.deleteColegio('${docSnap.id}', '${d.nombre}')">🗑️ Borrar</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html + '</div>';
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="empty-state">Error cargando centros.</div>';
  }
};

// ==========================================
// ACCIONES DE BORRADO Y APERTURA DE MODALES
// ==========================================
window.openCreateColegioModal = () => {
  document.getElementById('createColegioModal').classList.add('active');
};

window.deleteColegio = async (id, nombre) => {
  if(confirm(`⚠️ PELIGRO: ¿Estás seguro de que quieres borrar el centro "${nombre}"? Esta acción destruirá toda su base de datos.`)) {
    try {
      await deleteDoc(doc(db, 'colegios', id));
      window.loadColegios();
    } catch(e) {
      alert("Error al borrar: " + e.message);
    }
  }
};

window.openConfigColegioModal = async (colegioId, colegioNombre) => {
  const modal = document.getElementById('configColegioModal');
  const colIdInput = document.getElementById('configColId');
  const selectHorarios = document.getElementById('configModHorarios');
  
  colIdInput.value = colegioId;
  modal.querySelector('.modal-header').textContent = `Ajustes de ADN: ${colegioNombre}`;
  modal.classList.add('active');
  
  try {
    const docRef = doc(db, 'colegios', colegioId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.features && data.features.horarios !== undefined) {
        selectHorarios.value = data.features.horarios ? 'true' : 'false';
      } else {
        selectHorarios.value = 'true'; 
      }
    }
  } catch(e) { 
    console.error(e); 
  }
};

// ==========================================
// FORMULARIOS Y GUARDADO EN FIREBASE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Crear un nuevo Colegio
  document.getElementById('createColegioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Creando...";
    try {
      // Crea el colegio en Firebase
      const newCol = await addDoc(collection(db, 'colegios'), {
        nombre: e.target.nombre.value,
        directorEmail: e.target.directorEmail.value.toLowerCase(),
        createdAt: serverTimestamp(),
        features: { horarios: true }
      });
      
      // Añade automáticamente al director a la lista de profesores
      await setDoc(doc(db, 'profesores', e.target.directorEmail.value.toLowerCase()), {
        colegioId: newCol.id,
        rol: 'admin',
        nombre: 'Director',
        createdAt: serverTimestamp()
      });
      
      document.getElementById('createColegioModal').classList.remove('active');
      e.target.reset();
      window.loadColegios();
    } catch (error) {
      alert(error.message);
    } finally {
      btn.disabled = false; btn.textContent = "Crear Centro";
    }
  });

  // 2. Guardar la configuración de ADN (Feature Flags)
  document.getElementById('configColegioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Guardando...";
    
    const colId = document.getElementById('configColId').value;
    const showHorarios = document.getElementById('configModHorarios').value === 'true';
    
    try {
      await updateDoc(doc(db, 'colegios', colId), {
        'features.horarios': showHorarios
      });
      document.getElementById('configColegioModal').classList.remove('active');
      alert("✅ ADN del centro actualizado correctamente.");
      window.loadColegios();
    } catch (error) {
      alert(error.message);
    } finally {
      btn.disabled = false; btn.textContent = "Guardar ADN";
    }
  });
});
