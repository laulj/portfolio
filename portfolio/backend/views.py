from django.shortcuts import render

import json
from datetime import datetime
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.forms import (
    AuthenticationForm,
    PasswordChangeForm,
    PasswordResetForm,
    SetPasswordForm,
    UserChangeForm,
    UserCreationForm,
)
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import (
    HttpResponse,
    HttpResponseRedirect,
    render,
    get_object_or_404,
    get_list_or_404,
)
from django.urls import reverse
from django.views import defaults
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.debug import sensitive_post_parameters
from django.core.exceptions import ObjectDoesNotExist
from django.utils.translation import gettext_lazy as _

from .models import User, Portfolio, Transaction
from .forms import CustomUserChangeForm, TransactionForm, Symbol_validator
from .admin import CustomUserCreationForm


def index(request):

    # Authenticated users view their inbox
    if request.user.is_authenticated:
        print(f"user {request.user.username} is authenticated.")
        return render(request, "portfolio/index.html")

    # Everyone else is prompted to sign in
    else:
        return HttpResponseRedirect(reverse("backend:login"))

@sensitive_post_parameters('user', 'password')
def login_view(request):
    loginForm = AuthenticationForm()

    if request.method == "POST":

        # Attempt to sign user in
        loginForm = AuthenticationForm(data=request.POST)

        # Clean the form data
        if loginForm.is_valid():
            username = loginForm.cleaned_data.get("username")
            password = loginForm.cleaned_data.get("password")
            user = authenticate(request, username=username, password=password)

            # Check if authentication successful
            if user is not None:
                login(request, user)
                return HttpResponseRedirect(reverse("backend:index"))
            else:
                return render(
                    request,
                    "portfolio/login.html",
                )

    return render(request, "portfolio/login.html", {"loginForm": loginForm})


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("backend:index"))


def register(request):

    if request.method == "POST":
        # create a form instance and populate it with data from the request
        registerForm = CustomUserCreationForm(request.POST, request.FILES)

        # Clean and validate the form
        if registerForm.is_valid():
            # Attempt to create new user
            user = registerForm.save(commit=False)
            
            # save the user's id and auction status
            user.user = request.user

            # save the new instance
            user.save()

            # Verify if the asset is saved
            try:
                User.objects.get(pk=user.id)
            except ObjectDoesNotExist:
                messages.add_message(
                    request, messages.ERROR, f"Registration failed as {user.username}"
                )
                return render(
                    request, "portfolio/register.html", {"registerForm": registerForm}
                )

            login(request, user)
            messages.add_message(
                request,
                messages.SUCCESS,
                f"Successfully registered as {user.username}",
            )
            # Create a default portfolio when user is successfully registered
            Portfolio.objects.create(
                user=user,
                name="Default",
                description=_("An auto-generated default portfolio."),
            )
            return HttpResponseRedirect(reverse("backend:index"))

    else:
        registerForm = CustomUserCreationForm()

    return render(request, "portfolio/register.html", {"registerForm": registerForm})

@login_required
def dashboard(request):
    return render(request, "portfolio/dashboard.html")

@login_required
def transaction(request):

    if request.method == "POST":
        # create a form instance and populate it with data from the request
        #print("readhere:",request.POST.getlist('portfolio'))
        
        print(f"request.Post: {request.POST}")
        #print(transactionForm);
        # Clean and validate the form
        new_portfolio = []
        for index, portfolio in enumerate(request.POST.getlist('portfolio')):
            try:
                Portfolio.objects.get(id=int(portfolio))
                new_portfolio.append(portfolio)
            except (ObjectDoesNotExist, ValueError) as error:
                obj, created = Portfolio.objects.get_or_create(user=request.user, name=portfolio)
                if created:
                    print(f"Portfolio: {portfolio} created!")
                    new_portfolio.append(obj.id)
                    #request.POST.getlist('portfolio')[index] = obj.id
                else:
                    messages.add_message(
                        request, messages.ERROR, _(f"Failed to create Portfolio {portfolio}.")
                    )
                    print(error)
        #print(f"new portfolio: {request.POST.getlist('portfolio')} and {new_portfolio}")
        user_request = {
            'type': request.POST.get('type'),
            'symbol_id': request.POST.get('symbol_id'),
            'bought_at': request.POST.get('bought_at'),
            'quantity': request.POST.get('quantity'),
            'tx_id': request.POST.get('tx_id'),
            'portfolio': new_portfolio,
            'comment': request.POST.get('comment'),
            'created_on': request.POST.get('created_on'),
            'initial-created_on': request.POST.get('initial-created_on'),
        }
        print(user_request)
        # Passing extra arg 'portfolio' to create new portfolio if it does not exists before saving the tx
        transactionForm = TransactionForm(data=user_request, request=request, portfolio=new_portfolio)
        if transactionForm.is_valid():
            # Attempt to create new user
            tx = transactionForm.save(commit=False)
            # save the user's id and auction status
            tx.user = User.objects.get(pk=request.user.id)
            # get the asset symbol using its id
            tx.symbol = Symbol_validator(user_request['symbol_id'])
            # save the new instance
            tx.save()
            # save the many-to-many data for the form
            transactionForm.save_m2m()

            print("form is valid")
            return HttpResponseRedirect(reverse("backend:dashboard"))
        
    else:
        transactionForm = TransactionForm()

    return render(request, "portfolio/transaction.html", {"form": transactionForm})

