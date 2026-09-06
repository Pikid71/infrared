// path: /server.js

const oglog = console.log;
let logs = []
let clients = []
console.log = function (...args){
    const time = new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles'
    }) + '    '
    const logg = `${time}    ${args.join(' ')}`
    logs.push(logg)
    clients.forEach(client => client.write(`\n ${logg}`))
    oglog(logg)
}

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const marked = require('marked');
const PORT = process.env.PORT;
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ADMIN_PASS = process.env.ADMIN_PASS
const LOGS_KEY = process.env.LOGS_KEY
const nfilter = require('./filter');
const { send } = require('./sendemail');

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const users = {};
const pending = {}

const defaultRooms = ['main', 'vip', 'mod', 'admin']
let rooms = {
    'main':{
        users: []
    },
    'vip':{
        users: []
    },
    'mod':{
        users: []
    },
    'admin':{
        users: []
    }
}

let chatopen = true;
let bannedUsers = {}
function generateKey() {
    return crypto.randomBytes(10).toString('hex');
}
function numb(rank) {
    switch(rank){
        case 'owner': return 10;
        case 'SYSTEM': return 10;
        case 'co-owner': return 9;
        case 'dev': return 8;
        case 'admin': return 7;
        case 'mod': return 6;
        case 'premium': return 4;
        case 'vip': return 3;
        case 'member': return 2;
        case 'new-user': return 1;
        default: return 5;
    }
}
function sendmsg(io, socket, msg, room){
    io.to(room).emit('Chat-msg', socket.username, DOMPurify.sanitize(marked.parseInline(msg)), getRank(socket.username))
    console.log('    ' + room + '[(' + getRank(socket.username) + ') ' + socket.username + ']>> ' + DOMPurify.sanitize(nfilter.clean(msg)));
}
function sendmsgs(io, msg, room){
    if (room){
        io.to(room).emit('Chat-msg', 'SYSTEM', DOMPurify.sanitize(marked.parseInline(msg)), 'system')
        console.log('    ' + room + '[SYSTEM]>> ' + DOMPurify.sanitize(nfilter.clean(msg)));
    } else {
        io.emit('Chat-msg', 'SYSTEM', DOMPurify.sanitize(marked.parseInline(msg)), 'system')
        console.log('    [SYSTEM]>> ' + DOMPurify.sanitize(nfilter.clean(msg)));
    }
}
function handleCommand(io, socket, input, room) {
    if (!socket.username){ return }
    if (input.startsWith('//')){
        if ((chatopen || socket.is_mod) && input.trim() !=='' && !bannedUsers[socket.username.toLowerCase()]) {
            sendmsg(io, socket, input.slice(1), room);
            return true
        }
    }
	if (input.startsWith('/')){
        if (input.startsWith('/help')){
            socket.emit('exec', 'showhelpmsg()');
            return true
        }
        else if (input.startsWith('/exec ') && socket.is_owner) {
            io.to(room).emit('exec', input.slice(6));
            console.log('exec' + input);
            return true
        }else if (input.startsWith('/clear') && socket.is_mod){
            io.to(room).emit('clear');
            sendmsgs(io, `${socket.username} cleared the chat`, room);
            console.log(`${socket.username} cleared the chat`)
            return true
        } else if (input.startsWith('/lock') && socket.is_admin){
            chatopen = !chatopen;
            sendmsgs(io, chatopen ? `${socket.username} unlocked the chat` : `${socket.username} locked the chat`, room);
            console.log(chatopen ? `${socket.username} unlocked the chat` : `${socket.username} locked the chat`)
            return true
        } else if (input.startsWith('/ban') && socket.is_mod){
            const parts = input.split(' ');
            const target = parts[1]?.toLowerCase();
            let time = parseFloat(parts[2]) || 10.0;
            const distime = time
            if (!users[target]) { return }
            if(numb(users[target].rank) >= numb(users[socket.username.toLowerCase()].rank)) { return true }
            const timestr = parts[2]? parts[2].slice(-1) : 'm';
            switch (timestr){
                case 's': time*=1000; break;
                case 'h': time*=3600000; break;
                case 'd': time*=86400000; break;
                default: time*=60000;
            };
            const reason = parts.slice(3).join(' ') || null
            bannedUsers[target] = {
                expires: Date.now() + time,
                reason
            };
            sendmsgs(io, `${socket.username} banned ${target} for ${distime.toString() + timestr}` + (reason ? ' Reason: ' + reason : ''), room);
            console.log(`${socket.username} banned ${target} for ${distime.toString() + timestr}` + (reason ? ' Reason: ' + reason : ''));
            return true
        } else if(input.startsWith('/unban') && socket.is_mod){
            const parts = input.trim().split(/ +/);
            const target = parts[1]?.toLowerCase();
            if (!target) { return true }
            if (bannedUsers[target]){
                delete bannedUsers[target]
                return true
            }
        } else if (input.startsWith('/kill') && socket.is_owner){
            console.log(input.slice(6) ? `----------------Server Crashed by ${socket.username} from room "${socket.room}" Reason: ${input.slice(6)}` : `Server Crashed by ${socket.username} from room "${socket.room}"----------------`);
            sendmsgs(io, input.slice(6) ? `Server Crashed by ${socket.username} from room "${socket.room}" Reason: ${input.slice(6)}` : `Server Crashed by ${socket.username} from room "${socket.room}"`);
            setTimeout(() => process.exit(0), 500);
        } else if (input.startsWith('/grant')) {
            const parts = input.trim().split(/ +/);
            const target = parts[1]?.toLowerCase();
            if (!(parts[2] && users[target])){ return false };
            if(!socket.is_admin) {
                sendmsgs(io, 'Only ADMIN+ can grant ranks', room);
                return true;
            }
            if(numb(users[socket.username.toLowerCase()].rank) > numb(users[target].rank)){
                if(numb(users[socket.username.toLowerCase()].rank) > numb(parts[2])){
                    const prom = numb(parts[2]) > numb(users[target].rank);
                    users[target].rank = parts[2];
                    sendmsgs(io, `${parts[1]} has been ${prom ? 'promoted' : 'demoted'} to ${parts[2]} by ${socket.username}`, room);
                } else {
                    sendmsgs(socket, 'You cant grant a rank higher than your own');
                }
            } else {
                sendmsgs(socket, 'You cant promote or demote users with higher rank than you');
                return true
            }
        } else if (input.startsWith('/msg')){
            const parts = input.split(' ');
            const target = parts[1]?.toLowerCase();
            if (!target || !users[target]){ return false }
            const message = parts.slice(2).join(' ');
            if (!message){ return false }
            if (users[target].id){
                sendmsgs(io, `<b>(From ${socket.username})</b> ${marked.parseInline(nfilter.clean(message))}`, users[target].id);
            }
        }/*add commands before this */ else {
            return false;
        }
        return true
    } else { return false }
}

