"""로컬 테스트용: 포트원 웹훅 POST 경로만 백엔드로 전달한다."""
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

WEBHOOK_PATH = "/api/payments/webhooks/portone"


class WebhookProxy(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != WEBHOOK_PATH:
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if size <= 0 or size > 65_536:
            self.send_error(413)
            return
        body = self.rfile.read(size)
        headers = {"Content-Type": self.headers.get("Content-Type", "application/json")}
        # 쿠키와 임의 인증 헤더는 전달하지 않는다.
        for name in ("webhook-id", "webhook-timestamp", "webhook-signature"):
            value = self.headers.get(name)
            if value is not None:
                headers[name] = value
        upstream = http.client.HTTPConnection("127.0.0.1", 8090, timeout=25)
        try:
            upstream.request("POST", WEBHOOK_PATH, body=body, headers=headers)
            result = upstream.getresponse()
            response = result.read()
            self.send_response(result.status)
            self.send_header("Content-Type", result.getheader("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except OSError:
            self.send_error(502, "Local backend unavailable")
        finally:
            upstream.close()

    def do_GET(self):
        self.send_error(404)

    def log_message(self, *_):
        # 요청 본문과 서명은 기록하지 않는다.
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8191), WebhookProxy).serve_forever()
