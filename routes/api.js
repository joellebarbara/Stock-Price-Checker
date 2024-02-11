'use strict';

const expect = require('chai').expect;
const MongoClient = require('mongodb').MongoClient;
const request = require('request-promise');

const CONNECTION_STRING = process.env.DB;

module.exports = function (app) {
  app.route('/api/stock-prices').get(async (req, res) => {
    if (!Array.isArray(req.query.stock)) {
      const requestedStock = req.query.stock;

      try {
        const body = await request(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${requestedStock}/quote`);
        const stockData = await processSingleStock(JSON.parse(body), req);
        res.json({ stockData });
      } catch (error) {
        console.error(error);
        res.json({ error: 'Failed to fetch stock data' });
      }
    } else {
      const requestedStocks = req.query.stock;

      try {
        const stockData = await processMultipleStocks(requestedStocks, req);
        res.json({ stockData });
      } catch (error) {
        console.error(error);
        res.json({ error: 'Failed to fetch stock data' });
      }
    }
  });
};

async function processSingleStock(stockInfo, req) {
  // Your single stock processing logic here
  const likes = await updateLikes(await getOrCreateStock(stockInfo.symbol), req.query.like, req.ip);
  return {
    stock: stockInfo.symbol,
    price: stockInfo.latestPrice,
    likes,
  };
}

async function processMultipleStocks(requestedStocks, req) {
  // Your multiple stocks processing logic here
  const [stockData1, stockData2] = await Promise.all(requestedStocks.map(async (stock) => {
    const stockInfo = await getStock(stock);
    return processSingleStock(stockInfo, req);
  }));

  const likes = [stockData1.likes, stockData2.likes];
  stockData1.rel_likes = likes[0] - likes[1];
  stockData2.rel_likes = likes[1] - likes[0];

  return [stockData1, stockData2];
}

