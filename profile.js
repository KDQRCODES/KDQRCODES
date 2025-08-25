import { auth, db } from "./firebase-config.js";
import {
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    signOut,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
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
    
    // Carregar e exibir os dados do usuário
    async function loadUserData() {
        if (user) {
            currentEmailEl.textContent = user.email;
            
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentNameEl.textContent = userData.nome || 'Não definido';
                currentUserTypeEl.textContent = userData.tipo || 'Não definido';
            }
        }
    }
    loadUserData();

    // Lógica para atualizar o nome
    updateNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = newNameInput.value.trim();
        nameMessageEl.textContent = '';
        if (!newName) {
            nameMessageEl.textContent = 'O nome não pode ser vazio.';
            return;
        }

        try {
            // 1. Atualiza o perfil no Firebase Authentication
            await updateProfile(user, { displayName: newName });
            
            // 2. Atualiza o nome no Firestore
            await updateDoc(doc(db, 'usuarios', user.uid), {
                nome: newName
            });

            nameMessageEl.textContent = 'Nome atualizado com sucesso!';
            nameMessageEl.style.color = 'green';
            newNameInput.value = '';
            loadUserData(); // Recarrega os dados para exibir o novo nome
        } catch (error) {
            nameMessageEl.textContent = `Erro ao atualizar nome: ${error.message}`;
            nameMessageEl.style.color = 'red';
        }
    });

    // Lógica para atualizar a senha
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
            // Reautentica o usuário para permitir a mudança de senha
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Atualiza a senha no Firebase Authentication
            await updatePassword(user, newPassword);
            
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
    
    // Lógica para o menu de usuário no header (replicada de outras páginas)
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const userDropdownLogoutBtn = document.getElementById('btnLogout');

    if (userProfileSummary) {
        userProfileSummary.addEventListener('click', () => {
            if (userDropdown) userDropdown.classList.toggle('show');
        });
    }

    if (userDropdownLogoutBtn) {
        userDropdownLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    async function setupUserMenu(user) {
        if (user) {
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if(userNameSpan) userNameSpan.textContent = userData.nome;
                if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
                if(userInfoContainer) userInfoContainer.style.display = 'flex';
            }
        }
    }
    setupUserMenu(user);
}