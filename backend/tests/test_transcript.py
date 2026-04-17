import unittest

from app.services.transcript import extract_youtube_video_id


class ExtractVideoIdTests(unittest.TestCase):
    def test_standard_url(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            "dQw4w9WgXcQ",
        )

    def test_short_url(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://youtu.be/dQw4w9WgXcQ"),
            "dQw4w9WgXcQ",
        )

    def test_shorts_url(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://www.youtube.com/shorts/abc123"),
            "abc123",
        )

    def test_embed_url(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://www.youtube.com/embed/abc123"),
            "abc123",
        )

    def test_mobile_url(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://m.youtube.com/watch?v=xyz789"),
            "xyz789",
        )

    def test_invalid_url(self) -> None:
        self.assertEqual(extract_youtube_video_id("https://example.com"), "")

    def test_empty_url(self) -> None:
        self.assertEqual(extract_youtube_video_id(""), "")

    def test_no_v_param(self) -> None:
        self.assertEqual(
            extract_youtube_video_id("https://www.youtube.com/watch"),
            "",
        )


if __name__ == "__main__":
    unittest.main()
