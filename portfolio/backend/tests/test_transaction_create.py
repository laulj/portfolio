"""Recording (creating) transactions through the /transaction form."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from backend.models import Portfolio, Transaction

from .support import BackendTestCase, mock_coingecko


class TransactionCreateTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def test_creates_a_buying_transaction(self):
        with mock_coingecko():
            response = self.client.post(reverse("backend:transaction"), self.tx_payload())

        self.assertRedirects(response, reverse("backend:dashboard"))
        tx = Transaction.objects.get(user=self.user)
        self.assertEqual(tx.type, Transaction.BUY)
        # the Coingecko id is stored on symbol_id, the ticker on symbol
        self.assertEqual(tx.symbol_id, "bitcoin")
        self.assertEqual(tx.symbol, "btc")
        self.assertEqual(tx.quantity, 1.0)
        self.assertEqual(tx.bought_at, 100.0)
        self.assertEqual(list(tx.portfolio.all()), [self.portfolio])

    def test_links_the_transaction_to_every_selected_portfolio(self):
        second = self.make_portfolio(self.user, "Second")
        payload = self.tx_payload(
            portfolio_ids=[str(self.portfolio.id), str(second.id)]
        )
        with mock_coingecko():
            response = self.client.post(reverse("backend:transaction"), payload)

        self.assertRedirects(response, reverse("backend:dashboard"))
        tx = Transaction.objects.get(user=self.user)
        self.assertEqual(
            sorted(p.name for p in tx.portfolio.all()), ["Default", "Second"]
        )

    def test_creates_a_portfolio_from_a_typed_name(self):
        """Select2 allows free text, which creates a portfolio on the fly."""
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"), self.tx_payload(portfolio_ids=["LongTerm"])
            )

        self.assertRedirects(response, reverse("backend:dashboard"))
        tx = Transaction.objects.get(user=self.user)
        self.assertEqual([p.name for p in tx.portfolio.all()], ["LongTerm"])
        self.assertTrue(
            Portfolio.objects.filter(user=self.user, name="LongTerm").exists()
        )

    def test_rejects_an_unknown_symbol(self):
        with mock_coingecko():  # only BTC and ETH are "known"
            response = self.client.post(
                reverse("backend:transaction"), self.tx_payload(symbol_id="not-a-coin")
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("symbol_id", response.context["form"].errors)
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())

    def test_rejects_a_future_date(self):
        future = (timezone.now() + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"), self.tx_payload(created_on=future)
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("created_on", response.context["form"].errors)
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())


    def test_stale_numeric_portfolio_id_does_not_create_a_junk_portfolio(self):
        """A stale/unknown numeric id must not become a portfolio named like it."""
        stale_id = self.portfolio.id + 999
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(portfolio_ids=[str(stale_id)]),
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("portfolio", response.context["form"].errors)
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())
        self.assertFalse(Portfolio.objects.filter(name=str(stale_id)).exists())

    def test_another_users_portfolio_id_is_ignored_with_a_clear_message(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")

        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(portfolio_ids=[str(bob_portfolio.id)]),
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("portfolio", response.context["form"].errors)
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())
        self.assertFalse(Transaction.objects.filter(portfolio=bob_portfolio).exists())
        messages = [str(m) for m in response.context["messages"]]
        self.assertTrue(
            any("does not exist" in message for message in messages),
            f"expected a message explaining the portfolio is unknown, got {messages}",
        )

    def test_selling_without_holdings_is_rejected(self):
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(type=Transaction.SELL, quantity="1.0"),
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("quantity", response.context["form"].errors)
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())

    def test_selling_more_than_held_is_rejected(self):
        self.make_tx(quantity=1.0)
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(type=Transaction.SELL, quantity="2.0"),
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("quantity", response.context["form"].errors)
        self.assertFalse(
            Transaction.objects.filter(user=self.user, type=Transaction.SELL).exists()
        )

    def test_selling_within_the_holdings_is_accepted(self):
        self.make_tx(quantity=2.0)
        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(type=Transaction.SELL, quantity="1.0"),
            )

        self.assertRedirects(response, reverse("backend:dashboard"))
        self.assertTrue(
            Transaction.objects.filter(user=self.user, type=Transaction.SELL).exists()
        )

    def test_holdings_of_another_portfolio_do_not_count(self):
        """Selling must be validated per portfolio, not per user."""
        second = self.make_portfolio(self.user, "Second")
        self.make_tx(portfolio=second, quantity=5.0)

        with mock_coingecko():
            response = self.client.post(
                reverse("backend:transaction"),
                self.tx_payload(type=Transaction.SELL, quantity="1.0"),
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("quantity", response.context["form"].errors)
