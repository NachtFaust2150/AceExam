"""
GraphQL schema for AceExam.
Defines all types, queries, and mutations using Graphene.
"""
import graphene
from datetime import datetime, timezone

from .db import users_col, questions_col, results_col, exams_col
from .auth import hash_password, verify_password, generate_token
from .serializers import (
    serialize_id, serialize_list, to_object_id,
    serialize_user, serialize_question, serialize_result,
)
from .models import make_user, make_question, make_exam_result, make_exam


# ===================== TYPES =====================

class UserType(graphene.ObjectType):
    id = graphene.String()
    name = graphene.String()
    email = graphene.String()
    role = graphene.String()
    disability_type = graphene.String()
    created_by = graphene.String()
    assigned_exams = graphene.List(graphene.String)


class ExamType(graphene.ObjectType):
    id = graphene.String()
    title = graphene.String()
    created_by = graphene.String()
    created_at = graphene.String()
    questions_count = graphene.Int()


class QuestionType(graphene.ObjectType):
    id = graphene.String()
    exam_id = graphene.String()
    text = graphene.String()
    options = graphene.List(graphene.String)
    correct_answer = graphene.String()
    difficulty = graphene.String()


class ExamResultType(graphene.ObjectType):
    id = graphene.String()
    exam_id = graphene.String()
    student_id = graphene.String()
    student_name = graphene.String()
    answers = graphene.JSONString()
    score = graphene.Int()
    total = graphene.Int()
    time_taken = graphene.Int()
    submitted_at = graphene.String()


class AuthPayload(graphene.ObjectType):
    token = graphene.String()
    role = graphene.String()
    user = graphene.Field(UserType)


# ===================== QUERIES =====================

