// Modals Module - Gestión de todos los modales
import { state } from './config.js';
import { createClass, addStudent, createAsignatura, inviteProfesor, loadAlumnosForSelection } from './director.js';

// Initialize all modals
export function initModals() {
  initCreateClassModal();
  initAddStudentModal();
  initCreateAsignaturaModal();
  initInviteProfesorModal();
}

// Create Class Modal
function initCreateClassModal() {
  const modal = document.getElementById('createClassModal');
  const form = document.getElementById('createClassForm');
  
  document.getElementById('newClassBtn').addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  document.getElementById('cancelClassBtn').addEventListener('click', () => {
    modal.classList.remove('active');
    form.reset();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      form.reset();
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
      const formData = new FormData(form);
      await createClass(formData.get('nombre'), formData.get('curso'));
      
      modal.classList.remove('active');
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear clase';
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear clase';
    }
  });
}

// Add Student Modal
function initAddStudentModal() {
  const modal = document.getElementById('addStudentModal');
  const form = document.getElementById('addStudentForm');
  
  document.getElementById('newStudentBtn').addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  document.getElementById('cancelStudentBtn').addEventListener('click', () => {
    modal.classList.remove('active');
    form.reset();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      form.reset();
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Añadiendo...';
    
    try {
      const formData = new FormData(form);
      await addStudent(formData.get('nombre'), formData.get('apellidos'));
      
      modal.classList.remove('active');
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Añadir alumno';
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Añadir alumno';
    }
  });
}

// Create Asignatura Modal (con selector de alumnos específicos)
function initCreateAsignaturaModal() {
  const modal = document.getElementById('createAsignaturaModal');
  const form = document.getElementById('createAsignaturaForm');
  
  document.getElementById('newAsignaturaBtn').addEventListener('click', async () => {
    // Populate profesor select
    const profesorSelect = document.getElementById('asignaturaProfesorSelect');
    profesorSelect.innerHTML = '<option value="">Selecciona un profesor</option>';
    state.cachedProfesores.filter(p => p.rol === 'profesor').forEach(prof => {
      profesorSelect.innerHTML += `<option value="${prof.id}">${prof.nombre || prof.id}</option>`;
    });
    
    // Load alumnos for selection (multi-class checkboxes)
    const alumnosSelection = document.getElementById('alumnosSelection');
    alumnosSelection.innerHTML = '<div class="loading" style="padding:20px;">Cargando alumnos...</div>';
    
    const alumnosHTML = await loadAlumnosForSelection();
    alumnosSelection.innerHTML = alumnosHTML;
    
    modal.classList.add('active');
  });
  
  document.getElementById('cancelAsignaturaBtn').addEventListener('click', () => {
    modal.classList.remove('active');
    form.reset();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      form.reset();
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
      const formData = new FormData(form);
      const nombre = formData.get('nombre');
      const profesorEmail = formData.get('profesorEmail');
      
      // Get selected alumnos
      const selectedAlumnos = Array.from(document.querySelectorAll('input[name="alumnos"]:checked'))
        .map(cb => cb.value);
      
      if (selectedAlumnos.length === 0) {
        alert('Debes seleccionar al menos un alumno');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear asignatura';
        return;
      }
      
      await createAsignatura(nombre, profesorEmail, selectedAlumnos);
      
      alert(`✅ Asignatura "${nombre}" creada con ${selectedAlumnos.length} alumnos`);
      
      modal.classList.remove('active');
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear asignatura';
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear asignatura';
    }
  });
}

// Invite Profesor Modal
function initInviteProfesorModal() {
  const modal = document.getElementById('inviteProfesorModal');
  const form = document.getElementById('inviteProfesorForm');
  
  document.getElementById('inviteProfesorBtn').addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  document.getElementById('cancelProfesorBtn').addEventListener('click', () => {
    modal.classList.remove('active');
    form.reset();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      form.reset();
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Invitando...';
    
    try {
      const formData = new FormData(form);
      const email = formData.get('email');
      const nombre = formData.get('nombre');
      
      await inviteProfesor(email, nombre);
      
      alert(`✅ Invitación enviada a ${email}`);
      
      modal.classList.remove('active');
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar invitación';
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar invitación';
    }
  });
}
