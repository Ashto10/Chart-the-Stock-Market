(function() {
  
  var stocks = {};
  
  var margin = {
    top: 30,
    right: 20,
    bottom: 30,
    left: 55
  },
      chartWidth = 500 - margin.left - margin.right,
      chartHeight = 200 - margin.top - margin.bottom,
      closeMin = chartHeight,
      closeMax= 0,
      minDate = new Date();
  
  var chart = d3.select("svg")
      .attr('width', chartWidth + margin.left + margin.right)
      .attr('height', chartHeight + margin.top + margin.bottom)
      .style('background', 'whitesmoke')
    .append('g')
      .attr('transform','translate('+margin.left+','+margin.top+')')
  
  var ordinalScale = d3.scaleOrdinal()
  .range(d3.schemePaired);
  
  var yScale = d3.scaleLinear()
      .range([0,chartHeight]);
    
  var xScale = d3.scaleTime()
      .range([0,chartWidth]);
  
  var ws = new WebSocket('wss://legend-turret.glitch.me/');
  var heartbeat;
  
  function removeStockLocally(stock) {
    $('#' + stock).remove();
    delete stocks[stock];
    closeMin = chartHeight;
    closeMax= 0;
    minDate = new Date();
    updateStocks();
    
  }
  
  function updateStocks() {
    Object.keys(stocks).forEach(function(key) {
      closeMin = closeMin < stocks[key].minClose ? closeMin : stocks[key].minClose;
      closeMax = closeMax > stocks[key].maxClose ? closeMax : stocks[key].maxClose;
      minDate = new Date(minDate).getTime() < new Date(stocks[key].minDate).getTime() ? minDate : stocks[key].minDate;
    })
    
    chart.selectAll('g').remove();
    
    var t = d3.transition()
      .duration(750);
    
    xScale.domain([new Date(minDate), new Date()]);
    yScale.domain([closeMax * 1.3,closeMin * 0.7]);
    ordinalScale.domain(d3.keys(stocks));
    
    chart.append("g")
      .attr("transform", "translate(" + 0 + ",0)")
      .call(
        d3.axisLeft(yScale)
          .tickFormat(function (d) {
            return `$${d}.00`;
          })
          .ticks(6)
      );
    
    chart.append("g")
      .attr("transform", "translate(0," + chartHeight + ")")
      .call(d3.axisBottom(xScale));
    
    var lineGenerator = d3.line()
        .x(function(d,i) {
          return xScale(new Date(d.date));
        })
        .y(function(d) {
          return yScale(d.close);
        });
    
    var update = chart.selectAll('.line')
      .data(d3.keys(stocks), function (d) { return d});
    
    update.exit()
      .transition(t)
        .style("opacity", 0)
        .remove();
    
    update
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('class','line')
      .transition(t)
        .attr('stroke', function(d) { return ordinalScale(d) })
        .attr('d', function(d) {
          return lineGenerator(stocks[d].weeklyData);  
        })
    
    // Enter
    update.enter()
      .append('path')
        .attr('d', function(d) {
          return lineGenerator(stocks[d].weeklyData);  
        })
        .attr('stroke', function(d) { return ordinalScale(d) })
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('class','line')
        .style("opacity", 0)
      .transition(t)
        .style("opacity", 1)
        
  }

  // event emmited when connected
  ws.onopen = function () {
    console.log('websocket is connected ...')

    // sending a send event to websocket server
    ws.send(JSON.stringify({command: "FETCH"}));
    
    // keep connection open and update
    heartbeat = setInterval(function() {
      ws.send(JSON.stringify({command: null}));
    }, 30000);

    // ws.close();
  }

  // event emmited when receiving message 
  ws.onmessage = function (ev) {
    var response = JSON.parse(ev.data);
    if (response.type === null) {
      return;
    }
    
    if (response.type === "REMOVE") {
      removeStockLocally(response.symbol);
    }
    
    if (response.type === "UPDATE") {
      if (!(response.symbol in stocks)) {
        stocks[response.symbol] = response.stockData;
        
        var title = $('<span>').text(response.symbol.toUpperCase());
        var button = $('<a>').attr({class: 'remove'}).html('&times;');
        var stock = $('<div>')
            .attr({
              id: response.symbol,
              class: 'col-sm-6 col-md-3'
            })
          .append(title)
          .append(button);
        $('#stocks-container').append(stock);
        
        updateStocks();
      }
    }
  }
  
  window.onbeforeunload = function() {
    console.log('Closing connection');
    ws.onclose = function () {}; // disable onclose handler first
    clearInterval(heartbeat);
    ws.close()
  };
  
  $("#addSymbol").on('click', function() {
    var call = {command: "ADD", data: $('#symbol').val()}
    ws.send(JSON.stringify(call));
    $('#symbol').val('');
  });
  
  $(document).on('click', '.remove', function() {
    var stockToRemove = $(this).parent().attr('id');
    var call = {command: "REMOVE", data: stockToRemove}
    ws.send(JSON.stringify(call));
    
    removeStockLocally(stockToRemove);
  });
  
})()