class Query(graphene.ObjectType):
    me = graphene.Field(UserType)
    teachers = graphene.List(UserType)
    students = graphene.List(UserType)
    exams = graphene.List(ExamType)
    exam = graphene.Field(ExamType, id=graphene.String(required=True))
    questions = graphene.List(QuestionType, exam_id=graphene.String(required=True))
    all_questions = graphene.List(QuestionType, exam_id=graphene.String(required=True))
    exam_results = graphene.List(
        ExamResultType,
        exam_id=graphene.String(required=False),
        student_id=graphene.String(required=False),
    )

    def resolve_me(self, info):
        user_info = info.context.user_info
        if not user_info:
            return None
        doc = users_col().find_one({"_id": to_object_id(user_info["user_id"])})
        return serialize_user(doc) if doc else None

    def resolve_teachers(self, info):
        """Organisation query — list all their teachers."""
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "organisation":
            raise Exception("Organisation access required")
        docs = list(users_col().find({"role": "teacher", "created_by": user_info["user_id"]}))
        return [serialize_user(doc) for doc in docs]

    def resolve_students(self, info):
        """Teacher query — list all their students."""
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")
        docs = list(users_col().find({"role": "student", "created_by": user_info["user_id"]}))
        return [serialize_user(doc) for doc in docs]

    def resolve_exams(self, info):
        user_info = info.context.user_info
        if not user_info:
            raise Exception("Authentication required")
        
        if user_info["role"] == "teacher":
            docs = list(exams_col().find({"created_by": user_info["user_id"]}))
        elif user_info["role"] == "student":
            user_doc = users_col().find_one({"_id": to_object_id(user_info["user_id"])})
            assigned_exams = user_doc.get("assigned_exams", [])
            docs = list(exams_col().find({"_id": {"$in": [to_object_id(eid) for eid in assigned_exams]}}))
        else:
            return []
            
        result = []
        for doc in docs:
            serialized_exam = serialize_id(doc)
            serialized_exam["questions_count"] = questions_col().count_documents({"exam_id": serialized_exam["id"]})
            result.append(serialized_exam)
        return result

    def resolve_exam(self, info, id):
        user_info = info.context.user_info
        if not user_info:
            raise Exception("Authentication required")
        doc = exams_col().find_one({"_id": to_object_id(id)})
        if not doc:
            raise Exception("Exam not found")
        
        # Verify access
        if user_info["role"] == "teacher" and doc["created_by"] != user_info["user_id"]:
            raise Exception("Access denied")
        if user_info["role"] == "student":
            user_doc = users_col().find_one({"_id": to_object_id(user_info["user_id"])})
            if id not in user_doc.get("assigned_exams", []):
                raise Exception("Access denied")
                
        serialized_exam = serialize_id(doc)
        serialized_exam["questions_count"] = questions_col().count_documents({"exam_id": serialized_exam["id"]})
        return serialized_exam

    def resolve_questions(self, info, exam_id):
        """Student query — returns questions WITHOUT correct answers."""
        user_info = info.context.user_info
        if not user_info:
            raise Exception("Authentication required")
        docs = list(questions_col().find({"exam_id": exam_id}))
        result = []
        for doc in docs:
            serialized = serialize_question(doc.copy(), include_answer=False)
            result.append(serialized)
        return result

    def resolve_all_questions(self, info, exam_id):
        """Teacher query — returns questions WITH correct answers."""
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")
        docs = list(questions_col().find({"exam_id": exam_id}))
        return serialize_list([doc.copy() for doc in docs])

    def resolve_exam_results(self, info, exam_id=None, student_id=None):
        user_info = info.context.user_info
        if not user_info:
            raise Exception("Authentication required")
            
        query = {}
        if exam_id:
            query["exam_id"] = exam_id
            
        if user_info["role"] == "teacher":
            # Teacher sees results for their own exams only
            if student_id:
                query["student_id"] = student_id
            my_exams = list(exams_col().find({"created_by": user_info["user_id"]}))
            my_exam_ids = [str(e["_id"]) for e in my_exams]
            if query.get("exam_id") and query["exam_id"] not in my_exam_ids:
                return []
            if not query.get("exam_id"):
                query["exam_id"] = {"$in": my_exam_ids}
        elif user_info["role"] == "student":
            # Student sees only their own results
            query["student_id"] = user_info["user_id"]
        else:
            return []

        docs = list(results_col().find(query).sort("submitted_at", -1))
        results = []
        for doc in docs:
            serialized = serialize_result(doc.copy())
            # Attach student name
            student = users_col().find_one({"_id": to_object_id(serialized.get("student_id", ""))})
            serialized["student_name"] = student["name"] if student else "Unknown"
            results.append(serialized)
        return results


# ===================== MUTATIONS =====================

