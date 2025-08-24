// Nenhum import é necessário aqui

document.addEventListener('DOMContentLoaded', () => {
    // Usa o objeto 'auth' global definido em firebase-config.js
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            initPainelEvento(user);
        }
    });
});

// Define o número máximo de itens a serem mostrados inicialmente
const MAX_ITEMS = 10;
// URL da sua Cloud Function
const GENERATE_ART_FUNCTION_URL = 'https://us-central1-kd-qr-codes-checkin-eventos.cloudfunctions.net/generateArt';

const searchPendingGuests = document.getElementById('searchPendingGuests');

let artTemplateUrl = null;
let generatedArtBlob = null;
let isExportCancelled = false; 
let currentGuestId = null;
let allPendingGuests = [];

function initPainelEvento(user) {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');

    if (!eventId) {
        alert('eventId não informado na URL.');
        window.location.href = 'painel.html';
        return;
    }

    const backButton = document.querySelector('.back-button');
    const eventTitleEl = document.getElementById('eventTitle');
    const eventCreatorNameEl = document.getElementById('eventCreatorName');
    const eventCreatedAtEl = document.getElementById('eventCreatedAt');
    const eventDateEl = document.getElementById('eventDate');
    const btnEditDate = document.getElementById('btnEditDate');
    
    const confirmedCountEl = document.getElementById('confirmedCount');
    const confirmedListEl = document.getElementById('confirmedList');
    const pendingCountEl = document.getElementById('pendingCount');
    const pendingListEl = document.getElementById('pendingList');
    
    const qrcodeDisplay = document.getElementById('qrcodeDisplay');
    const closeQrcodeModal = document.getElementById('closeQrcodeModal');
    const guestNameDisplay = document.getElementById('guestNameDisplay');
    const qrcodeImageContainer = document.getElementById('qrcodeImageContainer');
    const downloadQrcodeOnlyBtn = document.getElementById('downloadQrcodeOnlyBtn');
    const downloadFullArtBtn = document.getElementById('downloadFullArtBtn');
    const btnDeleteGuest = document.getElementById('btnDeleteGuest');
    
    const artPreviewContainer = document.getElementById('artPreviewContainer');
    const artPreview = document.getElementById('artPreview');
    const btnDeleteArt = document.getElementById('btnDeleteArt');
    const artUploadContainer = document.getElementById('artUploadContainer');
    const artFileInput = document.getElementById('artFileInput');
    const btnSelectArt = document.getElementById('btnSelectArt');
    const artFileName = document.getElementById('artFileName');
    const btnUploadArt = document.getElementById('btnUploadArt');
    const uploadStatus = document.getElementById('uploadStatus');

    const exportControls = document.getElementById('exportControls');
    const btnCancelExport = document.getElementById('btnCancelExport');
    const btnExportAll = document.getElementById('btnExportAll');
    const exportStatus = document.getElementById('exportStatus');

    const searchPendingGuestsInput = document.getElementById('searchPendingGuests');

    if(backButton) backButton.href = 'painel.html';
    
    loadEventDetails();

    function checkArtTemplateState() {
        if (artTemplateUrl && artPreviewContainer && artPreview) {
            artPreview.src = artTemplateUrl;
            artPreviewContainer.style.display = 'flex';
            if(artUploadContainer) artUploadContainer.style.display = 'none';
        } else {
            if(artPreviewContainer) artPreviewContainer.style.display = 'none';
            if(artUploadContainer) artUploadContainer.style.display = 'flex';
            if(artFileName) artFileName.textContent = '';
            if(btnUploadArt) btnUploadArt.style.display = 'none';
        }
    }
    
    async function loadEventDetails() {
        const docRef = db.collection('eventos').doc(eventId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if(eventTitleEl) eventTitleEl.textContent = data.nome || 'Painel do Evento';
            if(eventCreatedAtEl) eventCreatedAtEl.textContent = data.criadoEm?.toDate ? data.criadoEm.toDate().toLocaleString() : 'Não informado';
            
            if (data.criadoPor) {
                const userDoc = await db.collection('usuarios').doc(data.criadoPor).get();
                if(eventCreatorNameEl) eventCreatorNameEl.textContent = userDoc.exists ? userDoc.data().nome : 'Usuário Removido';
            }
            if (data.dataEvento) {
                if(eventDateEl) eventDateEl.textContent = data.dataEvento.toDate().toLocaleDateString();
            }
            if (data.artTemplateUrl) {
                artTemplateUrl = data.artTemplateUrl;
            }
            checkArtTemplateState();
        }
    }
    
    if(btnEditDate) btnEditDate.addEventListener('click', async () => {
        const novaData = prompt("Digite a nova data do evento (DD/MM/AAAA):");
        if (novaData) {
            const [dia, mes, ano] = novaData.split('/').map(Number);
            const dataObjeto = new Date(ano, mes - 1, dia);

            if (dia && mes && ano && !isNaN(dataObjeto.getTime())) {
                await db.collection('eventos').doc(eventId).update({
                    dataEvento: dataObjeto
                });
                if(eventDateEl) eventDateEl.textContent = novaData;
                alert('Data do evento atualizada!');
            } else {
                alert('Formato de data inválido. Use DD/MM/AAAA.');
            }
        }
    });

    if(btnSelectArt) btnSelectArt.addEventListener('click', () => {
        if(artFileInput) artFileInput.click();
    });

    if(artFileInput) artFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if(artFileName) artFileName.textContent = file.name;
            if(btnUploadArt) btnUploadArt.style.display = 'inline-block';
        }
    });

    if(btnUploadArt) btnUploadArt.addEventListener('click', async () => {
        const file = artFileInput.files[0];
        if (!file) {
            if(uploadStatus) uploadStatus.textContent = 'Selecione um arquivo primeiro.';
            return;
        }

        if(uploadStatus) uploadStatus.textContent = 'Enviando...';
        if(btnUploadArt) btnUploadArt.disabled = true;

        const storage = firebase.storage();
        const artRef = storage.ref(`event_templates/${eventId}/art_template.jpg`);

        try {
            await artRef.put(file);
            const downloadURL = await artRef.getDownloadURL();
            
            await db.collection('eventos').doc(eventId).update({
                artTemplateUrl: downloadURL
            });
            
            if(uploadStatus) uploadStatus.textContent = 'Upload concluído com sucesso!';
            alert('Arte do evento salva com sucesso!');
            artTemplateUrl = downloadURL;
            checkArtTemplateState();
        } catch (error) {
            if(uploadStatus) uploadStatus.textContent = 'Erro no upload: ' + error.message;
        } finally {
            if(btnUploadArt) btnUploadArt.disabled = false;
        }
    });

    if(btnDeleteArt) btnDeleteArt.addEventListener('click', async () => {
        if (confirm("Tem certeza que deseja excluir esta arte?")) {
            const storage = firebase.storage();
            const fileRef = storage.ref(`event_templates/${eventId}/art_template.jpg`);
            
            try {
                await fileRef.delete();
                await db.collection('eventos').doc(eventId).update({
                    artTemplateUrl: null
                });
                artTemplateUrl = null;
                checkArtTemplateState();
                if(uploadStatus) uploadStatus.textContent = 'Arte excluída com sucesso.';
            } catch (error) {
                if(uploadStatus) uploadStatus.textContent = 'Erro ao excluir arte: ' + error.message;
            }
        }
    });


    async function displayArtModal(guestData) {
        if (!qrcodeDisplay || !guestNameDisplay || !qrcodeImageContainer || !downloadFullArtBtn || !downloadQrcodeOnlyBtn) {
            console.error("Elementos do modal não encontrados. Verifique o HTML.");
            return;
        }

        currentGuestId = guestData.id;

        guestNameDisplay.textContent = guestData.nome;
        qrcodeImageContainer.innerHTML = 'Carregando arte...';
        
        downloadFullArtBtn.style.display = 'none';
        downloadQrcodeOnlyBtn.style.display = 'none';
        
        qrcodeDisplay.style.display = 'flex';

        if(btnDeleteGuest) btnDeleteGuest.onclick = async () => {
            if (confirm(`Tem certeza que deseja excluir o convidado "${guestNameDisplay.textContent}"?`)) {
                try {
                    const docRef = db.collection('eventos').doc(eventId).collection('convidados').doc(currentGuestId);
                    await docRef.delete();
                    alert('Convidado excluído com sucesso!');
                    if(qrcodeDisplay) qrcodeDisplay.style.display = 'none';
                } catch (error) {
                    alert('Erro ao excluir convidado: ' + error.message);
                    console.error("Erro ao excluir convidado:", error);
                }
            }
        };
        
        try {
            if (!artTemplateUrl) {
                throw new Error('Nenhuma arte de template foi enviada para este evento.');
            }
            
            // --- NOVA LÓGICA DE GERAÇÃO DA ARTE NO CLIENTE ---
            qrcodeImageContainer.innerHTML = 'Gerando convite...';

            // 1. Carrega o template da arte como uma imagem
            const templateImg = new Image();
            templateImg.crossOrigin = "anonymous";
            templateImg.src = artTemplateUrl;

            await new Promise((resolve, reject) => {
                templateImg.onload = resolve;
                templateImg.onerror = reject;
            });
            
            // 2. Cria um canvas e desenha a imagem do template
            const canvas = document.createElement('canvas');
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(templateImg, 0, 0);

            // 3. Gera o QR Code com a URL salva no Firestore
            const qrCodeValue = guestData.qrCode;
            const qrCodeSize = 415; // Ajuste o tamanho do QR Code
            
            const qrCodeImg = new Image();
            qrCodeImg.src = qrCodeValue;
            
            await new Promise((resolve, reject) => {
                qrCodeImg.onload = resolve;
                qrCodeImg.onerror = reject;
            });
            
            // 4. Calcula a posição para colar o QR Code no centro da área designada
            // Essas coordenadas (position_x, position_y) foram retiradas da sua Cloud Function
            const position_x = 337;
            const position_y = 1257;

            // 5. Redimensiona o QR Code e o cola no canvas
            const qrCodeResized = await new Promise(resolve => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = qrCodeSize;
                tempCanvas.height = qrCodeSize;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(qrCodeImg, 0, 0, qrCodeSize, qrCodeSize);
                resolve(tempCanvas);
            });
            
            ctx.drawImage(qrCodeResized, position_x, position_y);

            // 6. Converte o canvas para uma imagem e exibe no modal
            const finalImageUrl = canvas.toDataURL('image/png');
            generatedArtBlob = await (await fetch(finalImageUrl)).blob();
            
            qrcodeImageContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = finalImageUrl;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            qrcodeImageContainer.appendChild(img);

            downloadFullArtBtn.style.display = 'inline-block';
            downloadQrcodeOnlyBtn.style.display = 'inline-block';

            downloadFullArtBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = finalImageUrl;
                link.download = `${guestData.nome}_Convite.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            downloadQrcodeOnlyBtn.onclick = async () => {
                const link = document.createElement('a');
                link.href = guestData.qrCode;
                link.download = `${guestData.nome}_QRCode.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

        } catch (error) {
            qrcodeImageContainer.innerHTML = `
                <p style="color: red;">
                    Erro ao gerar a arte: ${error.message}. <br>
                    Verifique se o template foi enviado.
                </p>
            `;
            console.error("Erro ao gerar arte:", error);
        }
    }


    if(closeQrcodeModal) closeQrcodeModal.addEventListener('click', () => {
        if(qrcodeDisplay) qrcodeDisplay.style.display = 'none';
        if (generatedArtBlob) {
            URL.revokeObjectURL(URL.createObjectURL(generatedArtBlob));
            generatedArtBlob = null;
        }
    });

    if(btnCancelExport) btnCancelExport.addEventListener('click', () => {
        isExportCancelled = true;
        if(exportStatus) exportStatus.textContent = "Exportação cancelada.";
        if(exportControls) exportControls.style.display = 'none';
        if(btnExportAll) btnExportAll.style.display = 'block';
    });
    
    async function exportAllArts() {
        const confirmExport = confirm("Isso pode levar alguns minutos. Deseja exportar todos os convites?");
        if (!confirmExport) return;
        
        isExportCancelled = false;
        if(exportControls) exportControls.style.display = 'flex';
        if(btnExportAll) btnExportAll.style.display = 'none';
        
        if(exportStatus) exportStatus.textContent = "Iniciando a exportação...";

        const convidadosRef = db.collection('eventos').doc(eventId).collection('convidados');
        const querySnapshot = await convidadosRef.get();

        if (querySnapshot.empty) {
            if(exportStatus) exportStatus.textContent = "Nenhum convidado encontrado.";
            if(exportControls) exportControls.style.display = 'none';
            if(btnExportAll) btnExportAll.style.display = 'block';
            return;
        }

        const zip = new JSZip();
        const totalGuests = querySnapshot.docs.length;
        let processedCount = 0;

        for (const doc of querySnapshot.docs) {
            if (isExportCancelled) {
                if(exportStatus) exportStatus.textContent = "Exportação cancelada.";
                break;
            }

            const guestData = doc.data();
            const guestName = guestData.nome;

            try {
                if(exportStatus) exportStatus.textContent = `Gerando convite para: ${guestName} (${processedCount + 1}/${totalGuests})`;

                const response = await fetch(GENERATE_ART_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId: eventId,
                        nome: guestName
                    })
                });

                if (!response.ok) {
                    throw new Error('Erro ao gerar a arte para ' + guestName);
                }

                const blob = await response.blob();
                const fileName = `${guestName}_Convite.png`.replace(/[\\/:*?"<>|]/g, '_');
                zip.file(fileName, blob);

            } catch (error) {
                console.error("Erro ao gerar convite para " + guestName + ":", error);
            }
            
            processedCount++;
        }
        
        if (!isExportCancelled) {
            if(exportStatus) exportStatus.textContent = "Compactando arquivos...";
            
            zip.generateAsync({ type: "blob" }).then(function(content) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `Convites_Evento_${eventId}.zip`;
                link.click();
                
                if(exportStatus) exportStatus.textContent = "Download concluído!";
            }).catch(error => {
                if(exportStatus) exportStatus.textContent = "Erro ao compactar arquivos.";
                console.error("Erro ao compactar:", error);
            }).finally(() => {
                if(exportControls) exportControls.style.display = 'none';
                if(btnExportAll) btnExportAll.style.display = 'block';
            });
        }
    }

    if(searchPendingGuests) searchPendingGuests.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredGuests = allPendingGuests.filter(guest => 
            guest.nome.toLowerCase().includes(searchTerm)
        );
        renderPendingList(filteredGuests, pendentes.length > MAX_ITEMS);
    });

    if(btnExportAll) btnExportAll.addEventListener('click', exportAllArts);

    db.collection('eventos').doc(eventId).collection('convidados').onSnapshot(snapshot => {
        const convidados = [];
        snapshot.forEach(d => convidados.push({ id: d.id, ...d.data() }));

        const confirmados = convidados.filter(c => c.checkin === true);
        const pendentes = convidados.filter(c => c.checkin === false || !c.hasOwnProperty('checkin'));

        allPendingGuests = pendentes;

        if(confirmedCountEl) confirmedCountEl.textContent = confirmados.length;
        if(pendingCountEl) pendingCountEl.textContent = pendentes.length;

        renderList(confirmedListEl, confirmados.slice(0, MAX_ITEMS), confirmados.length, true);
        renderList(pendingListEl, pendentes.slice(0, MAX_ITEMS), pendentes.length, false);

        if (convidados.length > 0 && btnExportAll) {
            btnExportAll.style.display = 'block';
        } else if(btnExportAll) {
            btnExportAll.style.display = 'none';
        }
    });
    
    function renderList(listElement, data, totalCount, isConfirmed) {
        if(!listElement) return;
        listElement.innerHTML = '';

        if (data.length === 0) {
            const message = isConfirmed ? 'Nenhum check-in confirmado ainda.' : 'Todos os convidados chegaram!';
            listElement.innerHTML = `<li class="muted">${message}</li>`;
        } else {
            data.forEach(c => {
                const li = document.createElement('li');
                if (isConfirmed) {
                    li.textContent = `${c.nome} - ${c.checkinAt?.toDate ? c.checkinAt.toDate().toLocaleString() : '—'}`;
                    li.classList.add('confirmed-item');
                } else {
                    li.textContent = c.nome;
                    li.classList.add('pending-item');
                    li.addEventListener('click', () => displayArtModal(c));
                }
                listElement.appendChild(li);
            });
        }

        if (totalCount > MAX_ITEMS) {
            const btn = document.createElement('button');
            btn.textContent = `Mostrar todos os ${totalCount}`;
            btn.className = 'show-all-btn';
            btn.onclick = () => {
                const fullData = isConfirmed ? convidados.filter(c => c.checkin) : allPendingGuests;
                renderFullList(listElement, fullData, isConfirmed);
            };
            listElement.appendChild(btn);
        }
    }

    function renderFullList(listElement, data, isConfirmed = false) {
        if(!listElement) return;
        listElement.innerHTML = '';
        data.forEach(c => {
            const li = document.createElement('li');
            if (isConfirmed) {
                li.textContent = `${c.nome} - ${c.checkinAt?.toDate ? c.checkinAt.toDate().toLocaleString() : '—'}`;
                li.classList.add('confirmed-item');
            } else {
                li.textContent = c.nome;
                li.classList.add('pending-item');
                li.addEventListener('click', () => displayArtModal(c));
            }
            listElement.appendChild(li);
        });
        const btn = document.createElement('button');
        btn.textContent = `Mostrar menos`;
        btn.className = 'show-all-btn';
        btn.onclick = () => { location.reload(); };
        listElement.appendChild(btn);
    }
}