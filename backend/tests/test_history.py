import asyncio
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.database import init_db, set_db_path
from app.main import app

_test_db_path = ""
client = TestClient(app)


def setUpModule():
    global _test_db_path
    fd, _test_db_path = tempfile.mkstemp(suffix=".db", prefix="test_history_")
    os.close(fd)
    set_db_path(_test_db_path)
    asyncio.run(init_db())


def tearDownModule():
    if _test_db_path and os.path.exists(_test_db_path):
        os.unlink(_test_db_path)


def _get_auth_token() -> str:
    email = "history_test@example.com"
    password = "historypass123"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "History Tester"},
    )
    if reg.status_code == 200:
        return reg.json()["token"]
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return login.json()["token"]


class HistoryRouteTests(unittest.TestCase):
    def test_01_history_requires_auth(self) -> None:
        response = client.get("/api/v1/history")
        self.assertEqual(response.status_code, 401)

    def test_02_history_list_empty(self) -> None:
        token = _get_auth_token()
        response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("items", data)
        self.assertIn("total", data)

    def test_03_process_creates_history_and_crud(self) -> None:
        token = _get_auth_token()

        with patch(
            "app.routers.process.transcript_from_youtube",
            return_value={
                "source_kind": "youtube",
                "transcript_source": "youtube-transcript-api",
                "language_hint": "tr",
                "transcript": "test transcript for history",
                "timestamped_transcript": "[00:00] test",
            },
        ), patch(
            "app.services.summarizer._generate_summary",
            return_value="mock summary",
        ):
            process_response = client.post(
                "/api/v1/process",
                data={
                    "youtube_url": "https://www.youtube.com/watch?v=test123",
                    "summary_type": "short",
                    "summary_language": "tr",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(process_response.status_code, 200)
        history_id = process_response.json()["id"]
        self.assertIsNotNone(history_id)

        # List
        list_response = client.get(
            "/api/v1/history",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(list_response.status_code, 200)
        ids = [item["id"] for item in list_response.json()["items"]]
        self.assertIn(history_id, ids)

        # Get
        get_response = client.get(
            f"/api/v1/history/{history_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.json()["id"], history_id)

        # Delete
        delete_response = client.delete(
            f"/api/v1/history/{history_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertIn(delete_response.status_code, [200, 204])


if __name__ == "__main__":
    unittest.main()
