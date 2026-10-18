// path: /server.js

require('dotenv').config({ quiet: true });
const LOGS_KEY = process.env.LOGS_KEY;
const PORT = process.env.PORT;
const DB_NAME = process.env.DB_NAME || 'database_eXHMlvTLlf613u9TAAAB';
const aikey = process.env.OPENROUTER_API_KEY;
const dsc_url_main = process.env.DISCORD_WEBHOOK_MAIN;
const dsc_url_sys = process.env.DISCORD_WEBHOOK_SYS;
const dsc_url_logs = process.env.DISCORD_WEBHOOK_LOGS;

const oglog = console.log;
let logs = []
let clients = []
console.log = function (...args){
    const time = new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles'
    }) + '    '
    const logg = `${time}    ${args.map(arg => {
        if(typeof arg === 'object' && arg !== null){
            return JSON.stringify(arg, null, 2)
        }
        return String(arg)
    }).join(' ')

}`
    logs.push(logg)
    clients.forEach(client => client.write(`\n ${logg}`))
    oglog(logg)
    fetch(dsc_url_logs, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: 'Infrared Logs',
            content: logg
        })
    })
}

console.log('<@&1546740919917613157>, the server was started')

const bcrypt = require('bcrypt');

const crypto = require('crypto');

const path = require('path');

const marked = require('marked');

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const nfilter = require('./filter');
const { send } = require('./sendemail');

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const { MongoClient } = require('mongodb');
const mgclient = new MongoClient(process.env.MONGODB_URI);

const cookieparser = require('cookie-parser')

const { OpenRouter } = require('@openrouter/sdk')

const openrouter = new OpenRouter({
    apiKey: aikey,
    appTitle: 'Infrared'
});

const defaultrooms = ['main', 'vip', 'mod', 'admin'];

const rooms = {
    'main': {
        users: []
    },
    'vip': {
        users: []
    },
    'mod': {
        users: []
    },
    'admin': {
        users: []
    }
}

let typingusers = {};

