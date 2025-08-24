// Nenhum import é necessário aqui

document.addEventListener('DOMContentLoaded', () => {
    // Usa o objeto 'auth' global definido em firebase-config.js
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            initPainel(user);
        }
    });
});

function initPainel(user) {
    const eventsPanel = document.getElementById('eventsPanel');
    const btnLogout = document.getElementById('btnLogout');
    const eventsList = document.getElementById('eventsList');
    const newEventNameInput = document.getElementById('newEventName');
    const btnCreateEvent = document.getElementById('btnCreateEvent');
    const eventsErrorDiv = document.getElementById('eventsError');
    const eventIframe = document.getElementById('eventIframe');
    const btnBackToEvents = document.getElementById('btnBackToEvents');

    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const mainPanelLink = document.getElementById('mainPanelLink');
    const mainMenu = document.getElementById('mainMenu');

    // Atualiza links de navegação
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

    // Setup menu do usuário
    async function setupUserMenu(user) {
        if (user) {
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            // CORRIGIDO: de userDoc.exists() para userDoc.exists
            if (userDoc.exists) {
                const userData = userDoc.data();
                userNameSpan.textContent = userData.nome;
                userTypeSpan.textContent = userData.tipo;
                userInfoContainer.style.display = 'flex';
                updateNavLinks(userData.tipo);
            }
        }
    }

    // Dropdown do usuário
    userProfileSummary?.addEventListener('click', () => {
        userDropdown.classList.toggle('show');
    });

    // Logout
    btnLogout?.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = 'login.html';
    });

    // Voltar para eventos
    btnBackToEvents?.addEventListener('click', () => {
        eventIframe.src = '';
        showEventsPanel();
        loadEvents(user.uid);
    });

    // Criar evento
    btnCreateEvent?.addEventListener('click', async () => {
        const nomeEvento = newEventNameInput.value.trim();
        eventsErrorDiv.textContent = '';
        if (!nomeEvento) { eventsErrorDiv.textContent = 'Informe um nome para o evento.'; return; }
        try {
            await db.collection('eventos').add({
                nome: nomeEvento,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                criadoPor: auth.currentUser.uid
            });
            newEventNameInput.value = '';
            loadEvents(auth.currentUser.uid);
        } catch (err) { eventsErrorDiv.textContent = 'Erro ao criar evento: ' + err.message; }
    });

    // Carrega eventos do usuário
    async function loadEvents(uid) {
        eventsList.innerHTML = '';
        const q = db.collection('eventos').where('criadoPor', '==', uid).orderBy('criadoEm', 'desc');
        const snapshot = await q.get();

        if (snapshot.empty) {
            eventsList.innerHTML = '<li>Nenhum evento criado ainda.</li>';
            return;
        }

        snapshot.forEach(d => {
            const ev = d.data();
            const li = document.createElement('li');
            li.innerHTML = `<span>${ev.nome}</span>
                            <button class="deleteEvent" data-event-id="${d.id}">Excluir</button>`;
            li.dataset.id = d.id;

            li.addEventListener('click', () => {
                window.location.href = `painel-evento.html?eventId=${d.id}`;
            });

            li.querySelector('.deleteEvent').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Excluir evento ${ev.nome}?`)) {
                    await db.collection('eventos').doc(d.id).delete();
                    loadEvents(uid);
                }
            });

            eventsList.appendChild(li);
        });
    }

    // Inicializa painel
    loadEvents(user.uid);
    setupUserMenu(user);
}