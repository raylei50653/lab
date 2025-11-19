from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Data


class DataCollectionTests(TestCase):
    def setUp(self):
        Data.objects.bulk_create([
            Data(text="hello world"),
            Data(text="HELLO Django"),
            Data(text="random text"),
        ])

    def test_list_without_search_returns_all_items(self):
        resp = self.client.get(reverse("data-collection"))
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(len(payload), 3)

    def test_list_with_search_filters_case_insensitively(self):
        resp = self.client.get(reverse("data-collection"), {"search": "hello"})
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        returned_texts = {item["text"] for item in payload}
        self.assertSetEqual(returned_texts, {"hello world", "HELLO Django"})

    def test_blank_search_acts_like_no_filter(self):
        resp = self.client.get(reverse("data-collection"), {"search": "   "})
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(len(payload), 3)


class DataMutationApiTests(APITestCase):
    def test_create_data_trims_payload(self):
        resp = self.client.post(
            reverse("data-collection"),
            {"text": "  hello world  "},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertEqual(payload["text"], "hello world")
        self.assertTrue(Data.objects.filter(id=payload["id"], text="hello world").exists())

    def test_create_data_requires_text(self):
        resp = self.client.post(reverse("data-collection"), {}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("text", resp.json())

    def test_create_data_rejects_blank_text(self):
        resp = self.client.post(
            reverse("data-collection"),
            {"text": "   "},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("text", resp.json())

    def test_update_data_replaces_existing_value(self):
        item = Data.objects.create(text="original")
        resp = self.client.put(
            reverse("data-detail", args=[item.id]),
            {"text": "updated"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.text, "updated")

    def test_update_data_rejects_blank_text(self):
        item = Data.objects.create(text="original")
        resp = self.client.put(
            reverse("data-detail", args=[item.id]),
            {"text": "  "},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("text", resp.json())

    def test_delete_data_removes_record(self):
        item = Data.objects.create(text="to delete")
        resp = self.client.delete(reverse("data-detail", args=[item.id]))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Data.objects.filter(id=item.id).exists())
