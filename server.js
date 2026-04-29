//server.js
const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { log } = require('console');
const marked = require('marked');
const PORT = 8000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ADMIN_PASS = process.env.ADMIN_PASS;
const nfilter = require('./filter');

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const users = {};
let rooms = {
    'main':{
        users: []
    }
}
let chatopen = true;
let bannedUsers = {}
function generateKey() {
    return crypto.randomBytes(10).toString('hex');
}

function handleCommand(io, socket, input, room) {
	if (input.startsWith('/')){
        if (input.startsWith('/exec ') && socket.is_owner) {
            io.to(room).emit('exec', input.slice(6));
            log(`exec ${input}`);
        };
        if (input.startsWith('/lock ')){
            chatopen = !chatopen;
            io.to(room).emit('Chat-msg', 'SYSTEM', chatopen ? `${username} unlocked the chat` : `${username} locked the chat`, 'system');
            log(chatopen ? `${username} unlocked the chat` : `${username} locked the chat`)
        };
        return true
    } else { return false }
}

function handleRank(socket) {
    const rank = users[socket.username].rank;
    socket.is_owner = rank === 'owner';
    socket.is_co_owner = rank === 'co-owner' || socket.is_owner;
    socket.is_dev = rank === 'dev' || socket.is_co_owner;
    socket.is_admin = rank === 'admin' || socket.is_dev;
    socket.is_mod = rank === 'mod' || socket.is_admin;
    socket.is_vip = rank === 'vip' || socket.is_mod;
    socket.is_member = rank === 'member' || socket.is_vip;
};

const createUser = (username, password, xp, gold, rank, key) => ({
    username,
    password,
    xp,
    gold,
    rank,
    level: Math.floor(Math.sqrt(xp)),
    key
});

users['Pi_Kid71'] = createUser('Pi_Kid71', ADMIN_PASS, 100000000, 1000000, 'owner', null);
users.bruh = createUser('bruh', ADMIN_PASS, 100000000, 1000000, 'co-owner', null);

const getRank = (username) => users[username].rank || null;

app.use(express.static('public'));

app.get('/dev/ping/', (req, res) => {
    res.status(200).send('pong');
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
    console.log(`404 on url: ${req.url}`);
});

io.on('connection', (socket) => {
    log(`New connection: ${socket.id}`);

    // Join and leave rooms

    socket.on('Join-room', (room) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = {users: []};
        };
        rooms[room].users.push(socket.username);
    });

    //chat logic

    socket.on('Chat-msg', (room, username, msg) => {
        if (handleCommand(io,socket, msg, username, room)){return}
        if (username === socket.username && msg){
            const message = marked.parseInline(msg);
            if (users[username].rank === 'owner'){
                io.to(room).emit('Chat-msg', username, (nfilter.clean(message)), getRank(username));
                console.log(room + '[(' + getRank(username) + ') ' + username + ']>> ' + nfilter.clean(message));
            } else if (chatopen) {
                io.to(room).emit('Chat-msg', username, DOMPurify.sanitize(nfilter.clean(message)), getRank(username));
                console.log(room + '[(' + getRank(username) + ') ' + username + ']>> ' + DOMPurify.sanitize(nfilter.clean(message)));
            };
        };
    });

    //login and resister

    socket.on('Register', (username, password, callback) => {
        if (!users[username]){
            users[username] = createUser(username, password, 0, 0, 'New-user', generateKey());
            callback({ username: users[username].username, key: users[username].key });
            log(`${users[username].username} registered with key ${users[username].key}`);
            socket.username = users[username].username;
        } else {
            callback({ error: 'User already exists'});
        };
    });

    socket.on('Login', (username, password, callback) => {
        if (users[username]) {
            if (password === users[username].password) {
                users[username].key = generateKey();
                callback({ key: users[username].key, username: users[username].username });
                socket.username = users[username].username;
                log(`${users[username].username} logged in with key ${users[username].key}`);
            } else {
                callback({ error: 'Wrong Password'});
            };
        } else {
            callback({ error: 'User Not Found'})
        };
    });

    socket.on('Login-key', (key, username, callback) => {
        if (users[username] && users[username].key === key) {
            socket.username = users[username].username;
            users[username].key = generateKey();
            callback({ succes: true, key: users[username].key, username: users[username].username });
        } else {
            callback({ error: 'Espired Key', succes: false });
        };
    });


    //get user info
    socket.on('Get-rank', (username, callback) => {
        if (users[username]) {
            callback({ rank: getRank(username) });
        } else {
            callback({ error: 'User Not Found' });
        }
    });

    //disconnect
    socket.on('disconnect', (reason) => {
        log(`${socket.username} disconnected because of ${reason}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Service active on port: ${PORT}`);
});

