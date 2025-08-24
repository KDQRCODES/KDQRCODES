// Nenhum import é necessário aqui
document.addEventListener('DOMContentLoaded', () => {
    // Usa o objeto 'auth' global definido em firebase-config.js
    auth.onAuthStateChanged(user => {
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
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if(userNameSpan) userNameSpan.textContent = userData.nome;
                if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
                if(userInfoContainer) userInfoContainer.style.display = 'flex';
                updateNavLinks(userData.tipo);
            }
        }
    }

    async function loadEvents() {
        if (!eventSelection) return;
        eventSelection.innerHTML = '<option value="">Carregando eventos...</option>';
        const eventosRef = db.collection('eventos');
        const querySnapshot = await eventosRef.get();

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
                const convidadosRef = db.collection('eventos').doc(eventId).collection('convidados');
                const querySnapshot = await convidadosRef.where('nome', '==', nome).get();

                if (querySnapshot.empty) {
                    // Prepara o valor para o QR Code (uma URL com parâmetros)
                    const qrCodeValue = `{"eventId": "${eventId}", "nome": "${nome}"}`;
                    
                    // CORRIGIDO: Usa QRCode.toDataURL, que é a forma correta da biblioteca que você está usando
                    const qrCodeUrl = await QRCode.toDataURL(qrCodeValue, {
                        errorCorrectionLevel: 'H'
                    });

                    await convidadosRef.add({
                        nome: nome,
                        checkin: false,
                        qrCode: qrCodeUrl,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
        await auth.signOut();
        window.location.href = 'login.html';
    });
}