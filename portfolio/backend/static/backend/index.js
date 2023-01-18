// Exclude 'DOMContentLoaded' event condition since babel standalone has it already
const ReactSpring = window["ReactSpring"];
const market_overview = ReactDOM.createRoot(document.getElementById("market-overview"));

function formatPrice(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function useInterval(callback, delay) {
    const savedCallback = React.useRef();

    React.useEffect(() => {
        savedCallback.current = callback;
    });

    React.useEffect(() => {
        function tick() {
            savedCallback.current();
        }

        let id = setInterval(tick, delay);
        return () => clearInterval(id);
    }, [delay]);
}

function MarketOverview() {
    const [tickerData, setTickerData] = React.useState([]);
    const [fetchState, setFetchState] = React.useState(null);
    const [fetchError, setFetchError] = React.useState(null);
    // For referencing latest fetchState in setTimeout
    const fetchRef = React.useRef();
    fetchRef.current = fetchState;
    React.useEffect(() => {
        // Error handling
        fetchState !== 200 && fetchState !== 'loading' && fetchState !== null ? setFetchError("Too many requests: Failed to fetch data from Coingecko, try again later.") : setFetchError(null);
    }, [fetchState]);
    const getTickerData = async () => {
        setFetchState(null);
        // Only display Boostrap 'placeholder' div if data is not loaded in 1s
        const timeout = setTimeout(() => {
            if (fetchRef.current === null) {
                setFetchState('loading');
            }
        }, 1000);
        // Wait for response
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=1000&page=1&sparkline=false&price_change_percentage=24h%2C7d`, { method: 'GET' });
        clearTimeout(timeout);

        const data = await response.json();

        // Post-processing
        // If tickerData is empty, use current values for all the prev values
        let mounted;
        if (tickerData.length === 0) {
            mounted = false;
        } else {
            mounted = true;
        }
        // Only trigger animation when there is a changes between the prev and current values
        let changes = false;
        data.forEach((asset, index) => {
            asset.prev_price = mounted ? parseFloat(tickerData[index].current_price) : asset.current_price;
            asset.prev_martket_cap = mounted ? parseFloat(tickerData[index].market_cap) : asset.market_cap;
            asset.prev_total_volume = mounted ? parseFloat(tickerData[index].total_volume) : asset.total_volume;
            asset.prev_price_change_percentage_24h = mounted ? parseFloat(tickerData[index].price_change_percentage_24h) : asset.price_change_percentage_24h;
            asset.prev_price_change_percentage_7d_in_currency = mounted ? parseFloat(tickerData[index].price_change_percentage_7d_in_currency) : asset.price_change_percentage_7d_in_currency;
            asset.prev_price !== asset.current_price ? changes = true : null;
        });

        // Update the state only after the post-processing is completed
        setFetchState(response.status);

        setTickerData(data);
        // Toggle Refresh animation
        changes ? setAnimateState(!animateState) : null;
        return data;
    };

    React.useEffect(() => {
        getTickerData()
            .catch(err => setFetchState(404));
    }, [])

    // Pagination state
    const [pageNum, setPageNum] = React.useState(1);
    // Update the css properties of page-link once the page state changes
    const updatePagination = (num) => {
        const pageElement = document.querySelector(`#page${num}`);
        const allpages = document.getElementsByClassName('page-item');
        // Disabled all link
        for (let page of allpages) {
            page.classList.remove('active', 'disabled');
        }
        // Enable the clciked link
        pageElement.classList.add('active');

        // Disable the previous and next link accordingly
        if (parseInt(num) === 1) {
            // Enable 'next' and disable 'previous'
            document.getElementsByClassName('previous')[0].classList.add('disabled');
            document.getElementsByClassName('next')[0].classList.add('active');
        }
        else if (parseInt(num) === (allpages.length - 2)) {
            // Enable 'previous' and disable 'next'
            document.getElementsByClassName('next')[0].classList.add('disabled');
            document.getElementsByClassName('previous')[0].classList.add('active');
        }
        else {
            document.getElementsByClassName('previous')[0].classList.remove('disabled');
            document.getElementsByClassName('next')[0].classList.remove('disabled');
        }
    }
    React.useEffect(() => {
        updatePagination(pageNum);
    }, []);

    // Compute the page length required
    const tickerPerPage = parseInt(50);
    let page_length = Math.ceil(tickerData.length / tickerPerPage);
    let page_num = [];
    for (let i = 2; i < page_length + 1; i++) {
        page_num.push(<li key={i} id={"page" + i} className="page-item"><a className="page-link" onClick={() => { setPageNum(i); updatePagination(i); fadeIn(); }}>{i}</a></li>);
    }

    // Update asset and chart data per 5s
    useInterval(() => {
        if (fetchState !== null && fetchError === null) {
            getTickerData()
                .catch(err => setFetchState(404));
        }
    }, 5000);

    // ReactSpring animations
    const [animateState, setAnimateState] = React.useState(true);
    const [fade, api] = ReactSpring.useSpring(() => ({
        from: { opacity: 0 },
        to: { opacity: 1 },
        config: { duration: 1000 },
    }));
    const fadeIn = () => {
        api({
            from: {
                opacity: 0,
            },
            to: {
                opacity: 1,
            },
        });
    };

    const { refreshAnimation } = ReactSpring.useSpring({
        from: { refreshAnimation: 0 },
        refreshAnimation: animateState ? 1 : 0,
        config: { duration: 1000 },
    });

    return (
        <>
            <ReactSpring.animated.div className="container-fluid" style={fade}>
                {fetchError === null ? null : (
                    <div className="queryAlert alert alert-danger d-flex align-items-center justify-content-between p-2" role="alert" style={{ fontSize: 15 }}>
                        <div><i className="bi bi-exclamation-triangle me-1"></i> {fetchError}</div>
                        <button type="button" className="btn-close btn-sm ms-1 pe-3" aria-label="Close" onClick={() => { document.querySelector('.queryAlert').style.setProperty("display", "none", "important"); }}></button>
                    </div>)
                }
                <h1>A Simplistic Portfolio Tracker</h1>
                <p className="lead">Portfolio Tracker allows you to build your crypto portfolio and track your
                    cryptocurrencies accurately free of charge.</p>
                <div className="overviewBackground-container">
                    <div className="row ticker-header fw-semibold text-end">
                        <div className="col-2 col-sm-1 text-truncate">Rank</div>
                        <div className="col-4 col-xs-7 col-sm-3 col-md-3 col-lg-4 col-xl-3 text-start">Coin</div>
                        <div className="col-6 col-xs-4 col-sm-4 col-md-3 col-lg-2 col-xl-2">Price</div>
                        <div className="d-none d-sm-grid col-4 col-md-4 col-lg-3 col-xl-2">MarketCap.</div>
                        <div className="d-none d-xl-grid col-2">24h Volume</div>
                        <div className="d-none d-md-grid col-1">24h</div>
                        <div className="d-none d-lg-grid col-1">7d</div>
                    </div>
                    <TickerData tickerData={tickerData} tickerPerPage={tickerPerPage} pageNum={pageNum} fetchState={fetchState} refreshAnimation={refreshAnimation} />
                </div>
                <nav aria-label="..." style={{ paddingTop: 15 }}>
                    <ul className="pagination pagination-sm justify-content-center">
                        <li className="page-item previous">
                            <a className="page-link"><span onClick={() => { setPageNum(pageNum - 1); updatePagination(pageNum - 1); fadeIn(); }} aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li id="page1" className="page-item" aria-current="page">
                            <a className="page-link" onClick={() => { setPageNum(1); updatePagination(1); fadeIn(); }}>
                                1
                            </a>
                        </li>
                        {page_num}
                        <li className="page-item next">
                            <a className="page-link"><span onClick={() => { setPageNum(pageNum + 1); updatePagination(pageNum + 1); fadeIn(); }} aria-hidden="true">&raquo;</span></a>
                        </li>
                    </ul>
                </nav>
            </ReactSpring.animated.div>
        </>
    )
}

function TickerData({ tickerData, tickerPerPage, pageNum, fetchState, refreshAnimation }) {
    return (
        <>
            {
                tickerData.slice(tickerPerPage * (pageNum - 1), tickerPerPage * pageNum).map((data, index) => (
                    (fetchState !== null && fetchState !== 200 ? (
                        <div key={index} className="placeholder-glow row ticker-container fw-light text-end" aria-hidden="true">
                            <span className="placeholder col-12 bg-secondary mx-3"></span>
                        </div>
                    ) : (
                        <div key={index} className="row ticker-container fw-light text-end">
                            {/* Rank */}
                            <div className="col-2 col-sm-1">{data.market_cap_rank}</div>
                            {/* Coin */}
                            <div className="col-4 col-xs-7 col-sm-3 col-md-3 col-lg-4 col-xl-3 d-flex text-start">
                                <img src={data.image} className="me-2" style={{ maxHeight: 20, maxWidth: 20 }}></img><div>{data.symbol.toUpperCase()}</div>
                            </div>
                            {/* Current Price */}
                            <div className="col-6 col-xs-4 col-sm-4 col-md-3 col-lg-2 col-xl-2" data-mdb-toggle="animation" data-mdb-animation="fade-in">
                                <ReactSpring.animated.div className="row row-cols-2 justify-content-between" style={{
                                    opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                    color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.current_price > data.prev_price ? 'green' : (data.current_price < data.prev_price ? 'red' : 'black'), 'black'] }),
                                }}>
                                    <div className="col-sm-auto ps-xl-5">$</div><div className="col-sm-auto">{data.current_price === null ? '-' : formatPrice(data.current_price.toFixed(2))}</div>
                                </ReactSpring.animated.div>
                            </div>
                            {/* MarketCap */}
                            <div className="d-none d-sm-grid col-4 col-md-4 col-lg-3 col-xl-2">
                                <ReactSpring.animated.div className="row row-cols-2 justify-content-between" style={{
                                    opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                    color: refreshAnimation.to({ range: [0, 1], output: ['black', 'black'] }),
                                }}>
                                    <div className="col-md-auto">$</div><div className="col-md-auto">{data.market_cap === null ? '-' : formatPrice(data.market_cap)}</div>
                                </ReactSpring.animated.div>
                            </div>
                            {/* TotalVolume */}
                            <div className="d-none d-xl-grid col-2">
                                <ReactSpring.animated.div className="row row-cols-2 justify-content-between" style={{
                                    opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                    color: refreshAnimation.to({ range: [0, 1], output: ['black', 'black'] }),
                                }}>
                                    <div className="col-auto">$</div><div className="col-auto">{data.total_volume === null ? '-' : formatPrice(data.total_volume)}</div>
                                </ReactSpring.animated.div>
                            </div>
                            {/* 24H% */}
                            <ReactSpring.animated.div className={
                                parseFloat(data.price_change_percentage_24h) > parseFloat(0) ? "d-none d-md-grid col-1 text-success" : parseFloat(data.price_change_percentage_24h) === parseFloat(0) ? "d-none d-md-grid col-1" : "d-none d-md-grid col-1 text-danger"
                            } style={{
                                opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.price_change_percentage_24h > data.prev_price_change_percentage_24h ? 'green' : (data.price_change_percentage_24h < data.prev_price_change_percentage_24h ? 'red' : 'black'), 'black'] }),
                            }}>
                                {data.price_change_percentage_24h === null ? '-' : data.price_change_percentage_24h.toFixed(2) + '%'}
                            </ReactSpring.animated.div>
                            {/* 7D% */}
                            <ReactSpring.animated.div className={
                                parseFloat(data.price_change_percentage_7d_in_currency) > parseFloat(0) ? "d-none d-lg-grid col-1 text-truncate text-success" : parseFloat(data.price_change_percentage_7d_in_currency) === parseFloat(0) ? "d-none d-lg-grid col-1 text-truncate" : "d-none d-lg-grid col-1 text-truncate  text-danger"
                            } style={{
                                opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.price_change_percentage_7d > data.prev_price_change_percentage_7d_in_currency ? 'green' : (data.price_change_percentage_24h < data.prev_price_change_percentage_24h ? 'red' : 'black'), 'black'] }),
                            }}>
                                {data.price_change_percentage_7d_in_currency === null ? '-' : data.price_change_percentage_7d_in_currency.toFixed(2) + '%'}
                            </ReactSpring.animated.div>
                        </div>
                    )
                    )
                ))
            }
        </>
    )
}


market_overview.render(<MarketOverview />);

