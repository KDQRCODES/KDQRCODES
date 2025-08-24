// Nenhum import é necessário aqui

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
                // CORRIGIDO: Usa auth.createUserWithEmailAndPassword
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);

                // CORRIGIDO: Usa a sintaxe de compatibilidade do Firestore
                await db.collection('usuarios').doc(userCredential.user.uid).set({
                    nome: name,
                    email: email,
                    tipo: userType,
                    // CORRIGIDO: Usa a sintaxe de compatibilidade para serverTimestamp
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
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