# CS50 Web Final Project - Portfolio

Portfolio is the final project submission with respect to **CS50 Web Programming with Python and JavaScript.**

## Distinctiveness and Complexity

Portfolio is neither a social or mail or e-commerce or wikipedia or search engine platform because it is a cryptocurrency portfolio platform that designed to help traders and investors to track their assets accurately by providing statistical information such as chart and totaling of networth and profit or loses. Portfolio leverages two APIs from Coingecko and Binance to provide user accurate market feeds. Furthermore, it supports multiple portfolios to facilitate different strategies.
Market feeds utilized from Coingecko API involve:

1. ranking,
2. ticker symbol (icon),
3. market capitalization,
4. percentage changes in terms of 24 hours,
5. 7 days, and
6. 24 hours volume,

while queries from Binance API provides an 5s interval updates on the current price of each user's assets. The computation required to correctly display the data and derrived data such as current holding of each assets computed in USD with respect to the portfolio, construction of portfolio chart data, and others on the frontend have dramatically increased the complexity of the design and codes.
To display the user total networth againsts time, TradingView lightweight chart is incoporated.

The backend however, is responsible to verify the validity of the transaction order with the list of existing tickers queried from Coingecko API. Besides, it must verify if the user's asset balance is sufficient when handling a selling transaction.

Furthermore, React-Spring is implemented to animate the components such as fading and scaling effects. Fade in and out are natural choices for animating changes in current price of an asset where green and red indicate increases and decreases respectively.

## Documentation

### Specification

- **Register & Login**: Users must be able to register new account and login with those that are already created.
  - Registeration should include profile image upload field.
- **Overview**: The "Overview" link in the navigation bar should take user to a page where all assets are listed in pagination format with 50 assets per page.
  - The information displayed should include minimally the ranking, symbol/ ticker, and current price of the asset.
  - The information should be updated without requiring to refresh the entire page on a reasonable interval.
- **Dashboard**: For authenticated users, the "Dashboard" link in the navigation should take user to a page where:
  - The total networth of the selected portfolio is plotted againsts time.
  - The assets of that portfolio should be displayed in pagination format with 5 assets per page. The information displayed on each of those assets should also include its ranking, symbol/ticker, holding in USD, and total profit/ loses.
  - The chart and assets networth should be live and updates continuously instead of requiring user to refresh the entire page.
- **Transaction**: User should be able to click on an "Add Tx" button to record/ submit a transaction for portfolio(s).
- **History**: User should be able to click on an "Remove Tx" to take user to a page where all transactions made are displayed in reverse chronological order.
  - Each transaction displayed must also comes with information Timestamp, Type (buy/ sell), Symbol, Purchasing Price, and Quantity.
  - User should be able to click on an "edit" button to edit the selected transaction, and the information of that transaction should be pre-populated on the presented form.
  - User should be able to click on an "delete" button to remove the selected transaction.
- **Profile page**: User should be able to click on an button "profile" to navigate to a page where user's profile image, username, and email address are displayed.
  - User should be able to click on an "update" button to modify the said fields.
  - User should be able to click on an "change" button to modify its current password if the provided password matched the current password.

### Design Methodology

Traditionally, web app design involves backend and frontend working together to delivery contents. For instance, Django could be designed to act only as an API database for queries, while React on the frontend to compensate the user-interactivity Django lacks.

Generally, the frontend static files bundling and babel setup for production are abstracted using the pre-configured environment, Create-react-app. The security provided by django forms, specifically validating, cleaning and error handling of the modelforms are very well-designed and convenient. However, by using Django as API database stripped its ability to render the HTML form which is now handled by Create-react-app. To utilize the best from both worlds, Webpack loader and babel are configured manually and thus allowing React to function as an isolate JavaScript front-end for each HTML generated by a Django backend.

Webpack loader is responsible for generating the corresponding JavaScript filepath, i.e. layout.js. in assets/dist/ by using the Jinja syntax {% render_bundle 'layout' %}.

### File Structure

- portfolio/ # _Django Project_
  - assets/
    - dist/ # _Dir. for the bundled static files_
    - js/ # _Dir. for the pre-bundle static files_
  - backend/
    - static/
    - templates/
    - forms.py # _Django modelforms_
    - storage*backend.py # \_S3 Boto Storage class, declared to store static files to Amazon S3 bucket in production*
  - media/ # _Dir. for media files_
  - portfolio # _Django App_
    - settings/
      - settings.py
      - storage.py # _Webpack loader and Storage settings_
  - staticfiles/ # _Dir. for Django collected staticfiles when DEBUG is True_
  - .babelrc # _Config files for babel_
  - manage.py
  - package-lock.json
  - package.json # _npm dependencies_
  - webpack-stats.json
  - webpack.config.js # _webpack_loader config file_
- .dockerignore
- .env
- .gitignore
- Dockerfile
- LICENSE
- Procfile # _Heroku config file_
- requirements.txt # _Package Dependencies_

