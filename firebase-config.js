// Configurações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAiA6yOsbv6gKtTdjeKXWZb3wutx0Ipv4c",
  authDomain: "kd-qr-codes-checkin-eventos.firebaseapp.com",
  projectId: "kd-qr-codes-checkin-eventos",
  storageBucket: "kd-qr-codes-checkin-eventos.firebasestorage.app",
  messagingSenderId: "9325387244",
  appId: "1:9325387244:web:7c0e2c03ede84d860d74c9"
};

// Inicializa o Firebase e cria as constantes para os outros scripts usarem
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();