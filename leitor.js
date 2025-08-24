// Nenhum import é necessário aqui
document.addEventListener('DOMContentLoaded', () => {
    // Usa o objeto 'auth' global definido em firebase-config.js
    auth.onAuthStateChanged(user => {
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
        if (!eventSelection) return;
        eventSelection.innerHTML = '<option value="">Carregando eventos...</option>';
        
        // Usa a sintaxe de compatibilidade
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

    async function setupUserMenu(user) {
        if (user) {
            // Usa a sintaxe de compatibilidade
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            // Correção para .exists
            if (userDoc.exists) {
                const userData = userDoc.data();
                if(userNameSpan) userNameSpan.textContent = userData.nome;
                if(userTypeSpan) userTypeSpan.textContent = userData.tipo;
                if(userInfoContainer) userInfoContainer.style.display = 'flex';
                updateNavLinks(userData.tipo);
            }
        }
    }

    async function updateNavLinks(userType) {
        if (!mainMenu) return;
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
            
            // Usa a sintaxe de compatibilidade
            const convidadosRef = db.collection('eventos').doc(eventId).collection('convidados');
            const querySnapshot = await convidadosRef.where('nome', '==', nome).get();

            if (querySnapshot.empty) {
                showStatus(`Convidado "${nome}" não encontrado.`, 'error');
                return;
            }

            const convidadoDoc = querySnapshot.docs[0];
            const convidadoRef = convidadoDoc.ref;
            const convidadoData = convidadoDoc.data();

            if (convidadoData.checkin) {
                showStatus(`"${nome}" já fez check-in.`, 'error');
            } else {
                if (!isTestMode) {
                    // Usa a sintaxe de compatibilidade
                    await convidadoRef.update({ 
                        checkin: true,
                        checkinAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                showStatus(`✅ Check-in de "${nome}" realizado com sucesso!`, 'success');
            }
        } catch (error) {
            showStatus('QR Code inválido.', 'error');
            console.error("Erro ao ler QR Code:", error);
        }
        
        // Mantém a exibição da mensagem por 3 segundos
        if (qrCodeScanner) {
            qrCodeScanner.pause();
            setTimeout(() => qrCodeScanner.resume(), 3000);
        }
    };

    const onScanError = (error) => {
        // Ignora erros de leitura para evitar mensagens de erro constantes
        // console.error("Erro de leitura:", error);
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
    
    if (btnTestReader) {
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
    }

    if (btnStartReader) {
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
    }
    
    function startScanner() {
        stopScanner();
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const cameraId = cameraSelection.value;

        // O 'Html5QrcodeScanner' não é global. O correto é criar uma instância.
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(cameraId, config, onScanSuccess, onScanError).then(instance => {
            qrCodeScanner = instance;
        }).catch(err => {
            console.error("Erro ao iniciar leitor:", err);
            showStatus("Não foi possível iniciar o leitor. Verifique as permissões da câmera.", 'error');
        });
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

    if(userProfileSummary) {
        userProfileSummary.addEventListener('click', () => {
            if(userDropdown) userDropdown.classList.toggle('show');
        });
    }

    if(userDropdownLogoutBtn) {
        userDropdownLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await auth.signOut();
            window.location.href = 'login.html';
        });
    }
}