import asyncio
import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from app.database import init_db, set_db_path
from app.main import app

_test_db_path = ""
client = TestClient(app)


def setUpModule():
    """Create a temp DB file for auth tests."""
    global _test_db_path
    fd, _test_db_path = tempfile.mkstemp(suffix=".db", prefix="test_auth_")
    os.close(fd)
    set_db_path(_test_db_path)
    asyncio.run(init_db())


def tearDownModule():
    if _test_db_path and os.path.exists(_test_db_path):
        os.unlink(_test_db_path)


class AuthRouteTests(unittest.TestCase):
    _test_email = "test_auth@example.com"
    _test_password = "testpass123"

    def test_01_register_success(self) -> None:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": self._test_email,
                "password": self._test_password,
                "display_name": "Test User",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], self._test_email)

    def test_02_register_duplicate_email(self) -> None:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": self._test_email,
                "password": self._test_password,
                "display_name": "Dup User",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_03_login_success(self) -> None:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": self._test_email, "password": self._test_password},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_04_login_wrong_password(self) -> None:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": self._test_email, "password": "wrongpass"},
        )
        self.assertEqual(response.status_code, 401)

    def test_05_me_with_valid_token(self) -> None:
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": self._test_email, "password": self._test_password},
        )
        token = login_response.json()["token"]
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self._test_email)

    def test_06_me_without_token(self) -> None:
        response = client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
