// A configuração do seu app Firebase, copiada do console
const firebaseConfig = {
    apiKey: "AIzaSyAIa6yOSbv6gKtTdjeKWWzB3wutx8IpV4c",
    authDomain: "kd-qr-codes-checkin-eventos.firebaseapp.com",
    projectId: "kd-qr-codes-checkin-eventos",
    storageBucket: "kd-qr-codes-checkin-eventos.appspot.com",
    messagingSenderId: "9325387244",
    appId: "1:9325387244:web:7c0e2c03ede84d860d74c9"
};

// Inicializa o Firebase usando a sintaxe de compatibilidade
const firebaseApp = firebase.initializeApp(firebaseConfig);

// Cria as referências para os serviços usando a sintaxe de compatibilidade
const db = firebaseApp.firestore();
const auth = firebaseApp.auth();

// O objeto 'db' e 'auth' agora são globais e podem ser usados pelos outros scripts.