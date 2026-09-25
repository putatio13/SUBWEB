const path = require("path");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CSSMinimizerPlugin = require('css-minimizer-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    entry: "./src/index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "./js/[name].[contenthash:8].js"
    },
    mode: process.env.NODE_ENV,
    // devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: "css-loader",
                        options: {
                            url: false
                        }
                    },
                    {
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins: [
                                    require('tailwindcss'),
                                    require('autoprefixer')
                                ]
                            }
                        }
                    }
                ],
                exclude: /node-moudles/
            }
        ]
    },
    plugins: [
        // new BundleAnalyzerPlugin(),
        new CleanWebpackPlugin(),
        new HTMLWebpackPlugin({
            template: "./public/index.html"
        }),
        new MiniCssExtractPlugin({
            filename: "css/[name].[contenthash:8].css"
        }),
        new CSSMinimizerPlugin(),
        new NodePolyfillPlugin(),
        new CopyPlugin({
            patterns: [
                { from: "public/favicon.ico", to: "favicon.ico" },
                { from: "public/qrcode.min.js", to: "qrcode.min.js" },
                { from: "public/_routes.json", to: "_routes.json" }
            ],
        })
    ],
    resolve: {
        extensions: [".js", "..."]
    },
    optimization: {
        splitChunks: {
            chunks: "all",
            cacheGroups: {
                vendors: {
                    test: /node_modules/,
                    filename: "js/chunk-vendor.[name].[contenthash:8].js",
                }
            }
        },
        minimize: true,
        minimizer: [new TerserPlugin({
            // Keep the standalone QRCode global used by both QR actions.
            exclude: /^qrcode\.min\.js$/,
            terserOptions: {
                toplevel: true
                
            },
            extractComments: false
        })]
    }
};
