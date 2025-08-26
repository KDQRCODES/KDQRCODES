import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, getDocs, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            initLeitorPage(user);
        }
    });
});

async function initLeitorPage(user) {
    const eventSelection = document.getElementById('eventSelection');
    const cameraSelection = document.getElementById('cameraSelection');
    const leitorStatus = document.getElementById('leitorStatus');
    const leitorStatusBox = document.getElementById('leitorStatusBox');
    const btnStartReader = document.getElementById('btnStartReader');
    const btnTestReader = document.getElementById('btnTestReader');
    const readerDiv = document.getElementById('reader');
    let qrCodeScanner;
    let currentEventId = null;
    let isTestMode = false;

    // Elementos do menu do usuário
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userDropdown = document.getElementById('userDropdown');
    const userNameSpan = document.getElementById('userName');
    const userTypeSpan = document.getElementById('userType');
    const userInfoContainer = document.querySelector('.user-info-container');
    const userDropdownLogoutBtn = document.getElementById('btnLogout');
    const mainMenu = document.getElementById('mainMenu');

    function showStatus(message, type = 'info') {
        leitorStatus.textContent = message;
        leitorStatusBox.className = 'status-box'; // Reset
        if (type === 'success') {
            leitorStatusBox.classList.add('status-box--success');
        } else if (type === 'error') {
            leitorStatusBox.classList.add('status-box--error');
        } else {
            leitorStatusBox.classList.add('status-box--info');
        }
    }

    async function loadEvents() {
        eventSelection.innerHTML = '<option value="">Carregando eventos...</option>';
        const eventosRef = collection(db, 'eventos');
        const querySnapshot = await getDocs(query(eventosRef));

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

    async function updateNavLinks(userType) {
        const mainPanelLink = mainMenu.querySelector('a[href="painel.html"]');
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

    const onScanSuccess = async (decodedText, decodedResult) => {
        try {
            const data = JSON.parse(decodedText);
            const { eventId, nome } = data;

            if (eventId !== currentEventId) {
                showStatus('QR Code não pertence a este evento!', 'error');
                return;
            }
            
            // NOVO: Faz uma consulta por nome, em vez de usar o nome como ID
            const convidadosRef = collection(db, 'eventos', eventId, 'convidados');
            const q = query(convidadosRef, where('nome', '==', nome));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showStatus(`Convidado "${nome}" não encontrado.`, 'error');
                return;
            }

            // Pega o primeiro documento encontrado (assumindo que os nomes são únicos)
            const convidadoDoc = querySnapshot.docs[0];
            const convidadoRef = convidadoDoc.ref;
            const convidadoData = convidadoDoc.data();

            if (convidadoData.checkin) {
                showStatus(`"${nome}" já fez check-in.`, 'error');
            } else {
                if (!isTestMode) {
                    await updateDoc(convidadoRef, { 
                        checkin: true,
                        checkinAt: serverTimestamp() // ADICIONADO: Para registrar a data e hora do check-in
                    });
                }
                showStatus(`✅ Check-in de "${nome}" realizado com sucesso!`, 'success');
            }
        } catch (error) {
            showStatus('QR Code inválido.', 'error');
            console.error("Erro ao ler QR Code:", error);
        }
        
        // Mantém a exibição da mensagem por 3 segundos
        qrCodeScanner.pause();
        setTimeout(() => qrCodeScanner.resume(), 3000);
    };

    const onScanError = (error) => {
        // Ignora erros de leitura para evitar mensagens de erro constantes
    };

    const stopScanner = () => {
        if (qrCodeScanner) {
            qrCodeScanner.stop().then(() => {
                showStatus('Leitor parado.', 'info');
                readerDiv.innerHTML = '';
            }).catch(err => {
                console.error("Erro ao parar o leitor:", err);
            });
        }
    };
    
    btnTestReader.addEventListener('click', () => {
        const eventId = eventSelection.value;
        if (!eventId) {
            alert('Por favor, selecione um evento primeiro.');
            return;
        }

        isTestMode = true;
        currentEventId = eventId;
        showStatus('Modo de teste ativado. Nenhuma alteração será salva.', 'info');
        startScanner();
    });

    btnStartReader.addEventListener('click', () => {
        const eventId = eventSelection.value;
        if (!eventId) {
            alert('Por favor, selecione um evento primeiro.');
            return;
        }

        isTestMode = false;
        currentEventId = eventId;
        showStatus('Leitor ativado em modo de produção. Os check-ins serão salvos.', 'info');
        startScanner();
    });
    
    function startScanner() {
        stopScanner();

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const cameraId = cameraSelection.value;

        qrCodeScanner = new Html5QrcodeScanner("reader", config, true);
        qrCodeScanner.render(onScanSuccess, onScanError);
    }
    
    // Carregar eventos e câmeras ao iniciar a página
    loadEvents();
    setupUserMenu(user);
    
    Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length) {
            cameras.forEach(camera => {
                const option = document.createElement('option');
                option.value = camera.id;
                option.text = camera.label || `Câmera ${camera.id}`;
                cameraSelection.appendChild(option);
            });
        }
    }).catch(err => {
        console.error("Erro ao buscar câmeras:", err);
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
