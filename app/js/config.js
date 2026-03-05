// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC0trECUS1g7CpQjGQtvjFim5QgcKVBfUs",
  authDomain: "www.gradeweighting.com",
  projectId: "grade-weighting",
  storageBucket: "grade-weighting.firebasestorage.app",
  messagingSenderId: "567298019231",
  appId: "1:567298019231:web:18c435e0a6808b7bd5f7aa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Global state
export const state = {
  currentUser: null,
  userRole: null,
  colegioId: null,
  currentClassId: null,
  currentAsignaturaId: null,
  currentAlumnoId: null,
  currentTrimestre: 'T1',
  currentContext: null, // 'clase' o 'asignatura'
  cachedClasses: [],
  cachedProfesores: []
};
