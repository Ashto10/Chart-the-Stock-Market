const fetch = require('node-fetch');

module.exports = function (app, serverData, aWss) {
  
  app.get('/', function(req, res, next) {
    res.render('index');
  });
  
  app.ws('/', function(ws, req) {
    ws.on('connection', function() {
      console.log('Connected');
    });

    ws.on('message', function(msg) {
      msg = JSON.parse(msg);
      
      if (msg.command === 'HEARTBEAT' || msg.command === null) {
        return ws.send(JSON.stringify({type: null}))
      }
      
      if (msg.command === 'ADD') {
        serverData.trackedSymbols.push(msg.data);
      }
      
      if (msg.command === 'REMOVE') {
        serverData.trackedSymbols.splice(serverData.trackedSymbols.indexOf(msg.data));
        aWss.clients.forEach(client => {
          client.send(JSON.stringify({type: 'REMOVE', symbol: msg.data}))
        });
      }
      
      serverData.trackedSymbols.forEach(symbol => {
        let url = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol='+
            symbol + '&outputsize=full&apikey=' + process.env.STOCK_API_KEY;

        fetch(url)
        .then(res => res.json())
        .then(json => {
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
          stockData.minDate = weeklyData[weeklyData.length - 1].date;
          stockData.maxDate = weeklyData[0].date;
          
          aWss.clients.forEach(client => {
            client.send(JSON.stringify({type: 'UPDATE', symbol: symbol, stockData: stockData}))
          });
        }).catch(err => console.log('Error:', err));
      });
      
    });

    ws.on('close', function (msg) {
      console.log('Connection is closed!', msg);
    });
  });
};