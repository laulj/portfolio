"""The context handed to the /transactionHistory page."""

from django.urls import reverse

from .support import BackendTestCase


class TransactionHistoryViewTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def test_renders_the_react_mount_point(self):
        response = self.client.get(reverse("backend:transactionHistory"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="transactionHistory-page"')

    def test_context_lists_the_real_portfolios_of_each_transaction(self):
        second = self.make_portfolio(self.user, "Second")
        tx = self.make_tx(portfolio=self.portfolio)
        tx.portfolio.add(second)

        response = self.client.get(reverse("backend:transactionHistory"))
        payload = response.context["txs"]
        self.assertEqual(len(payload), 1)
        # The ids must reference the Portfolio rows, never the Transaction row.
        self.assertEqual(
            {p["id"]: p["name"] for p in payload[0]["portfolio"]},
            {self.portfolio.id: "Default", second.id: "Second"},
        )

    def test_context_serializes_every_transaction_of_the_user(self):
        self.make_tx(quantity=1.0)
        tx = self.make_tx(quantity=4.0)

        response = self.client.get(reverse("backend:transactionHistory"))
        payload = response.context["txs"]
        self.assertEqual([tx_["id"] for tx_ in payload], [tx.id - 1, tx.id])

    def test_context_formats_created_on_for_the_client(self):
        tx = self.make_tx()

        response = self.client.get(reverse("backend:transactionHistory"))
        self.assertEqual(
            response.context["txs"][0]["created_on"],
            tx.created_on.strftime("%Y-%m-%d %H:%M:%S"),
        )
