"""The /userProfile page: updating details, changing the password."""

from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from .support import BackendTestCase, TempMediaMixin, png_bytes

User = get_user_model()


class ProfileUpdateTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def test_get_renders_the_current_details(self):
        response = self.client.get(reverse("backend:userProfile"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.user.username)
        self.assertContains(response, self.user.email)

    def test_update_changes_username_and_email(self):
        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "alice2", "email": "alice2@example.com"},
        )
        self.assertRedirects(response, reverse("backend:userProfile"))

        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "alice2")
        self.assertEqual(self.user.email, "alice2@example.com")

    def test_update_rejects_a_username_that_differs_only_by_case(self):
        """get_by_natural_key() matches on username__iexact, so accepting a
        case variant would make the next login raise MultipleObjectsReturned."""
        other = self.make_user("bob")

        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "BOB", "email": self.user.email},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFormError(
            response, "registerForm", "username", "A user with that username already exists."
        )

        self.user.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(self.user.username, "alice")
        self.assertEqual(other.username, "bob")
        self.assertEqual(User.objects.filter(username__iexact="bob").count(), 1)

    def test_update_rejects_an_email_that_differs_only_by_case(self):
        self.make_user("bob", email="bob@example.com")

        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "alice", "email": "BOB@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFormError(
            response,
            "registerForm",
            "email",
            "A user with that email address already exists.",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "alice@example.com")

    def test_username_can_be_rewritten_in_another_case(self):
        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "Alice", "email": "alice@example.com"},
        )
        self.assertRedirects(response, reverse("backend:userProfile"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "alice")

    def test_can_log_in_again_after_updating_the_profile(self):
        self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "Wonderland", "email": "wonderland@example.com"},
        )
        self.client.logout()

        response = self.client.post(
            reverse("backend:login"),
            {"username": "wonderland", "password": self.password},
        )
        self.assertRedirects(response, reverse("backend:index"))

    def test_unknown_action_is_a_bad_request(self):
        response = self.client.post(reverse("backend:userProfile"), {"action": "Delete"})
        self.assertEqual(response.status_code, 400)


class ProfileImageTests(TempMediaMixin, BackendTestCase):
    def upload(self, **extra):
        image = SimpleUploadedFile("avatar.png", png_bytes(), content_type="image/png")
        data = {
            "action": "Update",
            "username": "alice",
            "email": "alice@example.com",
            "profile_image": image,
        }
        data.update(extra)
        return self.client.post(reverse("backend:userProfile"), data)

    def test_uploading_a_profile_image(self):
        self.login()
        response = self.upload()
        self.assertRedirects(response, reverse("backend:userProfile"))

        self.user.refresh_from_db()
        self.assertTrue(self.user.profile_image.name.startswith("profileImg/user_"))
        self.assertTrue(Path(self.user.profile_image.path).exists())

    def test_updating_without_an_image_keeps_the_existing_one(self):
        self.login()
        self.upload()
        self.user.refresh_from_db()
        uploaded_name = self.user.profile_image.name

        response = self.client.post(
            reverse("backend:userProfile"),
            {"action": "Update", "username": "alice", "email": "alice@example.com"},
        )
        self.assertRedirects(response, reverse("backend:userProfile"))

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile_image.name, uploaded_name)


class PasswordChangeTests(BackendTestCase):
    new_password = "N3wPassw0rd!x"

    def setUp(self):
        super().setUp()
        self.assertTrue(self.login())

    def payload(self, **overrides):
        data = {
            "action": "Change",
            "old_password": self.password,
            "new_password1": self.new_password,
            "new_password2": self.new_password,
        }
        data.update(overrides)
        return data

    def test_change_with_wrong_old_password_is_rejected(self):
        response = self.client.post(
            reverse("backend:userProfile"), self.payload(old_password="not-my-password")
        )
        self.assertEqual(response.status_code, 200)
        self.assertFormError(
            response,
            "passwordChangeForm",
            "old_password",
            "Your old password was entered incorrectly. Please enter it again.",
        )

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))

    def test_change_keeps_the_session_and_allows_a_fresh_login(self):
        response = self.client.post(reverse("backend:userProfile"), self.payload())
        self.assertRedirects(response, reverse("backend:userProfile"))

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        # update_session_auth_hash() must keep the current session usable
        self.assertEqual(self.client.get(reverse("backend:dashboard")).status_code, 200)

        self.client.logout()
        response = self.client.post(
            reverse("backend:login"),
            {"username": "alice", "password": self.new_password},
        )
        self.assertRedirects(response, reverse("backend:index"))

    def test_change_rejects_a_weak_new_password(self):
        response = self.client.post(
            reverse("backend:userProfile"),
            self.payload(new_password1="123", new_password2="123"),
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("new_password2", response.context["passwordChangeForm"].errors)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))