## How to run the application

### Development

1.  While in the `root` dir. or the same dir. as `portfolio`:
    1.        Create a virtual env, `python3 -m venv portfolio_venv`,
    2.        Activate the venv, `source portfolio_venv/bin/activate`,
    3.        Install the requirements, `pip3 install -r requirements.txt`,
2.  cd to dir. `portfolio/`, run `npm install`,
3.  while in dir. `portfolio/`, run `npm run collect` to collect the pre-bundle static files to `assets/js/` and bundle it to `assets/dist/`.
4.  Ensure DEBUG in settings.py is True. while in the dir. `portfolio/`, run:
    1.        `python3 manage.py makemigrations backend`,
    2.        `python3 manage.py migrate`, and
    3.        `python3 manage.py runserver`.

### Production

`Dockerfile` is provided under the root directory. You may build the image to deploy on Heroku or run locally, the two environment variables must not be empty are:
Command to build the docker image if your OS is arm64: `docker buildx build --platform linux/amd64 -t $repoName:tag  .`

1. Django SECRET_KEY,
2. DEBUG

if DEBUG is `False`, static files are configured to upload to AWS S3 bucket, therefore, the following extra settings in .env are needed:

    1. ALLOWED_HOSTS=$YOURHOSTNAMES
    2. CSRF_TRUSTED_ORIGINS=$YOURDOMAINS
    3. SECURE_SSL_REDIRECT=True
    4. AWS_ACCESS_KEY_ID="YOUR AWS ACCESS KEY ID"
    5. AWS_SECRET_ACCESS_KEY="YOUR AWS SECRET ACCESS KEY"
    6. AWS_STORAGE_BUCKET_NAME="YOUR AWS STORAGE BUCKET NAME"

Deployed url: `https://cs50-portfolio.onrender.com/`

## File Functionality

A description of what is contained in each file.

### Frontend

HTML and CSS static files.

#### layout.html and layout.js

An abstraction for all others html files to refence, contain elements such as Navbar and Footer.
The JavaScript file does not involves react, only function is to animate the Navbar element underline effect by adding and removing the 'active' class when each of them is clicked.

#### generic_form.html

As the name implies, it is an abstracted form generated by Django.

#### index.html and index.js

A landing page for the Portfolio web application, where a list of ticker/ assets' market feeds are retrieved from Coingecko API and displayed in pagination form.

index.js involves pre-processing and extract the following attributes from the returned query:

1. ranking,
2. ticker symbol (icon),
3. market capitalization,
4. percentage changes in terms of 24 hours,
5. 7 days, and
6. 24 hours volume,

As of current, the Coingecko API call is limited to 30calls/min for free, therefore, the data is queried per 1min interval to prevent blocking.

React-Spring animations involved is fading in when the component is mounted and fading in and out with green and red indicates increases and decreases respectively when the current price changes.

#### dashboard.html and dashboard.js

The function of dashboard is to display the user portoflio data, which are separated into two main sections: the chart and the assets.

##### Chart

Chart refers to a plot of the total networth of the portfolio againsts time, generated by lightweight chart API. The chart is programmed to update every 5s since Binance API does not limit the number of API calls for free user.

##### Assets

A section where list of assets with their corresponding market data such as its market capitalization, 24hrs and 7D price changes, total holding in USD, and profit/ loses are displayed.

#### transaction.html and transaction.js

transaction.html is a modelform generated by Django using Jinja syntax for user to submit either a buying or selling transaction for portfolio(s). Select2 package is initialized in transaction.js for portfolio field in the modelform.

#### transactionHistory.html and transactionHistory.js

transactionHistory.html displays transactions user has recorded regardless of which portfolio are listed in reverse chronological order. JavaScript is utilized to sort the transaction to user needs whether it is by index, date, type, coin, price, and size of the transaction. Additionally, user is able to filter the transactions by portfolio. Each transaction is also editable and removable.

#### userProfile.html

userProfile.html is a plain html file that displays user's profile image, username, and email address and if needed, forms are provided to modify them including the password.

### Backend

Django files

#### models.py

- User:
  - User model is abstracted to include the "profile_image" field.
  - Validate username and email in case-insensitive manner.
- Portfolio:
  - Model to store user's portfolio information.
  - Validate "name" field with ASCIIUsernameValidator to eliminates all the other possible characters.
- Transaction:
  - Model to store user's portfolio transaction.
  - The same transaction could be register under multiple portfolios.

#### API Route

- "portfolio" - Returns the existing portfolios data
- "portfolio/portf_id" - To remove a portfolio where id = portf_id
- "txs" - Returns all existing transaction data in all portfolios.
- "tx/tx_id" - Return or alter or remove a specific transaction.
- "txs_data/portfolio_id" - Return all transactions on portfolio where id = portfolio_id

#### storage_backend.py

Declaration of S3 storage classes for storing static and media files.

#### webpack.config.js

Configuring webpack loader to provide the bundled static files path to Django.
