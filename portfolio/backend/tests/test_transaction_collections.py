"""The /txs and /txs_data/<portfolio_id> collection endpoints."""

from django.urls import reverse

from .support import BackendTestCase


class TxsCollectionTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def test_returns_every_transaction_of_the_user_only(self):
        self.make_tx(quantity=1.0)
        second = self.make_portfolio(self.user, "Second")
        self.make_tx(portfolio=second, quantity=3.0)
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        self.make_tx(user=bob, portfolio=bob_portfolio, quantity=9.0)

        response = self.client.get(reverse("backend:txs"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(tx["quantity"] for tx in response.json()), [1.0, 3.0])

    def test_returns_transactions_in_transaction_order(self):
        """The History page re-sorts by date client-side."""
        first = self.make_tx(quantity=1.0)
        second = self.make_tx(quantity=2.0)

        response = self.client.get(reverse("backend:txs"))
        self.assertEqual([tx["id"] for tx in response.json()], [first.id, second.id])

    def test_is_404_when_the_user_has_no_transactions(self):
        # Documented contract: the React clients treat a 404 as "nothing recorded".
        response = self.client.get(reverse("backend:txs"))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"], "No txs found.")

    def test_only_get_is_allowed(self):
        response = self.client.post(reverse("backend:txs"))
        self.assertEqual(response.status_code, 400)


class TxsDataCollectionTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def test_returns_only_the_requested_portfolios_transactions(self):
        self.make_tx(quantity=1.0)
        second = self.make_portfolio(self.user, "Second")
        self.make_tx(portfolio=second, quantity=2.0)

        response = self.client.get(reverse("backend:txs_data", args=[second.id]))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual([tx["quantity"] for tx in payload], [2.0])
        self.assertEqual([p["id"] for p in payload[0]["portfolio"]], [second.id])

    def test_is_404_for_a_portfolio_without_transactions(self):
        # The dashboard client relies on this to say "Please add some transactions."
        response = self.client.get(reverse("backend:txs_data", args=[self.portfolio.id]))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"], "No txs available.")

    def test_is_404_for_another_users_portfolio(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")

        response = self.client.get(reverse("backend:txs_data", args=[bob_portfolio.id]))
        self.assertEqual(response.status_code, 404)

    def test_is_404_for_an_unknown_portfolio(self):
        response = self.client.get(reverse("backend:txs_data", args=[999_999]))
        self.assertEqual(response.status_code, 404)

    def test_only_get_is_allowed(self):
        response = self.client.post(reverse("backend:txs_data", args=[self.portfolio.id]))
        self.assertEqual(response.status_code, 400)
