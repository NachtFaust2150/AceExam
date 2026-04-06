import hashlib
from pymongo import MongoClient

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

client = MongoClient("mongodb://localhost:27017")
db = client["aceexam_db"]
users = list(db["users"].find())

print(f"Total Users Found: {len(users)}")
for u in users:
    print(f"- {u['name']} ({u['email']}) Role: {u['role']}")

# Check specific demo users
emails = ["org@ace.com", "teacher@ace.com", "student@ace.com"]
for email in emails:
    user = db["users"].find_one({"email": email})
    if user:
        print(f"PASS: {email} exists.")
    else:
        print(f"FAIL: {email} MISSING!")