class Login(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    Output = AuthPayload

    def mutate(self, info, email, password):
        user = users_col().find_one({"email": email})
        if not user or not verify_password(password, user["password"]):
            raise Exception("Invalid email or password")

        token = generate_token(str(user["_id"]), user["role"])
        user_data = serialize_user(user.copy())
        return AuthPayload(token=token, role=user_data["role"], user=user_data)


class AddTeacher(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    Output = UserType

    def mutate(self, info, name, email, password):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "organisation":
            raise Exception("Organisation access required")
        if users_col().find_one({"email": email}):
            raise Exception("Email already exists")

        doc = make_user(
            name=name, email=email, password_hash=hash_password(password),
            role="teacher", created_by=user_info["user_id"]
        )
        result = users_col().insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_user(doc)


class AddStudent(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        email = graphene.String(required=True)
        password = graphene.String(required=True)
        disability_type = graphene.String(default_value="none")

    Output = UserType

    def mutate(self, info, name, email, password, disability_type):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")
        if users_col().find_one({"email": email}):
            raise Exception("Email already exists")

        doc = make_user(
            name=name, email=email, password_hash=hash_password(password),
            role="student", disability_type=disability_type,
            created_by=user_info["user_id"]
        )
        result = users_col().insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_user(doc)


class DeleteUser(graphene.Mutation):
    class Arguments:
        id = graphene.String(required=True)
    ok = graphene.Boolean()

    def mutate(self, info, id):
        user_info = info.context.user_info
        if not user_info:
            raise Exception("Authentication required")
        
        oid = to_object_id(id)
        target_user = users_col().find_one({"_id": oid})
        if not target_user:
            raise Exception("User not found")
            
        if user_info["role"] == "organisation" and target_user["role"] == "teacher" and target_user["created_by"] == user_info["user_id"]:
            pass # OK
        elif user_info["role"] == "teacher" and target_user["role"] == "student" and target_user["created_by"] == user_info["user_id"]:
            pass # OK
        else:
            raise Exception("Access denied")
            
        result = users_col().delete_one({"_id": oid})
        return DeleteUser(ok=result.deleted_count > 0)


class CreateExam(graphene.Mutation):
    class Arguments:
        title = graphene.String(required=True)

    Output = ExamType

    def mutate(self, info, title):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")

        doc = make_exam(title=title, created_by=user_info["user_id"], created_at=datetime.now(timezone.utc).isoformat())
        result = exams_col().insert_one(doc)
        doc["_id"] = result.inserted_id
        serialized = serialize_id(doc)
        serialized["questions_count"] = 0
        return serialized


class AssignStudentToExam(graphene.Mutation):
    class Arguments:
        exam_id = graphene.String(required=True)
        student_id = graphene.String(required=True)
        assign = graphene.Boolean(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, exam_id, student_id, assign):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")
            
        exam = exams_col().find_one({"_id": to_object_id(exam_id)})
        student = users_col().find_one({"_id": to_object_id(student_id), "role": "student"})
        
        if not exam or exam["created_by"] != user_info["user_id"]:
            raise Exception("Exam not found or access denied")
        if not student or student["created_by"] != user_info["user_id"]:
            raise Exception("Student not found or access denied")
            
        if assign:
            users_col().update_one({"_id": student["_id"]}, {"$addToSet": {"assigned_exams": exam_id}})
        else:
            users_col().update_one({"_id": student["_id"]}, {"$pull": {"assigned_exams": exam_id}})
            
        return AssignStudentToExam(ok=True)


class AddQuestion(graphene.Mutation):
    class Arguments:
        exam_id = graphene.String(required=True)
        text = graphene.String(required=True)
        option_a = graphene.String(required=True)
        option_b = graphene.String(required=True)
        option_c = graphene.String(required=True)
        option_d = graphene.String(required=True)
        correct_answer = graphene.String(required=True)
        difficulty = graphene.String(default_value="medium")

    Output = QuestionType

    def mutate(self, info, exam_id, text, option_a, option_b, option_c, option_d, correct_answer, difficulty):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")
            
        exam = exams_col().find_one({"_id": to_object_id(exam_id)})
        if not exam or exam["created_by"] != user_info["user_id"]:
            raise Exception("Exam not found or access denied")

        doc = make_question(
            exam_id=exam_id, text=text, options=[option_a, option_b, option_c, option_d],
            correct_answer=correct_answer.upper(), difficulty=difficulty,
        )
        result = questions_col().insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_id(doc)


class DeleteQuestion(graphene.Mutation):
    class Arguments:
        id = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")

        oid = to_object_id(id)
        q = questions_col().find_one({"_id": oid})
        if not q:
            raise Exception("Question not found")
            
        exam = exams_col().find_one({"_id": to_object_id(q["exam_id"])})
        if not exam or exam["created_by"] != user_info["user_id"]:
            raise Exception("Access denied")
            
        result = questions_col().delete_one({"_id": oid})
        return DeleteQuestion(ok=result.deleted_count > 0)


class SubmitExam(graphene.Mutation):
    class Arguments:
        exam_id = graphene.String(required=True)
        answers = graphene.JSONString(required=True)
        time_taken = graphene.Int(required=True)

    Output = ExamResultType

    def mutate(self, info, exam_id, answers, time_taken):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "student":
            raise Exception("Student access required")

        # Check existing attempt
        if results_col().find_one({"student_id": user_info["user_id"], "exam_id": exam_id}):
            raise Exception("Exam already submitted")

        score = 0
        all_questions = list(questions_col().find({"exam_id": exam_id}))
        total = len(all_questions)

        for q in all_questions:
            q_id = str(q["_id"])
            if answers.get(q_id) and answers[q_id].upper() == q["correct_answer"]:
                score += 1

        doc = make_exam_result(
            exam_id=exam_id,
            student_id=user_info["user_id"],
            answers=answers,
            score=score,
            total=total,
            time_taken=time_taken,
            submitted_at=datetime.now(timezone.utc).isoformat(),
        )
        result = results_col().insert_one(doc)
        doc["_id"] = result.inserted_id

        student = users_col().find_one({"_id": to_object_id(user_info["user_id"])})
        serialized = serialize_result(doc)
        serialized["student_name"] = student["name"] if student else "Unknown"
        return serialized


# ===================== SCHEMA =====================

class UpdateQuestion(graphene.Mutation):
    class Arguments:
        id = graphene.String(required=True)
        text = graphene.String()
        option_a = graphene.String()
        option_b = graphene.String()
        option_c = graphene.String()
        option_d = graphene.String()
        correct_answer = graphene.String()
        difficulty = graphene.String()

    Output = QuestionType

    def mutate(self, info, id, **kwargs):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")

        oid = to_object_id(id)
        if not oid:
            raise Exception("Invalid question ID")
            
        q = questions_col().find_one({"_id": oid})
        if not q:
            raise Exception("Question not found")
        
        exam = exams_col().find_one({"_id": to_object_id(q["exam_id"])})
        if not exam or exam["created_by"] != user_info["user_id"]:
            raise Exception("Exam access denied")

        update = {}
        if kwargs.get("text"):
            update["text"] = kwargs["text"]
        if kwargs.get("correct_answer"):
            update["correct_answer"] = kwargs["correct_answer"].upper()
        if kwargs.get("difficulty"):
            update["difficulty"] = kwargs["difficulty"]

        if any(kwargs.get(f"option_{x}") for x in "abcd"):
            options = list(q["options"])
            for i, key in enumerate(["option_a", "option_b", "option_c", "option_d"]):
                if kwargs.get(key):
                    options[i] = kwargs[key]
            update["options"] = options

        if update:
            questions_col().update_one({"_id": oid}, {"$set": update})

        doc = questions_col().find_one({"_id": oid})
        return serialize_id(doc) if doc else None


class UpdateStudent(graphene.Mutation):
    class Arguments:
        id = graphene.String(required=True)
        name = graphene.String()
        email = graphene.String()
        password = graphene.String()
        disability_type = graphene.String()

    Output = UserType

    def mutate(self, info, id, **kwargs):
        user_info = info.context.user_info
        if not user_info or user_info["role"] != "teacher":
            raise Exception("Teacher access required")

        oid = to_object_id(id)
        if not oid:
            raise Exception("Invalid student ID")
            
        target = users_col().find_one({"_id": oid, "role": "student"})
        if not target or target.get("created_by") != user_info["user_id"]:
            raise Exception("Access denied or student not found")

        update = {}
        for field in ["name", "email", "disability_type"]:
            if kwargs.get(field):
                update[field] = kwargs[field]
        if kwargs.get("password"):
            update["password"] = hash_password(kwargs["password"])

        if update:
            users_col().update_one({"_id": oid}, {"$set": update})

        doc = users_col().find_one({"_id": oid})
        return serialize_user(doc) if doc else None


class Mutation(graphene.ObjectType):
    login = Login.Field()
    add_teacher = AddTeacher.Field()
    add_student = AddStudent.Field()
    update_student = UpdateStudent.Field()
    delete_user = DeleteUser.Field()
    create_exam = CreateExam.Field()
    assign_student_to_exam = AssignStudentToExam.Field()
    add_question = AddQuestion.Field()
    update_question = UpdateQuestion.Field()
    delete_question = DeleteQuestion.Field()
    submit_exam = SubmitExam.Field()


schema = graphene.Schema(query=Query, mutation=Mutation)

