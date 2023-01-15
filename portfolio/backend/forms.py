import requests

from django import forms
#from django.db import models
#from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from .models import User, Portfolio, Transaction

def coingecko_symbols_lookup(symbol):
    """Look up data for symbol."""
    try:
        url = f"https://api.coingecko.com/api/v3/search?query={symbol}"
        response = requests.get(url)
        response.raise_for_status()
    except requests.RequestException:
        return None

    # Parse response
    try:
        #print(f"The symbol queried response: {response.json()}")
        return response.json()
    except (KeyError, TypeError, ValueError):
        return None


def Id_validator(id):
    """Validate the symbol respect to symbols listed on Coingecko."""
    #print(f"The symbol requested is {symbol}")
    id_lowercase = id.lower()
    id_list = coingecko_symbols_lookup(id_lowercase)
    if id_list != None:
        for coin in id_list['coins']:
            #print(f"Comparing symbol requested {symbol} with {coin['symbol']}")
            print(f'comparing {id_lowercase} with {coin["symbol"].lower()}, {coin["id"].lower()}, {coin["name"].lower()}')  
            if coin["symbol"].lower() == id_lowercase or coin["id"].lower() == id_lowercase or coin["name"].lower() == id_lowercase:
                print(f'ID_VALIDATOR: FOUND:{coin}, return {coin["id"]}')
                return coin["id"]
    print('symbol not found', id, id_list)
    # Id not found
    raise ValidationError(
        _("%(id)s is not a valid symbol on Coingecko."),
        params={"id": id},
    )

def Symbol_validator(symbol):
    """Validate the symbol respect to symbols listed on Coingecko."""
    symbol_lowercase = symbol.lower()
    symbol_list = coingecko_symbols_lookup(symbol_lowercase)
    if symbol_list != None:
        for coin in symbol_list['coins']:
            print(f'comparing {symbol_lowercase} with {coin["symbol"].lower()}, {coin["id"].lower()}, {coin["name"].lower()}')  
            if coin["symbol"].lower() == symbol_lowercase or coin["id"].lower() == symbol_lowercase or coin["name"].lower() == symbol_lowercase:
                print(f'SYMBOL_VALIDATOR: FOUND:{coin}, return {coin["symbol"]}')
                return coin["symbol"]
    print('symbol not found', symbol, symbol_list)
    '''# Symbol not found
    raise ValidationError(
        _("%(symbol)s is not a valid symbol on Coingecko."),
        params={"symbol": symbol},
    )'''

class CustomUserChangeForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["username", "email", "profile_image"]
        localized_fields = "__all__"
        
class TransactionForm(forms.ModelForm):
    class Meta:
        model = Transaction
        exclude = ["user","symbol"]
        localized_fields = "__all__"
        # widgets = {"portfolio": forms.CheckboxSelectMultiple}

    def __init__(self, *args, **kwargs):
        try:
            self.request = kwargs.pop("request") # store value of request
            self.portfolio = kwargs.pop("portfolio") # store value of portfolio
        except KeyError:
            print(f'POP request: failed')      
        super().__init__(*args, **kwargs)
    
    def clean_symbol(self):
        data = self.cleaned_data.get("symbol")
        validated_data = Symbol_validator(data)

        # Always return a value to use as the new cleaned data, even if
        # this method didn't change it.
        return validated_data

    def clean_symbol_id(self):
        data = self.cleaned_data.get("symbol_id")
        #print('symbol_id:', data)
        validated_data = Id_validator(data)

        # Always return a value to use as the new cleaned data, even if
        # this method didn't change it.
        return validated_data

    def clean(self):
        cleaned_data = super().clean()
        type = cleaned_data.get("type")
        quantity = cleaned_data.get("quantity")
        symbol_id = cleaned_data.get("symbol_id")

        try:
            print('instance:',self.instance)
        except ObjectDoesNotExist:
            print('INSTANCE DOES NOT EXISTs')
        #print(f'portfolio: {self.portfolio}, type: {type}, symbol_id: {symbol_id}, quantity: {quantity}')
        if type == 'S':
            for portfolio_id in self.portfolio:
                available_quantity = 0
                # If self.instance does not raise ObjectDoesNotExists imply an update ('PUT') request to the transaction instead of create ('POST')
                try:
                    txs = Transaction.objects.filter(user = self.request.user, symbol_id = symbol_id, portfolio = Portfolio.objects.get(pk=portfolio_id)).exclude(pk=self.instance.id)
                except ObjectDoesNotExist:
                    txs = Transaction.objects.filter(user = self.request.user, symbol_id = symbol_id, portfolio = Portfolio.objects.get(pk=portfolio_id))
                #print(f'txs:{txs}')
                if len(txs) != 0:
                    for tx in txs:
                        if tx.type == 'B':
                            available_quantity += tx.quantity
                        elif tx.type == 'S':
                            available_quantity -= tx.quantity
                    if available_quantity < quantity:
                        #print(f'avail: {available_quantity}, to sell: {quantity} not enough for selling')
                        self.add_error('quantity', _(f"You do not have enough {symbol_id} for selling."))
                        '''raise ValidationError(
                            _("You do not have enough %(symbol_id)s for selling."),
                            params={"symbol_id": symbol_id},
                        )'''
                else:
                    #print(f'avail: {available_quantity}, to sell: {quantity} not enough for selling')
                    self.add_error('quantity', _(f"You do not have enough {symbol_id} for selling."))
                    '''raise ValidationError(
                        _("You do not have enough %(symbol_id)s for selling."),
                        params={"symbol_id": symbol_id},
                    )'''
        
        # Always return a value to use as the new cleaned data, even if
        # this method didn't change it.
        return cleaned_data