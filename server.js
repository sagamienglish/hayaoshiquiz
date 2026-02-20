const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイルの配信先（publicフォルダ内にHTMLを入れている想定）
app.use(express.static('public'));

// 既存の変数
let players = {}; 
let answers = { A: [], B: [], C: [], D: [] };
let answeredUsers = new Set();
let settings = { basePoints: 10, bonusPoints: 5, bonusCount: 1 };

// ▼追加：Excelから読み込んだ問題データを保持する変数
let quizData = [];
let currentQuestionIndex = 0;

io.on('connection', (socket) => {
    // --- 既存の処理 ---
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
            // 選択肢（A, B, C, D）ごとに生徒名を記録
            if (answers[data.choice]) {
                answers[data.choice].push(data.name);
            }
            io.emit('update_answers_teacher', answers);
        }
    });

    socket.on('judge_answer', (data) => {
        const correctChoice = data.choice;
        const currentSettings = data.currentSettings || settings;

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

    // --- ▼追加：Excel問題データ連携用の処理 ---

    // 教員画面から問題リスト（Excelコピペデータ）を受信
    socket.on('start_quiz_data', (data) => {
        quizData = data;
        currentQuestionIndex = 0;
        console.log(`Excelデータを受信しました: 全${quizData.length}問`);
        
        // 1問目を全生徒へ配信
        sendCurrentQuestion();
    });

    // 教員画面から「次の問題へ」の指示を受信
    socket.on('next_question', () => {
        if (currentQuestionIndex < quizData.length - 1) {
            currentQuestionIndex++;
            sendCurrentQuestion();
        } else {
            // 全問終了のアナウンス
            io.emit('quiz_finished'); 
        }
    });
    
    // 現在の問題を配信し、解答状況をリセットする共通関数
    function sendCurrentQuestion() {
        // 前回の解答状況をリセット（既存のreset_questionと同じ処理）
        answers = { A: [], B: [], C: [], D: [] };
        answeredUsers.clear();
        io.emit('update_answers_teacher', answers);
        io.emit('clear_student');

        const q = quizData[currentQuestionIndex];
        if (q) {
            // 生徒へ問題テキストと選択肢を送信
            io.emit('new_question', {
                questionNumber: currentQuestionIndex + 1,
                totalQuestions: quizData.length,
                question: q.question,
                choices: q.choices,
                correctChoiceLetter: q.correctChoiceLetter
            });
        }
    }
});

// ランキング取得用の関数
function getRanking() {
    return Object.entries(players)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
