"""Test-suite for the ``backend`` app.

Run it with::

    python manage.py test backend -v 2

The suite needs no Node toolchain and makes no network calls: the Coingecko
lookup is mocked and a stand-in ``webpack-stats.json`` is generated when the
real one (produced by ``npm run collect``) is missing.
"""
