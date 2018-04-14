// const testData = require(process.cwd() + '/testData.js');
const fetch = require('node-fetch');

module.exports = function (app, serverData, aWss) {
  
  function sendMessage(recipient, msg) {
    if (recipient.readyState !== recipient.CLOSED) {
      recipient.send(JSON.stringify(msg));
    } else {
      console.log('Connection is closed');
    }
  }
  
  function fetchStockData (symbol) {    
    return new Promise((resolve, reject) => {
    let url = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol='+
            symbol + '&outputsize=full&apikey=' + process.env.STOCK_API_KEY;

    fetch(url)
      .then(res => res.json())
      .then(json => {
        // let json = testData.msft;
        let weeklyData = [], minClose, maxClose, stockData = {};

        Object.keys(json["Time Series (Daily)"]).forEach(function (key) {
          let close = +json['Time Series (Daily)'][key]['5. adjusted close'];
          let date = new Date(key).toString();
          if (minClose === undefined || minClose > close) {
            minClose = close;
          }
          if (maxClose === undefined || maxClose < close) {
            maxClose = close;
          }
          weeklyData.push({date: date, close: close});
        });

        stockData.stock = symbol;
        stockData.weeklyData = weeklyData;
        stockData.length = weeklyData.length;
        stockData.minClose = minClose;
        stockData.maxClose = maxClose;

        return resolve(stockData);

      });
    }).catch(err => console.log('Error:', err));
  }
  
  function addStock(recipiant, symbol) {
    sendMessage(recipiant, {command: 'ADD', stock: symbol});
    fetchStockData(symbol).then(data => {
      let response = {
        command: 'UPDATE',
        stock: symbol,
        data: data
      }
      setTimeout(()=>{
        sendMessage(recipiant,response);
      }, (Math.random() * 5) * 1000);
    }).catch(err => {
      let response = {
        command: 'ERROR',
        error: err
      }
      sendMessage(recipiant,response);
    });
  }
  
  app.get('/', function(req, res, next) {
    res.render('index');
  });
  
  app.ws('/', function(ws, req) {
    ws.on('connection', function() {
      console.log('Connected');
    });

    ws.on('message', function(msg) {
      msg = JSON.parse(msg);
      
      if (msg.command === 'PING' || msg.command === null) {
        return ws.send(JSON.stringify({command: "PONG"}));
      }
      
      if (msg.command === 'STARTUP') {
        serverData.trackedSymbols.forEach(symbol => {
          addStock(ws, symbol);
        });
      }
      
      if (msg.command === 'ADD') {
        serverData.trackedSymbols.push(msg.stock);
        aWss.clients.forEach(client => {
          addStock(client, msg.stock);
        });
      }
      
      if (msg.command === 'REMOVE') {
        serverData.trackedSymbols.splice(serverData.trackedSymbols.indexOf(msg.stock));
        aWss.clients.forEach(client => {
          sendMessage(client, {command: 'REMOVE', stock: msg.stock});
        });
      }
    });

    ws.on('close', function (msg) {
      console.log('Connection is closed!', msg);
    });
  });
};