"""
Serialization helpers for MongoDB documents.
Handles ObjectId ↔ string conversion and data formatting.
"""
from bson import ObjectId


def serialize_id(doc):
    """Convert MongoDB _id (ObjectId) to string 'id' field."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def serialize_list(docs):
    """Serialize a list of MongoDB documents."""
    return [serialize_id(doc) for doc in docs]


def to_object_id(id_str):
    """Safely convert a string to ObjectId."""
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def serialize_user(doc):
    """Serialize a user document, removing the password hash."""
    if doc is None:
        return None
    doc = serialize_id(doc)
    doc.pop("password", None)
    return doc


def serialize_question(doc, include_answer=True):
    """Serialize a question document."""
    if doc is None:
        return None
    doc = serialize_id(doc)
    if not include_answer:
        doc.pop("correct_answer", None)
    return doc


def serialize_result(doc):
    """Serialize an exam result document."""
    if doc is None:
        return None
    return serialize_id(doc)
