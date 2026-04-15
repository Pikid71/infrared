//server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Socket } = require('dgram');
const { log } = require('console');
const { listenerCount } = require('cluster');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ADMIN_PASS = process.env.ADMIN_PASS;

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const users = {};

const createUser = (username, password, xp, gold, rank) => ({
    username,
    password,
    xp,
    gold,
    rank,
    level: Math.floor(Math.sqrt(xp))
});

users['Pi_Kid71'] = createUser('Pi_Kid71', ADMIN_PASS, 100000000, 1000000, 'owner');
users.bruh = createUser('bruh', ADMIN_PASS, 100000000, 1000000, 'co-owner');

app.use(express.static(__dirname));

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login', 'index.html'));
    console.log('New user on Login page');
});


app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
    console.log('404');
});

io.on('connection', (socket) => {
    log(`New connection: ${socket.id}`);

    // Join and leave rooms

    socket.on('Join-room', (room) => {
        socket.join(room);
    });

    socket.on('Leave-room', (room) => {
        socket.leave(room);
    });

    //chat logic

    socket.on('Chat-msg', (room, username, msg) => {
        socket.join(room);
        const message = DOMPurify.sanitize(msg);
        console.log(room + '[' + username + ']>> ' + message);
        if (room) {
            socket.to(room).emit('Chat-msg', username, message);
        } else {
            io.emit('Chat-msg', username, message);
        }
    });
    socket.on('Login-attempt', (username, password) => {
        if (users[username]) {
            if (password === users[username]['password']) {
                socket.emit('Login-succes', username);
                log(`${username} logged in with the password ${password}`);
            } else {
                socket.emit('Login-failed', 'Wrong Password');
            }
        } else {
            socket.emit('Login-failed', 'No Username');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Service active on port: ${PORT}`);
});