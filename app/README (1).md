# Grade Weighting Dashboard - Arquitectura Modular

## 📁 Estructura del Proyecto

```
/app
├── index.html              # HTML principal (solo estructura)
├── css/
│   └── styles.css         # Todos los estilos (login, header, cards, tables, modals, notas)
├── js/
│   ├── config.js          # Configuración de Firebase + estado global
│   ├── auth.js            # Sistema de autenticación (login, logout, detectUserRole)
│   ├── director.js        # Funciones del director (clases, alumnos, profesores, asignaturas)
│   ├── profesor.js        # Funciones del profesor (ver asignaturas, alumnos)
│   ├── notas.js           # Sistema completo de notas (CRUD, cálculo automático)
│   ├── modals.js          # Gestión de todos los modales
│   └── app.js             # Punto de entrada principal (inicializa todo)
└── README.md              # Este archivo
```

## 🎯 Módulos y Responsabilidades

### **config.js**
- Configuración de Firebase
- Exporta `auth`, `db`, `state`
- Estado global de la aplicación

### **auth.js**
- `initLogin()` - Login con Google
- `initLogout()` - Cerrar sesión
- `initAuthListener()` - Detecta cambios de autenticación
- `detectUserRole()` - Determina si es Director o Profesor

### **director.js**
- `showDirectorView()` - Vista principal del director
- `showProfesoresView()` - Gestión de profesores
- `showAsignaturasView()` - Gestión de asignaturas
- `showStudentsView()` - Ver alumnos de una clase
- `createClass()` - Crear nueva clase
- `addStudent()` - Añadir alumno
- `createAsignatura()` - Crear asignatura con alumnos específicos
- `inviteProfesor()` - Invitar nuevo profesor
- `loadAlumnosForSelection()` - Cargar selector multi-clase de alumnos
- `selectAllFromClase()` - Seleccionar todos los alumnos de una clase

### **profesor.js**
- `showProfesorView()` - Vista principal del profesor
- `showAsignaturaDetail()` - Ver alumnos de una asignatura
- `backToAsignaturaDetail()` - Volver a lista de alumnos

### **notas.js** ⭐ Sistema de Notas
- `showNotasView()` - Mostrar vista de notas de un alumno
- `switchTrimestre()` - Cambiar entre T1, T2, T3
- `loadNotas()` - Cargar notas del alumno
- `calcularNotaFinal()` - Cálculo automático ponderado
- `addNota()` - Añadir nueva nota
- `updateNota()` - Modificar nota existente
- `deleteNota()` - Eliminar nota

**Categorías con Ponderación:**
- Exámenes: 70%
- Tareas: 20%
- Participación: 10%

### **modals.js**
- `initModals()` - Inicializa todos los modales
- `initCreateClassModal()` - Modal crear clase
- `initAddStudentModal()` - Modal añadir alumno
- `initCreateAsignaturaModal()` - Modal crear asignatura (con selector multi-clase)
- `initInviteProfesorModal()` - Modal invitar profesor

### **app.js**
- Punto de entrada principal
- Inicializa todos los módulos
- Expone funciones a `window` para eventos onclick

## 🔥 Funcionalidades Implementadas

### ✅ Director
- Crear y gestionar clases
- Añadir alumnos a clases
- Invitar profesores
- Crear asignaturas con **selector multi-clase** de alumnos específicos
- Ver todas las asignaturas del colegio

### ✅ Profesor
- Ver sus asignaturas asignadas
- Ver alumnos de cada asignatura
- **Sistema completo de notas:**
  - 3 trimestres (T1, T2, T3)
  - 3 categorías ponderadas
  - Añadir/editar/eliminar notas
  - **Cálculo automático de nota final**

### ✅ Selector de Alumnos Específicos
- Checkboxes organizados por clase
- Botón "Seleccionar todos" por clase
- Permite alumnos de diferentes clases en una asignatura
- Validación: mínimo 1 alumno

## 🚀 Ventajas de la Arquitectura Modular

### Para Desarrollo:
- **Fácil debugging** - Si hay error en notas, solo editas `notas.js`
- **Reutilizable** - Puedes usar `auth.js` en otras páginas
- **Mantenible** - Cambiar estilos solo requiere tocar `styles.css`
- **Colaborativo** - Varias personas pueden trabajar en paralelo
- **Menos tokens** - Solo regeneras el archivo con el bug

### Para Producción:
- **Cacheable** - El navegador cachea JS/CSS separados
- **Performance** - Solo carga módulos necesarios
- **Escalable** - Fácil añadir nuevos módulos

## 🛠️ Cómo Añadir Nuevas Funcionalidades

### Ejemplo: Añadir sistema de asistencia

1. **Crear `js/asistencia.js`**
```javascript
import { db, state } from './config.js';

export async function marcarAsistencia(alumnoId, fecha, presente) {
  // Implementación
}
```

2. **Importar en `app.js`**
```javascript
import { marcarAsistencia } from './asistencia.js';
window.marcarAsistencia = marcarAsistencia;
```

3. **Añadir vista en `index.html`**
```html
<div id="asistenciaView" class="hidden">
  <!-- HTML de la vista -->
</div>
```

4. **Añadir estilos en `styles.css` si es necesario**

## 📊 Estructura de Datos en Firestore

```
colegios/{colegioId}/
  clases/{claseId}/
    - nombre: "1º ESO A"
    - curso: "1º ESO"
    - numAlumnos: 25
    
    alumnos/{alumnoId}/
      - nombre: "Juan"
      - apellidos: "Pérez García"
  
  asignaturas/{asignaturaId}/
    - nombre: "Matemáticas"
    - profesorEmail: "profesor@email.com"
    - alumnos: ["clase1/alumno1", "clase2/alumno5"]
    - trimestres: ["T1", "T2", "T3"]
    
    notas/{alumno-ref}/{trimestre}/
      - categorias: {
          "Exámenes": [8, 7.5, 9],
          "Tareas": [10, 9],
          "Participación": [8]
        }

profesores/{email}/
  - nombre: "María López"
  - colegioId: "colegio123"
  - rol: "profesor" | "admin"
  - asignaturas: ["asig1", "asig2"]
```

## 🐛 Debugging

Para debuggear un módulo específico:

1. Abre DevTools (F12)
2. Ve a la pestaña "Sources"
3. Busca el archivo JS específico (ej. `notas.js`)
4. Añade breakpoints
5. Recarga la página

Los `console.log` de cada módulo tienen prefijos identificables:
- 🔄 Login/Auth events
- 📊 Director actions
- 📚 Profesor actions
- ✅ Success messages
- ❌ Error messages

## 📝 Próximas Mejoras Sugeridas

- [ ] Sistema de asistencia
- [ ] Gráficos de progreso de alumnos
- [ ] Exportar boletines a PDF
- [ ] Configuración personalizada de categorías de notas
- [ ] Comentarios por alumno/trimestre
- [ ] Notificaciones push
- [ ] Modo offline con sincronización

---

**Desarrollado con arquitectura modular para facilitar mantenimiento y escalabilidad** 🚀
