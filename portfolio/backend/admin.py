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


class UserAdmin(UserAdmin):
    # The forms to add and change user instances
    add_form = CustomUserCreationForm

    class Meta:
        proxy = True


# Now register the new UserAdmin...
admin.site.register(User, UserAdmin)
admin.site.register(Portfolio)
admin.site.register(Transaction)
