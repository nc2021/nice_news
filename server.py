"""Minimal HTTP server providing a news API and static frontend.

This server uses only the Python standard library. It serves files from the
``public`` directory and exposes a ``/api/news`` endpoint that fetches news from
SerpApi. Requests are logged to a SQLite database located at ``data.db`` in the
project root.
"""

from __future__ import annotations

import datetime
import http.server
import json
import os
import sqlite3
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn
from typing import Iterable, List, Mapping, MutableMapping


ROOT_DIR = Path(__file__).parent
PUBLIC_DIR = ROOT_DIR / "public"
DB_PATH = ROOT_DIR / "data.db"
HOST, PORT = "localhost", 8000


def init_db(db_path: Path) -> None:
    """Ensure the SQLite database and ``search_log`` table exist."""
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS search_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def log_search(db_path: Path, query: str) -> None:
    """Insert a search query into the log table."""
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO search_log (query, created_at) VALUES (?, ?)",
            (query, timestamp),
        )


def fetch_news(query: str, api_key: str) -> List[MutableMapping[str, str]]:
    """Retrieve news items from SerpApi using DuckDuckGo News engine."""
    params = {
        "engine": "duckduckgo_news",
        "q": query,
        "kl": "us-en",
        "df": "d",
        "safe": "1",
        "api_key": api_key,
    }
    encoded_params = urllib.parse.urlencode(params)
    url = f"https://serpapi.com/search.json?{encoded_params}"

    with urllib.request.urlopen(url, timeout=10) as response:  # nosec B310
        payload = json.loads(response.read().decode("utf-8"))

    results: Iterable[Mapping[str, str]] = payload.get("news_results", [])

    items: List[MutableMapping[str, str]] = []
    for result in results:
        item: MutableMapping[str, str] = {
            "title": result.get("title", ""),
            "link": result.get("link", ""),
            "snippet": result.get("snippet", ""),
            "source": result.get("source", ""),
            "date": result.get("date", ""),
        }

        thumbnail = result.get("thumbnail")
        if thumbnail:
            item["thumbnail"] = thumbnail

        items.append(item)

    return items


class NewsRequestHandler(SimpleHTTPRequestHandler):
    """HTTP handler serving static files and the news API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/news"):
            self.handle_news_api()
            return

        if self.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def handle_news_api(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        mode_param = (params.get("mode", ["good"])[0] or "good").strip().lower()
        mode = mode_param if mode_param in {"good", "breakthrough"} else "good"
        q_param = (params.get("q", [""])[0] or "").strip()

        if q_param:
            query = q_param
        else:
            query = "breakthrough news" if mode == "breakthrough" else "good news today"

        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            self.send_json(
                {"error": "SERPAPI_KEY is missing", "query": query, "mode": mode},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return

        try:
            items = fetch_news(query, api_key)
            log_search(DB_PATH, query)
            self.send_json({"query": query, "mode": mode, "items": items}, status=HTTPStatus.OK)
        except Exception as exc:  # pylint: disable=broad-except
            self.send_json(
                {"error": "Upstream fetch failed", "details": str(exc), "query": query, "mode": mode},
                status=HTTPStatus.BAD_GATEWAY,
            )

    def send_json(self, payload: MutableMapping[str, object], *, status: HTTPStatus) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        super().log_message(format, *args)


class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def run_server() -> None:
    init_db(DB_PATH)
    server = ThreadedHTTPServer((HOST, PORT), NewsRequestHandler)
    print(f"Serving on http://{HOST}:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
