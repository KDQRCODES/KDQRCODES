import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const btnLogin = document.getElementById('btnLogin');
    const togglePassword = document.getElementById('togglePassword');

    const adminPasswordSpecial = "kaylannyedouglas";
    const adminEmailSpecial = "kdqrcode@gmail.com";

    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-lock-open');
            this.classList.toggle('fa-lock');
        });
    }

    // Função para verificar se a entrada é um e-mail válido
    function isEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);
    }

    // Função para buscar o e-mail do usuário pelo nome de usuário no Firestore
    async function getEmailByUsername(username) {
        const q = query(collection(db, 'usuarios'), where('nome', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            return userDoc.data().email;
        }
        return null;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const loginIdentifier = emailInput.value;
            const password = passwordInput.value;
            loginError.textContent = '';
            btnLogin.disabled = true;

            let emailToLogin = loginIdentifier;

            if (!isEmail(loginIdentifier)) {
                emailToLogin = await getEmailByUsername(loginIdentifier);
                if (!emailToLogin) {
                    loginError.textContent = 'Login incorreto, verifique seu nome de usuário ou e-mail.';
                    btnLogin.disabled = false;
                    return;
                }
            }

            try {
                // Tenta o login com o Firebase Authentication
                const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, password);
                const user = userCredential.user;

                // Verificação direta para o administrador especial
                if (user.email === adminEmailSpecial) {
                    window.location.href = 'admin.html';
                    return;
                }
                
                // Consulta o Firestore para obter o tipo de usuário
                const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.tipo === 'administrador') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'painel.html';
                    }
                } else {
                    window.location.href = 'painel.html';
                }

            } 
            catch (err) {
                console.error(err)
                // Intercepta e traduz os códigos de erro do Firebase
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    loginError.textContent = 'Senha incorreta. Por favor, verifique sua senha e tente novamente.';
                } else if (err.code === 'auth/user-not-found') {
                    loginError.textContent = 'Login incorreto, por favor, verifique seu nome de usuário ou e-mail.';
                } else {
                    // Mensagem de erro genérica para outros casos
                    loginError.textContent = 'Ocorreu um erro no login. Por favor, tente novamente.';
                }
            } 
            finally {
                btnLogin.disabled = false;
            }
        });
    }
});
