const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {}; 
let answers = { A: [], B: [], C: [], D: [] };
let answeredUsers = new Set();
let settings = { basePoints: 10, bonusPoints: 5, bonusCount: 1 };

io.on('connection', (socket) => {
    socket.on('join_game', (name) => {
        if (!players[name]) Object.assign(players, { [name]: 0 }); 
        io.emit('update_lobby', Object.keys(players)); 
        socket.emit('sync_score', players[name]);      
    });

    socket.on('update_settings', (newSettings) => {
        settings = newSettings;
    });

    socket.on('submit_answer', (data) => {
        if (!answeredUsers.has(data.name)) {
            answeredUsers.add(data.name);
            answers[data.choice].push(data.name);
            io.emit('update_answers_teacher', answers);
        }
    });

    // ▼変更点：点数を問題ごとに計算し、正解を生徒に発表する
    socket.on('judge_answer', (data) => {
        const correctChoice = data.choice;
        const currentSettings = data.currentSettings;

        let correctNames = answers[correctChoice] || [];
        correctNames.forEach((name, index) => {
            let points = Number(currentSettings.basePoints);
            if (index < Number(currentSettings.bonusCount)) {
                points += Number(currentSettings.bonusPoints);
            }
            if(players[name] !== undefined) {
                players[name] += points;
            }
        });
        io.emit('sync_scores_all', players); 
        io.emit('update_ranking', getRanking()); 
        
        // 生徒全員に「正解はこれだよ！」と送信
        io.emit('result_announced', correctChoice);
    });

    socket.on('reset_question', () => {
        answers = { A: [], B: [], C: [], D: [] };
        answeredUsers.clear();
        io.emit('update_answers_teacher', answers);
        io.emit('clear_student');
    });
});

function getRanking() {
    return Object.entries(players)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
