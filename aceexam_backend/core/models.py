"""
MongoDB document shape definitions.
These are NOT Django ORM models — they define the expected structure
of documents stored in MongoDB collections.
"""

# --------------- User ---------------
USER_FIELDS = {
    "name": str,
    "email": str,
    "password": str,       # SHA-256 hashed
    "role": str,           # "organisation", "teacher", or "student"
    "disability_type": str,  # "none", "blind", "visual_impairment", "dyslexia", "motor", "adhd", "hearing"
    "created_by": str,     # Org ID (for teachers) or Teacher ID (for students)
    "assigned_exams": list, # List of Exam IDs (for students only)
}


def make_user(name, email, password_hash, role="student", disability_type="none", created_by=None):
    return {
        "name": name,
        "email": email,
        "password": password_hash,
        "role": role,
        "disability_type": disability_type,
        "created_by": created_by,
        "assigned_exams": [] if role == "student" else None,
    }


# --------------- Exam ---------------
EXAM_FIELDS = {
    "title": str,
    "created_by": str,     # Teacher ID
    "created_at": str,     # ISO timestamp
}


def make_exam(title, created_by, created_at):
    return {
        "title": title,
        "created_by": created_by,
        "created_at": created_at,
    }


# --------------- Question ---------------
QUESTION_FIELDS = {
    "exam_id": str,           # Which exam this question belongs to
    "text": str,
    "options": list,          # list of 4 strings
    "correct_answer": str,    # "A", "B", "C", or "D"
    "difficulty": str,        # "easy", "medium", "hard"
}


def make_question(exam_id, text, options, correct_answer, difficulty="medium"):
    return {
        "exam_id": exam_id,
        "text": text,
        "options": options,
        "correct_answer": correct_answer,
        "difficulty": difficulty,
    }


# --------------- Exam Result ---------------
EXAM_RESULT_FIELDS = {
    "exam_id": str,
    "student_id": str,
    "answers": dict,       # {"question_id": "A", ...}
    "score": int,
    "total": int,
    "time_taken": int,     # seconds
    "submitted_at": str,   # ISO timestamp
}


def make_exam_result(exam_id, student_id, answers, score, total, time_taken, submitted_at):
    return {
        "exam_id": exam_id,
        "student_id": student_id,
        "answers": answers,
        "score": score,
        "total": total,
        "time_taken": time_taken,
        "submitted_at": submitted_at,
    }
