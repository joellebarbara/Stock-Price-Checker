'use strict';

const expect = require('chai').expect;
const MongoClient = require('mongodb').MongoClient;
const request = require('request');

module.exports = function (app) {
  app.route('/api/stock-prices').get(async (req, res) => {
    try {
      if (!req.query.stock) {
        return res.json({ error: 'stock is required' });
      }

      const stocks = Array.isArray(req.query.stock) ? req.query.stock : [req.query.stock];
      const like = req.query.like === 'true';

      if (stocks.length > 2) {
        return res.json({ error: 'only 1 or 2 stocks are supported' });
      }

      const fetchStockData = async (stock) => {
        return new Promise((resolve, reject) => {
          const apiUrl = `https://www.alphavantage.co/query?function=global_quote&symbol=${stock.toLowerCase()}&apikey=${process.env.STOCK_API_TOKEN}`;
          request(apiUrl, (error, response, body) => {
            if (error) {
              reject(error);
            } else {
              resolve(JSON.parse(body));
            }
          });
        });
      };

      const updateStock = async (db, stockSymbol, ip, like) => {
        const stockUpdate = {
          $setOnInsert: { stock: stockSymbol },
        };

        if (like) {
          stockUpdate.$addToSet = { likes: ip };
        }

        return db.collection('stock').findOneAndUpdate(
          { stock: stockSymbol },
          stockUpdate,
          { upsert: true, returnDocument: 'after' }
        );
      };

      const db = await MongoClient.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      const stockResults = await Promise.all(
        stocks.map(async (stockSymbol) => {
          const stockData = await fetchStockData(stockSymbol);

          if (!stockData['Global Quote'] || !stockData['Global Quote']['05. price']) {
            return { error: 'Invalid stock data' };
          }

          const price = Number.parseFloat(stockData['Global Quote']['05. price']);
          const stockDocument = await updateStock(db.db(), stockSymbol.toUpperCase(), req.ip, like);
          const likes = stockDocument.value.likes ? stockDocument.value.likes.length : 0;

          return { stock: stockSymbol, price, likes };
        })
      );

      if (stocks.length === 1) {
        res.json({ stockData: stockResults[0] });
      } else {
        const rel_likes1 = stockResults[0].likes - stockResults[1].likes;
        const rel_likes2 = stockResults[1].likes - stockResults[0].likes;

        stockResults[0].rel_likes = rel_likes1;
        stockResults[1].rel_likes = rel_likes2;

        res.json({ stockData: stockResults });
      }
    } catch (error) {
      console.error(error);
      res.json({ error: 'Internal server error' });
    } finally {
      if (db) {
        db.close();
      }
    }
  });
};