@login_required
def transactionHistory(request):
    txs = Transaction.objects.filter(user=request.user)
    portfolio = []
    serialize_txs = []
    for tx in txs:
        newTx = tx.serialize()
        newTx["created_on"] = newTx["created_on"].replace("T", " ")
        newTx["portfolio"] = [{"id": tx.id, "name": tx.name} for tx in tx.portfolio.all()]
        serialize_txs.append(newTx)
        tx.user = None
    
    return render(request, "portfolio/transactionHistory.html", {"txs":serialize_txs})

@login_required
def userProfile(request):
    print('user:',request.user.profile_image, request.user.profile_image.url)

    if request.method == "POST":
        action = request.POST.get('action')
        print('action:', action)

        # create a form instance and populate it with data from the request
        if action == 'Update':
            registerForm = CustomUserChangeForm(request.POST, request.FILES, instance = get_object_or_404(User, pk=request.user.id))
            print(f"request.POST: {request.POST}")
            print(f"request.FILES: {request.FILES}")
            #print(f'registerForm:', registerForm)
            # Clean and validate the form
            if registerForm.is_valid():
                #int('cleaned_data:', registerForm)
                # Attempt to update new user
                user = registerForm.save(commit=False)
    
                # save the user's id and auction status
                user.user = request.user

                # save the new instance
                user.save()
                
                messages.add_message(
                    request,
                    messages.SUCCESS,
                    f"User profile updated!",
                )
                return HttpResponseRedirect(reverse("backend:userProfile"))
            else:
                print('CustomUserChangeForm is invalid')
            # Intialize form to return
            passwordChangeForm = PasswordChangeForm(user=request.user)

        elif action == 'Change':
            print(f"request.POST: {request.POST}")
            passwordChangeForm = PasswordChangeForm(request.user, request.POST)

            # Clean and validate the form
            if passwordChangeForm.is_valid():
                # Attempt change user's password
                passwordChangeForm.save()

                # Update user
                update_session_auth_hash(request, passwordChangeForm.user)

                messages.add_message(
                    request,
                    messages.SUCCESS,
                    f"Password changed!",
                )
                return HttpResponseRedirect(reverse("backend:userProfile"))
            else:
                print('UserChangePasswordForm is invalid')
            # Intialize form to return
            registerForm = CustomUserChangeForm()
            print('formErrors:',passwordChangeForm.errors.as_json())
        else:
            # Invalid action value
            return defaults.bad_request(request, 400)
            
    else:
        #userChangeForm = UserChangeForm(instance=request.user)
        #passwordResetForm = PasswordResetForm()
        passwordChangeForm = PasswordChangeForm(user=request.user)
        registerForm = CustomUserChangeForm()
        
    return render(request, "portfolio/userProfile.html", {"user": request.user, "registerForm": registerForm, "passwordChangeForm": passwordChangeForm})

# -------------- API Routes --------------
@csrf_exempt
@login_required
def portfolio(request):
    # Query for requested user's portfolios
    try:
        portfolios = Portfolio.objects.filter(user=request.user)
    except ObjectDoesNotExist:
        return JsonResponse({"error": "no portfolio found."}, status=404)

    # Return portfolio contents
    if request.method == "GET":
        return JsonResponse([portfolio.serialize() for portfolio in portfolios], safe=False)

    # Email must be via GET or PUT
    else:
        return JsonResponse({
            "error": "GET or PUT request required."
        }, status=400)