try{
    async function cn() {
        await mgclient.connect()
        console.log('Connected to MongoDB')
    }
    cn()
    const database = mgclient.db(DB_NAME)
    const users = database.collection('users')
    const pendingusers = database.collection('pendingusers')
    const bannedusers = database.collection('banned')

    async function getRank(user){
        const usre = await users.findOne({ rl_username: user?.toLowerCase() })
        return usre.rank
    }
    let chatopen = true;
    function generateKey() {
        return crypto.randomBytes(10).toString('hex');
    }

    function clean_msg(msg) {
        return marked.parse(nfilter.clean(DOMPurify.sanitize(msg))).trim()
    }

    function numb(rank) {
        switch(rank.toLowerCase()){
            case 'owner': return 11;
            case 'system': return 11;
            case 'co-owner': return 10;
            case 'dev': return 9;
            case 'admin': return 8;
            case 'mod': return 7;
            case 'jr mod': return 6;
            case 'premium': return 4;
            case 'vip': return 3;
            case 'member': return 2;
            case 'new-user': return 1;
            default: return 5;
        }
    }
    async function sendmsg(io, socket, msg){
        io.to(socket.room).emit('Chat-msg', `${socket.username}`, clean_msg(msg), await getRank(socket.username), socket.user?.xp || 0);
        console.log('    ' + socket.room + '[(' + await getRank(socket.username) + ') ' + socket.username + ']>> ' + clean_msg(msg));
        await fetch(dsc_url_main, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: `[${socket.user.rank.toUpperCase()}][Level ${socket.user?.xp || 0}] ${socket.username}`,
                content: clean_msg(msg)
            })
        })
    }
    async function sendmsgs(io, msg, room){
        const iduser = await users.findOne({ id: room })
        if (room){
            io.to(room).emit('Chat-msg', 'SYSTEM', clean_msg(msg), 'system')
            if (iduser) {
                console.log('    ' + iduser.username + '[SYSTEM]>> ' + clean_msg(msg))
            } else {
                console.log('    ' + room + '[SYSTEM]>> ' + clean_msg(msg));
            }
        } else {
            io.emit('Chat-msg', 'SYSTEM', clean_msg(msg), 'system')
            console.log('    [SYSTEM]>> ' + clean_msg(msg));
        }
        await fetch(dsc_url_sys, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'System',
                content: `(${(iduser?.username || room || 'all rooms')}) ${clean_msg(msg)}`
            })
        })
    }
    async function handleCommand(io, socket, input, room) {
        if (!socket.username){ return }
        socket.user = await users.findOne({ rl_username: socket.username.toLowerCase() });
        if (!socket.user) { return }
        let ban = await bannedusers.findOne({ rl_username: socket.user.username.toLowerCase() })
        if (ban && ban.expires < new Date()){
            await bannedusers.deleteOne({ rl_username: socket.user.rl_username })
            ban = null
        }
        if (input.startsWith('//')){
            if ((chatopen || socket.user.is_mod) && !ban) {
                sendmsg(io, socket, input.slice(1));
                return true
            }
        }
        if (input.startsWith('/')){
            if (input.startsWith('/help')){
                socket.emit('exec', 'showhelpmsg()');
                console.log(5)
                return true
            } else if (input.startsWith('/exec ') && socket.user.is_owner) {
                io.to(room).emit('exec', input.slice(6));
                console.log('exec' + input);
                return true
            } else if (input.startsWith('/clear') && socket.user.is_mod){
                io.to(room).emit('clear');
                sendmsgs(io, `${socket.username} cleared the chat`, room);
                console.log(`${socket.username} cleared the chat`)
                return true
            } else if (input.startsWith('/lock') && socket.user.is_admin){
                chatopen = !chatopen;
                sendmsgs(io, chatopen ? `${socket.username} unlocked the chat` : `${socket.username} locked the chat`, room);
                console.log(chatopen ? `${socket.username} unlocked the chat` : `${socket.username} locked the chat`)
                return true
            } else if (input.startsWith('/ban') && socket.user.is_mod){
                const parts = input.split(' ');
                const target = parts[1]?.toLowerCase();
                const targetuser = await users.findOne({ rl_username: target })
                if (!targetuser) {
                    sendmsgs(socket, 'Usage: /ban <username> <time> <reason>');
                    return true
                }
                socket.user = await users.findOne({ rl_username: socket.username.toLowerCase() })
                let time = parseFloat(parts[2]) || 10.0;
                const distime = time
                if(numb(targetuser.rank) >= numb(socket.user.rank)) {
                    sendmsgs(socket, 'You cannot ban a user with equal or higher rank than you');
                    return true
                }
                const timestr = parts[2]? parts[2].slice(-1) : 'm';
                switch (timestr){
                    case 's': time*=1000; break;
                    case 'h': time*=3600000; break;
                    case 'd': time*=86400000; break;
                    default: time*=60000;
                };
                const reason = parts.slice(3).join(' ') || 'no reason'
                await bannedusers.insertOne({
                    rl_username: targetuser.rl_username,
                    expires: new Date() + time,
                    reason: reason
                })
                sendmsgs(io, `${socket.username} banned ${target} for ${distime.toString() + timestr}` + (reason ? ' Reason: ' + reason : ''), room);
                return true
            } else if(input.startsWith('/unban') && socket.user.is_mod){
                const parts = input.trim().split(/ +/);
                const target = parts[1]?.toLowerCase();
                const ban = await bannedusers.findOne({ rl_username: target })
                if (!target) { 
                    sendmsgs(socket, 'Usage: /unban <username>');
                    return true
                }
                if (ban){
                    await bannedusers.deleteOne({ rl_username: target })
                    sendmsgs(io, `${socket.username} unbanned ${target}`, room);
                    return true
                } else {
                    sendmsgs(socket, `${target} is not banned`);
                    return true
                }
            } else if (input.startsWith('/kill') && socket.user.is_owner){
                console.log(input.slice(6) ? `    Server Crashed by ${socket.username} from room "${socket.room}" Reason: ${input.slice(6)}` : `Server Crashed by ${socket.username} from room "${socket.room}"----------------`);
                sendmsgs(io, input.slice(6) ? `Server Crashed by ${socket.username} from room "${socket.room}" Reason: ${input.slice(6)}` : `Server Crashed by ${socket.username} from room "${socket.room}"`);
                setTimeout(() => process.exit(0), 500);
            } else if (input.startsWith('/grant')) {
                const parts = input.trim().split(/ +/);
                const target = parts[1]?.toLowerCase();
                let user = socket.user;
                const targetuser = await users.findOne({ rl_username: target })
                if (!(parts[2] && targetuser)){
                    sendmsgs(socket, 'Usage: /grant <username> <rank>');
                    return true;
                }
                const rank = parts[2];
                const is_vip = rank === 'vip';
                const is_premium = rank === 'premium';
                const is_mod = rank === 'mod';
                const is_admin = rank === 'admin';
                const is_dev = rank === 'dev';
                const is_co_owner = rank === 'co-owner';
                const is_owner = rank === 'owner';

                if(!socket.user.is_admin) {
                    sendmsgs(socket, 'Only ADMIN+ can grant ranks');
                    return true;
                }
                if(numb(socket.user.rank) > numb(targetuser.rank)){
                    if(numb(socket.user.rank) > numb(rank)){
                        const prom = numb(rank) > numb(targetuser.rank);
                        await users.updateOne({ rl_username: targetuser.rl_username }, { $set: { rank: parts[2], is_vip: is_vip, is_premium: is_premium, is_admin: is_admin, is_mod: is_mod, is_dev: is_dev, is_co_owner: is_co_owner, is_owner: is_owner } })
                        sendmsgs(io, `${parts[1]} has been ${prom ? 'promoted' : 'demoted'} to ${parts[2]} by ${socket.username}`, room);
                    } else {
                        sendmsgs(socket, 'You cant grant a rank higher than or equal to your own');
                    }
                } else {
                    sendmsgs(socket, 'You cant promote or demote users with higher rank than you');
                    return true
                }
            } else if (input.startsWith('/msg')){
                const parts = input.split(' ');
                const target = parts[1]?.toLowerCase();
                const targetuser = await users.findOne({ rl_username: target })
                if (!target || !targetuser){
                    sendmsgs(socket, 'User not found for /msg');
                    return false }
                const message = parts.slice(2).join(' ');
                if (!message){
                    sendmsgs(socket, 'No message provided for /msg');
                    return false }
                if (targetuser.id){
                    sendmsgs(io, `<b>(From ${socket.username})</b> ${marked.parse(nfilter.clean(message))}`, targetuser.id);
                    sendmsgs(socket, `<b>(To ${targetuser.username})</b> ${marked.parse(nfilter.clean(message))}`);
                    return true
                }
            } else if(input.startsWith('/ai ')){
                if (socket.user.is_premium){
                    await ask_ai(io, socket, input.slice(4))
                    return true
                } else {
                    sendmsgs(socket, 'Purchase of the premium rank is required to use ai features')
                    return false
                }
            } else if (input.startsWith('/say ')){
                const message = input.slice(5);
                if (!message || !socket.user.is_admin){ return false }
                sendmsgs(io, clean_msg(message), socket.room);
                return true;
            } else if (input.startsWith('/users')){
                if (!socket.user){ return false }
                const room = input.split(' ')[1] || socket.room;
                if (!room || !rooms[room]){ return false }
                sendmsgs(socket, `Users in ${room}:<br><ul><li>${rooms[room].users.join('</li><li>')}</li></ul>`);
                return true;
            } else if ((input.startsWith('/reload') || input.startsWith('/r')) && socket.user.is_admin){
                sendmsgs(io, `${socket.username} will reload the page`, socket.room);
                console.log(`${socket.username} will reload the page`)
                await new Promise(resolve => setTimeout(resolve, 1000));
                io.emit('exec', 'reload()');
                return true;
            }
            /*add commands before this */ else {
                return false;
            }
        } else { return false }
    }

    async function handleRank(socket) {
        let user = socket.user
        if (!socket || !socket.username || !user){ return }
        const rank = await getRank(socket.username)
        socket.rank = rank
        socket.user = user;
        await users.findOneAndUpdate({ rl_username: socket.username.toLowerCase() }, { $set: { id: socket.id } })
    };

    async function register_start(socket, usrnm, password, email, callback){
        const username = usrnm.replace(/[^\w\-]/g, '')
        if (!username || !password || !email){
            if (callback){
                callback({ error: 'Enter all values to proceed'});
            }
            return;
        } else if (await users.findOne({ rl_username: username})){
            callback({ error: 'Username already exists'});
            return;
        } else if (await users.findOne({ email: email})){
            callback({ error: 'User with that email already exists'});
            return;
        }
        const pass_hash = await bcrypt.hash(password, 10);
        const vcode = crypto.randomInt(100000, 1000000)
        await pendingusers.deleteMany({ rl_username: username?.toLowerCase() })
        await pendingusers.insertOne({
            username,
            pass_hash,
            email,
            vcode,
            rl_username: username?.toLowerCase()
        })
        setTimeout(async () => {
            await pendingusers.deleteOne({ rl_username: username?.toLowerCase() })
        }, 60000)
        const err = await send(username, vcode, email)
        if (err) {
            callback({ error: err.text })
            return
        }
        callback({ success: true })
    }

    async function vcode(socket, usrnm, code, callback) {
        const username = usrnm?.replace(/[^\w\-]/g, '')
        const pend_user = await pendingusers.findOne({ rl_username: username?.toLowerCase() })
        if(!pend_user){
            callback({ error: 'Username not pending. Your code may be expired'})
            return
        }
        if (code.toString() !== pend_user.vcode.toString()){
            callback({ error: 'Wrong code'})
            return
        }
        await users.insertOne({
            username,
            rl_username: username?.toLowerCase(),
            email: pend_user.email,
            xp: 0,
            gold: 0,
            rank: 'new-user',
            is_member: false,
            is_vip: false,
            is_premium: false,
            is_mod: false,
            is_admin: false,
            is_dev: false,
            is_co_owner: false,
            is_owner: false,
            key: generateKey(),
            id: null,
            pass_hash: pend_user.pass_hash
        })
        await pendingusers.deleteOne({ rl_username: username?.toLowerCase() })
        socket.user = await users.findOne({ rl_username: username?.toLowerCase() })
        callback({ username: username, key: socket.user.key })
    }
    async function login(socket, username, password, callback) {
        socket.user = await users.findOne({ rl_username: username?.toLowerCase() })
        if(!socket.user){
            callback({ error: 'User not found'})
            return
        }
        if(!await bcrypt.compare(password, socket.user.pass_hash)){
            callback({ error: 'Incorrect password'})
            return
        }
        const key = generateKey()
        await users.updateOne({ rl_username: username?.toLowerCase() }, {$set: { key: key } })
        socket.user = await users.findOne({ rl_username: username?.toLowerCase() })
        callback({ username: socket.user.username, key: socket.user.key })
        return
    }
    async function login_key(username, key, callback, socket) {
        socket.user = await users.findOne({ rl_username: username?.toLowerCase()})
        if(!socket.user){
            callback({ error: 'User not found' })
            return
        }
        if(socket.user.key === key){
            const genkey = generateKey()
            await users.updateOne({ rl_username: username.toLowerCase() }, { $set: { key: genkey }})
            callback({ success: true, key: genkey, username: username })
            socket.username = username
            await handleRank(socket)
            return
        } else {
            callback({ error: 'Expired key'})
        }
    }
    async function join_room(io, socket, room) {
        if(socket.username){
            socket.user = await users.findOne({ rl_username: socket.username.toLowerCase() })
            if (defaultrooms.includes(room)){
                if(numb(socket.user.rank) < numb(room)){
                    socket.join('main')
                    socket.room = 'main'
                    sendmsgs(io, `${socket.username} joined the room ${room}`, socket.room)
                    sendmsgs(socket, 'You cannot join a room with higher rank than your own. You have been joined to the main room')
                    rooms['main'].users.push(socket.username)
                    return
                }
            }
            socket.join(room);
            socket.room = room
            sendmsgs(io, `${socket.username} joined the room ${room}`, socket.room)
            rooms[room].users.push(socket.username)
        }
    };
    async function chat_msg(io, socket, msg) {
        if(!socket || !io || !socket.username){
            return
        }
        if(!msg || !socket.room){
            sendmsgs(socket, '<span style="color: black; background: linear-gradient(135deg, red, pink); padding: 4px; border-radius: 4px;">Warinng:</span> Provide both the message and room')
            return
        }
        const cmd = await handleCommand(io, socket, msg, socket.room)
        if (cmd) {
            return
        } else if (!cmd && msg.startsWith('/')) {
            sendmsgs(socket, 'Invalid command: ' + msg)
            return
        }
        const ban = await bannedusers.findOne({ rl_username: socket.username.toLowerCase() })
        if(ban){
            if(ban.expires < new Date()){
                await bannedusers.deleteOne({ rl_username: socket.username.toLowerCase() })
            } else {
                sendmsgs(socket, 'You cannot send messages when you are banned')
                return
            }
        } 
        sendmsg(io, socket, msg)
        await users.updateOne({ rl_username: socket.username.toLowerCase() }, { $inc: { xp: 5 } })
        let user = await users.findOne({ rl_username: socket.username.toLowerCase() })
        socket.user = user;
        if (!socket.user?.is_member && socket.user?.xp >= 10){
            await users.updateOne({ rl_username: socket.username.toLowerCase() }, { $set: { is_member: true, rank: 'member' } })
        }
    }
    async function ask_ai(io, socket, msg) {
        try {
            sendmsgs(socket, 'Thinking... This may take a few seconds.')
            sendmsgs(io, `${socket.username} asked AI: ${msg}`, socket.room)
            const result = await openrouter.chat.send({
                chatRequest: {
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant within the infrared chat application. You will answer the user\'s questions and provide information as accurately as possible. If you do not know the answer, you will say "I don\'t know". If you are unsure, you will ask for clarification. Do not make assumptions.' },
                        { role: 'user', content: msg }
                    ],
                    model: 'openrouter/free'
                }
            })
            console.log(result.choices[0].message.content)
            sendmsgs(io, result.choices[0].message.content, socket.room)
        } catch (error) {
            console.log(error)
        }
    }

    setInterval(async () => {
        typingusers = {};
        io.emit('typping', typingusers)
    }, 5000)

    app.use(express.static('public'));
    app.use(cookieparser());

    app.get('/dev/ping/', (req, res) => {
        res.status(200).send('pong');
    });

    app.get('/r/:refid', (req, res) => {
        const refid = req.params.refid;
        const isbot = (req.headers['user-agent'] || '').toLowerCase().includes('bot');
        if (!isbot) {
            console.log(`Refrence from ${refid}`);
        }
        res.redirect('/');
    })

    app.get('/dev/logs/', async (req, res) => {
        const key = req.cookies?.key || ''
        let user = await users.findOne({ key: key });
        if (req.query.key !== LOGS_KEY || !user?.is_owner) {
            res.status(403).send('You are not authorized to view the logs.');
            return;
        }
        console.log(`Logs viewed successfully by ${user.username}`);
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        logs.forEach(log => res.write(`\n${log}`))
        clients.push(res)
        req.on('close', () => {
            console.log(`Log disconnected for: ${user.username}`);
            clients = clients.filter(client => client !== res)
        })
    })

    app.use((req, res) => {
        const isbot = (req.headers['user-agent'] || '').toLowerCase().includes('bot');
        if (!isbot) {
            console.log(`404 on url: ${req.url}`);
        }
        res.status(404).sendFile(path.join(__dirname, '404.html'));
    });
    io.on('connection', (socket) => {

        //register and login

        socket.on('Register-start', (username, password, email, callback) => {
            register_start(socket, username, password, email, callback)
            return
        });
        socket.on('vcode', (username, code, callback) => {
            vcode(socket, username, code, callback, socket)
            return
        })
    
        socket.on('Login', (username, password, callback) => {
            login(socket, username, password, callback)
            return
        });
        socket.on('Login-key', (username, key, callback) => {
            login_key(username, key, callback, socket)
            socket.username = username
            if ((socket.handshake.headers.referer || '').includes('chat')){
                socket.room = socket.handshake.query.r || 'main';
                join_room(io, socket, socket.room)
            }
            return
        });

        socket.on('get-rooms', (callback) => {
            callback({ rooms: rooms })
        });

        socket.on('typing', (istyping) => {
            if (!socket.username || !socket.room) return;
            if (istyping) {
                typingusers[socket.username] = true
            } else {
                delete typingusers[socket.username]
            }
            io.emit('typping', typingusers)
        });

        socket.on('Chat-msg', (msg) =>{
            chat_msg(io, socket, msg)
        });

        socket.on('disconnect', async () => {
            if(socket.room) {
                sendmsgs(io, `${socket.username} left the room.`, socket.room);
            }
            if (rooms[socket.room]) {
                const index = rooms[socket.room].users.indexOf(socket.username);
                if (index !== -1) {
                    rooms[socket.room].users.splice(index, 1);
                }
            }
            if (socket.username) {
                await users.updateOne({ rl_username: socket.username?.toLowerCase() }, { $set: { id: null } });
            }
        });
    });
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Service active on port: ${PORT}`);
    });
} catch(error) {
    console.log(error);
    mgclient.close();
}