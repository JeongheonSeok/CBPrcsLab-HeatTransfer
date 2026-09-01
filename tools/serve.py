#!/usr/bin/env python3
"""Static dev server that sends Cache-Control: no-store."""

# 모듈 하나만 캐시에서 옛 것이 오면 import가 깨지고 화면이 통째로 빈다.
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 404만 남긴다. 정상 요청까지 찍으면 로그에서 문제를 못 찾는다.
        if args and str(args[1]).startswith("4"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
