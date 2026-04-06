"""
JWT authentication utilities and Django middleware.
"""
import hashlib
import time
import jwt

SECRET_KEY = "aceexam-secret-key-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRY = 86400  # 24 hours


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def generate_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": int(time.time()) + TOKEN_EXPIRY,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


class JWTAuthMiddleware:
    """
    Django middleware that decodes the Authorization header
    and attaches user_info to the request object.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        request.user_info = None

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            if payload:
                request.user_info = {
                    "user_id": payload["user_id"],
                    "role": payload["role"],
                }

        return self.get_response(request)
