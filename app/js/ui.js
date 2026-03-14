// UTILIDAD: Ocultar todas las vistas del Dashboard
window.hideAllViews = function() {
  const views = [
    'superAdminView', 'directorView', 'profesorAsignaturasView', 'profesorClasesView', 
    'claseDetailView', 'asistenciaView', 'expedienteView', 'profesoresView', 
    'asignaturasView', 'asignaturaDetailView', 'notasView', 'trimestreDetailView', 
    'classAnalyticsView', 'horariosView', 'miHorarioView'
  ];
  views.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
  });
};

// ==========================================
// NAVEGACIÓN PRINCIPAL
// ==========================================
window.showDirectorView = () => { 
  window.hideAllViews(); 
  document.getElementById('directorView').classList.remove('hidden'); 
  if(window.loadClasses) window.loadClasses('classesList', false); 
};

window.showProfesoresView = () => { 
  window.hideAllViews(); 
  document.getElementById('profesoresView').classList.remove('hidden'); 
  if(window.loadProfesores) window.loadProfesores(); 
};

window.showAsignaturasView = () => { 
  window.hideAllViews(); 
  document.getElementById('asignaturasView').classList.remove('hidden'); 
  if(window.loadAsignaturas) window.loadAsignaturas(); 
};

window.showProfesorAsignaturasView = () => { 
  window.hideAllViews(); 
  document.getElementById('profesorAsignaturasView').classList.remove('hidden'); 
  if(window.loadProfesorAsignaturas) window.loadProfesorAsignaturas(); 
};

window.showProfesorClasesView = () => { 
  window.hideAllViews(); 
  document.getElementById('profesorClasesView').classList.remove('hidden'); 
  if(window.loadClasses) window.loadClasses('profesorClasesList', true); 
};

// ==========================================
// BOTONES DE VOLVER (BREADCRUMBS)
// ==========================================
window.backToClasesList = () => { 
  if (window.state.userRole === 'admin') window.showDirectorView(); 
  else window.showProfesorClasesView(); 
};

window.backToClaseDetail = () => { 
  if(window.showClaseDetail) window.showClaseDetail(window.state.currentClassId, document.getElementById('claseDetailName').textContent); 
};

window.backToAsignaturasList = () => { 
  if (window.state.userRole === 'admin') window.showAsignaturasView(); 
  else window.showProfesorAsignaturasView(); 
};

window.backToAsignaturaDetailBreadcrumb = () => { 
  if (window.state.userRole === 'admin') window.showAsignaturasView(); 
  else window.showProfesorAsignaturasView(); 
};

window.backToAsignaturaDetail = () => { 
  if (window.state.currentContext === 'tutoria') {
    if(window.showTutoriaDetail) window.showTutoriaDetail(window.state.currentClassId, document.getElementById('currentAsignaturaNombre').textContent.replace('Tutoría - ', ''));
  } else {
    if(window.showAsignaturaDetail) window.showAsignaturaDetail(window.state.currentAsignaturaId, document.getElementById('currentAsignaturaNombre').textContent);
  }
};

window.backToTrimestreDetail = () => { 
  if(window.showTrimestreDetail) window.showTrimestreDetail(window.state.currentTrimestre); 
};

// ==========================================
// ABRIR MODALES BÁSICOS
// ==========================================
window.openCreateColegioModal = () => {
  document.getElementById('createColegioModal').classList.add('active');
};

window.openInviteProfesorModal = () => {
  document.getElementById('inviteProfesorModal').classList.add('active');
};
