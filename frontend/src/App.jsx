import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useParams } from "react-router-dom";
import { LogOut, Plus, Clock, CheckCircle, ChevronRight, BookOpen, Trash2 } from "lucide-react";

// Use environment variable for the API base URL in production
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [token, setToken] = useState(localStorage.getItem("token"));

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <Link to="/" className="brand">QuizLeaf <BookOpen size={20} style={{color: "var(--success)"}} /></Link>
          {user ? (
            <div className="nav-actions">
              <span className="user-info">Hello, {user.name} ({user.role})</span>
              <button onClick={logout} className="btn-logout"><LogOut size={16} /> Logout</button>
            </div>
          ) : (
            <div className="nav-actions">
              <Link to="/login" className="btn-login">Login</Link>
              <Link to="/register" className="btn-register">Register</Link>
            </div>
          )}
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={user ? (user.role === 'organiser' ? <OrganiserDashboard token={token} /> : <ParticipantDashboard token={token} />) : <Navigate to="/login" />} />
            <Route path="/login" element={<Login onLogin={login} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/quiz/:id" element={<QuizPage token={token} user={user} />} />
            <Route path="/manage/:id" element={<ManageQuiz token={token} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// --- Auth Components ---
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      onLogin(data.user, data.token);
      navigate("/");
    } else alert(data.error || "Login failed");
  };

  return (
    <div className="card-centered">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary">Login</button>
      </form>
    </div>
  );
}

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("participant");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (res.ok) {
      alert("Registration successful! Please login.");
      navigate("/login");
    } else alert("Error registering");
  };

  return (
    <div className="card-centered">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="participant">Participant</option>
          <option value="organiser">Organiser</option>
        </select>
        <button type="submit" className="btn-primary">Register</button>
      </form>
    </div>
  );
}

