// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Configurações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAiA6yOsbv6gKtTdjeKXWZb3wutx0Ipv4c",
  authDomain: "kd-qr-codes-checkin-eventos.firebaseapp.com",
  projectId: "kd-qr-codes-checkin-eventos",
  storageBucket: "kd-qr-codes-checkin-eventos.firebasestorage.app",
  messagingSenderId: "9325387244",
  appId: "1:9325387244:web:7c0e2c03ede84d860d74c9"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };