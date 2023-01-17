// Exclude 'DOMContentLoaded' event condition since babel standalone has it already
const dashboard = ReactDOM.createRoot(document.getElementById("dashboard-page"));
const ReactSpring = window["ReactSpring"];
function formatPrice(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Custom interval hook
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

function Dashboard() {
    return (
        <>
            <Portfolio />
        </>
    )
}

function Portfolio() {
    const [portfolios, setPortfolios] = React.useState([]);
    const [generalError, setGeneralError] = React.useState(null);
    //const [fetchState, setFetchState] = React.useState(null);

    React.useEffect(() => {
        // Load user's portfolio on the first mount
        getPortfolios()
            .catch(err => setGeneralError(err));
    }, [])

    const getPortfolios = async () => {
        let ignore = false;

        // Wait for response
        const response = await fetch('/portfolio');

        if (!ignore) {
            console.log('status:', response.status);

            const data = await response.json();
            console.log('portfolios:', data);
            setPortfolios(data);
            setActivePortfolio(data[0].id);
        }

        return () => {
            ignore = true;
        }
    };

    const handleClick = (id) => {
        setActivePortfolio(id);
    }

    const [activePortfolio, setActivePortfolio] = React.useState(null);
    const [portfolioAsset, setPortfolioAsset] = React.useState([]);
    const [txsError, setTxsError] = React.useState(null);
    const txsintervalRef = React.useRef(null);
    const handleChartDisplay = async () => {
        // Fetch new chart data
        await update_txs();
        // Resize chart
        lightWeightChartRef.current.timeScale().fitContent();
        // Toggle chart display animation
        setChartDisplayState(!chartDisplayState);
    }

    const update_txs = async () => {
        getTxs()
            .then(newTxs => {
                console.log('newTxs:', newTxs);
                if (newTxs !== null) {
                    getPortfolioChartData(newTxs);
                }
            })
            .catch(err => { console.log('err', err); setTxsError(err); });
    }

    React.useEffect(() => {
        // Clear the previous interval when activePortfolio changes
        clearInterval(txsintervalRef.current);

        // Set the portfolio dropdown innerHTML by the first portfolio name
        const element = document.getElementById('portfolioName');
        portfolios.map(portfolio => {
            if (portfolio.id === activePortfolio) {
                element.innerHTML = portfolio.name;
            }
        });

        getTxs()
            .then(newTxs => {
                console.log('newTxs:', newTxs);
                if (newTxs !== null) {
                    getAssets(newTxs)
                        .catch(err => console.log('err:', err));
                    getPortfolioChartData(newTxs)

                    // Query for user's assets detail per 60s interval
                    txsintervalRef.current = setInterval(() => {
                        console.log('charData:', chartData);
                        getTxs()
                            .then(newTxs => {
                                if (newTxs !== null) {
                                    getAssets(newTxs)
                                        .catch(err => { console.log('err', err); setTxsError(err); });
                                }
                            });
                    }, 60000);
                }
                return () => clearInterval(txsintervalRef.current);
            })
            .catch(err => { console.log('err', err); setTxsError(err); });

    }, [activePortfolio])

    // Reference for the LightWeightChart AreaSeries
    const lightWeightChartRef = React.useRef(null);
    const areaSeriesRef = React.useRef(null);
    // Chart States
    const [chartUpdate, setChartUpdate] = React.useState(null);
    React.useEffect(() => {
        // To update the chart data without resizing the current chart
        if (chartUpdate !== null && areaSeriesRef !== null) {
            console.log("update chart", chartUpdate);
            areaSeriesRef.current.update(chartUpdate);
        }

    }, [chartUpdate]);
    const [chartData, setChartData] = React.useState([]);


    function portfolioChartData(time, assets, value) {
        this.time = time;
        this.assets = assets;
        this.value = parseFloat(value.toFixed(2));
    }

    const [uiKlinesFetchState, setUiKlinesFetchState] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const getuiKlinesById = async (id, date) => {
        setIsLoading(true);
        let intervalNum = '1h';
        let response;
        try {
            response = await fetch(`https://api.binance.com/api/v3/uiKlines?symbol=${id}USDT&interval=${intervalNum}&startTime=${date}`);
        } catch (err) {
            setUiKlinesFetchState('failed'); // TypeError: failed to fetch
            return null;
        }

        //console.log('response', response);
        const data = await response.json();

        setIsLoading(false);
        //console.log('binance history:', id, data);
        return data;
    }

    const getCurrentAveragePriceById = async (id) => {
        const response = await fetch(`https://api.binance.com/api/v3/avgPrice?symbol=${id}USDT`);
        const data = await response.json();
        //console.log('binance current price:', id, data);
        return data.price;
    }

    const getTxs = async () => {
        let ignore = false;
        // Wait for response
        if (activePortfolio !== null && !ignore) {
            const response = await fetch(`/txs_data/${activePortfolio}`);
            console.log(`fetching /txs_data/${activePortfolio}...`, 'status:', response.status);
            const data = await response.json();
            console.log(`Queried txs for portfolio ${activePortfolio}:`, data);
            if (response.status !== 200) {
                setTxsError(data.error);
                return null;
            } else {
                setTxsError(null);
                return data;
            }
        }
        //setFetchState(response.status);

        // Return null if activePortfolio Hook is not set
        return null;
    };

    // Queried for user's asset market data
    const getMarketDataById = async (ids) => {
        let ids_string = "";
        for (let id of ids) {
            ids_string += id + "%2C";
        }
        //console.log('ids:', ids_string);
        //const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`);
        //const response = await fetch(`https://api.binance.com/api/v3/avgPrice?symbol=${id}USDT`);
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&&ids=${ids_string}&order=market_cap_desc&sparkline=false&price_change_percentage=24h%2C7d`, { method: 'GET' });

        const data = await response.json();

        return data;
    }

    // Asset constructor function
    function userAsset(data) {
        this.index = null;
        this.rank = data.market_cap_rank;
        this.id = data.id;
        this.symbol = data.symbol;
        this.prev_price = data.current_price;
        this.current_price = data.current_price;
        this.market_cap = data.market_cap;
        this.price_change_percentage_24h = data.price_change_percentage_24h;
        this.price_change_percentage_7d = data.price_change_percentage_7d_in_currency;
        this.image_url = data.image;
        this.last_updated = data.last_updated;
        this.average_cost = null;
        this.quantity = null;
        this.pnl = 0;
    }

    // Construct portfolio chart data
    const getPortfolioChartData = async newTxs => {
        // Construct charData between the first portfolio txs and current from txs data and binance API
        //console.log('In getPortfolioChartData: newTxs:', newTxs);
        if (chartData.length === 0) {
            // Identify unique asset from user's txs
            let symbols = new Set();
            for (let tx of newTxs) {
                symbols.add(tx.symbol);
            }
            // Convert set to an array to iterate async with the method: map
            symbols = Array.from(symbols);

            // Query for assets 4hr klines data since the first recorded portfolio transction 
            const promises = symbols.map(async symbol => {
                return { symbol: symbol, uKline: await getuiKlinesById(symbol, Math.floor((new Date(newTxs[0].created_on)).getTime())) };
            });
            // Waiting for promises to resolve
            let latestAssetsValue_inMS = await Promise.all(promises);
            if (latestAssetsValue_inMS[0].uKline === null) { return null; }
            let net_worth = 0;
            let asset_list = [];

            const promises1 = newTxs.map(async tx => {
                let newchart = null;
                let current_price = null;
                // Method getTime() returns in time milliseonds since 1970
                let unixTimestamp_inMS = Math.floor((new Date(tx.created_on)).getTime());

                // Get the price of the asset at the closest 4hr Kline candlestick instead of tx.bought_on
                latestAssetsValue_inMS.map(AssetValue => {
                    if (AssetValue.symbol === tx.symbol) {
                        for (let i = 0; i < AssetValue.uKline.length - 2; i++) {
                            // If transaction is created closer to opening 4hr Kline candlestick
                            if (unixTimestamp_inMS - AssetValue.uKline[i][0] <= unixTimestamp_inMS - AssetValue.uKline[i + 1][0]) {
                                // Use the starting price of the 4hr Kline candlestick
                                current_price = AssetValue.uKline[i][1];
                            } else {
                                // Use the ending price of the 4hr Kline candlestick
                                current_price = AssetValue.uKline[i + 1][1];
                            }
                        }
                    }
                });
                if (tx.type === 'B') {
                    net_worth += tx.quantity * current_price;
                    asset_list.push({ symbol: tx.symbol, quantity: tx.quantity });
                }
                else if (tx.type === 'S') {
                    net_worth -= tx.quantity * current_price;
                    asset_list.forEach(asset => {
                        if (asset.symbol === tx.symbol) {
                            asset.quantity -= tx.quantity;
                        }
                    });
                }
                // Clone the array of objects to prevent pointing to the same reference
                newchart = new portfolioChartData(unixTimestamp_inMS / 1000, structuredClone(asset_list), net_worth);

                return newchart;
            });
            // Waiting for promises to resolve
            let res = await Promise.all(promises1);

            //console.log('be4 res:', res);

            //console.log('adding more chartdata...');
            const uKline_unixTimestamp_inMS = latestAssetsValue_inMS[0].uKline;
            // Adding new Chart Data by timestamps
            const promises2 = uKline_unixTimestamp_inMS.map(async (timestamp_inMS, index) => {

                // Determine the networth at that instance by finding the closest transaction before timestamp_inMS
                const promises = res.map(async (portChartData, chartDataIndex) => {
                    let net_worth = 0;
                    //console.log(`${index}:`, 'timestamp:', timestamp_inMS[0], 'vs', portChartData.time * 1000, timestamp_inMS[0] < portChartData.time * 1000);
                    // If timestamp_inMS[i] is < chartData[j].time, the networth of user's portfolio at that instance must be chartData[j - 1].time
                    if (timestamp_inMS[0] < res[res.length - chartDataIndex - 1].time * 1000 && chartDataIndex <= (res.length - 2)) {
                        const promises = res[res.length - chartDataIndex - 2].assets.map(async asset => {
                            const promises = latestAssetsValue_inMS.map(async AssetValue => {
                                //console.log('comparing asset.symbol:', asset.symbol, 'to AssetValue.symbol:', AssetValue.symbol, asset.symbol === AssetValue.symbol);
                                if (asset.symbol === AssetValue.symbol) {
                                    //console.log(AssetValue.uKline[index][1], net_worth);
                                    net_worth += parseFloat(asset.quantity * AssetValue.uKline[index][1]);
                                    //console.log('networth:', net_worth);
                                }
                            });
                            await Promise.all(promises);
                        });

                        await Promise.all(promises);
                        //console.log(net_worth);

                        return new portfolioChartData(timestamp_inMS[0] / 1000, structuredClone(res[res.length - chartDataIndex - 2].assets), net_worth);
                    }
                    return null;
                });
                let new_chartData = await Promise.all(promises);
                new_chartData = new_chartData.filter(data => data !== null);
                //console.log('newchartdata', new_chartData);
                if (new_chartData.length !== 0) {
                    /*for (let chartData of new_chartData) {
                        res.push(chartData);
                    }*/
                    res.push(new_chartData[0]);
                }
            });
            await Promise.all(promises2);
            // Add starting chart data, i.e. networth = 0
            res.push(new portfolioChartData(res[0].time - 4 * 60 * 60, [], parseFloat(0.00)));

            // Sort the array of chart data by time in ascending order
            res.sort((a, b) => { return a.time - b.time });

            // Get current time chart data
            const latest_assets = res[res.length - 1].assets;
            net_worth = 0;
            const promises3 = latest_assets.map(async asset => {
                const price = await getCurrentAveragePriceById(asset.symbol);
                net_worth += asset.quantity * price;
            });
            await Promise.all(promises3);

            //console.log(new portfolioChartData((new Date()).getTime() / 1000, structuredClone(latest_assets), net_worth));
            res.push(new portfolioChartData((new Date()).getTime() / 1000, structuredClone(latest_assets), net_worth));

            //console.log('after res:', res);

            setChartData(res);
            return res;
        } else {
            // Update the latest chart data only
            let net_worth = 0;
            //console.log(chartData[chartData.length - 1]);
            const latest_assets = chartData[chartData.length - 1].assets;
            let portfolioAssetToUpdate = [...portfolioAsset];
            const promises = latest_assets.map(async asset => {
                const price = await getCurrentAveragePriceById(asset.symbol);
                // Update portfolio asset metrics
                portfolioAssetToUpdate.forEach(pAsset => {
                    if (pAsset.symbol === asset.symbol.toLowerCase()) {
                        pAsset.prev_price = parseFloat(pAsset.current_price);
                        pAsset.current_price = parseFloat(price);
                        pAsset.pnl = (pAsset.current_price - pAsset.average_cost) * 100 / pAsset.average_cost;
                    }
                });
                // Update chart data
                net_worth += asset.quantity * price;
            });
            //console.log('newAsset:', portfolioAssetToUpdate);
            setPortfolioAsset(portfolioAssetToUpdate);
            await Promise.all(promises);
            //console.log('portfolioasset:', portfolioAsset);

            setChartUpdate(new portfolioChartData((new Date()).getTime() / 1000, structuredClone(latest_assets), net_worth));
            setAnimateState(!animateState);
        }
    }

    // Construct user's assets
    const getAssets = async (newTxs) => {
        // Identify unique asset from user's transactions
        const symbols_id = new Set();
        for (let tx of newTxs) {
            symbols_id.add(tx.symbol_id);
        }
        // Construct a list of unique userAsset objects
        let temp_asset = [];

        const chunks = await getMarketDataById(symbols_id);
        for (let data of chunks) {
            temp_asset.push(new userAsset(data));
        }

        // Update the net user's asset quantity, ,average cost, pnl
        temp_asset.forEach(asset => {
            //console.log('asset:', asset, 'tx.symbol:', tx.symbol, 'asset.id', asset.rank);
            for (let tx of newTxs) {
                if (tx.symbol_id === asset.id) {
                    if (tx.type === 'B') {
                        asset.quantity += tx.quantity;
                        asset.average_cost += tx.bought_at * tx.quantity;
                    } else if (tx.type === 'S') {
                        asset.quantity -= tx.quantity;
                        asset.average_cost -= tx.bought_at * tx.quantity;
                    }
                }
            }
            asset.average_cost /= asset.quantity;
            //console.log('asset:', asset.id, 'asset current price:', asset.current_price, 'asset average cost:', asset.average_cost);
            asset.pnl = (asset.current_price - asset.average_cost) * 100 / asset.average_cost;
        })

        // Sort by largest current holding in descending order
        temp_asset.sort((a, b) => { return b.current_price * b.quantity - a.current_price * a.quantity });

        // Add index number for sorting, default to holding in descending order
        temp_asset.map((asset, index) => {
            asset.index = index;
        });
        console.log('tempasset:', temp_asset);
        setPortfolioAsset(temp_asset);
        return temp_asset;
    }

    // Remove portfolio handler
    const removePortfolio = async (id) => {
        let ignore = false;

        if (!ignore) {
            let response = await fetch(`/portfolio/${parseInt(id)}`, {
                method: 'POST',
            })
            // Get the response status
            console.log('response:', response);
            const responseStatus = response.status;
            if (responseStatus !== 204) {
                const data = await response.json();
                setGeneralError(data.error);
            }
            // Hide the modal
            $('#deletePortfolioModal' + id).modal('hide');
            getPortfolios();

        }

        return () => {
            ignore = true;
        }
    };

    // Pagination state
    const [pageNum, setPageNum] = React.useState(1);
    // Update the css properties of page-link once the page state changes
    const updatePagination = (num) => {
        //console.log('num:', num);
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
            console.log('if');
            document.getElementsByClassName('previous')[0].classList.add('disabled');
            document.getElementsByClassName('next')[0].classList.add('active');
        }
        else if (parseInt(num) === (allpages.length - 2)) {
            // Enable 'previous' and disable 'next'
            console.log('else if');
            document.getElementsByClassName('next')[0].classList.add('disabled');
            document.getElementsByClassName('previous')[0].classList.add('active');
        }
        else {
            console.log('else');
            document.getElementsByClassName('previous')[0].classList.remove('disabled');
            document.getElementsByClassName('next')[0].classList.remove('disabled');
        }
    }
    React.useEffect(() => {
        updatePagination(pageNum);
    }, []);

    // Compute the page length required
    const assetPerPage = parseInt(5);
    let page_length = Math.ceil(portfolioAsset.length / assetPerPage);
    let page_num = [];
    for (let i = 2; i < page_length + 1; i++) {
        page_num.push(<li key={i} id={"page" + i} className="page-item"><a className="page-link" onClick={() => { setPageNum(i); updatePagination(i); fadeIn2(); }}>{i}</a></li>);
    }

    // Update asset and chart data per 5s
    useInterval(() => {
        //console.log('charData:', chartData);
        if (!isLoading && uiKlinesFetchState !== 'failed') {
            getTxs()
                .then(newTxs => {
                    if (newTxs !== null) {
                        getPortfolioChartData(newTxs)
                            .catch(err => setGeneralError(err));
                    }
                });
        }
    }, 5000);


    // Compute the totall portfolio statistics
    let total_pnl = 0;
    let total_cost = 0;
    let prev_networth = 0;
    let networth = 0;
    // Account for portfolio with empty transactions
    if (txsError === null) {
        portfolioAsset.map(asset => {
            total_pnl += asset.pnl * asset.average_cost;
            total_cost += asset.average_cost;
            asset.prev_price !== null ? (prev_networth += parseFloat(asset.quantity * asset.prev_price)) : (prev_networth += 0);
            networth += parseFloat(asset.quantity * asset.current_price);
        });
        total_pnl /= total_cost;
    }

    // -------ReactSpring Animations-------
    const [chartDisplayState, setChartDisplayState] = React.useState(true);
    const { fadeIn } = ReactSpring.useSpring({
        from: { fadeIn: 0 },
        fadeIn: chartDisplayState ? 1 : 0,
        config: { duration: 500 },
    });
    // Pagination Refresh animation
    const [fade, api] = ReactSpring.useSpring(() => ({
        from: { opacity: 0 },
        to: { opacity: 1 },
        config: { duration: 1000 },
    }));
    const fadeIn2 = () => {
        api({
            from: {
                opacity: 0,
            },
            to: {
                opacity: 1,
            },
        });
    };
    // Portfolio asset content i.e. price refresh animation
    const [animateState, setAnimateState] = React.useState(true);
    const { refreshAnimation } = ReactSpring.useSpring({
        from: { refreshAnimation: 0 },
        refreshAnimation: animateState ? 1 : 0,
        config: { duration: 1000 },
    });


    return (
        <>
            <div className="container-fluid">
                <div className="d-flex flex-column justify-content-around">
                    {generalError === null ? null : (
                        <div className="queryAlert alert alert-danger d-flex align-items-center justify-content-between p-2" role="alert" style={{ fontSize: 15 }}>
                            <div><i className="bi bi-exclamation-triangle me-1"></i> {generalError}</div>
                            <button type="button" className="btn-close btn-sm ms-1 pe-3" aria-label="Close" onClick={() => { document.querySelector('.queryAlert').style.setProperty("display", "none", "important"); }}></button>
                        </div>)
                    }
                    <div className="d-flex flex-row justify-content-start mb-2">
                        <button id="chartDisplayButton" className="btn btn-outline-primary" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePortfolioChart" aria-expanded="true" aria-controls="collapsePortfolioChart" onClick={() => handleChartDisplay()}>
                            Chart
                            <i className="bi bi-eye ms-1"></i>
                            <i className="bi bi-eye-slash ms-1"></i>
                        </button>
                    </div>

                    {/* CHART OVERVIEW*/}
                    <ReactSpring.animated.div className="collapse show mb-3" id="collapsePortfolioChart" style={{
                        opacity: fadeIn.to({ range: [0, 1], output: [0.3, 1] }),
                        scale: fadeIn.to({
                            range: [0, 0.5, 0.75, 1],
                            output: [0, 1.1, 0.95, 1],
                        }),
                    }}>
                        <div className="card card-body p-1">
                            <div className="d-flex justify-content-start mb-3">
                                {isLoading && uiKlinesFetchState === null ? (
                                    <button className="btn btn-sm btn-outline-warning p-1" type="button" disabled style={{ fontSize: 12 }}>
                                        <span className="spinner-grow spinner-grow-sm me-1" role="status" aria-hidden="true" style={{ height: '0.75rem', width: '0.75rem' }}></span>
                                        Loading...
                                    </button>
                                ) : (uiKlinesFetchState === 'failed' ? (
                                    <div className="chartAlert alert alert-danger d-flex align-items-center justify-content-between p-2" role="alert" style={{ fontSize: 13 }}>
                                        <div><i className="bi bi-exclamation-triangle me-1"></i> Couldn't load chart data from binance API, is your IP address blocked from accessing binance.com?</div>
                                        <button type="button" className="btn-close btn-sm ms-1" aria-label="Close" onClick={() => { document.querySelector('.chartAlert').style.setProperty("display", "none", "important"); }}></button>
                                    </div>) : null)
                                }
                            </div>
                            <div id="chart" className="d-flex flex-row chart ps-3" style={{ height: '30vh', position: "relative" }}>
                                <ChartComponent data={chartData} lightWeightChartRef={lightWeightChartRef} areaSeriesRef={areaSeriesRef} />
                                {/* Lightweight Charts Attribution Message and Link */}
                                <div className="lw-attribution">
                                    <a href="https://tradingview.github.io/lightweight-charts/">Powered by Lightweight Charts</a>
                                </div>
                                {txsError !== null || (isLoading && uiKlinesFetchState === null) ? (
                                    <div style={{ position: "absolute", left: "50%", top: "35%", zIndex: 3 }}>
                                        <span className="spinner-border text-primary" role="status" aria-hidden="true" style={{ height: '3rem', width: '3rem' }}></span>
                                    </div>) : null
                                }
                            </div>
                        </div>
                    </ReactSpring.animated.div>

                    {/* PORTFOLIO CONTENT */}
                    <div className="card card-body">
                        {/* Statistics Summary */}
                        <div className="d-flex flex-row justify-content-between align-items-center">
                            <div className="d-flex flex-row justify-content-start me-3 mb-3">
                                <div className="btn-outline-primary d-flex flex-column flex-md-row align-items-center portfolio_total_pnl p-3 me-3" style={{ fontSize: "1em" }}>
                                    <span className="fw-semibold me-3">Total PNL: </span>
                                    <ReactSpring.animated.span className={parseFloat(total_pnl) > parseFloat(0) ? "text-success" : parseFloat(total_pnl) < parseFloat(0) ? "text-danger" : ""} style={{
                                        opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                        color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', networth > prev_networth ? 'green' : (networth < prev_networth ? 'red' : 'black'), 'black'] }),
                                    }}>
                                        {total_pnl === 0 ? total_pnl + '%' : total_pnl.toFixed(2) + '%'}
                                    </ReactSpring.animated.span>
                                </div>
                                <div className="btn-outline-primary d-flex flex-column flex-md-row align-items-center portfolio_total_pnl p-3" style={{ fontSize: "1em" }}>
                                    <span className="fw-semibold me-3">Networth: </span>
                                    <ReactSpring.animated.span className="" style={{
                                        opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                        color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', networth > prev_networth ? 'green' : (networth < prev_networth ? 'red' : 'black'), 'black'] }),
                                    }}>
                                        $ {networth.toFixed(2)}
                                    </ReactSpring.animated.span>
                                </div>
                            </div>
                            {/* Portfolio Delete Button */}
                            <div className="mb-3 me-2">
                                <button type="button" className="btn btn-danger" value={activePortfolio} data-bs-toggle="modal" data-bs-target={"#deletePortfolioModal" + activePortfolio}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={13}
                                        height={13}
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
                                <div className="modal fade" id={"deletePortfolioModal" + activePortfolio} value={activePortfolio} tabIndex={-1} aria-labelledby={"deletePortfolioModal" + activePortfolio + "Label"} aria-hidden="true">
                                    <div className="modal-dialog modal-dialog-centered modal-sm">
                                        <div className="modal-content">
                                            <div className="modal-header">
                                                <h1 className="modal-title fs-5" id={"deletePortfolioModal" + activePortfolio + "Label"}>
                                                    Delete portfolio: {portfolios.map(portfolio => (portfolio.id === activePortfolio ? portfolio.name : null))}
                                                </h1>
                                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                                            </div>
                                            <div className="modal-body text-start">Are you sure?</div>
                                            <div className="modal-footer">
                                                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">
                                                    Close
                                                </button>
                                                <button type="button" className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); removePortfolio(activePortfolio); }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Portfolio Details */}
                        <ReactSpring.animated.div className="d-flex flex-column justify-content-between text-start" style={fade}>
                            <div className="d-flex flex-row justify-content-between">
                                <div className="dropdown mb-3">
                                    <button id="portfolioName" className="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Portfolio
                                    </button>
                                    <ul className="dropdown-menu">
                                        {portfolios.map(portfolio => (
                                            <li key={portfolio.id}>
                                                <a className="dropdown-item d-flex flex-row justify-content-between" style={{ cursor: "pointer" }} onClick={() => { setChartData([]); handleClick(portfolio.id) }}>
                                                    <span className="pt-1" style={{ fontSize: 15 }}>{portfolio.name}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="mb-3 pe-2">
                                    <a className="btn btn-sm btn-success me-2" type="button" href="/transaction">Add Tx</a>
                                    <a className="btn btn-sm btn-danger" type="button" href="/transactionHistory">Remove Tx</a>
                                </div>
                            </div>
                            <div className="overviewBackground-container">
                                <div className="row ticker-header fw-semibold text-end">
                                    <div className="col-1 text-truncate">Rank</div>
                                    <div className="col-1 col-sm-2 col-xl-1 text-start"></div>

                                    <div className="d-none d-md-grid col-3 col-lg-2">Price</div>
                                    <div className="d-none d-lg-grid col-4 col-lg-3 col-xl-2">MarketCap.</div>
                                    <div className="d-none d-xl-grid col-1">24h</div>
                                    <div className="d-none d-xl-grid col-1">7d</div>
                                    <div className="col-6 col-xs-5 col-md-3 col-lg-2">Holding</div>
                                    <div className="col-3 col-xs-4 col-sm-3 col-md-2 col-lg-2 col-xl-2">PNL</div>
                                </div>
                                {txsError !== null ? (<div className="row ticker-header text-secondary text-end ps-5" style={{ fontSize: 13 }}>Please add some transactions.</div>) : (
                                    <Asset portfolioAsset={portfolioAsset} assetPerPage={assetPerPage} pageNum={pageNum} refreshAnimation={refreshAnimation} />)
                                }
                            </div>
                            <nav aria-label="..." style={{ paddingTop: 15 }}>
                                <ul className="pagination pagination-sm justify-content-center">
                                    <li className="page-item previous">
                                        <a className="page-link"><span onClick={() => { setPageNum(pageNum - 1); updatePagination(pageNum - 1); fadeIn2(); }} aria-hidden="true">&laquo;</span></a>
                                    </li>
                                    <li id="page1" className="page-item" aria-current="page">
                                        <a className="page-link" onClick={() => { setPageNum(1); updatePagination(1); fadeIn2(); }}>
                                            1
                                        </a>
                                    </li>
                                    {page_num}
                                    <li className="page-item next">
                                        <a className="page-link"><span onClick={() => { setPageNum(pageNum + 1); updatePagination(pageNum + 1); fadeIn2(); }} aria-hidden="true">&raquo;</span></a>
                                    </li>
                                </ul>
                            </nav>
                        </ReactSpring.animated.div>
                    </div>
                </div>
            </div>
        </>
    )
}

function ChartComponent({ data, lightWeightChartRef, areaSeriesRef }) {
    const chartContainerRef = React.useRef();

    //console.log('areaSeriesRef', areaSeriesRef.current);
    React.useEffect(() => {
        const handleResize = () => {
            lightWeightChartRef.current.applyOptions({ width: document.getElementById("chart").clientWidth, height: document.getElementById("chart").clientHeight });
        };

        lightWeightChartRef.current = LightweightCharts.createChart(chartContainerRef.current, {
            layout: {
                background: { type: LightweightCharts.ColorType.Solid, color: 'white' },
                textColor: 'black',
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            //width: chartContainerRef.current.clientWidth,
            width: document.getElementById("chart").clientWidth,
            height: document.getElementById("chart").clientHeight,
        });
        lightWeightChartRef.current.timeScale().fitContent();
        //chart.timeScale().setVisibleLogicalRange({ from: 0.0, to: 5.2 })
        //const newSeries = chart.addAreaSeries({ lineColor, topColor: areaTopColor, bottomColor: areaBottomColor });
        areaSeriesRef.current = lightWeightChartRef.current.addAreaSeries({ lineColor: '#2962FF', topColor: '#2962FF', bottomColor: 'rgba(41, 98, 255, 0.28)', lastPriceAnimation: LightweightCharts.LastPriceAnimationMode.Continuous });

        areaSeriesRef.current.setData(data);
        //console.log('areaSeriesRef after:', areaSeriesRef);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            lightWeightChartRef.current.remove();
        };
    }, [data]);

    return (
        <div
            ref={chartContainerRef}
        />
    );
};

function Asset({ portfolioAsset, assetPerPage, pageNum, refreshAnimation }) {

    return (
        <>
            {
                portfolioAsset.slice(assetPerPage * (pageNum - 1), assetPerPage * pageNum).map((data, index) => (
                    <div key={index} className="row ticker-container fw-light text-end">
                        {/* Rank */}
                        <div className="col-1">{data.index + 1}</div>
                        {/* Coin */}
                        <div className="col-1 col-sm-2 col-xl-1 d-flex text-start">
                            <img src={data.image_url} className="me-2" style={{ maxHeight: 20, maxWidth: 20 }}></img>
                            <div className="d-none d-sm-inline-flex">{data.symbol.toUpperCase()}</div>
                        </div>
                        {/* CurrentPrice */}
                        <div className="d-none d-md-grid col-3 col-lg-2">
                            <ReactSpring.animated.div className="row row-cols-2 justify-content-between" style={{
                                opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.current_price > data.prev_price ? 'green' : (data.current_price < data.prev_price ? 'red' : 'black'), 'black'] }),
                            }}>
                                <div className="col-auto ps-3 ps-xl-5">$</div><div className="col-auto">{data.current_price === null ? '-' : formatPrice(data.current_price.toFixed(2))}</div>
                            </ReactSpring.animated.div>
                        </div>
                        {/* MarketCap */}
                        <div className="d-none d-lg-grid col-4 col-lg-3 col-xl-2">
                            <div className="row row-cols-2 justify-content-between">
                                <div className="col-auto">$</div><div className="col-auto">{data.market_cap === null ? '-' : formatPrice(data.market_cap)}</div>
                            </div>
                        </div>
                        {/* 24H% */}
                        <div className={
                            parseFloat(data.price_change_percentage_24h) > parseFloat(0) ? "d-none d-xl-grid col-1 text-success" : parseFloat(data.price_change_percentage_24h) === parseFloat(0) ? "d-none d-xl-grid col-1" : "d-none d-xl-grid col-1 text-danger"
                        }>
                            {data.price_change_percentage_24h === null ? '-' : data.price_change_percentage_24h.toFixed(2)}%
                        </div>
                        {/* 7D% */}
                        <div className={
                            parseFloat(data.price_change_percentage_7d) > parseFloat(0) ? "d-none d-xl-grid col-1 text-success" : parseFloat(data.price_change_percentage_7d) === parseFloat(0) ? "d-none d-xl-grid col-1" : "d-none d-xl-grid col-1 text-danger"
                        }>
                            {data.price_change_percentage_7d === null ? '-' : data.price_change_percentage_7d.toFixed(2)}%
                        </div>
                        {/* Holding */}
                        <div className="col-6 col-xs-5 col-md-3 col-lg-2 justify-content-between">
                            <ReactSpring.animated.div className="row row-cols-2 justify-content-around justify-content-sm-between" style={{
                                opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                                color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.current_price > data.prev_price ? 'green' : (data.current_price < data.prev_price ? 'red' : 'black'), 'black'] }),
                            }}>
                                <div className="col-auto ps-0 ps-sm-5 ps-md-3 ps-xl-5">$</div><div className="col-auto">{data.current_price === null ? data.quantity : formatPrice((data.quantity * data.current_price).toFixed(2))}</div>
                            </ReactSpring.animated.div>
                        </div>
                        {/* PNL */}
                        <ReactSpring.animated.div className={
                            parseFloat(data.pnl) > parseFloat(0) ? "col-3 col-xs-4 col-sm-3 col-md-2 col-lg-2 col-xl-2 text-success" : parseFloat(data.pnl) === parseFloat(0) ? "col-3 col-xs-4 col-sm-3 col-md-2 col-lg-2 col-xl-2" : "col-3 col-xs-4 col-sm-3 col-md-2 col-lg-2 col-xl-2 text-danger"
                        } style={{
                            opacity: refreshAnimation.to({ range: [0, 0.5, 1], output: [1, 0.3, 1] }),
                            color: refreshAnimation.to({ range: [0, 0.5, 1], output: ['black', data.current_price > data.prev_price ? 'green' : (data.current_price < data.prev_price ? 'red' : 'black'), 'black'] }),
                        }}>
                            {data.pnl === null ? '-' : data.pnl.toFixed(2)}%
                        </ReactSpring.animated.div>
                    </div>
                ))
            }
        </>
    )
}

dashboard.render(<Dashboard />);

