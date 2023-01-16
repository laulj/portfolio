// Exclude 'DOMContentLoaded' event condition since babel standalone has it already
//const portfolio = ReactDOM.createRoot(document.getElementById("portfolio-page"));

/*function formatPrice(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}*/

$(document).ready(function () {
    //$('.transactionForm_portfolio').select2({ placeholder: "portfolio", dropdownCssClass: "form-select-sm", selectionCssClass: "form-select-sm text-start mx-0 px-0 pt-2 pb-3", tags: true, tokenSeparators: [',', ' '], debug: true, allowClear: true });
    //console.log('ok');
    $('.transactionForm_portfolio').select2({
        theme: "bootstrap-5",
        width: $(this).data('width') ? $(this).data('width') : $(this).hasClass('w-100') ? '100%' : 'style',
        placeholder: $(this).data('placeholder'),
        closeOnSelect: false,
        selectionCssClass: 'select2--small',
        dropdownCssClass: 'select2--small',
        tags: true,
        tokenSeparators: [',', ' '],
        debug: true,
        allowClear: true
    });
});
/*
function Portfolio() {
    const [activeView, setActiveView] = React.useState('dashboard');
    React.useEffect(() => {
        //console.log('useEffect:', activeView);
        handleViewChange();
    }, [activeView]);

    const handleClick = (e) => {
        setActiveView(s => e.target.id);
        //console.log('handleClick', e.target.id);
        //handleViewChange();
    };
    const handleViewChange = () => {
        console.log('handleViewChange', activeView);
        let transaction_page = document.querySelector('#transaction-page');
        let portfolio_page = document.querySelector('#portfolio-page');
        let account_page = document.querySelector('#account-page');

        // Hide all views
        transaction_page.style.display = 'none';
        portfolio_page.style.display = 'none';
        account_page.style.display = 'none';

        // Enable the clicked view
        switch (activeView) {
            case 'dashboard':
                portfolio_page.style.display = 'block';
                break;
            case 'transaction':
                transaction_page.style.display = 'block';
                console.log(transaction_page);
                $('.transactionForm_portfolio').select2({
                    theme: "bootstrap-5",
                    width: $(this).data('width') ? $(this).data('width') : $(this).hasClass('w-100') ? '100%' : 'style',
                    placeholder: $(this).data('placeholder'),
                    closeOnSelect: false,
                    selectionCssClass: 'select2--small',
                    dropdownCssClass: 'select2--small',
                    tags: true,
                    tokenSeparators: [',', ' '],
                    debug: true,
                    allowClear: true
                });
                break;
            case 'account':
                account_page.style.display = 'block';
                break
            default:
                portfolio_page.style.display = 'block';
                break;
        };


        const nav_links = document.getElementsByClassName('nav-link');

        // Disabled all link
        for (let nav_link of nav_links) {
            // Remove active on all nav-links
            nav_link.classList.remove('active');
        };
        // Enable the clciked link
        document.querySelector(`#${activeView}`).classList.add('active');

    };
    return (
        <>
            <Navbar handleClick={handleClick} />
            <Dashboard activeView={activeView} />
            <Transaction activeView={activeView} />
        </>
    )
}

function Navbar({ handleClick }) {
    //console.log('Navbar');
    document.querySelector('#dashboard').addEventListener('click', handleClick);
    document.querySelector('#transaction').addEventListener('click', handleClick);
    document.querySelector('#account').addEventListener('click', handleClick);
}

function Dashboard({ activeView }) {
    return (
        <>
            <div className="d-flex flex-column justify-content-around">
                <div className="d-flex flex-row chart" style={{ height: '30vh' }}>
                    CHART HERE
                </div>
                <div className="d-flex flex-row justify-content-between portfolio">
                    <h3>Portfolio</h3>
                </div>
            </div>
        </>
    )
}

function Transaction({ activeView }) {
}

portfolio.render(<Portfolio />);*/