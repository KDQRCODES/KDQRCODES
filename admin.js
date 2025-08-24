// Nenhum import é necessário aqui

document.addEventListener("DOMContentLoaded", () => {
  initAdminPanel();
});

function initAdminPanel() {
  // Painéis / listas
  const eventsPanel = document.getElementById("eventsPanel");
  const eventsList = document.getElementById("eventsList");
  const newEventNameInput = document.getElementById("newEventName");
  const btnCreateEvent = document.getElementById("btnCreateEvent");
  const eventsErrorDiv = document.getElementById("eventsError");

  const usersPanel = document.getElementById("usersPanel");
  const btnCreateUser = document.getElementById("btnCreateUser");
  const userList = document.getElementById("userList");

  const eventIframe = document.getElementById("eventIframe");
  const btnBackToEvents = document.getElementById("btnBackToEvents");

  // User menu (perfil)
  const userInfoContainer = document.querySelector(".user-info-container");
  const userProfileSummary = document.getElementById("userProfileSummary");
  const userDropdown = document.getElementById("userDropdown");
  const userArrow = document.getElementById("userArrow");
  const userNameSpan = document.getElementById("userName");
  const userTypeSpan = document.getElementById("userType");

  // Logout correto
  const btnLogoutDropdown = document.getElementById("btnLogoutDropdown");

  // Usa os objetos 'auth' e 'db' globais, definidos em firebase-config.js
  const currentUser = auth.currentUser;

  function showAdminPanels() {
    eventsPanel.style.display = "block";
    usersPanel.style.display = "block";
  }

  if (btnBackToEvents) {
    btnBackToEvents.addEventListener("click", () => {
      eventIframe.src = "";
      showAdminPanels();
      loadAllEvents();
    });
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const userDocRef = db.collection("usuarios").doc(user.uid);
    const userDoc = await userDocRef.get();

    // CORRIGIDO: de userDoc.exists() para userDoc.exists
    if (!userDoc.exists || userDoc.data().tipo !== "administrador") {
      window.location.href = "painel.html";
      return;
    }

    showAdminPanels();
    loadAllEvents();
    loadAllUsers();
    setupUserMenu(user);
  });

  if (btnLogoutDropdown) {
    btnLogoutDropdown.addEventListener("click", async (e) => {
      e.preventDefault();
      await auth.signOut();
      window.location.href = "login.html";
    });
  }

  if (btnCreateEvent) {
    btnCreateEvent.addEventListener("click", async () => {
      const nomeEvento = (newEventNameInput.value || "").trim();
      eventsErrorDiv.textContent = "";
      if (!nomeEvento) {
        eventsErrorDiv.textContent = "Informe um nome para o evento.";
        return;
      }
      try {
        await db.collection("eventos").add({
          nome: nomeEvento,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          criadoPor: auth.currentUser.uid,
        });
        newEventNameInput.value = "";
        loadAllEvents();
      } catch (err) {
        eventsErrorDiv.textContent = "Erro ao criar evento: " + err.message;
      }
    });
  }

  async function getCreatorName(uid) {
    if (!uid) return "Desconhecido";
    const userDoc = await db.collection("usuarios").doc(uid).get();
    // CORRIGIDO: de u.exists() para u.exists
    return userDoc.exists ? userDoc.data().nome : "Usuário Removido";
  }

  async function loadAllEvents() {
    eventsList.innerHTML = "";
    const q = db.collection("eventos").orderBy("criadoEm", "desc");
    const snapshot = await q.get();

    if (snapshot.empty) {
      eventsList.innerHTML = "<li>Nenhum evento criado ainda.</li>";
      return;
    }

    for (const d of snapshot.docs) {
      const ev = d.data();
      // Removido: A linha que buscava o nome do criador do evento
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${ev.nome}</span>
        <button class="deleteEvent" data-event-id="${d.id}">Excluir</button>
      `;

      li.addEventListener("click", () => {
        window.location.href = `painel-evento.html?eventId=${d.id}`;
      });

      li.querySelector(".deleteEvent").addEventListener("click", async (event) => {
        event.stopPropagation();
        if (confirm(`Excluir evento ${ev.nome}?`)) {
          await db.collection("eventos").doc(d.id).delete();
          loadAllEvents();
        }
      });

      eventsList.appendChild(li);
    }
  }

  async function loadAllUsers() {
    userList.innerHTML = "";
    const q = db.collection("usuarios");
    const snapshot = await q.get();

    if (snapshot.empty) {
      userList.innerHTML = "<li>Nenhum usuário cadastrado.</li>";
      return;
    }

    snapshot.forEach((d) => {
      const user = d.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${user.nome}</span>
        <button class="deleteUser" data-user-id="${d.id}">Excluir</button>
      `;
      li.querySelector(".deleteUser").addEventListener("click", async (event) => {
        event.stopPropagation();
        if (confirm(`Excluir usuário ${user.nome}?`)) {
          await db.collection("usuarios").doc(d.id).delete();
          loadAllUsers();
        }
      });
      userList.appendChild(li);
    });
  }

  if (btnCreateUser) {
    btnCreateUser.addEventListener("click", () => {
      window.location.href = "create.html";
    });
  }

  async function setupUserMenu(user) {
    if (!user) return;
    const userDoc = await db.collection("usuarios").doc(user.uid).get();
    // CORRIGIDO: de userDoc.exists() para userDoc.exists
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    if (userNameSpan) userNameSpan.textContent = userData.nome;
    if (userTypeSpan) userTypeSpan.textContent = userData.tipo;
    if (userInfoContainer) userInfoContainer.style.display = "flex";
  }

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!userDropdown) return;
    const opened = userDropdown.classList.toggle("show");
    if (userArrow) userArrow.classList.toggle("rotate", opened);
  };

  if (userProfileSummary) userProfileSummary.addEventListener("click", toggleDropdown);
  if (userArrow) userArrow.addEventListener("click", toggleDropdown);

  document.addEventListener("click", (e) => {
    if (!userDropdown) return;
    const clickInside = userInfoContainer && userInfoContainer.contains(e.target);
    if (!clickInside && userDropdown.classList.contains("show")) {
      userDropdown.classList.remove("show");
      userArrow && userArrow.classList.remove("rotate");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && userDropdown?.classList.contains("show")) {
      userDropdown.classList.remove("show");
      userArrow && userArrow.classList.remove("rotate");
    }
  });
}