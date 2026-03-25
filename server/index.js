const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const db = process.env.DB_URI
    ? mysql.createConnection(process.env.DB_URI)
    : mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'online_quiz_db'
    });

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
    
    // Create tables if they don't exist
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role ENUM('participant', 'organiser') DEFAULT 'participant')`,
        `CREATE TABLE IF NOT EXISTS quizzes (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, time_limit INT NOT NULL, created_by INT, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS questions (id INT AUTO_INCREMENT PRIMARY KEY, quiz_id INT, question_text TEXT NOT NULL, FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS options (id INT AUTO_INCREMENT PRIMARY KEY, question_id INT, option_text TEXT NOT NULL, is_correct BOOLEAN DEFAULT FALSE, FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS results (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, quiz_id INT, score INT NOT NULL, total_questions INT NOT NULL, completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE)`
    ];
    tables.forEach(sql => db.query(sql, (err) => { if(err) console.error('SQL Error:', err.message); }));
});

// Middleware to verify JWT
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).send('Access Denied');
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).send('Invalid Token');
    }
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        db.query(sql, [name, email, hashedPassword, role], (err, result) => {
            if (err) {
                console.error('Registration Error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'User registered' });
        });
    } catch (err) {
        console.error('Bcrypt Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: 'User not found' });
        const user = results[0];
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secretkey');
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

// --- QUIZ ROUTES ---

// Create Quiz (Organiser only)
app.post('/api/quizzes', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const { title, time_limit } = req.body;
    const sql = 'INSERT INTO quizzes (title, time_limit, created_by) VALUES (?, ?, ?)';
    db.query(sql, [title, time_limit, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: result.insertId, message: 'Quiz created' });
    });
});

// Add Question to Quiz
app.post('/api/quizzes/:id/questions', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const { question_text, options } = req.body; // options is array [{text: '...', is_correct: true/false}]
    const quiz_id = req.params.id;
    const qSql = 'INSERT INTO questions (quiz_id, question_text) VALUES (?, ?)';
    db.query(qSql, [quiz_id, question_text], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const question_id = result.insertId;
        const oSql = 'INSERT INTO options (question_id, option_text, is_correct) VALUES ?';
        const values = options.map(o => [question_id, o.option_text, o.is_correct]);
        db.query(oSql, [values], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Question added' });
        });
    });
});

// Get all quizzes
app.get('/api/quizzes', auth, (req, res) => {
    const sql = 'SELECT * FROM quizzes';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get quiz detail with questions and options
app.get('/api/quizzes/:id', auth, (req, res) => {
    const quiz_id = req.params.id;
    const sql = `
        SELECT q.id as quiz_id, q.title, q.time_limit, 
               qn.id as question_id, qn.question_text,
               o.id as option_id, o.option_text, o.is_correct
        FROM quizzes q
        LEFT JOIN questions qn ON q.id = qn.quiz_id
        LEFT JOIN options o ON qn.id = o.question_id
        WHERE q.id = ?
    `;
    db.query(sql, [quiz_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // Group results into a clean structure
        const quiz = {
            id: results[0].quiz_id,
            title: results[0].title,
            time_limit: results[0].time_limit,
            questions: []
        };

        results.forEach(row => {
            let question = quiz.questions.find(q => q.id === row.question_id);
            if (!question) {
                question = { id: row.question_id, text: row.question_text, options: [] };
                quiz.questions.push(question);
            }
            if (row.option_id) {
                question.options.push({ id: row.option_id, text: row.option_text, is_correct: row.is_correct });
            }
        });

        res.json(quiz);
    });
});

// Submit Quiz Result
app.post('/api/results', auth, (req, res) => {
    const { quiz_id, score, total_questions } = req.body;
    const sql = 'INSERT INTO results (user_id, quiz_id, score, total_questions) VALUES (?, ?, ?, ?)';
    db.query(sql, [req.user.id, quiz_id, score, total_questions], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Result saved' });
    });
});

// Delete Quiz
app.delete('/api/quizzes/:id', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const sql = 'DELETE FROM quizzes WHERE id = ? AND created_by = ?';
    db.query(sql, [req.params.id, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Quiz deleted' });
    });
});

// Update Quiz Name
app.put('/api/quizzes/:id', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const { title, time_limit } = req.body;
    const sql = 'UPDATE quizzes SET title = ?, time_limit = ? WHERE id = ? AND created_by = ?';
    db.query(sql, [title, time_limit, req.params.id, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Quiz updated' });
    });
});

// Delete individual question (optional but helpful)
app.delete('/api/questions/:id', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const sql = 'DELETE FROM questions WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Question deleted' });
    });
});

// Get My Results (History)
app.get('/api/results/me', auth, (req, res) => {
    const sql = `
        SELECT r.score, r.total_questions, r.completed_at, q.title as quiz_title
        FROM results r
        JOIN quizzes q ON r.quiz_id = q.id
        WHERE r.user_id = ?
        ORDER BY r.completed_at DESC
    `;
    db.query(sql, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});
app.get('/api/quizzes/:id/results', auth, (req, res) => {
    if (req.user.role !== 'organiser') return res.status(403).send('Forbidden');
    const quiz_id = req.params.id;
    const sql = `
        SELECT r.score, r.total_questions, r.completed_at, u.name as participant_name, u.email as participant_email
        FROM results r
        JOIN users u ON r.user_id = u.id
        WHERE r.quiz_id = ?
        ORDER BY r.completed_at DESC
    `;
    db.query(sql, [quiz_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
