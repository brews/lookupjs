// Guts of lookup. Assumes d3 is available.

function range(start, stop, step) {
    if (typeof stop == 'undefined'){
        // one param defined
        stop = start;
        start = 0;
    };
    if (typeof step == 'undefined'){
        step = 1;
    };
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)){
        return [];
    };
    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step){
        result.push(i);
    };
    return result;
};

function Engine(n) {
    // n is the length or number of filters (in time) that we will have.
    this.filter_n = n;
    this.dataset = {};
    // An example of a filter array:
    // [ {"filterYear": 0, 
    //    "FourRivers": {"high": 0, "low": 0},
    //    "LeesFerry":  {"high": 0, "low": 0},
    //    "PNA":        {"high": 0, "low": 0}},
    //    {"filterYear": 1, 
    //    "FourRivers": {"high": 0, "low": 0},
    //    "LeesFerry":  {"high": 0, "low": 0},
    //    "PNA":        {"high": 0, "low": 0}}];
    this.filters = [];
    this.var_keys = [];  // String array giving variable keys in each dataset object.
    this.time_key = "";  // The key for the observation time in each dataset object.
    this.plotId = {};
    this.seriesPlotDimensions = {
        "margin": {"top": 0,
                   "right": 0,
                   "bottom": 0,
                   "left": 0},
        "padding": 0,
        "width": 0,
        "height": 0,
    };
    this.filterPlotDimensions = {
        "margin": {"top": 0,
                   "right": 0,
                   "bottom": 0,
                   "left": 0},
        "padding": 0,
        "width": 0,
        "height": 0,
    };
    this.histPlotDimensions = {
        "margin": {"top": 0,
                   "right": 0,
                   "bottom": 0,
                   "left": 0},
        "padding": 0,
        "width": 0,
        "height": 0,
    };
    this.histPlotXScale = d3.scale.linear();
    this.histPlotXAxis = d3.svg.axis();
    this.filterPlotXScale = d3.scale.ordinal();
    this.filterPlotXAxis = d3.svg.axis();
    this.seriesPlotXScale = d3.scale.linear();
    this.seriesPlotXAxis = d3.svg.axis();
    this.seriesPlotYScales = {};
    this.seriesPlotYAxis = {};
    this.seriesPlotTicks = 5;
    this.seriesPlotDimensions.circleRadius = 4;
    this.zoomExtent = [1, 8];
    this.previousScale = 1;
    this.drag = d3.behavior.drag()
        .on("drag", dragger);
    this.zoom = d3.behavior.zoom()
        .x(this.seriesPlotXScale)  // Note: Needs to be re-set everytime we change this xscale.
        .scaleExtent(this.zoomExtent)
        .on("zoom", zoomer);
}

