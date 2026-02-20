const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ゲームの状態管理
let players = {}; // { "山田": 10, "佐藤": 15 } のようにスコアを記録
let answers = { A: [], B: [], C: [], D: [] };
let answeredUsers = new Set();
let settings = { basePoints: 10, bonusPoints: 5, bonusCount: 1 };

io.on('connection', (socket) => {
    // 生徒が参加した時
    socket.on('join_game', (name) => {
        if (!players[name]) Object.assign(players, { [name]: 0 }); // 新規参加なら0点
        io.emit('update_lobby', Object.keys(players)); // 教員の準備画面を更新
        socket.emit('sync_score', players[name]);      // 生徒に現在のスコアを送信
    });

    // 教員が設定を保存してスタートした時
    socket.on('update_settings', (newSettings) => {
        settings = newSettings;
    });

    // 生徒が回答を送信した時
    socket.on('submit_answer', (data) => {
        if (!answeredUsers.has(data.name)) {
            answeredUsers.add(data.name);
            answers[data.choice].push(data.name);
            io.emit('update_answers_teacher', answers);
        }
    });

    // 教員が正解を発表し、得点を加算する時
    socket.on('judge_answer', (correctChoice) => {
        let correctNames = answers[correctChoice] || [];
        correctNames.forEach((name, index) => {
            let points = Number(settings.basePoints);
            // 指定人数以内ならボーナス点追加
            if (index < Number(settings.bonusCount)) {
                points += Number(settings.bonusPoints);
            }
            if(players[name] !== undefined) {
                players[name] += points;
            }
        });
        io.emit('sync_scores_all', players); // 全員のスコアを更新
        io.emit('update_ranking', getRanking()); // 最新のランキングを教員へ
    });

    // 次の問題・リセット
    socket.on('reset_question', () => {
        answers = { A: [], B: [], C: [], D: [] };
        answeredUsers.clear();
        io.emit('update_answers_teacher', answers);
        io.emit('clear_student');
    });
});

// ランキングを作成する関数
function getRanking() {
    return Object.entries(players)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score); // スコア順に並び替え
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
