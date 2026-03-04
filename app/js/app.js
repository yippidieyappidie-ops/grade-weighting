// Main App - Punto de entrada principal
import { initLogin, initLogout, initAuthListener } from './auth.js';
import { showDirectorView, showProfesoresView, showAsignaturasView, showStudentsView, selectAllFromClase, showTrimestreDetail, guardarPonderacion, backToClassOrAsignatura } from './director.js';
import { showProfesorView, showAsignaturaDetail, backToAsignaturaDetail } from './profesor.js';
import { showNotasView, switchTrimestre, addNota, updateNota, deleteNota } from './notas.js';
import { initModals } from './modals.js';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log(' Inicializando Grade Weighting Dashboard...');
  
  // Initialize authentication
  initLogin();
  initLogout();
  
  // Initialize modals
  initModals();
  
  // Initialize auth listener
  initAuthListener(showDirectorView, showProfesorView);
  
  // Expose functions to window for onclick handlers
  window.showDirectorView = showDirectorView;
  window.showProfesoresView = showProfesoresView;
  window.showAsignaturasView = showAsignaturasView;
  window.showStudentsView = showStudentsView;
  window.showProfesorView = showProfesorView;
  window.showAsignaturaDetail = showAsignaturaDetail;
  window.backToAsignaturaDetail = backToAsignaturaDetail;
  window.showNotasView = showNotasView;
  window.switchTrimestre = switchTrimestre;
  window.addNota = addNota;
  window.updateNota = updateNota;
  window.deleteNota = deleteNota;
  window.selectAllFromClase = selectAllFromClase;
  
  // NEW: Trimestre functions
  window.showTrimestreDetail = showTrimestreDetail;
  window.guardarPonderacion = guardarPonderacion;
  window.backToClassOrAsignatura = backToClassOrAsignatura;
  
  console.log('✅ App inicializada correctamente');
});
