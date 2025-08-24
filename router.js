// Nenhum import é necessário aqui

const protectedRoutes = ['painel.html', 'admin.html', 'gerador.html', 'leitor.html', 'create.html', 'profile.html', 'painel-evento.html'];
const publicRoutes = ['index.html', 'login.html'];

// Usa o objeto 'auth' global
auth.onAuthStateChanged(user => {
    const currentPath = window.location.pathname.split('/').pop();

    if (user) {
        // Se o usuário estiver logado e tentar acessar uma rota pública (exceto index), redirecione para o painel.
        if (publicRoutes.includes(currentPath) && currentPath !== 'index.html') {
            window.location.href = 'painel.html';
        }
    } else {
        // Se o usuário não estiver logado e tentar acessar uma rota protegida, redirecione para o login.
        if (protectedRoutes.includes(currentPath)) {
            window.location.href = 'login.html';
        }
    }
});