"""The /portfolio and /portfolio/<id> JSON endpoints."""

from django.urls import reverse

from backend.models import Portfolio, Transaction

from .support import BackendTestCase


class PortfolioListTests(BackendTestCase):
    def test_returns_only_the_requesting_users_portfolios(self):
        self.login()
        self.make_portfolio(self.user, "Second")
        bob = self.make_user("bob")
        self.make_portfolio(bob, "Bob's portfolio")

        response = self.client.get(reverse("backend:portfolio"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p["name"] for p in response.json()], ["Default", "Second"])

    def test_serialized_portfolio_shape(self):
        self.login()
        response = self.client.get(reverse("backend:portfolio"))
        payload = response.json()[0]
        self.assertEqual(set(payload), {"id", "name", "created_on"})
        self.assertEqual(payload["id"], self.portfolio.id)
        self.assertEqual(payload["name"], self.portfolio.name)

    def test_returns_an_empty_list_for_a_user_without_portfolios(self):
        """The dashboard indexes data[0], so an empty list must stay a 200."""
        self.make_user("lonely")
        self.login("lonely")

        response = self.client.get(reverse("backend:portfolio"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_only_get_is_allowed(self):
        self.login()
        response = self.client.post(reverse("backend:portfolio"))
        self.assertEqual(response.status_code, 400)


class PortfolioDeleteTests(BackendTestCase):
    def test_delete_removes_the_portfolio_and_its_exclusive_transactions(self):
        self.login()
        spare = self.make_portfolio(self.user, "Spare")
        tx = self.make_tx(portfolio=spare)

        response = self.client.post(reverse("backend:portfolio_id", args=[spare.id]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Portfolio.objects.filter(pk=spare.pk).exists())
        self.assertFalse(Transaction.objects.filter(pk=tx.pk).exists())

    def test_delete_detaches_transactions_shared_with_another_portfolio(self):
        self.login()
        spare = self.make_portfolio(self.user, "Spare")
        tx = self.make_tx(portfolio=self.portfolio)
        tx.portfolio.add(spare)

        response = self.client.post(reverse("backend:portfolio_id", args=[spare.id]))
        self.assertEqual(response.status_code, 204)
        self.assertEqual(list(tx.portfolio.all()), [self.portfolio])

    def test_the_last_portfolio_cannot_be_deleted(self):
        self.login()
        response = self.client.post(
            reverse("backend:portfolio_id", args=[self.portfolio.id])
        )
        # /txs_data and friends answer 404 when there is nothing to show, and the
        # dashboard client only checks for a non-204 status.
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"], "Couldn't delete the only portfolio.")
        self.assertTrue(Portfolio.objects.filter(pk=self.portfolio.pk).exists())

    def test_another_users_portfolio_cannot_be_deleted(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        self.login()

        response = self.client.post(
            reverse("backend:portfolio_id", args=[bob_portfolio.id])
        )
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Portfolio.objects.filter(pk=bob_portfolio.pk).exists())

    def test_only_post_is_allowed(self):
        self.login()
        response = self.client.get(reverse("backend:portfolio_id", args=[self.portfolio.id]))
        self.assertEqual(response.status_code, 400)
