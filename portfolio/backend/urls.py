from django.urls import path

from . import views

app_name = "backend"

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
    path("dashboard", views.dashboard, name="dashboard"),
    path("transaction", views.transaction, name="transaction"),
    path("transactionHistory", views.transactionHistory, name="transactionHistory"),
    path("userProfile", views.userProfile, name="userProfile"),
    # API Routes
    path("portfolio",views.portfolio, name="portfolio"),
    path("portfolio/<int:portf_id>", views.portfolio_id, name="portfolio_id"),
    path("txs", views.txs, name="txs"),
    path("tx/<int:tx_id>", views.tx, name="tx"),
    path("txs_data/<int:portfolio_id>", views.txs_data, name="txs_data")
]
