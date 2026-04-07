"""
MongoDB connection helper using PyMongo.
Database: aceexam_db
Collections: users, questions, exam_results
"""
import hashlib
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = "aceexam_db"

_client = None


def get_client():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


# --------------- Collection helpers ---------------

def users_col():
    return get_db()["users"]


def questions_col():
    return get_db()["questions"]


def results_col():
    return get_db()["exam_results"]


def exams_col():
    return get_db()["exams"]


# --------------- Seed data ---------------

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def seed_data():
    """Create default org, teacher, student and sample exam/questions if empty."""
    db = get_db()
    
    from datetime import datetime, timezone

    # 1. Default Organisation
    org = db["users"].find_one({"email": "org@ace.com"})
    if not org:
        result = db["users"].insert_one({
            "name": "Super Org",
            "email": "org@ace.com",
            "password": _hash("org123"),
            "role": "organisation",
            "disability_type": "none",
            "created_by": None,
            "assigned_exams": None
        })
        org_id = str(result.inserted_id)
    else:
        org_id = str(org["_id"])

    # 2. Default Teacher
    teacher = db["users"].find_one({"email": "teacher@ace.com"})
    if not teacher:
        result = db["users"].insert_one({
            "name": "Demo Teacher",
            "email": "teacher@ace.com",
            "password": _hash("teacher123"),
            "role": "teacher",
            "disability_type": "none",
            "created_by": org_id,
            "assigned_exams": None
        })
        teacher_id = str(result.inserted_id)
    else:
        teacher_id = str(teacher["_id"])

    # 3. Default Exam
    exam = db["exams"].find_one({"title": "Sample Web Dev Exam"})
    if not exam:
        result = db["exams"].insert_one({
            "title": "Sample Web Dev Exam",
            "created_by": teacher_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        exam_id = str(result.inserted_id)
        
        # Add sample questions to this exam
        sample_questions = [
            {
                "exam_id": exam_id,
                "text": "What does HTML stand for?",
                "options": ["Hyper Text Markup Language", "Home Tool Markup Language", "Hyperlinks Text Mark Language", "Hyperlinking Text Marking Language"],
                "correct_answer": "A",
                "difficulty": "easy"
            },
            {
                "exam_id": exam_id,
                "text": "What does CSS stand for?",
                "options": ["Colorful Style Sheets", "Cascading Style Sheets", "Creative Style Sheets", "Computer Style Sheets"],
                "correct_answer": "B",
                "difficulty": "easy"
            }
        ]
        db["questions"].insert_many(sample_questions)
    else:
        exam_id = str(exam["_id"])

    # 4. Default Student (assigned to the exam)
    student = db["users"].find_one({"email": "student@ace.com"})
    if not student:
        db["users"].insert_one({
            "name": "Demo Student",
            "email": "student@ace.com",
            "password": _hash("student123"),
            "role": "student",
            "disability_type": "none",
            "created_by": teacher_id,
            "assigned_exams": [exam_id]
        })
