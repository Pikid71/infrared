// path: /public/script.js
function login_key(username, key) {
    if (username && key) {
        socket.emit('Login-key', username, key, (callback) => {
            if (callback.success){
                document.cookie = `key=${encodeURIComponent(callback.key)}; path=/; max-age=3600; SameSite=Lax;`;
                document.cookie = `usrnm=${encodeURIComponent(callback.username)}; path=/; max-age=3600; SameSite=Lax;`;
                alert('Login successful');
            } else {
                console.warn('Error: ' + callback.error);
                document.cookie = `key=; path=/; max-age=0; SameSite=Lax;`;
                document.cookie = `usrnm=; path=/; max-age=0; SameSite=Lax;`;
                window.location.reload();
            };
        });
    } else {
        window.location.href = `/c/login?re=${new URL(window.location.href).pathname}`
    }
}

function getcookie(name) {// document.cookie looks like "usrnm=pikid; key=quiavgfhya8rgt48gyh89a=gsd-; ..."
    const cookies = document.cookie.split(';');
    const cookie = cookies.find(c => c.trim().startsWith(name+'='));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}

function geturlparms() {
    const urlparms = new URLSearchParams(window.location.search);
    const room = urlparms.get('r') || 'main'

    const re = urlparms.get('re');
    let redir = '/c/dashboard';
    if (re && re.startsWith('/') && !re.startsWith('//') && !re.includes('..')){
        redir = re;
    }

    if (room.length > 8){
        window.location.search = `r=${room.slice(0,8)}`
    }
    return { room, redir }
}
window.addEventListener('beforeunload', () => {
    socket.disconnect()
})