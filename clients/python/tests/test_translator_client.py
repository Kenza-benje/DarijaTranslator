"""CLI regression checks using mocked input and HTTP; no live API requests."""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
import urllib.error


spec = importlib.util.spec_from_file_location(
    "translator_client", Path(__file__).resolve().parents[1] / "translator_client.py")
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class TranslatorClientTest(unittest.TestCase):
    def run_client(self, body=b'{"translation":"hello"}', failure=None,
                   text="Hello", username="test-user", password="test-password"):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = body
        output = io.StringIO()
        with patch("builtins.input", side_effect=[text, username]), \
                patch.object(client.getpass, "getpass", return_value=password), \
                patch.object(client.urllib.request, "urlopen", return_value=response,
                             side_effect=failure) as request, \
                contextlib.redirect_stdout(output):
            client.main()
        return output.getvalue(), request

    def test_unicode_translation_and_authenticated_request(self):
        output, request = self.run_client(
            json.dumps({"translation": "سلام"}).encode("utf-8"))
        self.assertIn("سلام", output)
        req = request.call_args.args[0]
        self.assertEqual(req.full_url, client.URL)
        self.assertEqual(req.method, "POST")
        self.assertEqual(json.loads(req.data), {"text": "Hello"})
        self.assertEqual(req.get_header("Authorization"), "Basic " +
                         base64.b64encode(b"test-user:test-password").decode("ascii"))
        self.assertEqual(request.call_args.kwargs["timeout"], 200)

    def test_blank_input_does_not_call_backend(self):
        output, request = self.run_client(text="   ")
        self.assertIn("Text cannot be empty", output)
        request.assert_not_called()

    def test_invalid_credentials_do_not_call_backend(self):
        for username, password in [("", "test"), ("test", ""), ("user:name", "test")]:
            with self.subTest(username=username):
                _, request = self.run_client(username=username, password=password)
                request.assert_not_called()

    def test_malformed_and_invalid_translation_responses(self):
        for body in [b"not JSON", b"null", b"[]", b"{}", b'{"translation":null}',
                     b'{"translation":42}', b'{"translation":"  "}', b"\xff"]:
            with self.subTest(body=body):
                output, _ = self.run_client(body)
                self.assertIn("Invalid response:", output)

    def test_connection_and_timeout_errors(self):
        for failure in [urllib.error.URLError("offline"), TimeoutError("timed out"),
                        ConnectionResetError("connection reset")]:
            with self.subTest(failure=type(failure).__name__):
                output, _ = self.run_client(failure=failure)
                self.assertIn("Connection error:", output)

    def test_http_authentication_error(self):
        failure = urllib.error.HTTPError(client.URL, 401, "Unauthorized", {}, io.BytesIO(b"Denied"))
        output, _ = self.run_client(failure=failure)
        self.assertIn("Server error: HTTP 401", output)


if __name__ == "__main__":
    unittest.main()
