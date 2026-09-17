"""Model level behaviour: serialization, the custom manager, upload paths."""

from backend.models import Portfolio, Transaction, User

from .support import BackendTestCase


class UserManagerTests(BackendTestCase):
    def test_username_is_unique(self):
        with self.assertRaises(Exception):
            self.make_user("alice")

    def test_get_by_natural_key_is_case_insensitive(self):
        self.assertEqual(User.objects.get_by_natural_key("ALICE"), self.user)
        self.assertEqual(User.objects.get_by_natural_key("alice"), self.user)

    def test_get_by_natural_key_raises_for_unknown_users(self):
        with self.assertRaises(User.DoesNotExist):
            User.objects.get_by_natural_key("nobody")

    def test_str_representation(self):
        self.assertEqual(str(self.user), f"{self.user.id}: alice")


class UserDirectoryPathTests(BackendTestCase):
    def test_profile_images_are_stored_per_user_folder(self):
        from backend.models import User as UserModel

        path = UserModel.user_directory_path(self.user, "avatar.png")
        self.assertTrue(path.startswith("profileImg/user_"))
        self.assertTrue(path.endswith("/avatar.png"))


class PortfolioModelTests(BackendTestCase):
    def test_serialize(self):
        payload = self.portfolio.serialize()
        self.assertEqual(payload["id"], self.portfolio.id)
        self.assertEqual(payload["name"], "Default")
        # e.g. "Feb 01 2024, 09:15 AM"
        self.assertRegex(payload["created_on"], r"^\w{3} \d{2} \d{4}, \d{2}:\d{2} (AM|PM)$")

    def test_str_representation(self):
        self.assertEqual(str(self.portfolio), "Default")

    def test_portfolios_are_owned_by_a_user(self):
        self.assertEqual(list(self.user.whose_portfolio.all()), [self.portfolio])


class TransactionModelTests(BackendTestCase):
    def test_serialize_uses_the_portfolio_ids(self):
        tx = self.make_tx()

        payload = tx.serialize()
        self.assertEqual(set(payload), {
            "id", "type", "symbol_id", "symbol", "bought_at",
            "quantity", "tx_id", "portfolio", "comment", "created_on",
        })
        self.assertEqual(payload["portfolio"], [self.portfolio.serialize()])
        self.assertEqual(payload["type"], Transaction.BUY)
        self.assertEqual(
            payload["created_on"], tx.created_on.strftime("%Y-%m-%dT%H:%M:%S")
        )

    def test_a_transaction_can_belong_to_several_portfolios(self):
        second = self.make_portfolio(self.user, "Second")
        tx = self.make_tx()
        tx.portfolio.add(second)

        self.assertEqual(
            sorted(p["name"] for p in tx.serialize()["portfolio"]), ["Default", "Second"]
        )
        self.assertEqual(second.transaction_set.count(), 1)

    def test_deleting_a_portfolio_leaves_its_transactions_untouched(self):
        """portfolio -> transaction is a M2M, so removing a portfolio only
        detaches it (the /portfolio/<id> view deletes exclusive rows itself)."""
        tx = self.make_tx()
        self.portfolio.delete()

        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())
        self.assertEqual(tx.portfolio.count(), 0)

    def test_str_representation(self):
        tx = self.make_tx(quantity=2.0, price=50.0)
        self.assertIn("2.0 of btc at 50.0", str(tx))

    def test_transactions_of_a_user_are_scoped(self):
        bob = self.make_user("bob")
        bob_portfolio = self.make_portfolio(bob, "Bob's portfolio")
        self.make_tx(user=bob, portfolio=bob_portfolio)

        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 0)
        self.assertEqual(Portfolio.objects.filter(user=self.user).count(), 1)
