'use strict';

const express = require('express');
const fetch = require('node-fetch');
const mongoose = require('mongoose'); // Make sure to import mongoose for database operations

const Stock = require('../models/stock');

const router = express.Router({ mergeParams: true });

const getStockData = async (symbol) => {
  try {
    // Implement logic to fetch stock data from API
    // Handle likes and return the response
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
    // Implement logic to update likes for the stock
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
