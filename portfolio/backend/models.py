from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import UserManager, PermissionsMixin
from django.contrib.auth.validators import ASCIIUsernameValidator
from django.core.validators import RegexValidator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from backend.storage_backend import PublicMediaS3Boto3Storage


class CustomUserManager(UserManager):
    # Override UserManager to validate PortfolioUser in case-insensitive manner.
    def get_by_natural_key(self, username):
        case_insensitive_username_field = "{}__iexact".format(self.model.USERNAME_FIELD)
        return self.get(**{case_insensitive_username_field: username})


class User(AbstractBaseUser, PermissionsMixin):
    """
    An abstract base class implementing a fully featured User model with
    admin-compliant permissions.
    Username and Email fields are required, others are optional.

    Changes:
    1. Ensure the email field is mandatory.
    2. Ensuring the username and email are unique (case-insensitive)
    3. Limiting username to ASCII letters and numbers, in addition to @, ., +, -, and _.
    4. Added profile_image for uploading image.
    5. Added email_confirmed for email verification.

    Referenced, and modified from Django original repo,
    https://github.com/django/django/blob/main/django/contrib/auth/models.py
    """

    def user_directory_path(instance, filename):
        # file will be uploaded to MEDIA_ROOT/user_<id>/<filename>
        return "user_{0}/{1}".format(instance.user.id, filename)

    # Accepting ASCII instead of Unicode
    username_validator = ASCIIUsernameValidator()

    username = models.CharField(
        _("username"),
        max_length=150,
        unique=True,
        help_text=_(
            "Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only."
        ),
        validators=[username_validator],
        error_messages={
            "unique": _("A user with that username already exists."),
        },
    )
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    # Email is mandatory
    email = models.EmailField(
        _("email address"),
        unique=True,
        help_text=_(
            "Required. Email will not be utilized for any other purposes other than authentication."
        ),
        error_messages={
            "unique": _("A user with that email address already exists."),
        },
    )
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    profile_image = models.ImageField(
        upload_to=user_directory_path, storage=PublicMediaS3Boto3Storage(), blank=True, default="default.png"
    )
    email_confirmed = models.BooleanField(default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = CustomUserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email)

    def get_full_name(self):
        """
        Return the first_name plus the last_name, with a space in between.
        """
        full_name = "%s %s" % (self.first_name, self.last_name)
        return full_name.strip()

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name

    def email_user(self, subject, message, from_email=None, **kwargs):
        """Send an email to this user."""
        send_mail(subject, message, from_email, [self.email], **kwargs)

    def __str__(self):
        """Return string representation of the model."""
        return f"{self.id}: {self.username}"


class Portfolio(models.Model):

    name_validator = ASCIIUsernameValidator()

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_index=True, related_name="whose_portfolio"
    )
    name = models.CharField(
        _("title"),
        max_length=150,
        help_text=_(
            "Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only."
        ),
        validators=[name_validator],
        error_messages={
            "unique": _("A portfolio with that name already exists."),
        },
    )
    description = models.TextField(
        help_text=_(
            "Optional. An introduction to your portfolio. Letters, digits and @/./+/-/_ only."
        )
    )
    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name}"

    def serialize(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_on": self.created_on.strftime("%b %d %Y, %I:%M %p")
        }

class Transaction(models.Model):
    BUY = "B"
    SELL = "S"
    ACTION = [(BUY, "Buying"), (SELL, "Selling")]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_index= True, related_name="whose_transaction"
    )
    type = models.CharField(_("act"), max_length=8, choices=ACTION, default=BUY)
    symbol_id = models.CharField(
        _("symbol"),
        max_length=150,
        help_text=_("Required. All available symbols are extracted from Coingecko."),       
    )
    symbol = models.CharField(max_length=150)
    bought_at = models.FloatField(_("price"), help_text=_(
            "Required. The price at which you made the trade."
        ))
    quantity = models.FloatField(_("qtty"), help_text=_(
            "Required. The quantitiy of the coin you traded."
        ))
    tx_id = models.CharField(
        _("tx id"),
        max_length=150,
        blank=True,
        help_text=_(
            "Optional. Referring to the transaction id. For instance, 0xea5528AD7..."
        ),
        validators=[
            RegexValidator(
                r"[^a-zA-Z0-9]",
                message=_("Please provide a valid tx id, letters, or digits only"),
                inverse_match=True,
            )
        ],
    )
    portfolio = models.ManyToManyField(Portfolio, help_text=_("Required."))
    comment = models.TextField(help_text=_("Optional. A note to your trade."), blank=True)
    created_on = models.DateTimeField(_("date"), default=timezone.now)

    class Meta:
        ordering = ["id", "created_on"]

    def __str__(self):
        return f"Transaction {self.id}: {self.user.username} {self.type} {self.quantity} of {self.symbol} at {self.bought_at} on {self.created_on}."
    
    def serialize(self):
        return {
            "id": self.id,
            "type": self.type,
            "symbol_id": self.symbol_id,
            "symbol": self.symbol,
            "bought_at": self.bought_at,
            "quantity": self.quantity,
            "tx_id": self.tx_id,
            "portfolio": [portfolio.serialize() for portfolio in self.portfolio.all()],
            "comment": self.comment,
            "created_on": self.created_on.strftime("%Y-%m-%dT%H:%M:%S")
        }