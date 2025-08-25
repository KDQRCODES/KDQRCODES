import { db, auth } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            initGeradorPage(user);
        }
    });
});

async function initGeradorPage(user) {
    const eventSelection = document.getElementById('eventSelection');
    const nomesInput = document.getElementById('nomesInput');
    const btnGerar = document.getElementById('btnGerar');
    const geradorStatus = document.getElementById('geradorStatus');
    const qrcodesContainer = document.getElementById('qrcodes-container');

    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const userDropdownLogoutBtn = document.getElementById('btnLogout');
    const mainPanelLink = document.getElementById('mainPanelLink');

    const GENERATE_QR_CODE_FUNCTION_URL = 'https://us-central1-kd-qr-codes-checkin-eventos.cloudfunctions.net/generateAndStoreQrCode';

    async function updateNavLinks(userType) {
        if (mainPanelLink) {
            if (userType === 'administrador') {
                mainPanelLink.textContent = 'Painel de Administrador';
                mainPanelLink.href = 'admin.html';
            } else {
                mainPanelLink.textContent = 'Painel de Check-in';
                mainPanelLink.href = 'painel.html';
            }
        }
    }

    async function setupUserMenu(user) {
        if (user) {
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if(userNameSpan) userNameSpan.textContent = userData.nome;
                if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
                if(userInfoContainer) userInfoContainer.style.display = 'flex';
                updateNavLinks(userData.tipo);
            }
        }
    }

    async function loadEvents() {
        eventSelection.innerHTML = '<option value="">Carregando eventos...</option>';
        const eventosRef = collection(db, 'eventos');
        const q = query(eventosRef);
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            eventSelection.innerHTML = '<option value="">Nenhum evento encontrado</option>';
            return;
        }

        eventSelection.innerHTML = '<option value="">-- Selecione um evento --</option>';
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.nome || 'Evento sem nome';
            eventSelection.appendChild(option);
        });
    }

    loadEvents();
    setupUserMenu(user);

    btnGerar.addEventListener('click', async () => {
        const eventId = eventSelection.value;
        const nomes = nomesInput.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);

        if (!eventId) {
            alert('Por favor, selecione um evento.');
            return;
        }

        if (!nomes.length) {
            alert('Digite pelo menos um nome de convidado.');
            return;
        }

        geradorStatus.textContent = 'Adicionando convidados...';
        qrcodesContainer.innerHTML = '';
        btnGerar.disabled = true;

        for (const nome of nomes) {
            try {
                const convidadosRef = collection(db, 'eventos', eventId, 'convidados');
                const q = query(convidadosRef, where('nome', '==', nome));
                const exists = await getDocs(q);

                if (exists.empty) {
                    // 1. Cria o documento do convidado primeiro para ter um ID
                    const newDocRef = await addDoc(convidadosRef, {
                        nome: nome,
                        checkin: false,
                        createdAt: serverTimestamp()
                    });

                    // 2. Chama a Cloud Function para gerar e salvar o QR Code
                    const qrCodeResponse = await fetch(GENERATE_QR_CODE_FUNCTION_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventId, nome })
                    });

                    if (!qrCodeResponse.ok) {
                        throw new Error('Falha ao gerar o QR Code.');
                    }

                    const qrCodeData = await qrCodeResponse.json();
                    const qrCodeUrl = qrCodeData.public_url;

                    // 3. Atualiza o documento do convidado com a URL do QR Code
                    await updateDoc(newDocRef, {
                        qrCodeUrl: qrCodeUrl
                    });

                    const successMsg = document.createElement('p');
                    successMsg.textContent = `✅ Convidado "${nome}" adicionado com sucesso.`;
                    qrcodesContainer.appendChild(successMsg);

                } else {
                    const errorMsg = document.createElement('p');
                    errorMsg.style.color = 'red';
                    errorMsg.textContent = `❌ Convidado "${nome}" já existe neste evento.`;
                    qrcodesContainer.appendChild(errorMsg);
                }
            } catch (error) {
                const errorMsg = document.createElement('p');
                errorMsg.style.color = 'red';
                errorMsg.textContent = `❌ Erro ao adicionar "${nome}": ${error.message}`;
                qrcodesContainer.appendChild(errorMsg);
                console.error("Erro ao adicionar convidado:", error);
            }
        }
        nomesInput.value = '';
        geradorStatus.textContent = 'Processo de adição concluído.';
        btnGerar.disabled = false;
    });

    if(userProfileSummary) userProfileSummary.addEventListener('click', () => {
        if(userDropdown) userDropdown.classList.toggle('show');
    });

    if(userDropdownLogoutBtn) userDropdownLogoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = 'login.html';
    });
}