// --- Dashboards ---
function OrganiserDashboard({ token }) {
  const [quizzes, setQuizzes] = useState([]);
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState(10);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchQuizzes();
  }, [token]);

  const fetchQuizzes = async () => {
    const res = await fetch(`${API_BASE}/quizzes`, {
      headers: { Authorization: token },
    });
    const data = await res.json();
    setQuizzes(data || []);
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    const res = await fetch(`${API_BASE}/quizzes/${id}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
    if (res.ok) fetchQuizzes();
  };

  const createQuiz = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ title, time_limit: timeLimit }),
    });
    if (res.ok) {
      setTitle("");
      setShowForm(false);
      fetchQuizzes();
    }
  };

  return (
    <div className="dashboard">
      <div className="header-row">
        <h1>Your Quizzes</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-secondary">
          <Plus size={16} /> Create Quiz
        </button>
      </div>

      {showForm && (
        <form onSubmit={createQuiz} className="quiz-form">
          <input type="text" placeholder="Quiz Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input type="number" placeholder="Time Limit (min)" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} required />
          <button type="submit" className="btn-primary">Save Quiz</button>
        </form>
      )}

      <div className="quiz-list">
        {quizzes.map(q => (
          <div key={q.id} className="quiz-card">
            <div className="header-row">
              <h3>{q.title}</h3>
              <button onClick={() => deleteQuiz(q.id)} className="btn-icon" style={{color: "var(--danger)", border: "none", background: "none", cursor: "pointer"}}><Trash2 size={16} /></button>
            </div>
            <p><Clock size={14} /> {q.time_limit} mins</p>
            <div className="card-actions">
               <Link to={`/manage/${q.id}`} className="btn-take">Manage Questions <ChevronRight size={16} /></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManageQuiz({ token }) {
    const { id } = useParams();
    const [quiz, setQuiz] = useState(null);
    const [results, setResults] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ title: "", time_limit: "" });
    const [qText, setQText] = useState("");
    const [options, setOptions] = useState([
        { text: "", is_correct: true },
        { text: "", is_correct: false },
        { text: "", is_correct: false },
        { text: "", is_correct: false }
    ]);

    const fetchDetail = async () => {
        const res = await fetch(`${API_BASE}/quizzes/${id}`, {
            headers: { Authorization: token },
        });
        const data = await res.json();
        setQuiz(data);
        setEditData({ title: data.title, time_limit: data.time_limit });
    };

    const fetchResults = async () => {
        const res = await fetch(`${API_BASE}/quizzes/${id}/results`, {
            headers: { Authorization: token },
        });
        const data = await res.json();
        setResults(data || []);
    };

    useEffect(() => {
        fetchDetail();
        fetchResults();
    }, [id, token]);

    const addQuestion = async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_BASE}/quizzes/${id}/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: token },
            body: JSON.stringify({ 
                question_text: qText, 
                options: options.map(o => ({ option_text: o.text, is_correct: o.is_correct })) 
            }),
        });
        if (res.ok) {
            setQText("");
            setOptions([
                { text: "", is_correct: true },
                { text: "", is_correct: false },
                { text: "", is_correct: false },
                { text: "", is_correct: false }
            ]);
            fetchDetail();
        }
    };

    const handleOptionChange = (idx, text) => {
        const newOptions = [...options];
        newOptions[idx].text = text;
        setOptions(newOptions);
    }

    const updateQuiz = async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_BASE}/quizzes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: token },
            body: JSON.stringify(editData),
        });
        if (res.ok) {
            setIsEditing(false);
            fetchDetail();
        }
    };

    const deleteQuestion = async (qId) => {
        if (!window.confirm("Delete this question?")) return;
        const res = await fetch(`${API_BASE}/questions/${qId}`, {
            method: "DELETE",
            headers: { Authorization: token },
        });
        if (res.ok) fetchDetail();
    };

    if (!quiz) return <div>Loading...</div>;

    return (
        <div className="dashboard">
            <div className="header-row">
                <Link to="/" style={{color: "var(--primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem"}}>
                   ← Back to Dashboard
                </Link>
                {isEditing ? (
                    <form onSubmit={updateQuiz} style={{display: "flex", gap: "1rem", alignItems: "center", background: "#f8fafc", padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)"}}>
                        <div style={{display: "flex", flexDirection: "column"}}>
                            <label style={{fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-light)"}}>Quiz Title</label>
                            <input type="text" value={editData.title} onChange={(e) => setEditData({...editData, title: e.target.value})} required style={{width: "200px"}} />
                        </div>
                        <div style={{display: "flex", flexDirection: "column"}}>
                            <label style={{fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-light)"}}>Limit (min)</label>
                            <input type="number" value={editData.time_limit} onChange={(e) => setEditData({...editData, time_limit: e.target.value})} required style={{width: "80px"}} />
                        </div>
                        <button type="submit" className="btn-success" style={{padding: "0.6rem 1rem", marginTop: "1rem"}}>Save</button>
                        <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary" style={{padding: "0.6rem 1rem", marginTop: "1rem"}}>Cancel</button>
                    </form>
                ) : (
                    <div style={{display: "flex", alignItems: "center", gap: "1.5rem"}}>
                        <div>
                            <h1 style={{margin: 0}}>{quiz.title}</h1>
                            <p style={{fontSize: "0.9rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "0.3rem"}}>
                                <Clock size={14} /> Time Limit: <strong>{quiz.time_limit} minutes</strong>
                            </p>
                        </div>
                        <button onClick={() => setIsEditing(true)} className="btn-secondary" style={{padding: "0.4rem 0.8rem", fontSize: "0.8rem"}}>Edit Settings</button>
                    </div>
                )}
            </div>
            
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem"}}>
                {/* Left Side: Add Questions */}
                <div>
                    <div className="card-box" style={{background: "white", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border)"}}>
                        <h3>Add New Question</h3>
                        <form onSubmit={addQuestion} className="quiz-form">
                            <input type="text" placeholder="Question Text" value={qText} onChange={(e) => setQText(e.target.value)} required />
                            {options.map((o, i) => (
                                <div key={i} style={{display: "flex", gap: "0.5rem", alignItems: "center"}}>
                                    <input type="text" placeholder={`Option ${i+1}`} value={o.text} onChange={(e) => handleOptionChange(i, e.target.value)} required style={{flex: 1}} />
                                    <input type="radio" name="correct" checked={o.is_correct} onChange={() => setOptions(options.map((opt, j) => ({...opt, is_correct: i === j})))}/>
                                    <span style={{fontSize: "0.8rem"}}>Correct</span>
                                </div>
                            ))}
                            <button type="submit" className="btn-primary" style={{width: "100%"}}>Add Question</button>
                        </form>
                    </div>

                    <div style={{marginTop: "2rem"}}>
                        <h3>Questions ({quiz.questions ? quiz.questions.length : 0})</h3>
                        <div style={{display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem"}}>
                            {quiz.questions && quiz.questions.map((q, i) => (
                                q.text && (
                                    <div key={q.id} className="quiz-card">
                                        <div className="header-row">
                                           <p><strong>{i+1}: {q.text}</strong></p>
                                           <button onClick={() => deleteQuestion(q.id)} className="btn-icon" style={{color: "var(--danger)", border: "none", background: "none", cursor: "pointer"}}><Trash2 size={14} /></button>
                                        </div>
                                        <ul style={{fontSize: "0.8rem", listStyle: "none", paddingLeft: "0.5rem", marginTop: "0.5rem"}}>
                                            {q.options && q.options.map(o => (
                                                <li key={o.id} style={{color: o.is_correct ? "var(--success)" : "inherit", padding: "0.2rem 0"}}>
                                                    • {o.text} {o.is_correct && "(✓)"}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Participant Results */}
                <div>
                    <h3>Participant Results</h3>
                    <div style={{background: "white", borderRadius: "12px", border: "1px solid var(--border)", marginTop: "1rem", overflow: "hidden"}}>
                        {results.length === 0 ? (
                            <p style={{padding: "2rem", textAlign: "center", color: "var(--text-light)"}}>No one has taken this quiz yet.</p>
                        ) : (
                            <table style={{width: "100%", borderCollapse: "collapse"}}>
                                <thead style={{background: "#f8fafc", borderBottom: "1px solid var(--border)"}}>
                                    <tr>
                                        <th style={{padding: "1rem", textAlign: "left"}}>Name</th>
                                        <th style={{padding: "1rem", textAlign: "left"}}>Email</th>
                                        <th style={{padding: "1rem", textAlign: "center"}}>Score</th>
                                        <th style={{padding: "1rem", textAlign: "right"}}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => (
                                        <tr key={i} style={{borderBottom: "1px solid #f1f5f9"}}>
                                            <td style={{padding: "1rem"}}>{r.participant_name}</td>
                                            <td style={{padding: "1rem", color: "var(--text-light)", fontSize: "0.9rem"}}>{r.participant_email}</td>
                                            <td style={{padding: "1rem", textAlign: "center", fontWeight: "bold", color: "var(--primary)"}}>
                                                {r.score} / {r.total_questions}
                                            </td>
                                            <td style={{padding: "1rem", textAlign: "right", fontSize: "0.8rem", color: "var(--text-light)"}}>
                                                {new Date(r.completed_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ParticipantDashboard({ token }) {
  const [quizzes, setQuizzes] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const qRes = await fetch(`${API_BASE}/quizzes`, { headers: { Authorization: token } });
      const qData = await qRes.json();
      setQuizzes(qData || []);

      const hRes = await fetch(`${API_BASE}/results/me`, { headers: { Authorization: token } });
      const hData = await hRes.json();
      setHistory(hData || []);
    };
    fetchData();
  }, [token]);

  return (
    <div className="dashboard">
      <div style={{display: "grid", gridTemplateColumns: "1fr 350px", gap: "2rem"}}>
        <div>
            <h1>Available Quizzes</h1>
            <div className="quiz-list" style={{marginTop: "1rem"}}>
                {quizzes.map(q => (
                <div key={q.id} className="quiz-card">
                    <div className="quiz-info">
                    <h3>{q.title}</h3>
                    <p><Clock size={14} /> {q.time_limit} mins</p>
                    </div>
                    <Link to={`/quiz/${q.id}`} className="btn-take">Take Quiz <ChevronRight size={16} /></Link>
                </div>
                ))}
            </div>
        </div>

        <div>
            <h2>Your History</h2>
            <div style={{display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem"}}>
                {history.length === 0 ? <p style={{color: "var(--text-light)"}}>No history yet.</p> : history.map((h, i) => (
                    <div key={i} className="quiz-card" style={{padding: "1rem"}}>
                        <p style={{fontSize: "0.9rem", fontWeight: "bold"}}>{h.quiz_title}</p>
                        <p style={{color: "var(--primary)", fontWeight: "800"}}>{h.score} / {h.total_questions}</p>
                        <p style={{fontSize: "0.75rem"}}>{new Date(h.completed_at).toLocaleDateString()}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}

// --- Quiz Interaction ---
function QuizPage({ token, user }) {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDetail = async () => {
      const res = await fetch(`${API_BASE}/quizzes/${id}`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      setQuiz(data);
      if (data) setTimeLeft(data.time_limit * 60);
    };
    fetchDetail();
  }, [id, token]);

  useEffect(() => {
    if (timeLeft > 0 && !finished) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !finished && quiz) {
      submitQuiz();
    }
  }, [timeLeft, finished, quiz]);

  const handleSelect = (questionId, optionId) => {
    setAnswers({ ...answers, [questionId]: optionId });
  };

  const submitQuiz = async () => {
    let score = 0;
    quiz.questions.forEach(q => {
      if (!q.id) return;
      const selected = answers[q.id];
      const correctOption = q.options.find(o => o.is_correct);
      if (selected === correctOption.id) score++;
    });

    const res = await fetch(`${API_BASE}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ quiz_id: id, score, total_questions: quiz.questions.length }),
    });

    if (res.ok) {
      setFinished(true);
      setResult({ score, total: quiz.questions.length });
    }
  };

  if (!quiz) return <div>Loading...</div>;

  if (finished) {
    return (
      <div className="card-centered result-card">
        <CheckCircle size={48} color="#10b981" />
        <h2>Quiz Completed!</h2>
        <p className="score">Your Score: <span>{result.score} / {result.total}</span></p>
        <button onClick={() => navigate("/")} className="btn-primary">Back to Home</button>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="quiz-interface">
      <div className="quiz-header">
        <h2>{quiz.title}</h2>
        <div className="timer"><Clock size={16} /> {formatTime(timeLeft)}</div>
      </div>

      <div className="question-box">
        <p className="progress">Question {currentQuestion + 1} of {quiz.questions.length}</p>
        <h3 className="question-text">{question?.text}</h3>
        <div className="options-grid">
          {question?.options && question.options.map(o => (
            <button 
              key={o.id} 
              className={`option-btn ${answers[question.id] === o.id ? 'selected' : ''}`}
              onClick={() => handleSelect(question.id, o.id)}
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-footer">
        {currentQuestion < quiz.questions.length - 1 ? (
          <button onClick={() => setCurrentQuestion(currentQuestion + 1)} className="btn-primary">Next</button>
        ) : (
          <button onClick={submitQuiz} className="btn-success">Submit Quiz</button>
        )}
      </div>
    </div>
  );
}

export default App;
