"""Login, logout and registration behaviour."""

from django.contrib.auth import get_user_model
from django.urls import reverse

from .support import BackendTestCase

User = get_user_model()


class LoginTests(BackendTestCase):
    def test_login_page_renders(self):
        response = self.client.get(reverse("backend:login"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "backend/login.html")

    def test_login_with_valid_credentials_starts_a_session(self):
        response = self.client.post(
            reverse("backend:login"), {"username": "alice", "password": self.password}
        )
        self.assertRedirects(response, reverse("backend:index"))
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.user.pk)

    def test_login_username_is_case_insensitive(self):
        response = self.client.post(
            reverse("backend:login"), {"username": "ALICE", "password": self.password}
        )
        self.assertRedirects(response, reverse("backend:index"))

    def test_login_with_invalid_credentials_does_not_start_a_session(self):
        response = self.client.post(
            reverse("backend:login"), {"username": "alice", "password": "wrong-password"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_with_inactive_user_is_rejected(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            reverse("backend:login"), {"username": "alice", "password": self.password}
        )
        self.assertEqual(response.status_code, 200)
        # django.contrib.auth refuses inactive accounts at authentication time,
        # so they are reported as invalid credentials.
        self.assertFormError(
            response,
            "loginForm",
            None,
            "Please enter a correct username and password. "
            "Note that both fields may be case-sensitive.",
        )
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_honours_next_parameter(self):
        """A login_required bounce must land on the originally requested page."""
        dashboard = reverse("backend:dashboard")
        response = self.client.get(dashboard)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f"{reverse('backend:login')}?next={dashboard}")

        response = self.client.post(
            response.url, {"username": "alice", "password": self.password}
        )
        self.assertRedirects(response, dashboard)

    def test_login_page_carries_the_next_parameter_into_the_form(self):
        """The hidden field is what makes the browser flow work: the form action
        has no query string, so `next` must travel in the POST body."""
        response = self.client.get(
            f"{reverse('backend:login')}?next={reverse('backend:dashboard')}"
        )
        self.assertContains(response, 'name="next"')

    def test_login_ignores_off_site_next_parameter(self):
        url = f"{reverse('backend:login')}?next=https://example.com/evil"
        response = self.client.post(url, {"username": "alice", "password": self.password})
        self.assertRedirects(response, reverse("backend:index"))


class LogoutTests(BackendTestCase):
    def test_logout_clears_the_session(self):
        self.assertTrue(self.login())
        response = self.client.get(reverse("backend:logout"))
        self.assertRedirects(response, reverse("backend:index"))
        self.assertNotIn("_auth_user_id", self.client.session)


class RegisterTests(BackendTestCase):
    def payload(self, **overrides):
        data = {
            "username": "newcomer",
            "email": "newcomer@example.com",
            "password1": "An0ther!Pass9",
            "password2": "An0ther!Pass9",
        }
        data.update(overrides)
        return data

    def test_register_creates_user_default_portfolio_and_logs_in(self):
        response = self.client.post(reverse("backend:register"), self.payload())
        self.assertRedirects(response, reverse("backend:index"))

        user = User.objects.get(username="newcomer")
        self.assertTrue(user.check_password("An0ther!Pass9"))
        self.assertEqual([p.name for p in user.whose_portfolio.all()], ["Default"])
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.pk)

    def test_register_requires_an_email(self):
        response = self.client.post(reverse("backend:register"), self.payload(email=""))
        self.assertEqual(response.status_code, 200)
        self.assertFormError(response, "registerForm", "email", "This field is required.")

    def test_register_requires_matching_passwords(self):
        response = self.client.post(
            reverse("backend:register"), self.payload(password2="Different!23")
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username="newcomer").exists())

    def test_register_rejects_username_varying_only_by_case(self):
        self.make_user("newcomer")

        response = self.client.post(
            reverse("backend:register"), self.payload(username="NewComer")
        )
        self.assertEqual(response.status_code, 200)
        self.assertFormError(
            response, "registerForm", "username", "A user with that username already exists."
        )
        self.assertEqual(User.objects.filter(username__iexact="newcomer").count(), 1)

    def test_register_rejects_email_varying_only_by_case(self):
        response = self.client.post(
            reverse("backend:register"), self.payload(email="ALICE@example.com")
        )
        self.assertEqual(response.status_code, 200)
        self.assertFormError(
            response,
            "registerForm",
            "email",
            "A user with that email address already exists.",
        )
        self.assertEqual(User.objects.filter(username="newcomer").count(), 0)
