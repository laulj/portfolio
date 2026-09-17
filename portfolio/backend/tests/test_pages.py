"""Post-login page rendering and access control."""

from django.urls import reverse

from .support import BackendTestCase

PAGES = [
    "backend:dashboard",
    "backend:transaction",
    "backend:transactionHistory",
    "backend:userProfile",
]


class PostLoginPageTests(BackendTestCase):
    """Every page behind @login_required must render without a server error."""

    def test_pages_redirect_anonymous_users_to_login(self):
        for name in PAGES:
            with self.subTest(page=name):
                response = self.client.get(reverse(name))
                self.assertEqual(response.status_code, 302)
                self.assertEqual(
                    response.url, f"{reverse('backend:login')}?next={reverse(name)}"
                )

    def test_pages_render_for_logged_in_users(self):
        self.assertTrue(self.login())
        for name in PAGES:
            with self.subTest(page=name):
                response = self.client.get(reverse(name))
                self.assertEqual(
                    response.status_code, 200, f"{name} returned {response.status_code}"
                )

    def test_dashboard_renders_the_react_mount_point(self):
        self.login()
        response = self.client.get(reverse("backend:dashboard"))
        self.assertContains(response, 'id="dashboard-page"')

    def test_transaction_page_prefills_only_the_users_portfolios(self):
        self.login()
        self.make_portfolio(self.user, "Second")
        other = self.make_user("bob")
        self.make_portfolio(other, "Bob's portfolio")

        response = self.client.get(reverse("backend:transaction"))
        choices = response.context["form"].fields["portfolio"].queryset
        self.assertEqual([p.name for p in choices], ["Default", "Second"])


class ApiAccessTests(BackendTestCase):
    def test_json_apis_require_login(self):
        tx = self.make_tx()
        endpoints = [
            reverse("backend:portfolio"),
            reverse("backend:txs"),
            reverse("backend:txs_data", args=[self.portfolio.id]),
            reverse("backend:tx", args=[tx.id]),
        ]
        for url in endpoints:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 302)
                self.assertTrue(response.url.startswith(reverse("backend:login")))

    def test_apis_answer_a_logged_in_user(self):
        tx = self.make_tx()
        self.login()
        endpoints = [
            reverse("backend:portfolio"),
            reverse("backend:txs"),
            reverse("backend:txs_data", args=[self.portfolio.id]),
            reverse("backend:tx", args=[tx.id]),
        ]
        for url in endpoints:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code, 200, f"{url} returned {response.status_code}"
                )
