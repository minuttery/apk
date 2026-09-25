"""Serve the VM web snapshot locally with read-only production API access."""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1] / "apps" / "web"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path in ("/winners", "/sync") or path.path.startswith("/stats/"):
            target = "https://minuttery.com" + path.path
            if path.query:
                target += "?" + path.query
            try:
                request = Request(target, headers={"Accept": "application/json", "User-Agent": "Minuttery-Preview/1.0"})
                with urlopen(request, timeout=15) as response:
                    body = response.read()
                    self.send_response(response.status)
                    self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    self.wfile.write(body)
            except HTTPError as error:
                self.send_error(error.code, "Production API returned an error")
            except (URLError, TimeoutError):
                self.send_error(502, "Production API unavailable")
            return
        super().do_GET()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    print(f"Web preview: http://localhost:{args.port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()
