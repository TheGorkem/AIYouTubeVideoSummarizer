from io import BytesIO
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import SummaryPayload

client = TestClient(app)


class ProcessRouteTests(unittest.TestCase):
    def test_healthcheck(self) -> None:
        response = client.get("/api/v1/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_process_requires_single_source(self) -> None:
        response = client.post("/api/v1/process", data={"summary_type": "all"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("YouTube linki", response.json()["detail"])

    def test_process_rejects_multiple_sources(self) -> None:
        response = client.post(
            "/api/v1/process",
            data={
                "youtube_url": "https://www.youtube.com/watch?v=demo123",
                "summary_type": "all",
            },
            files={"file": ("demo.mp3", BytesIO(b"audio"), "audio/mpeg")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("tek kaynak", response.json()["detail"])

    def test_process_trims_youtube_url_before_processing(self) -> None:
        with patch(
            "app.routers.process.transcript_from_youtube",
            return_value={
                "source_kind": "youtube",
                "transcript_source": "youtube-transcript-api",
                "language_hint": "tr",
                "transcript": "ornek transcript",
                "timestamped_transcript": "[00:00] ornek transcript",
            },
        ) as transcript_mock, patch(
            "app.routers.process.build_summaries",
            return_value=SummaryPayload(
                short="kisa",
                long=None,
                bullet_points=None,
                main_idea=None,
            ),
        ):
            response = client.post(
                "/api/v1/process",
                data={
                    "youtube_url": "  https://www.youtube.com/watch?v=demo123  ",
                    "summary_type": "short",
                },
            )

        self.assertEqual(response.status_code, 200)
        transcript_mock.assert_called_once_with("https://www.youtube.com/watch?v=demo123")

        data = response.json()
        self.assertIn("timestamped_transcript", data)
        self.assertIsNone(data["id"])  # anonymous, no history saved


if __name__ == "__main__":
    unittest.main()
