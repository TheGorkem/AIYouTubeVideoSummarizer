import unittest

from app.routers.history import build_history_filters


class HistoryFilterTests(unittest.TestCase):
    def test_build_history_filters_with_only_user(self) -> None:
        where_clause, params = build_history_filters(
            user_id=7,
            search_query=None,
            source_kind=None,
        )

        self.assertEqual(where_clause, "user_id = ?")
        self.assertEqual(params, [7])

    def test_build_history_filters_with_source_kind(self) -> None:
        where_clause, params = build_history_filters(
            user_id=7,
            search_query=None,
            source_kind="youtube",
        )

        self.assertEqual(where_clause, "user_id = ? AND source_kind = ?")
        self.assertEqual(params, [7, "youtube"])

    def test_build_history_filters_with_search_query(self) -> None:
        where_clause, params = build_history_filters(
            user_id=7,
            search_query="meeting notes",
            source_kind=None,
        )

        self.assertIn("youtube_url LIKE ?", where_clause)
        self.assertIn("filename LIKE ?", where_clause)
        self.assertEqual(
            params,
            [7, "%meeting notes%", "%meeting notes%", "%meeting notes%", "%meeting notes%"],
        )

    def test_build_history_filters_ignores_invalid_source_kind(self) -> None:
        where_clause, params = build_history_filters(
            user_id=7,
            search_query="",
            source_kind="other",
        )

        self.assertEqual(where_clause, "user_id = ?")
        self.assertEqual(params, [7])
