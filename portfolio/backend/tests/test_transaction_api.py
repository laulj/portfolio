"""The /tx/<id> JSON endpoint (read, update, delete)."""

import json
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from backend.models import Transaction

from .support import BackendTestCase, mock_coingecko


class TransactionDetailApiTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())
        self.tx = self.make_tx(quantity=2.0)

    def put_payload(self, **overrides):
        payload = {
            "type": Transaction.SELL,
            "symbol_id": "btc",
            "bought_at": 150.0,
            "quantity": 1.0,
            "tx_id": "",
            "portfolio": [self.portfolio.id],
            "comment": "edited",
            "created_on": (timezone.now() - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S"),
        }
        payload.update(overrides)
        return payload

    def put(self, tx_id=None, **overrides):
        with mock_coingecko():
            return self.client.put(
                reverse("backend:tx", args=[tx_id or self.tx.id]),
                data=json.dumps(self.put_payload(**overrides)),
                content_type="application/json",
            )

    def test_get_returns_the_serialized_transaction(self):
        response = self.client.get(reverse("backend:tx", args=[self.tx.id]))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.tx.id)
        self.assertEqual(payload["type"], Transaction.BUY)
        self.assertEqual(payload["symbol_id"], "bitcoin")
        self.assertEqual(payload["quantity"], 2.0)
        self.assertEqual([p["id"] for p in payload["portfolio"]], [self.portfolio.id])
        self.assertEqual(
            payload["created_on"], self.tx.created_on.strftime("%Y-%m-%dT%H:%M:%S")
        )

    def test_get_of_another_users_transaction_is_404(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        bob_tx = self.make_tx(user=bob, portfolio=bob_portfolio)

        response = self.client.get(reverse("backend:tx", args=[bob_tx.id]))
        self.assertEqual(response.status_code, 404)

    def test_put_updates_the_transaction(self):
        response = self.put()
        self.assertEqual(response.status_code, 204)

        self.tx.refresh_from_db()
        self.assertEqual(self.tx.bought_at, 150.0)
        self.assertEqual(self.tx.quantity, 1.0)
        self.assertEqual(self.tx.comment, "edited")

    def test_put_turns_a_buying_transaction_into_a_smaller_sell(self):
        """The coins bought by the edited transaction are still held, so a
        partial sell of them must be accepted."""
        response = self.put(type=Transaction.SELL, quantity=1.0)
        self.assertEqual(response.status_code, 204)

        self.tx.refresh_from_db()
        self.assertEqual(self.tx.type, Transaction.SELL)
        self.assertEqual(self.tx.quantity, 1.0)

    def test_put_rejects_selling_more_than_held(self):
        response = self.put(type=Transaction.SELL, quantity=5.0)
        self.assertEqual(response.status_code, 400)
        self.assertIn("quantity", response.json()["error"])

        self.tx.refresh_from_db()
        self.assertEqual(self.tx.type, Transaction.BUY)

    def test_put_rejects_a_future_date(self):
        future = (timezone.now() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
        response = self.put(created_on=future)
        self.assertEqual(response.status_code, 400)
        self.assertIn("created_on", response.json()["error"])

    def test_put_of_another_users_transaction_is_404(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        bob_tx = self.make_tx(user=bob, portfolio=bob_portfolio)

        response = self.put(tx_id=bob_tx.id)
        self.assertEqual(response.status_code, 404)
        bob_tx.refresh_from_db()
        self.assertEqual(bob_tx.bought_at, 100.0)

    def test_post_deletes_the_transaction(self):
        response = self.client.post(reverse("backend:tx", args=[self.tx.id]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Transaction.objects.filter(pk=self.tx.pk).exists())

    def test_post_of_another_users_transaction_is_404(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        bob_tx = self.make_tx(user=bob, portfolio=bob_portfolio)

        response = self.client.post(reverse("backend:tx", args=[bob_tx.id]))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Transaction.objects.filter(pk=bob_tx.pk).exists())

    def test_unsupported_method_is_rejected(self):
        response = self.client.patch(reverse("backend:tx", args=[self.tx.id]))
        self.assertEqual(response.status_code, 400)
