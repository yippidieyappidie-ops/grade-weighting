import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

// Mostrar el panel maestro
window.showSuperAdminView = async () => {
  window.hideAllViews();
  document.getElementById('superAdminView').classList.remove('hidden');
  
  const list = document.getElementById('superAdminCentrosList');
  list.innerHTML = '<div class="loading">Cargando centros...</div>';
  
  try {
    const snap = await getDocs(collection(db, 'colegios'));
    let html = '<table class="table"><thead><tr><th>ID</th><th>Nombre del Centro</th><th>Horarios Activos</th><th>Algoritmo Notas</th><th style="width:50px;">Ajustes</th></tr></thead><tbody>'; 
    
    snap.forEach(d => {
      const c = d.data();
      const conf = c.configuracion || { moduloHorarios: true, algoritmoNotas: 'numerico_10' };
      html += `
        <tr>
          <td><span style="font-size:11px; color:var(--ink-light);">${d.id}</span></td>
          <td><strong>${c.nombre}</strong></td>
          <td>${conf.moduloHorarios ? '✅ Sí' : '❌ No'}</td>
          <td>${conf.algoritmoNotas === 'letras_cambridge' ? '🇬🇧 Cambridge (A, B, C)' : '🔢 Numérico (0-10)'}</td>
          <td><button class="btn-icon" onclick="window.openConfigColegio('${d.id}', ${conf.moduloHorarios}, '${conf.algoritmoNotas}')">⚙️</button></td>
        </tr>
      `;
    });
    list.innerHTML = html + '</tbody></table>';
  } catch(e) { 
    console.error(e); 
  }
};

// Abrir modal de configuración del ADN
window.openConfigColegio = (colId, hasHorarios, algo) => {
  document.getElementById('configColId').value = colId;
  document.getElementById('configModHorarios').value = hasHorarios ? "true" : "false";
  document.getElementById('configModNotas').value = algo;
  document.getElementById('configColegioModal').classList.add('active');
};

// Listeners de los formularios del Super Admin
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Crear nuevo centro
  document.getElementById('createColegioForm')?.addEventListener('submit', async(e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Creando...";

    const nombre = e.target.nombre.value;
    const email = e.target.directorEmail.value.trim().toLowerCase();
    
    try {
      // Creamos la academia con la configuración por defecto
      const newColRef = await addDoc(collection(db, 'colegios'), {
        nombre: nombre,
        createdAt: serverTimestamp(),
        configuracion: { moduloHorarios: true, algoritmoNotas: 'numerico_10' }
      });
      
      // Creamos el perfil del director de esa academia
      await setDoc(doc(db, 'profesores', email), { 
        nombre: 'Director', 
        colegioId: newColRef.id, 
        rol: 'admin', 
        asignaturas: [], 
        createdAt: serverTimestamp() 
      });
      
      alert(`✅ Academia creada con éxito. Ya puedes decirle al director que inicie sesión.`);
      document.getElementById('createColegioModal').classList.remove('active');
      window.showSuperAdminView();
      e.target.reset();
    } catch(err) { 
      alert(err.message); 
    } finally {
      btn.disabled = false;
      btn.textContent = "Crear Centro";
    }
  });

  // 2. Guardar cambios en el ADN
  document.getElementById('configColegioForm')?.addEventListener('submit', async(e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const colId = document.getElementById('configColId').value;
    const hor = document.getElementById('configModHorarios').value === "true";
    const algo = document.getElementById('configModNotas').value;
    
    try {
      await updateDoc(doc(db, 'colegios', colId), {
        "configuracion.moduloHorarios": hor,
        "configuracion.algoritmoNotas": algo
      });
      alert('✅ ADN del centro actualizado correctamente.');
      document.getElementById('configColegioModal').classList.remove('active');
      window.showSuperAdminView();
    } catch(err) { 
      alert(err.message); 
    } finally {
      btn.disabled = false;
    }
  });
});
// ==========================================
// CONFIGURACIÓN DEL ADN DEL COLEGIO (FEATURE FLAGS)
// ==========================================
window.openConfigColegioModal = async (colegioId, colegioNombre) => {
  const modal = document.getElementById('configColegioModal');
  const colIdInput = document.getElementById('configColId');
  const selectHorarios = document.getElementById('configModHorarios');
  
  colIdInput.value = colegioId;
  
  // Cambiamos el título para que sepas qué colegio estás editando
  modal.querySelector('.modal-header').textContent = `Ajustes de ADN: ${colegioNombre}`;
  modal.classList.add('active');
  
  try {
    const docRef = doc(db, 'colegios', colegioId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      // Si ya tiene una configuración guardada, la mostramos. Si no, por defecto es 'true'
      if (data.features && data.features.horarios !== undefined) {
        selectHorarios.value = data.features.horarios ? 'true' : 'false';
      } else {
        selectHorarios.value = 'true'; 
      }
    }
  } catch(e) {
    console.error("Error cargando la configuración:", e);
  }
};

// Evento para guardar la configuración cuando se envía el formulario
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('configColegioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    const colId = document.getElementById('configColId').value;
    const showHorarios = document.getElementById('configModHorarios').value === 'true';
    
    try {
      await updateDoc(doc(db, 'colegios', colId), {
        'features.horarios': showHorarios
      });
      document.getElementById('configColegioModal').classList.remove('active');
      alert("✅ Configuración del centro actualizada correctamente.");
      
      // Recargamos la lista de colegios para reflejar cambios si es necesario
      if (typeof window.loadColegios === 'function') {
        window.loadColegios();
      }
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar ADN";
    }
  });
});
