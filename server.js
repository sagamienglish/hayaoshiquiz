const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// publicフォルダの中身を公開する
app.use(express.static('public'));

// 回答データを保存する変数
let answers = { A: [], B: [], C: [], D: [] };
let answeredUsers = new Set(); // 1人1回しか答えられないようにする管理用

io.on('connection', (socket) => {
    // 生徒が回答ボタンを押したときの処理
    socket.on('submit_answer', (data) => {
        // まだ答えていない生徒の場合のみ受け付ける
        if (!answeredUsers.has(data.name)) {
            answeredUsers.add(data.name);
            answers[data.choice].push(data.name); // 選択肢の配列に名前を追加
            io.emit('update_teacher', answers);   // 教員画面を更新
        }
    });

    // 教員が「次の問題へ（リセット）」を押したときの処理
    socket.on('reset_question', () => {
        answers = { A: [], B: [], C: [], D: [] };
        answeredUsers.clear();
        io.emit('update_teacher', answers); // 教員画面をクリア
        io.emit('clear_student');           // 生徒画面のボタンを復活させる
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
