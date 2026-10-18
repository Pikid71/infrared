const socket = io()
// path: /public/script.js
function login_key(username, key) {
    if (username && key) {
        socket.emit('Login-key', username, key, (callback) => {
            if (callback.success){
                document.cookie = `key=${encodeURIComponent(callback.key)}; path=/; max-age=3600; SameSite=Lax;`;
                document.cookie = `usrnm=${encodeURIComponent(callback.username)}; path=/; max-age=3600; SameSite=Lax;`;
            } else {
                console.warn('Error: ' + callback.error);
                document.cookie = `key=; path=/; max-age=0; SameSite=Lax;`;
                document.cookie = `usrnm=; path=/; max-age=0; SameSite=Lax;`;
                window.location.reload();
            };
        });
    } else {
        window.location.href = `/c/login?re=${new URL(window.location.href).pathname}${window.location.search}`
    }
}

function getcookie(name) {
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

function reload() {
    window.location.reload()
}

window.addEventListener('beforeunload', () => {
    socket.disconnect()
})
if (!window.location.href.includes('chat')){
    socket.on('Chat-msg', (username, message, rank, level) => {
        const div = document.createElement('div');
        div.className = 'pmsg';
        if(username.toLowerCase() === 'system'){
            div.innerHTML = message
        } else {
            div.innerHTML = `[${rank}] [Level ${level}] ${username} >> ${message}`;
        }
        document.body.appendChild(div);
        setTimeout(() => {
            div.style.display = 'none'
        }, 3000)
    })
}
window.addEventListener('keydown', (key) => {
    if (key.ctrlKey && key.key.toLowerCase() === 'q') {
        key.preventDefault();
        window.location.replace('about:blank');
        window.open('https://classroom.google.com/u/0/h', '_blank');
        window.close();
    }
});