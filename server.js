var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);

let aWss = expressWs.getWss('/');

app.set("view engine", "pug");
app.set("views", process.cwd() + "/views");

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/controllers', express.static(process.cwd() + '/controllers'));

let serverData = {
  trackedSymbols: ['MSFT', 'AAPL', 'BOX']
}

const routes = require('./routes/index.js');
routes(app, serverData, aWss);

app.listen(3000);