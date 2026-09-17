"""Shared fixtures and helpers for the backend test-suite."""

import json
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from backend.models import Portfolio, Transaction

User = get_user_model()

# ---------------------------------------------------------------------------
# webpack bundles
# ---------------------------------------------------------------------------
# ``templates/backend/layout.html`` (inherited by every page) calls
# ``{% render_bundle %}``, which raises unless the bundle map produced by
# ``npm run collect`` exists. That file is git-ignored, so generate a minimal
# stand-in when it is missing to keep the suite runnable without Node.
WEBPACK_BUNDLES = ("layout", "index", "dashboard", "transaction", "transactionHistory")


def webpack_stats():
    """Minimal ``webpack-stats.json`` payload for the bundles used by templates."""
    assets = {}
    chunks = {}
    for name in WEBPACK_BUNDLES:
        filename = f"{name}-test.js"
        assets[filename] = {"name": filename, "publicPath": f"/static/dist/{filename}"}
        chunks[name] = [filename]
    return {"status": "done", "assets": assets, "chunks": chunks}


def stats_file_path():
    """Location the app's WEBPACK_LOADER setting points at."""
    return Path(settings.WEBPACK_LOADER["DEFAULT"]["STATS_FILE"])


def ensure_webpack_stats():
    """Create the bundle map if it is missing. Returns True when it was created."""
    path = stats_file_path()
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(webpack_stats()), encoding="utf-8")
    return True


# ---------------------------------------------------------------------------
# Coingecko
# ---------------------------------------------------------------------------
COINGECKO_BTC = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"}]}
COINGECKO_ETH = {"coins": [{"id": "ethereum", "symbol": "eth", "name": "Ethereum"}]}


def mock_coingecko(*payloads):
    """Pretend the Coingecko ``/search`` endpoint answered with ``payloads``.

    ``backend.forms.coingecko_symbols_lookup`` is patched, which covers
    ``Id_validator``, ``Symbol_validator`` and the direct call in ``views``.
    Unknown symbols deliberately resolve to nothing so validation fails.
    """
    payloads = payloads or (COINGECKO_BTC,)

    def lookup(query):
        query = (query or "").lower()
        for payload in payloads:
            for coin in payload["coins"]:
                if query in (coin["id"].lower(), coin["symbol"].lower(), coin["name"].lower()):
                    return payload
        return {"coins": []}

    return mock.patch("backend.forms.coingecko_symbols_lookup", side_effect=lookup)


# ---------------------------------------------------------------------------
# Base test case
# ---------------------------------------------------------------------------
class BackendTestCase(TestCase):
    """Base class providing a logged-in user, a portfolio and factory helpers."""

    password = "Str0ngPass!23"

    @classmethod
    def setUpClass(cls):
        cls._created_stats_file = ensure_webpack_stats()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        if cls._created_stats_file:
            stats_file_path().unlink(missing_ok=True)

    def setUp(self):
        self.user = self.make_user("alice")
        self.portfolio = self.make_portfolio(self.user, "Default")

    # -- factories ---------------------------------------------------------
    def make_user(self, username, password=None, email=None):
        return User.objects.create_user(
            username=username,
            email=email or f"{username}@example.com",
            password=password or self.password,
        )

    def make_portfolio(self, user=None, name="Default"):
        return Portfolio.objects.create(user=user or self.user, name=name)

    def make_tx(
        self,
        portfolio=None,
        user=None,
        type=Transaction.BUY,
        symbol_id="bitcoin",
        symbol="btc",
        price=100.0,
        quantity=1.0,
        days_ago=1,
        **extra,
    ):
        tx = Transaction.objects.create(
            user=user or self.user,
            type=type,
            symbol_id=symbol_id,
            symbol=symbol,
            bought_at=price,
            quantity=quantity,
            created_on=timezone.now() - timedelta(days=days_ago),
            **extra,
        )
        tx.portfolio.add(portfolio or self.portfolio)
        return tx

    # -- helpers -----------------------------------------------------------
    def login(self, username=None, password=None):
        return self.client.login(
            username=username or self.user.username,
            password=password or self.password,
        )

    def tx_payload(
        self,
        portfolio_ids=None,
        type=Transaction.BUY,
        symbol_id="btc",
        price="100.0",
        quantity="1.0",
        created_on=None,
        **extra,
    ):
        """POST data for the /transaction ModelForm."""
        if created_on is None:
            created_on = (timezone.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        if portfolio_ids is None:
            portfolio_ids = [str(self.portfolio.id)]
        payload = {
            "type": type,
            "symbol_id": symbol_id,
            "bought_at": price,
            "quantity": quantity,
            "tx_id": "",
            "portfolio": portfolio_ids,
            "comment": "test",
            "created_on": created_on,
        }
        payload.update(extra)
        return payload


class TempMediaMixin:
    """Point MEDIA_ROOT at a scratch directory so uploads never touch the repo."""

    @classmethod
    def setUpClass(cls):
        cls._media_root = tempfile.mkdtemp(prefix="portfolio-test-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)


def png_bytes(size=(2, 2), color="red"):
    """A small, valid PNG for ImageField uploads."""
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()