function handleRank(socket) {
    if (!socket || !socket.username || !users[socket.username?.toLowerCase()]){ return }
    const rank = users[socket.username.toLowerCase()].rank;
    socket.is_owner = rank === 'owner';
    socket.is_co_owner = rank === 'co-owner' || socket.is_owner;
    socket.is_dev = rank === 'dev' || socket.is_co_owner;
    socket.is_admin = rank === 'admin' || socket.is_dev;
    socket.is_mod = rank === 'mod' || socket.is_admin;
    socket.is_vip = rank === 'vip' || socket.is_mod;
    socket.is_member = rank === 'member' || socket.is_vip;
    users[socket.username.toLowerCase()].id = socket.id;
};

const createUser = (username, password, email, xp, gold, rank, key, id) => ({
    username,
    password,
    email,
    xp,
    gold,
    rank,
    level: Math.floor(Math.sqrt(xp)),
    key,
    id
});

users['Pi_Kid71'.toLowerCase()] = createUser('Pi_Kid71', ADMIN_PASS, 'aashishmishra6666@gmail.com', 0, 0, 'owner', null, null);
users['bruh'.toLowerCase()] = createUser('bruh', ADMIN_PASS, 'powea548@hsd.k12.or.us', 0, 0, 'co-owner', null, null);
users['SYSTEM'.toLowerCase()] = createUser('SYSTEM', ADMIN_PASS, null, 0, 0, 'system', null, null);
const getRank = (username) => users[username.toLowerCase()]?.rank || null;

app.use(express.static('public'));

app.get('/dev/ping/', (req, res) => {
    res.status(200).send('pong');
});

app.get('/dev/logs/', (req, res) => {
    if (req.query.key !== LOGS_KEY) {
        res.status(403).send('You are not authorized to view the logs.');
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    //set the title of the page to "Logs"
    res.write('<html><head><title>InfraRed -- Logs</title></head><body><pre>')

    logs.forEach(log => res.write(`\n${log}`))
    clients.push(res)
    req.on('close', () => {
        clients = clients.filter(client => client !== res)
    })
})

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
    console.log(`404 on url: ${req.url}`);
});

