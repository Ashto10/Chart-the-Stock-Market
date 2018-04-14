(function() {
  
  var stocks = {};
  
  var margin = {
    top: 15,
    right: 15,
    bottom: 25,
    left: 60
  }
  
  var chartWidth = 500 - margin.left - margin.right,
      chartHeight = 300 - margin.top - margin.bottom,
      closeMin = chartHeight,
      closeMax= 0;
  
  var ordinalScale = d3.scaleOrdinal()
  .range(d3.schemePaired);
  
  var yScale = d3.scaleLinear()
      .range([0,chartHeight]);
    
  var xScale = d3.scaleTime()
      .range([0,chartWidth])
      .clamp(true);
  
  var lineGenerator = d3.line()
      .x(function(d,i) {
        return xScale(new Date(d.date));
      })
      .y(function(d) {
        return yScale(d.close);
      });
  
  var format = d3.format(",.2f");
  
  var ws = new WebSocket('wss://legend-turret.glitch.me/');
  var heartbeat;
  
  function sendMessage(msg) {
    ws.send(JSON.stringify(msg));
  }
  
  function dateButton(el, span, start) {
    
    var label = el.append('label')
        .attr('class','btn btn-sm btn-secondary')
        .classed('active', start)
        .on('click', function (d) {
          changeMinDate(d, span);
        })
      
    label.append('input')
        .attr('type','radio')
        .attr('name','date')
        .attr('autocomplete', 'off')
        
    
    label.append('span')
        .text(span)
  }
  
  function createLocalCharts() {
    var chartContainer = d3.select('#individual-charts')
      .selectAll('.chart')
      .data(d3.keys(stocks), function (d) { return d });
    
    chartContainer.exit().remove();
        
    var chartContainerEnter = chartContainer.enter().insert('div', ".add-stock")
        .attr('class', 'offset-sm-1 col-sm-10 offset-md-0 col-md-6 col-lg-4')
      .append('div')
        .attr('class', 'chart')
        .attr('id', function(d) { return d });
    
    var headerEnter = chartContainerEnter
      .append('div')
        .attr('class', 'chart-header rounded-top')
    
    headerEnter.append('span')
        .attr('class','stock-symbol')
        .text(function(d) { return d });
   
    headerEnter.append('btn')
        .attr('class', 'remove-btn btn btn-danger btn-sm')
        .html('&times;')
        .on('click', function (d) {
          sendMessage({command: "REMOVE", stock: d})
        });
    
    headerEnter.append('div')
        .attr('class','date-controls btn-group btn-group-toggle')
        .attr('data-toggle', 'buttons')
        .call(dateButton, 'All')
        .call(dateButton, 'Year')
        .call(dateButton, 'Month', true)
        .call(dateButton, 'Week')
    
    var svgContainer = chartContainerEnter.append('div')
        .attr('class','svg-container');
    
    svgContainer.append('div')
        .attr('class','loading')
      .append('div')
        .attr('class', 'loading-icon');
      
    var svg = svgContainer.append('svg')
        .attr('preserveAspectRatio','xMinYMin meet')
        .attr('viewBox', "0 0 " + (chartWidth + margin.left + margin.right) + " " + (chartHeight + margin.top + margin.bottom))
      .append('g')
        .attr('class', 'chart-contents')
        .attr('transform', 'translate('+ margin.left +','+ margin.top +')')
    
    svg.append('g')
        .attr('class', 'grid x-grid')
        .attr("transform", "translate("+ chartWidth +", 0)")
    
    svg.append('g')
        .attr('class', 'grid y-grid')
        .attr("transform", "translate(0," + chartHeight + ")")
    
    svg.append('path')
        .attr('class', 'line')
    
    svg.append('g')
        .attr('class', 'axis x-axis')
    
    svg.append('g')
        .attr('class', 'axis y-axis')
  }
  
  function updateLocalChart(stock) {
    
    var localData = stocks[stock].weeklyData.filter(function (d) {
        return moment(d.date).isAfter(stocks[stock].dateView);
    });
    
    xScale.domain([stocks[stock].dateView, new Date()])
    yScale.domain([d3.max(localData.map(function(d) {return d.close})) * 1.3,d3.min(localData.map(function(d) {return d.close})) * 0.7]);
    
    var chart = d3.select('#' + stock);
    chart.select('.loading').remove();
    
    var chartContents = chart.select('.chart-contents');
    
    chartContents.select('.line')
        .attr('d', function(d) {
            if (stocks[d].weeklyData !== undefined) {
              return lineGenerator(localData);
            }
          })
        .attr('stroke', function (d) { return ordinalScale(d) })
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('class', 'line');
    
    chartContents.select(".x-grid")
      .call(d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(chartWidth)
          .tickFormat("")
      )
    
    chartContents.select(".y-grid")
      .call(d3.axisBottom(xScale)
          .ticks(6)
          .tickSize(-chartHeight)
          .tickFormat("")
      )
      
    chartContents.select('.x-axis')
        .attr("transform", "translate(0," + chartHeight + ")")
        .call(d3.axisBottom(xScale).ticks(6));
    
    chartContents.select('.y-axis')
        .attr("transform", "translate(" + 0 + ",0)")
        .call(d3.axisLeft(yScale)
          .tickFormat(function (d) {
            return "$" + format(d);
          })
          .ticks(6)
        );
  }
  
  function changeMinDate(stock, span) {
    if(stocks[stock] === '') { return; }
    
    if (span === 'All') {
      var s = stocks[stock].weeklyData;
      stocks[stock].dateView = new Date(s[s.length - 1].date);
    } else {
      stocks[stock].dateView = moment().subtract(1, span);
    }
    
    updateLocalChart(stock)
  }

  ws.onopen = function () {    
    sendMessage({command: 'STARTUP'});
    
    heartbeat = setInterval(function() {
      sendMessage({command: 'PING'});
    }, 10000);

  }
  
  function removeLocalChart(stock) {
    var d = d3.select('#' + stock).select(function () { return this.parentNode} ).remove()
  }

  ws.onmessage = function (ev) {
    var res = JSON.parse(ev.data);
    var command = res.command;
    
    if (command === "ADD") {
      if (!(res.stock in stocks)) {
        stocks[res.stock] = '';
        createLocalCharts();
      }
    }
    
    if (command === "UPDATE") {
      if (res.stock in stocks) {
        stocks[res.stock] = res.data;
        changeMinDate(res.stock, 'month');
      }
    }
    
    if (command === "REMOVE") {
      if (res.stock in stocks) {
        delete stocks[res.stock];
        removeLocalChart(res.stock);
      }
    }
  }
  
  window.onbeforeunload = function() {
    ws.onclose = function () {}; // disable onclose handler first
    clearInterval(heartbeat);
    ws.close()
  };
  
  $("#addSymbol").on('click', function() {
    let stock = $('#input-stock').val();
     $('#input-stock').val('')
    sendMessage({command: "ADD", stock: stock});
  });
  
})()