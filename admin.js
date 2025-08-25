import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, getDocs, addDoc, doc, deleteDoc, getDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
    setupHamburgerMenu(); // Inicializa o menu mobile
});

function initAdminPanel() {
    const eventsPanel = document.getElementById('eventsPanel');
    const btnLogout = document.getElementById('btnLogout');
    const eventsList = document.getElementById('eventsList');
    const newEventNameInput = document.getElementById('newEventName');
    const btnCreateEvent = document.getElementById('btnCreateEvent');
    const eventsErrorDiv = document.getElementById('eventsError');
    const usersPanel = document.getElementById('usersPanel');
    const btnCreateUser = document.getElementById('btnCreateUser');
    const createUserMsg = document.getElementById('createUserMsg');
    const createUserError = document.getElementById('createUserError');
    const userList = document.getElementById('userList');
    const eventDetails = document.getElementById('eventDetails');
    const eventTitle = document.getElementById('eventTitle');
    const eventIframe = document.getElementById('eventIframe');
    const btnBackToEvents = document.getElementById('btnBackToEvents');
    
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const userDropdownLogoutBtn = document.getElementById('btnLogout');

    const mainMenu = document.getElementById('mainMenu');

    function showAdminPanels() {
        eventsPanel.style.display = 'block';
        usersPanel.style.display = 'block';
        eventDetails.style.display = 'none';
    }

    function showEventDetails() {
        eventsPanel.style.display = 'none';
        usersPanel.style.display = 'none';
        eventDetails.style.display = 'flex';
    }

    if (btnBackToEvents) {
        btnBackToEvents.addEventListener('click', () => {
            eventIframe.src = "";
            showAdminPanels();
            loadAllEvents();
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists() && userDoc.data().tipo === 'administrador') {
                showAdminPanels();
                loadAllEvents();
                loadAllUsers();
                setupUserMenu(user);
            } else {
                window.location.href = 'painel.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    btnLogout.addEventListener('click', () => {
        signOut(auth);
    });
    if(userDropdownLogoutBtn) userDropdownLogoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    });

    btnCreateEvent.addEventListener('click', async () => {
        const nomeEvento = newEventNameInput.value.trim();
        eventsErrorDiv.textContent = '';
        if (!nomeEvento) {
            eventsErrorDiv.textContent = 'Informe um nome para o evento.';
            return;
        }

        try {
            await addDoc(collection(db, 'eventos'), {
                nome: nomeEvento,
                criadoEm: serverTimestamp(),
                criadoPor: auth.currentUser.uid
            });
            newEventNameInput.value = '';
            loadAllEvents();

        } catch (err) {
            eventsErrorDiv.textContent = 'Erro ao criar evento: ' + err.message;
        }
    });

    async function getCreatorName(uid) {
        if (!uid) return 'Desconhecido';
        const userDoc = await getDoc(doc(db, 'usuarios', uid));
        return userDoc.exists() ? userDoc.data().nome : 'Usuário Removido';
    }

    async function loadAllEvents() {
        eventsList.innerHTML = '';
        const q = query(collection(db, 'eventos'), orderBy('criadoEm', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            eventsList.innerHTML = '<li>Nenhum evento criado ainda.</li>';
            return;
        }

        for (const d of snapshot.docs) {
            const ev = d.data();
            const creatorName = await getCreatorName(ev.criadoPor);
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${ev.nome} (Criado por: ${creatorName})</span>
                <button class="deleteEvent" data-event-id="${d.id}">Excluir</button>
            `;

            li.addEventListener('click', () => {
                window.location.href = `painel-evento.html?eventId=${d.id}`;
            });

            li.querySelector('.deleteEvent').addEventListener('click', async (event) => {
                event.stopPropagation();
                if (confirm(`Excluir evento ${ev.nome}?`)) {
                    await deleteDoc(doc(db, 'eventos', d.id));
                    loadAllEvents();
                }
            });

            eventsList.appendChild(li);
        }
    }

    async function loadAllUsers() {
        userList.innerHTML = '';
        const q = query(collection(db, 'usuarios'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            userList.innerHTML = '<li>Nenhum usuário cadastrado.</li>';
            return;
        }

        snapshot.forEach(d => {
            const user = d.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${user.nome}</span>
                <button class="deleteUser" data-user-id="${d.id}">Excluir</button>
            `;

            li.querySelector('.deleteUser').addEventListener('click', async (event) => {
                event.stopPropagation();
                if (confirm(`Excluir usuário ${user.nome}?`)) {
                    await deleteDoc(doc(db, 'usuarios', d.id));
                    loadAllUsers();
                }
            });
            userList.appendChild(li);
        });
    }

    btnCreateUser.addEventListener('click', () => {
        window.location.href = 'create.html';
    });

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
    if(userProfileSummary) userProfileSummary.addEventListener('click', () => {
        if(userDropdown) userDropdown.classList.toggle('show');
    });

    // =============================
    // MENU HAMBURGER RESPONSIVO
    // =============================
    function setupHamburgerMenu() {
        // Cria botão hamburger dinamicamente
        const header = document.querySelector('header.cabecario');
        const hamburger = document.createElement('div');
        hamburger.classList.add('hamburger');
        hamburger.innerHTML = `<span></span><span></span><span></span>`;
        header.appendChild(hamburger);

        hamburger.addEventListener('click', () => {
            mainMenu.classList.toggle('show');
            hamburger.classList.toggle('active');
        });

        // Fecha menu ao clicar fora
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target) && mainMenu.classList.contains('show')) {
                mainMenu.classList.remove('show');
                hamburger.classList.remove('active');
            }
        });
    }
}
