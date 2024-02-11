'use strict';

const express = require('express');

const Stock = require('./stock');

const router = express.Router({ mergeParams: true });

const getStockData = async (symbol) => {
  try {
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`;
    // Use dynamic import to fix the ES Module issue
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const stockInfo = await response.json();

    if (!stockInfo.symbol || !stockInfo.latestPrice) {
      return null; // Handle invalid stock data
    }

    return {
      stock: stockInfo.symbol,
      price: stockInfo.latestPrice,
    };
  } catch (error) {
    console.error(error);
    return null; // Handle fetch error
  }
};



const getOrCreateStock = async (symbol) => {
  try {
    let stock = await Stock.findOne({ symbol });

    if (!stock) {
      stock = await Stock.create({ symbol });
    }

    return stock;
  } catch (error) {
    console.error(error);
    return null; // Handle database error
  }
};

const updateLikes = async (stock, like, ip) => {
  try {
    if (!stock) {
      return 0; // Handle invalid stock
    }

    if (like !== 'true') {
      return stock.likes.length;
    }

    if (!stock.likes.includes(ip)) {
      stock = await Stock.findOneAndUpdate(
        { _id: stock._id },
        { $push: { likes: ip } },
        { new: true, useFindAndModify: false }
      );
    }

    return stock.likes.length;
  } catch (error) {
    console.error(error);
    return 0; // Handle updateLikes error
  }
};

router.route('/').get(async (req, res) => {
  try {
    const { stock, like } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!stock) {
      return res.json({ error: 'Stock parameter is required' });
    }

    if (typeof stock === 'string') {
      const stockData = await getStockData(stock);

      if (!stockData) {
        return res.json({ error: 'Invalid stock data' });
      }

      stockData.likes = await updateLikes(await getOrCreateStock(stock), like, ip);

      return res.json({ stockData });
    }

    if (stock.length !== 2) {
      return res.json({ error: 'Invalid number of stocks provided' });
    }

    const [stockData1, stockData2] = await Promise.all([
      getStockData(stock[0]),
      getStockData(stock[1]),
    ]);

    if (!stockData1 || !stockData2) {
      return res.json({ error: 'Invalid stock data' });
    }

    const likes = [
      await updateLikes(await getOrCreateStock(stock[0]), like, ip),
      await updateLikes(await getOrCreateStock(stock[1]), like, ip),
    ];

    stockData1.rel_likes = likes[0] - likes[1];
    stockData2.rel_likes = likes[1] - likes[0];

    return res.json({ stockData: [stockData1, stockData2] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
