from django.test import TestCase
from django.urls import reverse

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
