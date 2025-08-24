// Nenhum import é necessário aqui

document.addEventListener('DOMContentLoaded', () => {
    // Usa o objeto 'auth' global definido em firebase-config.js
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            initProfilePage(user);
        }
    });
});

async function initProfilePage(user) {
    const currentNameEl = document.getElementById('currentName');
    const currentEmailEl = document.getElementById('currentEmail');
    const currentUserTypeEl = document.getElementById('currentUserType');

    const updateNameForm = document.getElementById('updateNameForm');
    const newNameInput = document.getElementById('newName');
    const nameMessageEl = document.getElementById('nameMessage');

    const updatePasswordForm = document.getElementById('updatePasswordForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const passwordMessageEl = document.getElementById('passwordMessage');
    
    // Novos elementos do cadeado
    const toggleCurrentPassword = document.getElementById('toggleCurrentPassword');
    const toggleNewPassword = document.getElementById('toggleNewPassword');


    // Elementos do menu do usuário no header
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const userDropdownLogoutBtn = document.getElementById('btnLogout');
    const mainPanelLink = document.querySelector('a[href="painel.html"]');


    // Lógica para mostrar/ocultar senha
    const setupPasswordToggle = (toggleElement, passwordInput) => {
        if (toggleElement) {
            toggleElement.addEventListener('click', function () {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                this.classList.toggle('fa-lock');
                this.classList.toggle('fa-lock-open');
            });
        }
    };
    setupPasswordToggle(toggleCurrentPassword, currentPasswordInput);
    setupPasswordToggle(toggleNewPassword, newPasswordInput);


    // Carregar e exibir os dados do usuário
    async function loadUserData() {
        if (!user) return;
        
        currentEmailEl.textContent = user.email;
        
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (userDoc.exists) { 
            const userData = userDoc.data();
            currentNameEl.textContent = userData.nome || 'Não definido';
            currentUserTypeEl.textContent = userData.tipo || 'Não definido';
            if(userNameSpan) userNameSpan.textContent = userData.nome;
            if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
        }
    }
    loadUserData();
    
    async function updateNavLinks(userType) {
        if (!mainPanelLink) return;
        if (userType === 'administrador') {
            mainPanelLink.textContent = 'Painel de Administrador';
            mainPanelLink.href = 'admin.html';
        } else {
            mainPanelLink.textContent = 'Painel de Check-in';
            mainPanelLink.href = 'painel.html';
        }
    }

    if(updateNameForm) {
        updateNameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = newNameInput.value.trim();
            nameMessageEl.textContent = '';
            if (!newName) {
                nameMessageEl.textContent = 'O nome não pode ser vazio.';
                return;
            }

            try {
                await user.updateProfile({ displayName: newName });
                
                await db.collection('usuarios').doc(user.uid).update({
                    nome: newName
                });

                nameMessageEl.textContent = 'Nome atualizado com sucesso!';
                nameMessageEl.style.color = 'green';
                newNameInput.value = '';
                loadUserData(); 
            } catch (error) {
                nameMessageEl.textContent = `Erro ao atualizar nome: ${error.message}`;
                nameMessageEl.style.color = 'red';
            }
        });
    }

    if(updatePasswordForm) {
        updatePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            passwordMessageEl.textContent = '';

            if (newPassword.length < 6) {
                passwordMessageEl.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
                passwordMessageEl.style.color = 'red';
                return;
            }
            
            try {
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);

                await user.updatePassword(newPassword);
                
                passwordMessageEl.textContent = 'Senha atualizada com sucesso!';
                passwordMessageEl.style.color = 'green';
                currentPasswordInput.value = '';
                newPasswordInput.value = '';

            } catch (error) {
                let errorMessage = 'Erro ao atualizar senha. Verifique sua senha atual.';
                if (error.code === 'auth/wrong-password') {
                    errorMessage = 'A senha atual está incorreta.';
                } else if (error.code === 'auth/requires-recent-login') {
                    errorMessage = 'Sessão expirada. Faça login novamente para trocar a senha.';
                }
                passwordMessageEl.textContent = errorMessage;
                passwordMessageEl.style.color = 'red';
                console.error("Erro ao atualizar senha:", error);
            }
        });
    }

    async function setupUserMenu(user) {
        if (!user) return;
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();
        if(userNameSpan) userNameSpan.textContent = userData.nome;
        if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
        if(userInfoContainer) userInfoContainer.style.display = 'flex';
        updateNavLinks(userData.tipo);
    }
    setupUserMenu(user);
    
    if (userProfileSummary) {
        userProfileSummary.addEventListener('click', () => {
            if (userDropdown) userDropdown.classList.toggle('show');
        });
    }

    if (userDropdownLogoutBtn) {
        userDropdownLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await auth.signOut();
            window.location.href = 'login.html';
        });
    }
}