// Nenhum import é necessário aqui

document.addEventListener('DOMContentLoaded', () => {
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
    const eventsList = document.getElementById('eventsList');
    const btnLogout = document.getElementById('btnLogout');
    const eventIframe = document.getElementById('eventIframe');
    const btnBackToEvents = document.getElementById('btnBackToEvents');
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const mainPanelLink = document.getElementById('mainPanelLink');
    const mainMenu = document.getElementById('mainMenu');

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

    userProfileSummary?.addEventListener('click', () => {
        userDropdown.classList.toggle('show');
    });

    btnLogout?.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = 'login.html';
    });

    btnBackToEvents?.addEventListener('click', () => {
        eventIframe.src = '';
        loadEvents(user.uid);
    });

    async function loadEvents(uid) {
        eventsList.innerHTML = '';
        // NOVO: A consulta agora filtra por eventos em que o UID do usuário está na lista visivelPara
        const q = db.collection('eventos').where('visivelPara', 'array-contains', uid).orderBy('criadoEm', 'desc');
        const snapshot = await q.get();

        if (snapshot.empty) {
            eventsList.innerHTML = '<li>Nenhum evento disponível.</li>';
            return;
        }

        snapshot.forEach(d => {
            const ev = d.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${ev.nome}</span>
            `;
            li.dataset.id = d.id;

            li.addEventListener('click', () => {
                window.location.href = `painel-evento.html?eventId=${d.id}`;
            });

            eventsList.appendChild(li);
        });
    }

    loadEvents(user.uid);
    setupUserMenu(user);
}