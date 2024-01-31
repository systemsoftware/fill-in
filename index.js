const express = require('express');
const dubnium = require('dubnium');
const http = require('http');
const {
    Server
} = require('socket.io');
const {
    openai_key,
    Generate_prompts_from_ChatGPT,
    prompts_file,
    port,
    title
} = require('./config.json')


const makePrompt = async (id) => {
    const prompts = require(prompts_file);
    if (Generate_prompts_from_ChatGPT) {
        const {
            OpenAIApi,
            Configuration: AIConfig
        } = require('openai');

        const ai = new OpenAIApi(new AIConfig({
            apiKey: openai_key
        }))

        const c = await ai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: "Make a fill in the blank prompt"
            }]
        })
        return c.data.choices[0].message.content.split('\n').join('')
    } else {
        if (data.get(id)?.content?.prompts?.length) {
            prompts.push(...data.get(id).content.prompts)
        }
        return `${prompts[Math.floor(Math.random() * prompts.length)]}.`
    }
}


const app = express();
const server = http.createServer(app);
const io = new Server(server);
const data = new dubnium('./data');
data.wipe();

function getCookie(req, name) {
    const cookies = req?.headers?.cookie?.split(';') || [];
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + "=")) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }
    return null;
}

app.get('/title', (req, res) => { res.send(title) })


app.use((req, res, next) => {
    const path = req.path.split('/').join('');
    if (!getCookie(req, 'id')) res.cookie('id', Math.random().toString(36).substring(2, 20))
    if (path == 'username' || path == 'css') return next();
    if (req?.headers?.cookie?.includes("user")) {
        next()
    } else {
        res.sendFile(__dirname + '/username.html');
    }
})

app.use(express.static('static'));

app.get('/check/:id', (req, res) => {
    res.send({
        exists: data.has(req.params.id)
    });
})

app.get('/game/:id', (req, res) => {
    if (!data.has(req.params.id)) return res.redirect('/');
    res.sendFile(__dirname + '/game.html');
})

app.get('/css', (req, res) => {
    res.sendFile(`${__dirname}/style.css`);
})

app.get('/join/random', (req, res) => {
    const games = data.getAll(2).filter(g => g.tag != 'dubniumconfig' && g.content.private != true)
    const game = games[Math.floor(Math.random() * games.length)];
    if (!game) return res.redirect('/join');
    res.redirect(`/game/${game.tag}`);
})

