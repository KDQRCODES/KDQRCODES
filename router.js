import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function redirectToGerador() {
    window.location.href = 'gerador.html';
}

export async function redirectToPanel() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists() && userDoc.data().tipo === 'administrador') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'painel.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });
}