from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm

from .models import User, Portfolio, Transaction

# Display users in UserAdmin style
# admin.site.register(User, UserAdmin)


class CustomUserCreationForm(UserCreationForm):
    """
    A form that creates a user, with no privileges, from the given username and
    password, and email.
    """

    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + (
            "email",
            "profile_image",
        )
        proxy = True

    def clean_username(self):
        # Ensure the username is unique in case-insensitive manner
        username = self.cleaned_data['username'].lower()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError(
                User._meta.get_field("username").error_messages["unique"]
            )

        return username

    def clean_email(self):
        # Email is unique as well, so keep it unique in case-insensitive manner
        email = self.cleaned_data['email']
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(
                User._meta.get_field("email").error_messages["unique"]
            )

        return email


class UserAdmin(UserAdmin):
    # The forms to add and change user instances
    add_form = CustomUserCreationForm

    class Meta:
        proxy = True


# Now register the new UserAdmin...
admin.site.register(User, UserAdmin)
admin.site.register(Portfolio)
admin.site.register(Transaction)
