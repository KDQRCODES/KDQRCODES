import { db, auth } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";


document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
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

let artTemplateUrl = null;
let generatedArtBlob = null;
let isExportCancelled = false; // NOVO: Flag para cancelamento

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
        const docSnap = await getDoc(doc(db, 'eventos', eventId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(eventTitleEl) eventTitleEl.textContent = data.nome || 'Painel do Evento';
            if(eventCreatedAtEl) eventCreatedAtEl.textContent = data.criadoEm?.toDate ? data.criadoEm.toDate().toLocaleString() : 'Não informado';
            
            if (data.criadoPor) {
                const userDoc = await getDoc(doc(db, 'usuarios', data.criadoPor));
                if(eventCreatorNameEl) eventCreatorNameEl.textContent = userDoc.exists() ? userDoc.data().nome : 'Usuário Removido';
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
                await updateDoc(doc(db, 'eventos', eventId), {
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

        const storage = getStorage();
        const artRef = ref(storage, `event_templates/${eventId}/art_template.jpg`);

        try {
            await uploadBytes(artRef, file);
            const downloadURL = await getDownloadURL(artRef);
            
            await updateDoc(doc(db, 'eventos', eventId), {
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
            const storage = getStorage();
            const fileRef = ref(storage, `event_templates/${eventId}/art_template.jpg`);
            
            try {
                await deleteObject(fileRef);
                await updateDoc(doc(db, 'eventos', eventId), {
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

        guestNameDisplay.textContent = guestData.nome;
        qrcodeImageContainer.innerHTML = 'Carregando arte...';
        
        downloadFullArtBtn.style.display = 'none';
        downloadQrcodeOnlyBtn.style.display = 'none';
        
        qrcodeDisplay.style.display = 'flex';
        
        try {
            if (!artTemplateUrl) {
                throw new Error('Nenhuma arte de template foi enviada para este evento.');
            }
            
            const response = await fetch(GENERATE_ART_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: eventId,
                    nome: guestData.nome
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao gerar a arte do QR Code.');
            }
            
            generatedArtBlob = await response.blob();
            const imageUrl = URL.createObjectURL(generatedArtBlob);

            qrcodeImageContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            qrcodeImageContainer.appendChild(img);

            downloadFullArtBtn.style.display = 'inline-block';
            downloadQrcodeOnlyBtn.style.display = 'inline-block';

            downloadFullArtBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = `${guestData.nome}_Convite.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            downloadQrcodeOnlyBtn.onclick = async () => {
                const tempCanvas = document.createElement('canvas');
                await QRCode.toCanvas(tempCanvas, guestData.qrCode, { width: 300 });
                const link = document.createElement('a');
                link.href = tempCanvas.toDataURL('image/png');
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
        if (!confirmExport) {
            return;
        }
        
        isExportCancelled = false;
        if(exportControls) exportControls.style.display = 'flex';
        if(btnExportAll) btnExportAll.style.display = 'none';
        
        if(exportStatus) exportStatus.textContent = "Iniciando a exportação...";

        const convidadosRef = collection(db, 'eventos', eventId, 'convidados');
        const q = query(convidadosRef);
        const querySnapshot = await getDocs(q);

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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        eventId: eventId,
                        nome: guestName
                    })
                });

                if (!response.ok) {
                    throw new Error('Erro ao gerar a arte do QR Code para ' + guestName);
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

    if(btnExportAll) btnExportAll.addEventListener('click', exportAllArts);

    onSnapshot(collection(db, 'eventos', eventId, 'convidados'), snapshot => {
        console.log("onSnapshot acionado. Convidados recebidos:", snapshot.docs.length);

        const convidados = [];
        snapshot.forEach(d => convidados.push({ id: d.id, ...d.data() }));
        

        const confirmados = convidados.filter(c => c.checkin === true);
        const pendentes = convidados.filter(c => c.checkin === false || !c.hasOwnProperty('checkin'));

        if(confirmedCountEl) confirmedCountEl.textContent = confirmados.length;
        if(pendingCountEl) pendingCountEl.textContent = pendentes.length;

        const confirmedToDisplay = confirmados.slice(0, MAX_ITEMS);
        const pendingToDisplay = pendentes.slice(0, MAX_ITEMS);

        if(confirmedListEl) {
            confirmedListEl.innerHTML = '';
            if (confirmedToDisplay.length === 0) {
                confirmedListEl.innerHTML = '<li class="muted">Nenhum check-in confirmado ainda.</li>';
            } else {
                confirmedToDisplay.sort((a, b) => b.checkinAt - a.checkinAt).forEach(c => {
                    const li = document.createElement('li');
                    li.textContent = `${c.nome} - ${c.checkinAt?.toDate ? c.checkinAt.toDate().toLocaleString() : '—'}`;
                    li.classList.add('confirmed-item');
                    confirmedListEl.appendChild(li);
                });
            }
            if (confirmados.length > MAX_ITEMS) {
                const btn = document.createElement('button');
                btn.textContent = `Mostrar todos os ${confirmados.length} confirmados`;
                btn.className = 'show-all-btn';
                if(btn) btn.onclick = () => { renderFullList(confirmedListEl, confirmados, true); };
                confirmedListEl.appendChild(btn);
            }
        }

        if(pendingListEl) {
            pendingListEl.innerHTML = '';
            if (pendingToDisplay.length === 0) {
                pendingListEl.innerHTML = '<li class="muted">Todos os convidados chegaram!</li>';
            } else {
                pendingToDisplay.forEach(c => {
                    const li = document.createElement('li');
                    li.textContent = c.nome;
                    li.classList.add('pending-item');
                    if(li) li.addEventListener('click', () => displayArtModal(c));
                    pendingListEl.appendChild(li);
                });
            }
            if (pendentes.length > MAX_ITEMS) {
                const btn = document.createElement('button');
                btn.textContent = `Mostrar todos os ${pendentes.length} pendentes`;
                btn.className = 'show-all-btn';
                if(btn) btn.onclick = () => { renderFullList(pendingListEl, pendentes); };
                pendingListEl.appendChild(btn);
            }
        }

        if (convidados.length > 0 && btnExportAll) {
            btnExportAll.style.display = 'block';
        } else if(btnExportAll) {
            btnExportAll.style.display = 'none';
        }
    });
    
    function renderFullList(listElement, data, isConfirmed = false) {
        if(!listElement) return;

        listElement.innerHTML = '';
        data.forEach(c => {
            const li = document.createElement('li');
            li.textContent = c.nome;
            if (isConfirmed) {
                li.textContent = `${c.nome} - ${c.checkinAt?.toDate ? c.checkinAt.toDate().toLocaleString() : '—'}`;
                li.classList.add('confirmed-item');
            } else {
                 li.classList.add('pending-item');
                 if(li) li.addEventListener('click', () => displayArtModal(c));
            }
            listElement.appendChild(li);
        });
        const btn = document.createElement('button');
        btn.textContent = `Mostrar menos`;
        btn.className = 'show-all-btn';
        if(btn) btn.onclick = () => { location.reload(); };
        listElement.appendChild(btn);
    }
    
    if(btnExportAll) btnExportAll.addEventListener('click', exportAllArts);

    if(btnCancelExport) btnCancelExport.addEventListener('click', () => {
        isExportCancelled = true;
        if(exportStatus) exportStatus.textContent = "Exportação cancelada.";
        if(exportControls) exportControls.style.display = 'none';
        if(btnExportAll) btnExportAll.style.display = 'block';
    });


    async function exportAllArts() {
        const confirmExport = confirm("Isso pode levar alguns minutos. Deseja exportar todos os convites?");
        if (!confirmExport) {
            return;
        }
        
        isExportCancelled = false;
        if(exportControls) exportControls.style.display = 'flex';
        if(btnExportAll) btnExportAll.style.display = 'none';
        
        if(exportStatus) exportStatus.textContent = "Iniciando a exportação...";

        const convidadosRef = collection(db, 'eventos', eventId, 'convidados');
        const q = query(convidadosRef);
        const querySnapshot = await getDocs(q);

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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        eventId: eventId,
                        nome: guestName
                    })
                });

                if (!response.ok) {
                    throw new Error('Erro ao gerar a arte do QR Code para ' + guestName);
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
}