Engine.prototype = {
    setSeriesPlotMargin: function(x) {
        // Pass in an object with keys "top", "right", "bottom", "left", to integers.
        this.seriesPlotDimensions.margin = x;
    },

    setFilterPlotMargin: function(x) {
        // Pass in an object with keys "top", "right", "bottom", "left", to integers.
        this.filterPlotDimensions.margin = x;
    },

    setHistPlotMargin: function(x) {
        // Pass in an object with keys "top", "right", "bottom", "left", to integers.
        this.histPlotDimensions.margin = x;
    },

    setSeriesPlotPadding: function(x) {
        this.seriesPlotDimensions.padding = x;
    },

    setFilterPlotPadding: function(x) {
        this.filterPlotDimensions.padding = x;
    },

    setHistPlotPadding: function(x) {
        this.histPlotDimensions.padding = x;
    },

    setData: function(x, timekey) {
        // Store a reference to the dataset that will be filtered.
        //
        // Args:
        //     x - An array with each member being an object whos keys 1) 
        //          include one time variable, noting the time of variable 
        //          observation; 2) label each observed variable.
        //     timekey - A string noting the key which indicates the time of 
        //          observation for the objects in array `x`.
        var all_keys = Object.keys(x[0]);
        var variable_keys = [];
        for (i in all_keys) {
            if (all_keys[i] == timekey) {
                continue;
            } else {
                variable_keys.push(all_keys[i]);
            }
        }
        this.time_key = timekey;
        this.var_keys = variable_keys;
        this.dataset = x;
        this.initFilters();
        this.initScales();
        this.initAxis();
    },

    highlight: function(x) {
        // To highlight obs in an array of years, d, in timeline-chart.
        var k_time = this.time_key;
        d3.selectAll(".lineplotcircle.highlight").attr("class", "lineplot lineplotcircle");
        d3.selectAll(".lineplotcircle").filter(function(d) { return x.indexOf(d[k_time]) === -1 ? null : true; })
            .transition()
            .attr("class", "lineplot lineplotcircle highlight");
    },

    drawPlots: function() {
        this.drawSeriesPlot();
        this.drawFilterPlot();
        this.drawHistPlot();
    },

    drawSeriesPlot: function() {
        this.seriesPlotLines = {};
        var h = this.seriesPlotDimensions.height / this.var_keys.length - this.seriesPlotDimensions.padding;
        this.seriesPlotSvg = d3.select(this.plotId.seriesPlot).append("svg")
            .attr("width", this.seriesPlotDimensions.width + this.seriesPlotDimensions.margin.left + this.seriesPlotDimensions.margin.right)
            .attr("height", this.seriesPlotDimensions.height + this.seriesPlotDimensions.margin.top + this.seriesPlotDimensions.margin.bottom);
        this.seriesPlotSvg.append("g")
            .attr("id", "timelineplotspace")
            .attr("transform", "translate(" + this.seriesPlotDimensions.margin.left + "," + this.seriesPlotDimensions.margin.top + ")")
            .append("clipPath")
            .attr("id", "timeline-clip")
            .append("rect")
            .attr("cy", 0)
            .attr("cx", 0)
            .attr("height", this.seriesPlotDimensions.height)
            .attr("width", this.seriesPlotDimensions.width);
        var halfPadding = this.seriesPlotDimensions.padding / 2;
        var blockHeight = this.seriesPlotDimensions.height / this.var_keys.length;
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            var k_time = this.time_key;
            var kScale = this.seriesPlotYScales[k];
            var xScale = this.seriesPlotXScale;
            this.seriesPlotLines[k] = d3.svg.line()
                .defined(function(d) { return d[k] != null; })  // Avoid `null` values.
                .x(function(d) { return xScale(d[k_time]); })
                .y(function(d) { return kScale(d[k]); });
            this.seriesPlotSvg.select("#timelineplotspace").append("g")
                .attr("class", "series " + k)
                .attr("transform", "translate(0, " + ((blockHeight * i) + halfPadding) + ")")
                .append("g")
                .attr("class", "series chart")
                .append("rect")
                .attr("cy", 0)
                .attr("cx", 0)
                .attr("height", h)
                .attr("width", this.seriesPlotDimensions.width)
                .attr("class", "series chart background");
            this.seriesPlotSvg.select(".series." + k).select(".chart")
                .append("path")
                .attr("class", "lineplot lineplotpath " + k)
                .attr("d", this.seriesPlotLines[k](this.dataset));
            this.seriesPlotSvg.select(".series." + k).select(".chart").selectAll("circle")
                .data(dataset.filter(function(d) { return d[k] }))  // Avoid `null` values.
                .enter()
                .append("circle")
                .attr("class", "lineplot lineplotcircle " + k)
                .attr("cy", function(d) { return kScale(d[k]); })
                .attr("cx", function(d) { return xScale(d[k_time]); })
                .attr("r", this.seriesPlotDimensions.circleRadius)
                .append("title")
                .text(function(d) { return d[k] + " (" + d[k_time] + ")"; });
            this.seriesPlotSvg.select(".series." + k).append("g")
                .attr("class", "axis y")
                .call(this.seriesPlotYAxis[k]);
            this.seriesPlotSvg.append("text")
                .attr("class", "axis y label")
                .style("text-anchor", "middle")
                .attr("transform", "translate(" + (this.seriesPlotDimensions.margin.left/2) + "," + (((blockHeight * i) + (halfPadding * i)) + (blockHeight/2)) + ")rotate(-90)")
                .text(k);
        }
        this.seriesPlotSvg.select("#timelineplotspace").append("g")
            .attr("class", "axis x")
            .attr("transform", "translate(0, " + this.seriesPlotDimensions.height + ")")
            .call(this.seriesPlotXAxis);
        this.seriesPlotSvg.selectAll(".series.chart")
            .attr("clip-path", "url(#timeline-clip)")
            .call(this.zoom);
    },

    drawFilterPlot: function() {
        var h = this.filterPlotDimensions.height / this.var_keys.length - this.filterPlotDimensions.padding;
        this.filterPlotSvg = d3.select(this.plotId.filterPlot).append("svg")
            .attr("width", this.filterPlotDimensions.width + this.filterPlotDimensions.margin.left + this.filterPlotDimensions.margin.right)
            .attr("height", this.filterPlotDimensions.height + this.filterPlotDimensions.margin.top + this.filterPlotDimensions.margin.bottom);
        this.filterPlotSvg.append("g")
            .attr("id", "filterplotspace")
            .attr("transform", "translate(" + this.filterPlotDimensions.margin.left + ", " + this.filterPlotDimensions.margin.top + ")")
            .append("clipPath")
            .attr("id", "filter-clip")
            .append("rect")
            .attr("cy", 0)
            .attr("cx", 0)
            .attr("height", this.filterPlotDimensions.height)
            .attr("width", this.filterPlotDimensions.width);
        var halfPadding = this.filterPlotDimensions.padding / 2;
        var blockHeight = this.filterPlotDimensions.height / this.var_keys.length;
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            var k_time = "filterYear";
            var kScale = this.seriesPlotYScales[k];
            var xScale = this.filterPlotXScale;
            this.filterPlotSvg.select("#filterplotspace").append("g")
                .attr("class", "series " + k)
                .attr("transform", "translate(0, " + ((blockHeight * i) + halfPadding) + ")")
                .append("g")
                .attr("class", "chart filter")
                .append("rect")
                .attr("cy", 0)
                .attr("cx", 0)
                .attr("height", h)
                .attr("width", this.filterPlotDimensions.width)
                .attr("class", "filter chart background");
            this.filterPlotSvg.select(".series." + k).select(".chart").selectAll("line")
                .data(this.filters)
                .enter()
                .append("line")
                .attr("class", function(d) { return "filter filterplotline " + k + " fy" + d[k_time]; })
                .attr("y1", function(d) { return kScale(d[k].low); })
                .attr("x2", function(d) { return xScale(d[k_time]); })
                .attr("y2", function(d) { return kScale(d[k].high); })
                .attr("x1", function(d) { return xScale(d[k_time]); });
            this.filterPlotSvg.select(".series." + k).select(".chart").selectAll("circle.high")
                .data(this.filters)
                .enter()
                .append("circle")
                .attr("class", "filter filterplotcircle high " + k)
                .attr("cy", function(d) { return kScale(d[k].high); })
                .attr("cx", function(d) { return xScale(d[k_time]); })
                .attr("r", this.seriesPlotDimensions.circleRadius)
                .append("title")
                .text(function(d) { return d[k].high + " (" + d["filterYear"] + ")"; });
            this.filterPlotSvg.select(".series." + k).select(".chart").selectAll("circle.low")
                .data(this.filters)
                .enter()
                .append("circle")
                .attr("class", "filter filterplotcircle low " + k)
                .attr("cy", function(d) { return kScale(d[k].low); })
                .attr("cx", function(d) { return xScale(d[k_time]); })
                .attr("r", this.seriesPlotDimensions.circleRadius)
                .append("title")
                .text(function(d) { return d[k].low + " (" + d[k_time] + ")"; });
            this.filterPlotSvg.select(".series." + k).append("g")
                .attr("class", "axis y")
                .call(this.seriesPlotYAxis[k]);
            this.filterPlotSvg.append("text")
                .attr("class", "axis y label")
                .style("text-anchor", "middle")
                .attr("transform", "translate(" + (this.seriesPlotDimensions.margin.left/2) + "," + (((blockHeight * i) + (halfPadding * i)) + (blockHeight/2)) + ")rotate(-90)")
                .text(k);
        }
        this.filterPlotSvg.select("#filterplotspace").append("g")
            .attr("class", "axis x")
            .attr("transform", "translate(0, " + this.filterPlotDimensions.height + ")")
            .call(this.filterPlotXAxis);
        this.filterPlotSvg.selectAll(".filterplotcircle")
            .call(this.drag);
        this.filterPlotSvg.selectAll(".filter.chart")
            .attr("clip-path", "url(#filter-clip)");
    },

    drawHistPlot: function() {
        //
        var h = this.histPlotDimensions.height / this.var_keys.length - this.histPlotDimensions.padding;
        this.initHistPlotBins();
        this.histPlotSvg = d3.select(this.plotId.histPlot).append("svg")
            .attr("width", this.histPlotDimensions.width + this.histPlotDimensions.margin.left + this.histPlotDimensions.margin.right)
            .attr("height", this.histPlotDimensions.height + this.histPlotDimensions.margin.top + this.histPlotDimensions.margin.bottom);
        this.histPlotSvg.append("g")
            .attr("id", "yearhistplotspace")
            .attr("transform", "translate(" + this.histPlotDimensions.margin.left + ", " + this.histPlotDimensions.margin.top + ")")
            .append("clipPath")
            .attr("id", "yearhist-clip")
            .append("rect")
            .attr("cy", 0)
            .attr("cx", 0)
            .attr("height", this.histPlotDimensions.height)
            .attr("width", this.histPlotDimensions.width);
        var halfPadding = this.histPlotDimensions.padding / 2;
        var blockHeight = this.histPlotDimensions.height / this.var_keys.length;
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            var kScale = this.seriesPlotYScales[k];
            var xScale = this.histPlotXScale;
            this.histPlotSvg.select("#yearhistplotspace").append("g")
                .attr("class", "series " + k)
                .attr("transform", "translate(0, " + ((blockHeight * i) + halfPadding) + ")")
                .append("g")
                .attr("class", "chart yearhist")
                .append("rect")
                .attr("cy", 0)
                .attr("cx", 0)
                .attr("height", h)
                .attr("width", this.histPlotDimensions.width)
                .attr("class", "yearhist chart background");
            this.histPlotSvg.select(".series." + k).select(".chart").selectAll(".bar")
                .data(this.histPlotBins[k])
                .enter()
                .append("rect")
                .attr("class", "yearhist yearhistplotrect " + k)
                .attr("y", function(d) { return kScale(d.x + d.dx); })
                .attr("x", 0)
                .attr("height", function(d) { return kScale(d.x) - kScale(d.dx + d.x); })
                .attr("width", 0)
                .append("title")
                .text(function(d) { return d.y + " events (" + d.x + " - " + (d.x + d.dx) + ")"; });
            this.histPlotSvg.select(".series." + k).append("g")
                .attr("class", "axis y")
                .call(this.seriesPlotYAxis[k]);
            this.histPlotSvg.append("text")
                .attr("class", "axis y label")
                .style("text-anchor", "middle")
                .attr("transform", "translate(" + (this.seriesPlotDimensions.margin.left/2) + "," + (((blockHeight * i) + (halfPadding * i)) + (blockHeight/2)) + ")rotate(-90)")
                .text(k);
        }
        this.histPlotSvg.select("#yearhistplotspace").append("g")
            .attr("class", "axis x")
            .attr("transform", "translate(0, " + this.histPlotDimensions.height + ")")
            .call(this.histPlotXAxis);
        this.histPlotSvg.selectAll(".yearhist.chart")
            .attr("clip-path", "url(#yearhist-clip)");
    },
    
    initHistPlotBins: function(m) {
        // Refresh the single year histogram given `m`, an array, like 
        //`this.dataset`, which has an object for each target
        // -not matched- year.
        m =  typeof m !== 'undefined' ? m : this.dataset;
        this.histPlotBins = {};
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            this.histPlotBins[k] = d3.layout.histogram()
                .bins(this.seriesPlotYScales[k].ticks(this.seriesPlotTicks))
                (m.map(function(d) {return d[k]; }));
        }
    },

    refreshHistPlotBins: function(m) {
        // Refresh the single year histogram bins given `m`, an array, like 
        //`this.dataset`, which has an object for each target
        // -not matched- year. This also resets the histPlot scales and axis.
        this.initHistPlotBins(m);
        var maxNo = d3.max(this.histPlotBins[this.var_keys[0]].map(function(d) { return d.y; }));
        for (i in this.var_keys) {
            var currentVictim = d3.max(this.histPlotBins[this.var_keys[i]].map(function(d) { return d.y; }));
            if (currentVictim > maxNo) {
                maxNo = currentVictim;
            }
        }
        this.histPlotXScale.domain([0, maxNo]);
        this.histPlotXAxis.scale(this.histPlotXScale);
        this.histPlotSvg.select("#yearhistplotspace").selectAll(".axis.x").call(this.histPlotXAxis);
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            var kScale = this.seriesPlotYScales[k];
            var xScale = this.histPlotXScale;
            this.histPlotSvg.selectAll(".yearhistplotrect." + k)
                .data(this.histPlotBins[k])
                .transition()
                .duration(200)
                .attr("width", function(d) { return xScale(d.y); })
                .select("title")
                .text(function(d) { return d.y + " events (" + d.x + " - " + (d.x + d.dx) + ")"; });
        }
    },

    refilter: function() {
        // Rerun the lookup filter engine and refresh plots as needed.
        var matched = this.getMatchArray();
        this.highlight(matched.map(function(d) { return d.Year; }));
        this.refreshHistPlotBins(matched);
    },

    // zoomer: function(d) {
        // Called when zoom events are triggered. Transitions if zoom, not if panned.
    // },

    // dragger: function(d) {
        // Called whenever drag events are fired. Intended to work on filterSvg circles.
    // },

    initFilters: function() {
        // Initialize filters after a dataset has been set.
        // A three year filter is set using the max and min values of each series.
        for (var i in range(this.filter_n)) {
            var skeleton = {};
            for (var j in this.var_keys) {
                var k = this.var_keys[j];
                skeleton[k] = {"high": d3.max(this.dataset, function(d) { return d[k]; }),
                               "low": d3.min(this.dataset, function(d) { return d[k]; })};
            }
            skeleton["filterYear"] = parseInt(i);
            this.filters.push(skeleton);
        }
    },

    initAxis: function() {
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            this.seriesPlotYAxis[k] = d3.svg.axis();
            this.seriesPlotYAxis[k].scale(this.seriesPlotYScales[k])
                .orient("left")
                .ticks(this.seriesPlotTicks)
                .tickFormat(d3.format("d"));
        }
        this.seriesPlotXAxis = d3.svg.axis();
        this.seriesPlotXAxis.scale(this.seriesPlotXScale)
            .orient("bottom")
            .tickFormat(d3.format("d"));

        this.filterPlotXAxis = d3.svg.axis();
        this.filterPlotXAxis.scale(this.filterPlotXScale)
            .ticks(this.filter_n)
            .orient("bottom")
            .tickFormat(d3.format("d"));

        this.histPlotXAxis = d3.svg.axis();
        this.histPlotXAxis.scale(this.histPlotXScale)
            .orient("bottom")
            .tickFormat(d3.format("d"));
    },

    initScales: function() {
        var h = this.seriesPlotDimensions.height / this.var_keys.length - this.seriesPlotDimensions.padding;
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            this.seriesPlotYScales[k] = d3.scale.linear();
            this.seriesPlotYScales[k].domain([d3.min(this.dataset, function(d) { return d[k]; }),
                                              d3.max(this.dataset, function(d) { return d[k]; })])
                .range([h, 0])
                .nice(this.seriesPlotTicks);
        }
        this.seriesPlotXScale = d3.scale.linear();
        var k_time = this.time_key;
        this.seriesPlotXScale.domain([d3.min(this.dataset, function(d) { return d[k_time]; }),
                                      d3.max(this.dataset, function(d) { return d[k_time]; })])
            .range([0, this.seriesPlotDimensions.width]);
        this.zoom.x(this.seriesPlotXScale);

        this.filterPlotXScale = d3.scale.ordinal();
        this.filterPlotXScale.domain(range(this.filter_n))
            .rangePoints([0, this.filterPlotDimensions.width], 1.0);  // This last numer is for the scale padding.

        this.histPlotXScale = d3.scale.linear();
        this.histPlotXScale.domain([0, this.dataset.length])
            .range([0, this.histPlotDimensions.width])
            .nice();
    },

    getFilterLength: function() {
        // Return the number of years (length) of the filter.
        // Note that this assumes this.initFilters() has already been run.
        return this.filters.length;
    },

    getMatchArray: function() {
        // Get an array with objects that give the target values after applying current filter.
        // Note that this is not the year matched by the filters but the following year.
        var matches = this.filter();
        var out = [];
        var i;
        for (i = 0; i < this.dataset.length; i += 1) {
            if (matches.indexOf(this.dataset[i].Year) !== -1) {
                out.push(this.dataset[i]);
            }
        }
        return out;
    },

    filter: function(filters, firstrun, candidates) {
        // Filter the dataset based on this.filters. Returns an array of the 
        // single years following the matched pattern.
        firstrun =  typeof firstrun !== 'undefined' ? firstrun : true;
        candidates =  typeof candidates !== 'undefined' ? candidates : [];
        if (firstrun) {
            filters = this.filters.slice(0); // Not sure if this will corrupt object attribute.
            candidates = range(this.dataset.length - filters.length);
        }
        if ((filters.length == 0) || (candidates.length == 0)) {
            var final = [];
            var i;
            for (i = 0; i < candidates.length; i += 1) {
                final.push(this.dataset[candidates[i]].Year);
            }
            return final;
        }
        var filter_select = filters.shift();
        var good_match = [];
        var i;
        for (i = 0; i < candidates.length; i += 1) {
            var good_so_far = true;
            for (j in this.var_keys) {
                if (!this.dataset[candidates[i]][this.var_keys[j]] || ((this.dataset[candidates[i]][this.var_keys[j]] >= filter_select[this.var_keys[j]]["low"])
                 && (this.dataset[candidates[i]][this.var_keys[j]] <= filter_select[this.var_keys[j]]["high"]))) {
                    continue;
                } else {
                    good_so_far = false;
                    break;
                }
            }
            if (good_so_far) {
                good_match.push(parseInt(candidates[i]) + 1);
            }
        }
        return this.filter(filters = filters, firstrun = false, candidates = good_match);
    },

    setHighFilter: function(x, series, year) {
        // Set the high value of a filter given value `x`, the series key and the `filterYear`.

        // TODO: Combine the logic of setHighFilter and setLowFilter into a 
        // single function and add logic that ensures the high and low values 
        // stay within the data's range and that `high` cannot be lower than 
        // `low`, etc...
        var i;
        for (i = 0; i < this.filters.length; i += 1) {
            if (this.filters[i].filterYear == year) {
                this.filters[i][series].high = x;
            }
        }
    },

    setLowFilter: function(x, series, year) {
        // Set the low value of a filter given value `x`, the series key and the `filterYear`.

        // TODO: Combine the logic of setHighFilter and setLowFilter into a 
        // single function and add logic that ensures the high and low values 
        // stay within the data's range and that `high` cannot be lower than 
        // `low`, etc...

        var i;
        for (i = 0; i < this.filters.length; i += 1) {
            if (this.filters[i].filterYear === year) {
                this.filters[i][series].low = x;
            }
        }
    },

    setSeriesPlotId: function(x) {
        // Set the unique identifier used in the page's HTML which the seriesplot SVG will be attached to.
        this.plotId.seriesPlot = x;
    },

    setSeriesPlotHeight: function(x) {
        this.seriesPlotDimensions.height = x - this.seriesPlotDimensions.margin.top - this.seriesPlotDimensions.margin.bottom;
    },

    setSeriesPlotWidth: function(x) {
        this.seriesPlotDimensions.width = x - this.seriesPlotDimensions.margin.left - this.seriesPlotDimensions.margin.right;
    },

    setSeriesPlotTicks: function(x) {
        this.seriesPlotTicks = x;
    },

    setFilterPlotId: function(x) {
        // Set the unique identifier used in the page's HTML which the seriesplot SVG will be attached to.
        this.plotId.filterPlot = x;
    },

    setFilterPlotHeight: function(x) {
        this.filterPlotDimensions.height = x - this.filterPlotDimensions.margin.top - this.filterPlotDimensions.margin.bottom;
    },

    setFilterPlotWidth: function(x) {
        this.filterPlotDimensions.width = x - this.filterPlotDimensions.margin.left - this.filterPlotDimensions.margin.right;
    },

    setFilterPlotTicks: function(x) {
        this.filterPlotTicks = x;
    },

    setHistPlotId: function(x) {
        // Set the unique identifier used in the page's HTML which the histplot SVG will be attached to.
        this.plotId.histPlot = x;
    },

    setHistPlotHeight: function(x) {
        this.histPlotDimensions.height = x - this.histPlotDimensions.margin.top - this.histPlotDimensions.margin.bottom;
    },

    setHistPlotWidth: function(x) {
        this.histPlotDimensions.width = x - this.histPlotDimensions.margin.left - this.histPlotDimensions.margin.right;
    },

    setHistPlotTicks: function(x) {
        this.histPlotTicks = x;
    },
};