@csrf_exempt
@login_required
def portfolio_id(request, portf_id):
    # To Remove a portfolio
    try:
        portfolio = Portfolio.objects.get(user=request.user, pk=portf_id)
        txs = Transaction.objects.filter(user=request.user, portfolio=Portfolio.objects.get(user=request.user, pk=portf_id))
        txs = [tx.serialize() for tx in txs]
    except ObjectDoesNotExist:
        return JsonResponse({"error": "no portfolio found."}, status=404)

    # Remove the portfolio requested
    if request.method == "POST":
        print(f"to delete", portfolio)
        print(f"txs:", txs)
        if len(txs) != 0: 
            for tx in txs:
                if len(tx["portfolio"]) == 1:
                    Transaction.objects.get(user=request.user, pk=tx["id"]).delete()
                    print("tx to delete:",tx)
        # delete all txs related
        portfolio.delete()
        return HttpResponse(status=204)

    # Portfolio removal must be via POST
    else:
        return JsonResponse({
            "error": "POST request required."
        }, status=400)

@csrf_exempt
@login_required
def tx(request, tx_id):
    # Query, alter, and remove for a specific transaction
    try:
        tx = Transaction.objects.get(user=request.user, id=tx_id)
    except tx.DoesNotExist:
        return JsonResponse({"error": "no txs found."}, status=404)

    # Return every transaction contents
    if request.method == "GET":
        return JsonResponse(tx.serialize(), safe=False)

    # Update transaction content or remove transaction
    elif request.method == "PUT":
        data = json.loads(request.body)
        print(f"data: {data}")
        datetime_object = datetime.strptime(data["created_on"], "%Y-%m-%dT%H:%M:%S")
        print(f"datetime_object: {datetime_object}")
        # Retrieve the portfolio ids for form validation later
        portfolio_ids = data['portfolio']
        data['created_on'] = datetime_object
        data['portfolio'] = [Portfolio.objects.get(user=request.user, pk=portfolio_id) for portfolio_id in data['portfolio']]
        print('/nModified data:/n',data)

        # Create a form to edit an existing Transaction
        transactionForm = TransactionForm(data=data, instance=tx, request=request, portfolio=portfolio_ids)
        if transactionForm.is_valid():
            # Attempt to update the tx content
            tx_tosave = transactionForm.save(commit=False)
            # save the user's id and auction status
            tx_tosave.user = User.objects.get(pk=request.user.id)
            # get the asset symbol using its id
            tx_tosave.symbol = Symbol_validator(data['symbol_id'])
            # save the new instance
            tx_tosave.save()
            # save the many-to-many data for the form
            transactionForm.save_m2m()

            print("form is valid")
            return HttpResponse(status=204)
        else:
            print("form is invalid")
            print('formErrors:',transactionForm.errors.as_json())
            return JsonResponse({
                'success' : False,
                'error' : transactionForm.errors.as_json(),
                }, status=400)

    elif request.method == "POST":
        print('tx:',tx)
        tx.delete()
        return HttpResponse(status=204)

    # Transaction must be via GET or PUT or POST
    else:
        return JsonResponse({
            "error": "GET or PUT or POST request required."
        }, status=400)

@csrf_exempt
@login_required
def txs(request):
    # Query for all transactions
    try:
        txs = Transaction.objects.filter(user=request.user)
    except txs.DoesNotExist:
        return JsonResponse({"error": "no txs found."}, status=404)

    # Return every transaction contents
    if request.method == "GET":
        if len(txs) == 0:
            return JsonResponse({
            "error": "No txs found."
        }, status=404)
        return JsonResponse([tx.serialize() for tx in txs], safe=False)

    # Txs must be via GET
    else:
        return JsonResponse({
            "error": "GET request required."
        }, status=400)

@csrf_exempt
@login_required
def txs_data(request, portfolio_id):
    # Query for requested transactions for specific portfolio
    try:
        txs = Transaction.objects.filter(user=request.user, portfolio=Portfolio.objects.get(user=request.user, pk=portfolio_id))
    except txs.DoesNotExist:
        return JsonResponse({"error": "no txs found."}, status=404)

    # Return every transaction contents for queried portfolio
    if request.method == "GET":
        # Return transactions in reverse chronologial order
        #txs = txs.order_by("-created_on").all()
        if len(txs) == 0:
            return JsonResponse({
            "error": "No txs available."
        }, status=404)
        return JsonResponse([tx.serialize() for tx in txs], safe=False)

    # Tx content must be via GET
    else:
        return JsonResponse({
            "error": "GET request required."
        }, status=400)