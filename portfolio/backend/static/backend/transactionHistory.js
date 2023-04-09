$(document).ready(function () {
    const transactionHistory = ReactDOM.createRoot(document.getElementById("transactionHistory-page"));

    function formatPrice(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function Historyboard() {
        return (
            <>
                <TxHistory />
            </>
        )
    }
    function TxHistory() {
        // ---------- Portfolio and Txs States ----------
        const [portfolios, setPortfolios] = React.useState([]);
        const [txs, setTxs] = React.useState([]);
        const [fetchState, setFetchState] = React.useState(null);
        const [txsError, setTxsError] = React.useState(null);

        React.useEffect(() => {
            // Fetch and initialize txs data
            update_txs();

            // Select2
            $('.transactionFilter_portfolio').select2({
                theme: "bootstrap-5",
                width: $(this).data('width') ? $(this).data('width') : $(this).hasClass('w-100') ? '100%' : 'style',
                placeholder: $(this).data('placeholder'),
                closeOnSelect: false,
                selectionCssClass: 'select2--small',
                dropdownCssClass: 'select2--small',
                tokenSeparators: [',', ' '],
                debug: true,
            });

            // Trigger select-2 event when an option is selected and unselected, i.e. sort by which aspect
            $('.transactionFilter_portfolio').on('select2:select', (e) => {
                handleClick("portfolio");
            });
            $('.transactionFilter_portfolio').on('select2:unselect', (e) => {
                handleClick("portfolio");
            });
        }, []);

        const update_txs = async () => {
            // Fetch and return portfolios data through a callback function
            const callbackPortfs = await getPortfolios();
            setPortfolios(callbackPortfs());

            const callbackTxs = await getAllTxs();
            if (callbackTxs() !== null) {
                // Retrieve the queried txs and sort them by date in descending order
                const txsData_sortByDate = sortTxs(['date', false], structuredClone(callbackTxs()));
                setTxs(txsData_sortByDate);
            }
        }

        const getPortfolios = async () => {
            let ignore = false;

            if (!ignore) {
                // Wait for response
                const response = await fetch('/portfolio');
                const data = await response.json();

                return () => {
                    ignore = true;
                    return data;
                };
            }
            return null;
        };

        const getAllTxs = async () => {
            let ignore = false;

            if (!ignore) {
                // Wait for response
                const response = await fetch('/txs');

                const data = await response.json();
                setFetchState(response.status);
                if (response.status !== 200) {
                    setTxsError(data.error);
                    // Return null if the response is an error
                    return () => {
                        ignore = true;
                        return null;
                    };
                }

                return () => {
                    ignore = true;
                    return data;
                };
            }
            return;
        };

        // ---------- Sorting States ----------
        const [activeSort, setActiveSort] = React.useState([null, true]);

        React.useEffect(() => {
            const sortedTxs = sortTxs(activeSort, structuredClone(txs));
            setTxs(sortedTxs);

        }, [activeSort]);

        const sortTxs = ([id, asc], txs_data = null) => {
            // Sort txs by aspect, i.e. date, type, coin, price, and size
            const sortFunction = (a, b) => {
                // Sort by ascending order if asc is True
                return asc === true ? (a - b) : (b - a);
            };

            if (txs_data !== null) {
                let data = [];
                switch (id) {
                    case 'date':
                        data = txs_data.sort((a, b) => { return sortFunction(new Date(a.created_on), new Date(b.created_on)); });
                        break;
                    case 'type':
                        // Convert char to ASCII number
                        data = txs_data.sort((a, b) => { return sortFunction(a.type.charCodeAt(0), b.type.charCodeAt(0)); });
                        break;
                    case 'coin':
                        data = txs_data.sort((a, b) => {
                            let difference = 0;
                            // Standadize to lowercase
                            const a_symbol_id = a.symbol_id.toLowerCase();
                            const b_symbol_id = b.symbol_id.toLowerCase();
                            // Determine the shorter symbol
                            let shorter_array = [];
                            if (a.symbol_id.length <= b.symbol_id.length) {
                                shorter_array = a.symbol_id;
                            }
                            else {
                                shorter_array = b.symbol_id;
                            }
                            for (var i = 0; i < shorter_array.length; i++) {
                                // Sort by a - z through ASCII numbers
                                difference += sortFunction(a_symbol_id.charCodeAt(i), b_symbol_id.charCodeAt(i));
                            }

                            return difference;
                        });
                        break;
                    case 'price':
                        data = txs_data.sort((a, b) => { return sortFunction(a.bought_at, b.bought_at); });
                        break;
                    case 'quantity':
                        data = txs_data.sort((a, b) => { return sortFunction(a.quantity, b.quantity); });
                        break;
                    case 'portfolio':
                        const portf_opts = document.getElementById('portfolioFilter').options;
                        let portf_ids = [];
                        for (let portf of portf_opts) {
                            if (portf.selected) {
                                portf_ids.push(parseInt(portf.value));
                            }
                        }
                        data = txs_data.sort((a, b) => {
                            // Count the number of matches of portfolio by id
                            let a_matchCount = 0;
                            let b_matchCount = 0;
                            a.portfolio.map((portf) => {
                                portf_ids.map((id) => {
                                    // If the tx's portfolio id is in the filter
                                    if (portf.id === id) {
                                        a_matchCount += 1;
                                    }
                                })
                            })
                            b.portfolio.map((portf) => {
                                portf_ids.map((id) => {
                                    // If the tx's portfolio id is in the filter
                                    if (portf.id === id) {
                                        b_matchCount += 1;
                                    }
                                })
                            })
                            // Sort the tx by highest matches of in the portfolio id
                            if (a_matchCount > 0 && a_matchCount > b_matchCount) {
                                return -1
                            }
                            else if (b_matchCount > 0 && b_matchCount > a_matchCount) {
                                return 1
                            } else {
                                return 0;
                            }
                        });
                        break;
                };
                return data;
            }
        };

        const handleClick = (id) => {
            setActiveSort([id, !activeSort[1]]);
        };

        const updateTx = async (id) => {
            // To update an existing transaction
            let ignore = false;

            if (!ignore) {
                // Get list of portfolio's id
                const portf_opts = document.getElementById('id_portfolio' + id).options;
                let portf_ids = [];
                for (let portf of portf_opts) {
                    if (portf.selected) {
                        portf_ids.push(portf.value);
                    }
                }
                // Format the date
                let unformattedDate = document.getElementById('id_created_on' + id).value.split(' ');
                let tx = {
                    type: document.getElementById('id_type' + id),
                    symbol_id: document.getElementById('id_symbol_id' + id),
                    bought_at: document.getElementById('id_bought_at' + id),
                    quantity: document.getElementById('id_quantity' + id),
                    tx_id: document.getElementById('id_tx_id' + id),
                    portfolio: portf_ids,
                    comment: document.getElementById('id_comment' + id),
                    created_on: unformattedDate[0] + 'T' + unformattedDate[1]
                };
                let response = await fetch(`/tx/${parseInt(id)}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        type: tx.type.value,
                        symbol_id: tx.symbol_id.value,
                        bought_at: tx.bought_at.value,
                        quantity: tx.quantity.value,
                        tx_id: tx.tx_id.value,
                        portfolio: tx.portfolio,
                        comment: tx.comment.value,
                        created_on: tx.created_on
                    })
                });

                // Get the response status
                const responseStatus = response.status;
                if (responseStatus !== 204) {
                    // Parse the JSON response
                    response = await response.json();
                    const errors = JSON.parse(response.error);

                    // Errors handling
                    (() => {
                        'use strict'

                        // Fetch the form we want to apply custom Bootstrap validation styles to
                        const form = document.getElementById("editForm" + id);

                        for (let key in errors) {
                            // Add errors to the form, HTML5 custom errors are suppressed by 'novalidate'
                            document.getElementById('id_' + key + id).setCustomValidity('Initiate to alert custom errors.');
                            // Add the error message to the div 'invalid-feedback'
                            document.querySelector('#id_' + key + id + " + label + .invalid-feedback").innerHTML = errors[key][0].message;
                        }
                        // Initiate the bootstrap form validation
                        form.classList.add('was-validated');
                    })();
                } else {
                    // Hide the modal if the tx is updated successfully
                    $('#editModal' + id).modal('hide');
                    update_txs();
                }

            }

            return () => {
                ignore = true;
            }
        }

        const removeTx = async (id) => {
            // Remove an existing transaction
            let ignore = false;

            if (!ignore) {
                let response = await fetch(`/tx/${parseInt(id)}`, {
                    method: 'POST',
                })
                // Get the response status
                const responseStatus = response.status;
                if (responseStatus !== 204) {
                    const data = await response.json();
                    setTxsError(data.error);
                }
                // Hide the modal if the tx is updated successfully
                $('#deleteModal' + id).modal('hide');
                // Query for the latest txs
                update_txs();
            }

            return () => {
                ignore = true;
            }
        }

        return (
            <div className="container-fluid">
                {txsError === null ? null : (
                    <div className="queryAlert alert alert-danger d-flex align-items-center justify-content-between p-2" role="alert" style={{ fontSize: 15 }}>
                        <div><i className="bi bi-exclamation-triangle me-1"></i> {txsError}</div>
                        <button type="button" className="btn-close btn-sm ms-1 pe-3" aria-label="Close" onClick={() => { document.querySelector('.queryAlert').style.setProperty("display", "none", "important"); }}></button>
                    </div>)
                }
                <div className="container mb-4">
                    <h2>Transaction History</h2>
                </div>

                <div className="overviewBackground-container">
                    <div className="row ticker-header fw-semibold text-end">
                        <div className="d-none d-md-grid col-1 text-center">
                            No.
                        </div>
                        {/*--Date--*/}
                        <a href="#" className="col-4 col-sm-4 col-sm-3 col-md-2 text-start text-truncate no-underline" onClick={() => handleClick("date")}>
                            Date
                            {activeSort[1] === true ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-up ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-down-alt ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z" />
                                </svg>
                            )}
                        </a>
                        {/*--Type--*/}
                        <a href="#" className="col-1 text-center no-underline" onClick={() => handleClick("type")}>
                            Type
                            {activeSort[1] === true ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-up ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={1}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-down-alt ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z" />
                                </svg>
                            )}
                        </a>
                        {/*--Coin--*/}
                        <a href="#" className="col-2 col-md-1 text-start no-underline" onClick={() => handleClick("coin")}>
                            Coin
                            {activeSort[1] === true ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-up ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-down-alt ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z" />
                                </svg>
                            )}
                        </a>
                        {/*--Price--*/}
                        <a href="#" className="col-3 col-xs-2 col-md-2 col-xxl-1 no-underline" onClick={() => handleClick("price")}>
                            Price
                            {activeSort[1] === true ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-up ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-down-alt ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z" />
                                </svg>
                            )}
                        </a>
                        {/*--Quantity--*/}
                        <a href="#" className="col-2 col-md-1 no-underline" onClick={() => handleClick("quantity")}>
                            Size
                            {activeSort[1] === true ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-up ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={16}
                                    height={16}
                                    fill="currentColor"
                                    className="bi bi-sort-down-alt ms-2"
                                    viewBox="0 0 16 16"
                                >
                                    <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z" />
                                </svg>
                            )}
                        </a>
                        {/*--Portfolio--*/}
                        <div className="d-none d-md-grid col-3 col-lg-2 m-0 ps-1 pe-0 pt-0 pb-1">
                            <select
                                name="portfolio"
                                data-placeholder="Portfolio"
                                aria-label="multiple select example"
                                className="transactionFilter_portfolio portfolio-states form-select form-select-sm m-0 p-0"
                                id="portfolioFilter"
                                multiple
                            >{portfolios.map(portfolio => (
                                <option key={"filter" + portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                            ))}
                            </select>
                        </div>
                        {/*--Comment-*/}
                        <div className="d-none d-lg-grid col-2 col-md-1 col-xxl-2 text-center">Comment</div>
                        {/*--Utilities--*/}
                        <div className="col-3 col-xs-2 col-md-1"></div>
                    </div>
                    {
                        fetchState === null ? (
                            <small className="row mx-auto text-secondary">Loading...</small>
                        ) : fetchState === 200 ? (
                            <Transaction txs={txs} portfolios={portfolios} update_txs={update_txs} updateTx={updateTx} removeTx={removeTx} />
                        ) : null
                    }
                </div>
            </div>
        )
    }

    function Transaction({ txs, portfolios, update_txs, updateTx, removeTx }) {

        return (
            <>
                {
                    txs.map((tx, index) => (
                        <div key={index} className="row pt-0 pb-2 g-3 ticker-container fw-light text-end">
                            <div className="d-none d-md-grid col-1 pe-5">{index + 1}</div>
                            <div className="col-4 col-sm-4 col-sm-3 col-md-2 text-start text-truncate">{tx.created_on.replace(/T/, ' ')}</div>
                            <div className="col-1 text-center">{tx.type}</div>
                            <div className="col-2 col-md-1 text-start text-truncate">{tx.symbol}</div>
                            <div className="col-3 col-xs-2 col-md-2 col-xxl-1 text-truncate"><div className="row row-cols-2 justify-content-between">
                                <div className="col-2 ps-lg-5 ps-xxl-1">$</div><div className="col-8 col-sm-auto">{tx.bought_at === null ? '-' : formatPrice(tx.bought_at.toFixed(2))}</div>
                            </div></div>
                            <div className="col-2 col-md-1 text-truncate">{tx.quantity}</div>
                            <div className="d-none d-md-grid col-3 col-lg-2 text-truncate">{tx.portfolio.length > 1 ? (tx.portfolio.map(portf => portf.name).join(', ')) : (tx.portfolio[0].name)}</div>
                            <div className="d-none d-lg-grid col-2 col-md-1 col-xxl-2 text-center text-truncate">{tx.comment}</div>
                            <div className="col-3 col-xs-2 col-md-1 d-flex flex-row flex-md-column flex-lg-row justify-content-around">
                                <button type="button" className="btn btn-sm btn-primary btn-floating me-1" value={tx.id} data-bs-toggle="modal" data-bs-target={"#editModal" + tx.id} onClick={update_txs}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={14}
                                        height={14}
                                        fill="currentColor"
                                        className="bi bi-pencil-square"
                                        viewBox="0 0 16 16"
                                    >
                                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                                        <path
                                            fillRule="evenodd"
                                            d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"
                                        />
                                    </svg>
                                </button>
                                {/* editModal */}
                                <div className="modal fade" id={"editModal" + tx.id} tabIndex={-1} aria-labelledby={"editModal" + tx.id + "Label"} aria-hidden="true">
                                    <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                                        <div className="modal-content">
                                            <div className="modal-header">
                                                <h1 className="modal-title fs-5" id={"editModal" + tx.id + "Label"}>
                                                    Edit transaction {index + 1}
                                                </h1>
                                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                                            </div>
                                            <div className="modal-body text-start">
                                                <form id={"editForm" + tx.id} className="row g-3" noValidate>
                                                    {/* --Action-- */}
                                                    <div className="col-12 form-floating">
                                                        <select className="form-select form-select-sm" id={"id_type" + tx.id} defaultValue={tx.type} aria-label="Floating label select example">
                                                            <option value="B">Buying</option>
                                                            <option value="S">Selling</option>
                                                        </select>
                                                        <label htmlFor={"id_type" + tx.id} className="col-form-label form-control-sm text-muted mb-1">
                                                            Act
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --SYMBOL-- */}
                                                    <div className="col-md-4 form-floating">
                                                        <input type="text" maxLength={150} className="form-control form-control-sm" defaultValue={tx.symbol} required id={"id_symbol_id" + tx.id} />
                                                        <label htmlFor={"id_symbol_id" + tx.id} className="form-control-sm text-muted mb-1">
                                                            Symbol
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --PRICE-- */}
                                                    <div className="col-md-4 form-floating">
                                                        <input type="text" className="form-control form-control-sm" defaultValue={tx.bought_at} id={"id_bought_at" + tx.id} />
                                                        <label htmlFor={"id_bought_at" + tx.id} className="form-control-sm text-muted mb-1">
                                                            $ Price
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --Quantity-- */}
                                                    <div className="col-md-4 form-floating">
                                                        <input type="text" className="form-control form-control-sm" defaultValue={tx.quantity} id={"id_quantity" + tx.id} />
                                                        <label htmlFor={"id_quantity" + tx.id} className="form-control-sm text-muted mb-1">
                                                            Qtty
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --Tx_ID-- */}
                                                    <div className="col-12 form-floating">
                                                        <input type="text" className="form-control form-control-sm" defaultValue={tx.tx_id} id={"id_tx_id" + tx.id} />
                                                        <label htmlFor={"id_tx_id" + tx.id} className="form-control-sm text-muted mb-1">
                                                            Tx ID
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --PORTFOLIO-- */}
                                                    <div className="col-12 form-floating" >
                                                        <select data-placeholder="Portfolio" aria-label="multiple select example" className="form-select form-select-sm" id={"id_portfolio" + tx.id} defaultValue={tx.portfolio.map(portfolio => portfolio.id)} style={{ height: "5rem" }} multiple>
                                                            {
                                                                portfolios.map(portfolio => (
                                                                    <option key={"edit" + portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                                                                ))
                                                            }
                                                        </select>
                                                        <label htmlFor={"id_portfolio" + tx.id} className="form-control-sm text-muted">
                                                            Portfolio
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --COMMENT-- */}
                                                    <div className="col-12 form-floating">
                                                        <textarea cols={40} rows={3} style={{ height: "5rem" }} className="form-control form-control-sm" defaultValue={tx.comment} id={"id_comment" + tx.id} />
                                                        <label htmlFor={"id_comment" + tx.id} className="form-control-sm text-muted mb-1">
                                                            Comment
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                    {/* --DATE-- */}
                                                    <div className="col-12 form-floating">
                                                        <input type="text" className="form-control form-control-sm" defaultValue={tx.created_on.replace(/T/, ' ')} id={"id_created_on" + tx.id} required />
                                                        <label htmlFor={"id_created_on" + tx.id} className="form-control-sm text-muted mb-1">
                                                            Date
                                                        </label>
                                                        <div className="invalid-feedback"></div>
                                                    </div>
                                                </form>

                                            </div>
                                            <div className="modal-footer">
                                                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">
                                                    Close
                                                </button>
                                                <button type="button" className="btn btn-sm btn-primary" onClick={() => updateTx(tx.id)}>
                                                    Submit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button type="button" className="btn btn-sm btn-danger btn-floating" value={tx.id} data-bs-toggle="modal" data-bs-target={"#deleteModal" + tx.id}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={14}
                                        height={14}
                                        fill="currentColor"
                                        className="bi bi-trash"
                                        viewBox="0 0 16 16"
                                    >
                                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                        <path
                                            fillRule="evenodd"
                                            d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                                        />
                                    </svg>
                                </button>
                                {/* deleteModal */}
                                <div className="modal fade" id={"deleteModal" + tx.id} tabIndex={-1} aria-labelledby={"deleteModal" + tx.id + "Label"} aria-hidden="true">
                                    <div className="modal-dialog modal-dialog-centered modal-sm">
                                        <div className="modal-content">
                                            <div className="modal-header">
                                                <h1 className="modal-title fs-5" id={"deleteModal" + tx.id + "Label"}>
                                                    Delete transaction {index + 1}
                                                </h1>
                                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                                            </div>
                                            <div className="modal-body text-start">Are you sure?</div>
                                            <div className="modal-footer">
                                                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">
                                                    Close
                                                </button>
                                                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeTx(tx.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ))
                }
            </>
        )

    }

    transactionHistory.render(<Historyboard />);
});