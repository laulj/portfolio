var path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
var webpack = require('webpack');
var BundleTracker = require('webpack-bundle-tracker');
const DEBUG = process.env.DEBUG;
const AWS_STORAGE_BUCKET_NAME = process.env.AWS_STORAGE_BUCKET_NAME;
const AWS_S3_CUSTOM_DOMAIN = `${AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com`;
const AWS_LOCATION = 'static';

module.exports = {
    mode: 'production',
    context: __dirname,

    entry: {
        index: './assets/js/index',
        layout: './assets/js/layout',
        dashboard: './assets/js/dashboard',
        transaction: './assets/js/transaction',
        transactionHistory: './assets/js/transactionHistory',
    },

    output: DEBUG === "True" ? {
        path: path.resolve('./assets/dist/'),
        filename: "[name]-[fullhash].js",
    } : {
        path: path.resolve('./assets/dist/'),
        filename: "[name]-[fullhash].js",
        publicPath: `https://${AWS_S3_CUSTOM_DOMAIN}/${AWS_LOCATION}/dist/`,
    },

    plugins: [
        new BundleTracker({ filename: './webpack-stats.json' }),
    ],

    module: {
        rules: [
            { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' }, // to transform JSX into JS
        ],
    },

    resolve: {
        modules: ['node_modules', 'bower_components'],
        extensions: ['', '.js', '.jsx']
    },
}