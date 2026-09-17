"""End-to-end walk through everything a logged-in user does."""

import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from backend.models import Portfolio, Transaction

from .support import BackendTestCase, mock_coingecko

User = get_user_model()

PAGES = (
    "backend:dashboard",
    "backend:transaction",
    "backend:transactionHistory",
    "backend:userProfile",
)


class PostLoginJourneyTests(BackendTestCase):
    """Register -> pages -> record -> read -> edit -> profile -> delete -> login.

    This mirrors the click path of a real user; any 5xx on the way fails a step.
    """

    new_username = "journey"
    new_password = "An0ther!Pass9"
    updated_password = "N3wPassw0rd!x"

    def day_ago(self, days=5):
        return (timezone.now() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    def test_full_journey(self):
        # 1. register: account, default portfolio and session
        response = self.client.post(
            reverse("backend:register"),
            {
                "username": self.new_username,
                "email": "journey@example.com",
                "password1": self.new_password,
                "password2": self.new_password,
            },
        )
        self.assertRedirects(response, reverse("backend:index"))
        user = User.objects.get(username=self.new_username)
        portfolio = Portfolio.objects.get(user=user, name="Default")

        # 2. every page behind @login_required renders
        for name in PAGES:
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

        # 3. the dashboard APIs answer for an empty portfolio
        self.assertEqual(
            self.client.get(reverse("backend:portfolio")).json()[0]["name"], "Default"
        )
        self.assertEqual(self.client.get(reverse("backend:txs")).status_code, 404)
        self.assertEqual(
            self.client.get(reverse("backend:txs_data", args=[portfolio.id])).status_code, 404
        )

        # 4. record a buying transaction
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                {
                    "type": "B",
                    "symbol_id": "btc",
                    "bought_at": "100.0",
                    "quantity": "2.0",
                    "tx_id": "",
                    "portfolio": [str(portfolio.id)],
                    "comment": "first buy",
                    "created_on": self.day_ago(),
                },
            )
        self.assertRedirects(response, reverse("backend:dashboard"))
        tx = Transaction.objects.get(user=user)
        self.assertEqual(tx.symbol, "btc")

        # 5. read it back through the API
        payload = self.client.get(reverse("backend:tx", args=[tx.id])).json()
        self.assertEqual(payload["quantity"], 2.0)
        self.assertEqual([p["id"] for p in payload["portfolio"]], [portfolio.id])

        # 6. the history page lists it
        response = self.client.get(reverse("backend:transactionHistory"))
        self.assertEqual([t["id"] for t in response.context["txs"]], [tx.id])
        self.assertEqual(self.client.get(reverse("backend:txs")).status_code, 200)
        self.assertEqual(
            self.client.get(reverse("backend:txs_data", args=[portfolio.id])).status_code, 200
        )


        # 7. edit it: turn the buying transaction into a partial sell
        with mock_coingecko():
            response = self.client.put(
                reverse("backend:tx", args=[tx.id]),
                data=json.dumps(
                    {
                        "type": "S",
                        "symbol_id": "btc",
                        "bought_at": 120.0,
                        "quantity": 1.0,
                        "tx_id": "",
                        "portfolio": [portfolio.id],
                        "comment": "partial exit",
                        "created_on": (timezone.now() - timedelta(days=4)).strftime(
                            "%Y-%m-%dT%H:%M:%S"
                        ),
                    }
                ),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 204)
        tx.refresh_from_db()
        self.assertEqual((tx.type, tx.quantity, tx.bought_at), ("S", 1.0, 120.0))

        # 8. profile: rename, then change the password
        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "journey2", "email": "journey2@example.com"},
        )
        self.assertRedirects(response, reverse("backend:userProfile"))

        response = self.client.post(
            reverse("backend:userProfile"),
            {
                "action": "Change",
                "old_password": self.new_password,
                "new_password1": self.updated_password,
                "new_password2": self.updated_password,
            },
        )
        self.assertRedirects(response, reverse("backend:userProfile"))
        self.assertEqual(self.client.get(reverse("backend:dashboard")).status_code, 200)

        # 9. remove the transaction again
        response = self.client.post(reverse("backend:tx", args=[tx.id]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Transaction.objects.filter(pk=tx.pk).exists())

        # 10. log out and back in with the new credentials
        self.client.get(reverse("backend:logout"))
        response = self.client.post(
            reverse("backend:login"),
            {"username": "journey2", "password": self.updated_password},
        )
        self.assertRedirects(response, reverse("backend:index"))
        for name in PAGES:
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)
