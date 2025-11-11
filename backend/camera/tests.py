import os
import threading
from django.test import RequestFactory, TestCase
from unittest.mock import patch

from .views import (
    _ACTIVE_STREAMS,
    _ACTIVE_STREAMS_LOCK,
    _register_stream_session,
    _release_stream_session,
    camera_stream,
)


class StreamProofViewTests(TestCase):
    def setUp(self):
        with _ACTIVE_STREAMS_LOCK:
            _ACTIVE_STREAMS.clear()

    def test_requires_camera_url(self):
        with patch.dict(os.environ, {}, clear=True):
            resp = self.client.get("/stream/proof/")
        self.assertEqual(resp.status_code, 400)

    def test_returns_signature_payload(self):
        camera_url = "http://example.com/stream"
        with patch.dict(os.environ, {"CAMERA_URL": camera_url}, clear=True):
            resp = self.client.get("/stream/proof/")

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["via_backend"])
        self.assertEqual(data["camera_protocol"], "http")
        self.assertEqual(data["camera_host"], "example.com")
        self.assertIn("camera_signature", data)
        self.assertIn("server_time", data)
        self.assertIn("request_id", data)
        self.assertIsNone(data["client_id"])


class CameraStreamViewTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        with _ACTIVE_STREAMS_LOCK:
            _ACTIVE_STREAMS.clear()

    def test_iter_stream_receives_request(self):
        request = self.factory.get("/stream/")
        with patch.dict(os.environ, {"CAMERA_URL": "http://example.com"}, clear=True):
            with patch("camera.views._iter_stream") as iter_mock, patch(
                "camera.views._register_stream_session", return_value=None
            ):
                iter_mock.return_value = iter(())
                camera_stream(request)
        iter_kwargs = iter_mock.call_args.kwargs
        self.assertIs(iter_kwargs["request"], request)
        self.assertIsNone(iter_kwargs["client_id"])
        self.assertIsNone(iter_kwargs["stop_token"])


class StreamSessionHelpersTests(TestCase):
    def setUp(self):
        with _ACTIVE_STREAMS_LOCK:
            _ACTIVE_STREAMS.clear()

    def test_register_and_release_session(self):
        event = _register_stream_session("abc")
        self.assertIn("abc", _ACTIVE_STREAMS)
        self.assertFalse(event.is_set())

        _release_stream_session("abc", event)
        self.assertNotIn("abc", _ACTIVE_STREAMS)
        self.assertTrue(event.is_set())

    def test_register_replaces_existing_session(self):
        first = _register_stream_session("abc")
        second = _register_stream_session("abc")
        self.assertIsNot(first, second)
        self.assertTrue(first.is_set())
        self.assertFalse(second.is_set())
        self.assertIs(_ACTIVE_STREAMS.get("abc"), second)

    def test_abort_stream_view(self):
        event = threading.Event()
        with _ACTIVE_STREAMS_LOCK:
            _ACTIVE_STREAMS["abc"] = event

        resp_missing = self.client.post("/stream/abort/")
        self.assertEqual(resp_missing.status_code, 400)

        resp_ok = self.client.post("/stream/abort/?client=abc")
        self.assertEqual(resp_ok.status_code, 200)
        self.assertTrue(resp_ok.json()["aborted"])
        self.assertTrue(event.is_set())

    def test_abort_stream_view_no_session(self):
        resp = self.client.post("/stream/abort/?client=ghost")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["aborted"])