io.on('connection', (socket) => {
    socket.on("join", (d) => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        if (!game) return socket.disconnect();
        const gamedata = data.get(id);
        const player = gamedata?.content?.players.find(p => p.id == getCookie(socket.request, 'id'));
        if (!player) {
            gamedata?.content?.players?.push({
                id: getCookie(socket.request, 'id'),
                name: getCookie(socket.request, 'user'),
                score: 0
            });
            data.get(id).overwrite(gamedata);
        }
        socket.to(id).emit('new_player', getCookie(socket.request, 'id'))
        socket.join(id);
    })

    socket.on('disconnect', () => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        if (!game) return
        game.content.players = game.content.players.filter(p => p.id != getCookie(socket.request, 'id'));
        data.get(id).overwrite(game.content);
        socket.leave(id);
        socket.to(id).emit('new_player', getCookie(socket.request, 'id'))
        if (game.content.players.length <= 0) {
            data.get(id).delete();
        }
    });

    socket.on('get_results', () => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        socket.emit('results', {
            prompt: game.content.prompt,
            results: game.content.players.map(p => {
                return {
                    name: p.name,
                    answer: p.answer,
                    id: p.id
                }
            })
        });
    })

    socket.on("start_game", () => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const user = getCookie(socket.request, 'id')
        const game = data.get(id)
        if (game.content.players.find(e => e.id == user)?.creator || !game.content.players.find(e => e.creator)) {
            game.content.state = 'playing'
            data.get(id).overwrite(game.content)
            socket.to(id).emit("start")
            socket.emit("start")
        } else {}
    })

    socket.on("answer", async (a = '') => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        if (!game) return socket.disconnect();
        a = a.includes('/') ? a : `${a.substring(0,1).toUpperCase()}${a.substring(1,a.length)}${a.endsWith('.') ? '' : '.'}`;
                if(!game.content.players.find(p => p.id == getCookie(socket.request, 'id'))) {
            game.content.players[getCookie(socket.request, 'id')] = {
                id: getCookie(socket.request, 'id'),
                name: getCookie(socket.request, 'user'),
                score: 0
            }
        }
        game.content.players.find(p => p.id == getCookie(socket.request, 'id'))?.answer = a;
        data.get(id).overwrite(game.content);
        if (game.content.players.filter(p => p.answer).length == game.content.players.length) {
            game.content.state = "results";
            data.get(id).overwrite(game.content);
            io.to(id).emit("results", {
                prompt: game.content.prompt,
                results: game.content.players.map(p => {
                    return {
                        name: p.name,
                        answer: p.answer,
                        id: p.id
                    }
                })
            });
        }
    })



    socket.on("vote", async (a) => {
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        if (!game) return socket.disconnect();
        game.content.players.find(p => p.id == getCookie(socket.request, 'id')).vote = a;
        data.get(id).overwrite(game.content);
        if (game.content.players.filter(p => p.vote).length == game.content.players.length) {
            let winner = ''
            const votes = game.content.players.map(p => p.vote);
            const modeMap = {};
            let maxEl = votes[0],
                maxCount = 1;
            for (let i = 0; i < votes.length; i++) {
                const el = votes[i];
                if (modeMap[el] == null)
                    modeMap[el] = 1;
                else
                    modeMap[el]++;
                if (modeMap[el] > maxCount) {
                    maxEl = el;
                    maxCount = modeMap[el];
                }
            }
            winner = maxEl;
            const w = game.content.players.find(p => p.id == winner)
            if (!w) socket.emit('end', {
                winner: 'Nobody',
                new_prompt: game.content.prompt,
                votes: 0,
                answer: 'n/a'
            })
            const w_a = w.answer
            game.content.state = 'playing'
            game.content.prompt = await makePrompt(id);
            game.content.last_winner = winner;
            game.content.players.forEach(p => {
                p.answer = '';
                p.vote = '';
                if (p.id == winner) p.score++;
            })
            io.to(id).emit("end", {
                winner: w.name || w.id,
                new_prompt: game.content.prompt,
                votes: maxCount,
                answer: w_a
            });
            data.get(id).overwrite(game.content);
        }
    })

    app.get('/prompt/random', async (req, res) => {
        res.send({
            prompt: await makePrompt()
        })
    })

    app.get('/game/:id/json', (req, res) => {
        const id = req.params.id;
        const game = data.get(id);
        if (!game) return res.send({
            error: "Game doesn't exist"
        });
        game.content.canStart = game.content.players.find(e => e.id == getCookie(req, 'id'))?.creator || !game.content.players.find(e => e.creator)
        res.send(game.content);
    })

    socket.on("create", async (_data) => {
        const id = Math.random().toString(36).split(/[0-9]/).join('').substring(2, 8)
        socket.rooms.add(id)
        data.create(id, {
            "players": [{
                id: getCookie(socket.request, 'id'),
                name: getCookie(socket.request, 'user'),
                score: 0,
                creator: true
            }],
            "state": "waiting",
            "private": _data.private,
            "prompt": await makePrompt()
        })
        await socket.join(id)
        socket.emit("created", {
            id
        })
    })

    socket.on('add_custom', async (p) => {
        p = p.substring(0, 1).toUpperCase() + p.substring(1, p.length) + (p.endsWith('.') ? '' : '.');
        const id = socket.handshake.headers.referer.split('/').pop();
        const game = data.get(id);
        if (!game) return socket.disconnect();
        if (!game.content.prompts) game.content.prompts = []
        if (game.content.prompts.find(e => e == p)) return socket.emit('message', 'Prompt already exists')
        game.content.prompts.push(p)
        data.get(id).overwrite(game.content);
        socket.emit('message', 'Prompt added')
    })
});

server.listen(port, () => {
    console.log(`listening on *:${port}`);
})
