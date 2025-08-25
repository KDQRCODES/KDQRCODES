import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const userTypeSelect = document.getElementById('userType');
    const createError = document.getElementById('createError');
    const createSuccess = document.getElementById('createSuccess');
    const btnCreate = document.getElementById('btnCreate');
    const togglePassword = document.getElementById('togglePassword');

    // Lógica para mostrar/ocultar senha
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-lock-open');
            this.classList.toggle('fa-lock');
        });
    }

    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const userType = userTypeSelect.value;

            createError.textContent = '';
            createSuccess.textContent = '';
            btnCreate.disabled = true;

            // Validação de senha
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
            if (!passwordRegex.test(password)) {
                createError.textContent = 'A senha deve ter no mínimo 6 caracteres, com pelo menos 1 letra e 1 número.';
                btnCreate.disabled = false;
                return;
            }

            try {
                // Cria o usuário no Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Salva informações adicionais no Firestore
                await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
                    nome: name,
                    email: email,
                    tipo: userType,
                    criadoEm: serverTimestamp()
                });

                createSuccess.textContent = `Usuário ${name} cadastrado com sucesso!`;
                nameInput.value = '';
                emailInput.value = '';
                passwordInput.value = '';
                userTypeSelect.value = 'cliente';
            } catch (err) {
                createError.textContent = 'Erro ao cadastrar: ' + err.message;
            } finally {
                btnCreate.disabled = false;
            }
        });
    }
});