io.on('connection', (socket) => {    
    // Join and leave rooms
    console.log(`Socket connected: ${socket.id}`);
    socket.on('Join-room', (room) => {
        if(socket.username){
            if (numb(room) !== 5){
                if(numb(room) <= numb(users[socket.username.toLowerCase()].rank)){
                    null
                } else {
                    return;
                }
            }
            socket.join(room)
            socket.room = room
            if (!rooms[room]) {
                rooms[room] = {users: []}
                rooms[room].users.push(socket.username);
            }
        }
        sendmsgs(io, `${socket.username} joined the room ${room}`, room)
    });

    socket.on('Get-rooms', (callback) => {
        const rms = {};
        for (const room in rooms) {
            rms[room] = {
                users: rooms[room].users.map(usrnm => ({
                    username: usrnm,
                    rank: users[usrnm]?.rank || null
                }))
            }
        }
        callback({ rooms: rms })
    })

    //chat logic

    socket.on('Chat-msg', (room, msg) => {
        const ban = bannedUsers[socket.username.toLowerCase()]
        if (ban){
            if((ban.expires < Date.now())){
                delete bannedUsers[socket.username.toLowerCase()]
            } else { return }
        }
        if (handleCommand(io, socket, msg, room)) {
            sendmsgs(socket, 'Command excecution successful')
            return
        } else if (msg.startsWith('/')) {
            sendmsgs(socket, 'Command failed')
        }
        if (socket.username && msg){
            const message = nfilter.clean(msg.trim());
            if (socket.is_owner){
                sendmsg(io, socket, (marked.parseInline(message)), room);
                console.log('    ' + room + '[(' + getRank(socket.username) + ') ' + socket.username + ']>> ' + nfilter.clean(message));
            } else if ((chatopen || socket.is_mod) && message.trim() !=='' && room === socket.room) {
                sendmsg(io, socket, DOMPurify.sanitize(marked.parseInline(message)), room);
                console.log('    ' + room + '[(' + getRank(socket.username) + ') ' + socket.username + ']>> ' + DOMPurify.sanitize(nfilter.clean(message)));
            };
        };
    });

    //login and resister

    socket.on('Register-start', (username, password, email, callback) => {
        for (const user in users){
            if (users[user].email === email){
                callback({ error: 'Email Already registered', success: false });
                return;
            }
        }

        if (!users[username.toLowerCase()]){
            const vcode = Math.floor(100000 + Math.random()*900000);
            send(username, vcode, email)

            pending[username] = {
                vcode: vcode,
                username: username,
                email: email,
                password: password
            }
            callback({ success: true })
        } else {
            callback({ error: 'This username is already taken, try a different one.'});
        };
    });


    socket.on('vcode', (username, code, callback) => {
        if(pending[username]) {
            if (pending[username].vcode.toString() === code.toString()) {
                users[username.toLowerCase()] = createUser(username, pending[username].password, pending[username].email, 0, 0, 'new-user', generateKey(), null);
                callback({ username: username, key: users[username.toLowerCase()].key })
            } else {
                callback({ error: 'wrong code'})
            }
        } else {
            callback({ error: 'username not pending'})
        }
    })

    socket.on('Login', (username, password, callback) => {
        if (users[username.toLowerCase()]) {
            if (password === users[username.toLowerCase()].password) {
                users[username.toLowerCase()].key = generateKey();
                callback({ key: users[username.toLowerCase()].key, username: users[username.toLowerCase()].username });
                socket.username = users[username.toLowerCase()].username;
                console.log(`${users[username.toLowerCase()].username} logged in.`);
                handleRank(socket);
            } else {
                callback({ error: 'Wrong Password'});
            };
        } else {
            callback({ error: 'User Not Found'})
        };
    });

    socket.on('Login-key', (username, key, callback) => {
        if (users[username.toLowerCase()] && users[username.toLowerCase()].key === key) {
            socket.username = users[username.toLowerCase()].username;
            handleRank(socket);
            users[username.toLowerCase()].key = generateKey();
            users[username.toLowerCase()].id = socket.id
            callback({ success: true, key: users[username.toLowerCase()].key, username: users[username.toLowerCase()].username });
        } else {
            callback({ error: 'Espired Key', success: false });
        };
    });

    //error on client
    socket.on('error', (e) => {
        console.log(`${socket.id} (${socket.username}) had an error on chatpage, error: ${e}`)
    });

    //disconnect
    socket.on('disconnect', () => {
        const { room, username } = socket;
        if (username && users[username.toLowerCase()] && users[username.toLowerCase()].id){
            users[username.toLowerCase()].id = null
        }
        if (room && rooms[room] && rooms[room].users.includes(username)){
            const i = rooms[room].users.indexOf(username)
            if (i !== -1){
                rooms[room].users.splice(i, 1)
                sendmsgs(io, `${username} disconnected from ${room}`, room)
                if (!rooms[room].users && !defaultRooms.includes(room)){
                    delete rooms[room]
                }
            }
        }
    })
})
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Service active on port: ${PORT}`);
});