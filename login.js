// Não há mais 'imports' aqui em cima

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

    function isEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);
    }

    async function getEmailByUsername(username) {
        // Usa o objeto 'db' que foi criado no firebase-config.js
        const q = db.collection('usuarios').where('nome', '==', username);
        const snapshot = await q.get();
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
                // Usa o objeto 'auth' globalmente, através do firebase.auth()
                const userCredential = await auth.signInWithEmailAndPassword(emailToLogin, password);
                const user = userCredential.user;

                if (user.email === adminEmailSpecial) {
                    window.location.href = 'admin.html';
                    return;
                }
                
                const userDocRef = db.collection('usuarios').doc(user.uid);
                const userDoc = await userDocRef.get();
                
                if (userDoc.exists) {
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
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    loginError.textContent = 'Senha incorreta. Por favor, verifique sua senha e tente novamente.';
                } else if (err.code === 'auth/user-not-found') {
                    loginError.textContent = 'Login incorreto, por favor, verifique seu nome de usuário ou e-mail.';
                } else {
                    loginError.textContent = 'Ocorreu um erro no login. Por favor, tente novamente.';
                }
            } 
            finally {
                btnLogin.disabled = false;
            }
        });
    }
});