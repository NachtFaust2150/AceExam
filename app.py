"""
AceExam — Flask Application
Replaces React + Django with server-rendered Jinja2 templates.
Connects to the same MongoDB (aceexam_db).
"""
import os
import sys
import hashlib
import subprocess
import tempfile
import traceback
from datetime import datetime, timezone
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash, jsonify, abort
)
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv
import urllib.parse
from whitenoise import WhiteNoise

# Load environment variables from .env
load_dotenv()

# --------------- App Setup ---------------
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "aceexam-flask-secret-key")

# Integrate WhiteNoise for static file serving in production
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')

# --------------- MongoDB ---------------
user = os.getenv("MONGO_USER")
pswd = os.getenv("MONGO_PASS")
host = os.getenv("MONGO_HOST")
opts = os.getenv("MONGO_OPTIONS", "appName=AceExam")

if user and pswd and host:
    # URL encode the password to handle special characters (@, #, etc.)
    safe_pswd = urllib.parse.quote_plus(pswd)
    MONGO_URI = f"mongodb+srv://{user}:{safe_pswd}@{host}/?{opts}"
else:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

DB_NAME = os.getenv("DB_NAME", "aceexam_db")
_client = MongoClient(MONGO_URI)
db = _client[DB_NAME]

# --------------- Helpers ---------------
def _hash(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def _sid(doc):
    """Serialize a mongo doc: _id → id string, return dict."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return None

# --------------- Auth Decorator ---------------
def login_required(roles=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = session.get("user")
            if not user:
                return redirect(url_for("login_page"))
            if roles and user.get("role") not in roles:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

# --------------- Seed Data ---------------
def seed_data():
    if not db.users.find_one({"email": "org@ace.com"}):
        org_id = db.users.insert_one({
            "name": "Super Org", "email": "org@ace.com",
            "password": _hash("org123"), "role": "organisation",
            "disability_type": "none", "created_by": None, "assigned_exams": None
        }).inserted_id
    else:
        org_id = db.users.find_one({"email": "org@ace.com"})["_id"]

    if not db.users.find_one({"email": "teacher@ace.com"}):
        teacher_id = db.users.insert_one({
            "name": "Demo Teacher", "email": "teacher@ace.com",
            "password": _hash("teacher123"), "role": "teacher",
            "disability_type": "none", "created_by": str(org_id), "assigned_exams": None
        }).inserted_id
    else:
        teacher_id = db.users.find_one({"email": "teacher@ace.com"})["_id"]

    if not db.exams.find_one({"title": "Sample Web Dev Exam"}):
        exam_id = db.exams.insert_one({
            "title": "Sample Web Dev Exam", "created_by": str(teacher_id),
            "created_at": datetime.now(timezone.utc).isoformat()
        }).inserted_id
        db.questions.insert_many([
            {"exam_id": str(exam_id), "text": "What does HTML stand for?",
             "options": ["Hyper Text Markup Language", "Home Tool Markup Language",
                         "Hyperlinks Text Mark Language", "Hyperlinking Text Marking Language"],
             "correct_answer": "A", "difficulty": "easy"},
            {"exam_id": str(exam_id), "text": "What does CSS stand for?",
             "options": ["Colorful Style Sheets", "Cascading Style Sheets",
                         "Creative Style Sheets", "Computer Style Sheets"],
             "correct_answer": "B", "difficulty": "easy"},
        ])
    else:
        exam_id = db.exams.find_one({"title": "Sample Web Dev Exam"})["_id"]

    if not db.users.find_one({"email": "student@ace.com"}):
        db.users.insert_one({
            "name": "Demo Student", "email": "student@ace.com",
            "password": _hash("student123"), "role": "student",
            "disability_type": "none", "created_by": str(teacher_id),
            "assigned_exams": [str(exam_id)]
        })


# ===================== PAGE ROUTES =====================

@app.route("/")
def login_page():
    if session.get("user"):
        role = session["user"]["role"]
        if role == "organisation": return redirect(url_for("org_dashboard"))
        if role == "teacher": return redirect(url_for("teacher_dashboard"))
        return redirect(url_for("student_dashboard"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


# --- Student ---
@app.route("/student")
@login_required(roles=["student"])
def student_dashboard():
    user = session["user"]
    user_doc = db.users.find_one({"_id": _oid(user["id"])})
    assigned = user_doc.get("assigned_exams", []) if user_doc else []
    exams = []
    for eid in assigned:
        exam = db.exams.find_one({"_id": _oid(eid)})
        if exam:
            e = _sid(exam)
            e["questions_count"] = db.questions.count_documents({"exam_id": e["id"]})
            result = db.exam_results.find_one({"exam_id": e["id"], "student_id": user["id"]})
            e["result"] = _sid(result) if result else None
            exams.append(e)
    return render_template("student/dashboard.html", user=user, exams=exams)


@app.route("/student/exam/<exam_id>")
@login_required(roles=["student"])
def student_exam(exam_id):
    user = session["user"]
    user_doc = db.users.find_one({"_id": _oid(user["id"])})
    if exam_id not in (user_doc or {}).get("assigned_exams", []):
        abort(403)
    if db.exam_results.find_one({"exam_id": exam_id, "student_id": user["id"]}):
        flash("You have already submitted this exam.", "warning")
        return redirect(url_for("student_dashboard"))
    
    exam = db.exams.find_one({"_id": _oid(exam_id)})
    if not exam:
        abort(404)
    questions = list(db.questions.find({"exam_id": exam_id}))
    q_list = []
    for q in questions:
        q_list.append({"id": str(q["_id"]), "text": q["text"], "options": q["options"], "difficulty": q.get("difficulty", "medium")})

    disability = user_doc.get("disability_type", "none") if user_doc else "none"
    multipliers = {"none":1,"blind":2,"visual_impairment":1.75,"dyslexia":1.5,"motor":1.75,"adhd":1.25,"hearing":1}
    time_mult = multipliers.get(disability, 1)

    return render_template("student/exam.html",
        user=user, exam=_sid(exam), questions=q_list,
        disability_type=disability, time_multiplier=time_mult
    )


# --- Teacher ---
@app.route("/teacher")
@login_required(roles=["teacher"])
def teacher_dashboard():
    user = session["user"]
    student_count = db.users.count_documents({"role": "student", "created_by": user["id"]})
    exam_count = db.exams.count_documents({"created_by": user["id"]})
    result_count = 0
    my_exams = list(db.exams.find({"created_by": user["id"]}))
    exam_ids = [str(e["_id"]) for e in my_exams]
    if exam_ids:
        result_count = db.exam_results.count_documents({"exam_id": {"$in": exam_ids}})
    return render_template("teacher/dashboard.html", user=user,
        student_count=student_count, exam_count=exam_count, result_count=result_count)


@app.route("/teacher/students")
@login_required(roles=["teacher"])
def teacher_students():
    user = session["user"]
    students = list(db.users.find({"role": "student", "created_by": user["id"]}))
    students = [_sid(s) for s in students]
    for s in students:
        s.pop("password", None)
    return render_template("teacher/students.html", user=user, students=students)


@app.route("/teacher/exams")
@login_required(roles=["teacher"])
def teacher_exams():
    user = session["user"]
    exams = list(db.exams.find({"created_by": user["id"]}))
    exams_list = []
    for e in exams:
        ex = _sid(e)
        ex["questions_count"] = db.questions.count_documents({"exam_id": ex["id"]})
        exams_list.append(ex)
    students = list(db.users.find({"role": "student", "created_by": user["id"]}))
    students = [_sid(s) for s in students]
    for s in students:
        s.pop("password", None)
    return render_template("teacher/exams.html", user=user, exams=exams_list, students=students)


@app.route("/teacher/exams/<exam_id>/questions")
@login_required(roles=["teacher"])
def teacher_questions(exam_id):
    user = session["user"]
    exam = db.exams.find_one({"_id": _oid(exam_id), "created_by": user["id"]})
    if not exam:
        abort(404)
    questions = list(db.questions.find({"exam_id": exam_id}))
    questions = [_sid(q) for q in questions]
    return render_template("teacher/questions.html", user=user, exam=_sid(exam), questions=questions)


@app.route("/teacher/results")
@login_required(roles=["teacher"])
def teacher_results():
    user = session["user"]
    my_exams = list(db.exams.find({"created_by": user["id"]}))
    exam_ids = [str(e["_id"]) for e in my_exams]
    exam_map = {str(e["_id"]): e["title"] for e in my_exams}
    results = list(db.exam_results.find({"exam_id": {"$in": exam_ids}}).sort("submitted_at", -1))
    results_list = []
    for r in results:
        rs = _sid(r)
        student = db.users.find_one({"_id": _oid(rs.get("student_id", ""))})
        rs["student_name"] = student["name"] if student else "Unknown"
        rs["exam_title"] = exam_map.get(rs.get("exam_id", ""), "Unknown")
        results_list.append(rs)
    return render_template("teacher/results.html", user=user, results=results_list)


# --- Organisation ---
@app.route("/org")
@login_required(roles=["organisation"])
def org_dashboard():
    user = session["user"]
    teacher_count = db.users.count_documents({"role": "teacher", "created_by": user["id"]})
    return render_template("org/dashboard.html", user=user, teacher_count=teacher_count)


@app.route("/org/teachers")
@login_required(roles=["organisation"])
def org_teachers():
    user = session["user"]
    teachers = list(db.users.find({"role": "teacher", "created_by": user["id"]}))
    teachers = [_sid(t) for t in teachers]
    for t in teachers:
        t.pop("password", None)
    return render_template("org/teachers.html", user=user, teachers=teachers)


# ===================== API ROUTES =====================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json()
    email = data.get("email", "")
    password = data.get("password", "")
    user = db.users.find_one({"email": email})
    if not user or user["password"] != _hash(password):
        return jsonify({"error": "Invalid email or password"}), 401
    user_data = _sid(user.copy())
    user_data.pop("password", None)
    session["user"] = user_data
    return jsonify({"ok": True, "role": user_data["role"], "user": user_data})


@app.route("/api/submit-exam", methods=["POST"])
@login_required(roles=["student"])
def api_submit_exam():
    user = session["user"]
    data = request.get_json()
    exam_id = data.get("exam_id")
    answers = data.get("answers", {})
    time_taken = data.get("time_taken", 0)

    if db.exam_results.find_one({"student_id": user["id"], "exam_id": exam_id}):
        return jsonify({"error": "Already submitted"}), 400

    all_q = list(db.questions.find({"exam_id": exam_id}))
    score = sum(1 for q in all_q if answers.get(str(q["_id"]), "").upper() == q["correct_answer"])
    total = len(all_q)

    doc = {
        "exam_id": exam_id, "student_id": user["id"],
        "answers": answers, "score": score, "total": total,
        "time_taken": time_taken,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    db.exam_results.insert_one(doc)
    return jsonify({"score": score, "total": total, "time_taken": time_taken})


# --- Teacher CRUD APIs ---
@app.route("/api/students", methods=["POST"])
@login_required(roles=["teacher"])
def api_add_student():
    user = session["user"]
    data = request.get_json()
    if db.users.find_one({"email": data["email"]}):
        return jsonify({"error": "Email already exists"}), 400
    doc = {
        "name": data["name"], "email": data["email"],
        "password": _hash(data["password"]), "role": "student",
        "disability_type": data.get("disabilityType", "none"),
        "created_by": user["id"], "assigned_exams": []
    }
    db.users.insert_one(doc)
    return jsonify({"ok": True})


@app.route("/api/students/<sid>", methods=["PUT"])
@login_required(roles=["teacher"])
def api_update_student(sid):
    user = session["user"]
    data = request.get_json()
    target = db.users.find_one({"_id": _oid(sid), "role": "student", "created_by": user["id"]})
    if not target:
        return jsonify({"error": "Not found"}), 404
    update = {}
    for f in ["name", "email"]:
        if data.get(f): update[f] = data[f]
    if data.get("disabilityType"): update["disability_type"] = data["disabilityType"]
    if data.get("password"): update["password"] = _hash(data["password"])
    if update:
        db.users.update_one({"_id": _oid(sid)}, {"$set": update})
    return jsonify({"ok": True})


@app.route("/api/students/<sid>", methods=["DELETE"])
@login_required(roles=["teacher"])
def api_delete_student(sid):
    user = session["user"]
    db.users.delete_one({"_id": _oid(sid), "role": "student", "created_by": user["id"]})
    return jsonify({"ok": True})


@app.route("/api/exams", methods=["POST"])
@login_required(roles=["teacher"])
def api_create_exam():
    user = session["user"]
    data = request.get_json()
    db.exams.insert_one({
        "title": data["title"], "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return jsonify({"ok": True})


@app.route("/api/exams/<eid>/assign", methods=["POST"])
@login_required(roles=["teacher"])
def api_assign_exam(eid):
    user = session["user"]
    data = request.get_json()
    student_id = data.get("student_id")
    assign = data.get("assign", True)
    if assign:
        db.users.update_one({"_id": _oid(student_id), "created_by": user["id"]}, {"$addToSet": {"assigned_exams": eid}})
    else:
        db.users.update_one({"_id": _oid(student_id), "created_by": user["id"]}, {"$pull": {"assigned_exams": eid}})
    return jsonify({"ok": True})


@app.route("/api/questions", methods=["POST"])
@login_required(roles=["teacher"])
def api_add_question():
    data = request.get_json()
    doc = {
        "exam_id": data["exam_id"], "text": data["text"],
        "options": [data["option_a"], data["option_b"], data["option_c"], data["option_d"]],
        "correct_answer": data["correct_answer"].upper(),
        "difficulty": data.get("difficulty", "medium")
    }
    db.questions.insert_one(doc)
    return jsonify({"ok": True})


@app.route("/api/questions/<qid>", methods=["DELETE"])
@login_required(roles=["teacher"])
def api_delete_question(qid):
    db.questions.delete_one({"_id": _oid(qid)})
    return jsonify({"ok": True})


# --- Org CRUD APIs ---
@app.route("/api/teachers", methods=["POST"])
@login_required(roles=["organisation"])
def api_add_teacher():
    user = session["user"]
    data = request.get_json()
    if db.users.find_one({"email": data["email"]}):
        return jsonify({"error": "Email already exists"}), 400
    db.users.insert_one({
        "name": data["name"], "email": data["email"],
        "password": _hash(data["password"]), "role": "teacher",
        "disability_type": "none", "created_by": user["id"], "assigned_exams": None
    })
    return jsonify({"ok": True})


@app.route("/api/teachers/<tid>", methods=["DELETE"])
@login_required(roles=["organisation"])
def api_delete_teacher(tid):
    user = session["user"]
    db.users.delete_one({"_id": _oid(tid), "role": "teacher", "created_by": user["id"]})
    return jsonify({"ok": True})


# --- ML Voice Prediction ---
@app.route("/api/predict", methods=["POST"])
@app.route("/api/stt/predict/", methods=["POST"])
def api_predict():
    print("[STT-BACKEND] Received POST request to STT endpoint.")
    if not request.files.get("audio"):
        print("[STT-BACKEND] Error: No audio file in request.")
        return jsonify({"success": False, "error": "No audio file"}), 400

    audio_file = request.files["audio"]
    webm_path = wav_path = None
    try:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        FFMPEG = "ffmpeg"

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp)
            webm_path = tmp.name

        wav_path = webm_path.replace(".webm", ".wav")
        subprocess.run([FFMPEG, "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
                       capture_output=True, text=True, timeout=10)

        backend_dir = os.path.join(os.path.dirname(__file__), "aceexam_backend")
        # --- External Open Source API Integration ---
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        
        text = ""
        try:
            with sr.AudioFile(wav_path) as source:
                audio_data = recognizer.record(source)
                # Calling Google's Free STT API automatically handles the REST request
                text = recognizer.recognize_google(audio_data).lower().strip()
                print(f"[STT-EXTERNAL-API] Recognized Text: '{text}'")
        except sr.UnknownValueError:
            print("[STT-EXTERNAL-API] Could not understand audio (silence or noise).")
            return jsonify({"success": True, "command": "silence", "confidence": 0.0, "text": ""})
        except sr.RequestError as e:
            print(f"[STT-EXTERNAL-API] External STT service unavailable: {e}")
            return jsonify({"success": False, "error": str(e)}), 500

        # Command Mapping Logic
        prediction = "error"
        if "option a" in text or text == "a": prediction = "option_a" 
        elif "option b" in text or text == "b": prediction = "option_b"
        elif "option c" in text or text == "c": prediction = "option_c"
        elif "option d" in text or text == "d": prediction = "option_d"
        elif "next" in text: prediction = "next"
        elif "previous" in text or "back" in text: prediction = "previous"
        elif "submit" in text: prediction = "submit"
        elif "confirm" in text: prediction = "confirm"
        elif "cancel" in text: prediction = "cancel"
        elif "read" in text: prediction = "read"
        
        print(f"[STT-EXTERNAL-API] Mapped command: '{prediction}'")
        
        return jsonify({
            "success": True,
            "command": prediction,
            "confidence": 0.95,
            "text": text
        })
    except Exception as e:
        traceback.print_exc()
        print(f"[STT ERROR] {type(e).__name__}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        for p in (webm_path, wav_path):
            if p and os.path.exists(p):
                try: os.remove(p)
                except: pass

# ===================== MAIN =====================
if __name__ == "__main__":
    seed_data()
    app.run(debug=True, port=5000)
