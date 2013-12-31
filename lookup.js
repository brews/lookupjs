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
    // var this.filters = new Array(this.filter_n);  // Not sure this really works.
    this.var_keys = [];  // String array giving variable keys in each dataset object.
    this.time_key = "";  // The key for the observation time in each dataset object.
}

Engine.prototype = {
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
    },

    initFilters: function() {
        // Initialize filters after a dataset has been set.
        // A three year filter is set using the max and min values of each series.
        var skeleton = {};
        for (i in this.var_keys) {
            var k = this.var_keys[i];
            var range_body = {"high": d3.max(this.dataset, function(d) { return d[k]; }),
                              "low":  d3.min(this.dataset, function(d) { return d[k]; })};
            eval("skeleton." + this.var_keys[i] + " = " + "range_body");
        }
        for (i in range(this.filter_n)) {
            var outgoing = Object.create(skeleton);
            outgoing.filterYear = parseInt(i);
            this.filters.push(outgoing);
        }
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
        console.log(filter_select);  // DEBUG
        var good_match = [];
        var i;
        for (i = 0; i < candidates.length; i += 1) {
            var good_so_far = true;
            for (j in this.var_keys) {
                // TODO 2013-12-30: I stopped here. We're getting `TypeError: Cannot read property 'low' of undefined` below.
                if ((this.dataset[candidates[i]][this.var_keys[j]] >= filter_select[this.var_keys[j]]["low"])
                 && (this.dataset[candidates[i]][this.var_keys[j]] <= filter_select[this.var_keys[j]]["high"])) {
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
            if (this.filters[i].filterYear === year) {
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
};

// var lookup = {
//  // TODO: Change this into a proper constructor function as in 
//  //       'Javascript Definitive' p202

//  dataset: {},

//  // An example of a filter array:
//  // [ {"filterYear": 0, 
//  //    "FourRivers": {"high": 0, "low": 0},
//  //    "LeesFerry":  {"high": 0, "low": 0},
//  //    "PNA":        {"high": 0, "low": 0}},
//  //    {"filterYear": 1, 
//  //    "FourRivers": {"high": 0, "low": 0},
//  //    "LeesFerry":  {"high": 0, "low": 0},
//  //    "PNA":        {"high": 0, "low": 0}}];
//  filters: [],

//  getFilterLength: function() {
//      // Return the number of years (length) of the filter.
//      // Note that this assumes this.initFilters() has already been run.
//      return this.filters.length;
//  },

//  setData: function(x) {
//      // Store a reference to the dataset that will be filtered.
//      this.dataset = x;
//      this.initFilters();
//  },

//  initFilters: function() {
//      // Initialize filters after a dataset has been set. 
//      // A three year filter is set using the max and min values of each series.
//      for (i in range(3)) {
//          this.filters.push({"filterYear": parseInt(i),
//                             "FourRivers": {"high": d3.max(lookup.dataset, function(d) { return d["FourRivers"]; }),
//                                            "low": d3.min(lookup.dataset, function(d) { return d["FourRivers"]; })},
//                             "LeesFerry":  {"high": d3.max(lookup.dataset, function(d) { return d["LeesFerry"]; }),
//                                            "low": d3.min(lookup.dataset, function(d) { return d["LeesFerry"]; })},
//                             "PNA":        {"high": d3.max(lookup.dataset, function(d) { return d["PNA"]; }),
//                                            "low": d3.min(lookup.dataset, function(d) { return d["PNA"]; })},
//                            }
//          );
//      }
//  },

//  getMatchArray: function() {
//      // Get an array with objects that give the target values after applying current filter.
//      // Note that this is not the year matched by the filters but the following year.
//      var matches = this.filter();
//      var out = [];
//      var i;
//      for (i = 0; i < this.dataset.length; i += 1) {
//          if (matches.indexOf(this.dataset[i].Year) !== -1) {
//              out.push(this.dataset[i]);
//          }
//      }
//      return out;
//  },

//  filter: function(filters, firstrun, candidates) {
//      // Filter the dataset based on this.filters. Returns an array of the 
//      // single years following the matched pattern.
//      firstrun =  typeof firstrun !== 'undefined' ? firstrun : true;
//      candidates =  typeof candidates !== 'undefined' ? candidates : [];
//      if (firstrun) {
//          filters = this.filters.slice(0); // Not sure if this will corrupt object attribute.
//          candidates = range(this.dataset.length - filters.length);
//      }
//      // console.log({"filters": filters, "candidates": candidates}); // DEBUG
//      if ((filters.length == 0) || (candidates.length == 0)) {
//          var final = [];
//          var i;
//          for (i = 0; i < candidates.length; i += 1) {
//              final.push(this.dataset[candidates[i]].Year);
//          }
//          return final;
//      }
//      var filter_select = filters.shift();
//      var good_match = [];
//      // console.log({"filters": filters, "candidates": candidates, "good_match": good_match}); // DEBUG
//      var i;
//      for (i = 0; i < candidates.length; i += 1) {
//          if ((this.dataset[candidates[i]].FourRivers >= filter_select.FourRivers.low)
//              && (this.dataset[candidates[i]].FourRivers <= filter_select.FourRivers.high)
//              && (this.dataset[candidates[i]].LeesFerry >= filter_select.LeesFerry.low)
//              && (this.dataset[candidates[i]].LeesFerry <= filter_select.LeesFerry.high)
//              && (this.dataset[candidates[i]].PNA >= filter_select.PNA.low)
//              && (this.dataset[candidates[i]].PNA <= filter_select.PNA.high)) {
//              good_match.push(parseInt(candidates[i]) + 1);
//          }
//      }
//      return this.filter(filters = filters, firstrun = false, candidates = good_match);
//  },

//  setHighFilter: function(x, series, year) {
//      // Set the high value of a filter given value `x`, the series key and the `filterYear`.

//      // TODO: Combine the logic of setHighFilter and setLowFilter into a 
//      // single function and add logic that ensures the high and low values 
//      // stay within the data's range and that `high` cannot be lower than 
//      // `low`, etc...
//      var i;
//      for (i = 0; i < this.filters.length; i += 1) {
//          if (this.filters[i].filterYear === year) {
//              this.filters[i][series].high = x;
//          }
//      }
//  },

//  setLowFilter: function(x, series, year) {
//      // Set the low value of a filter given value `x`, the series key and the `filterYear`.

//      // TODO: Combine the logic of setHighFilter and setLowFilter into a 
//      // single function and add logic that ensures the high and low values 
//      // stay within the data's range and that `high` cannot be lower than 
//      // `low`, etc...

//      var i;
//      for (i = 0; i < this.filters.length; i += 1) {
//          if (this.filters[i].filterYear === year) {
//              this.filters[i][series].low = x;
//          }
//      }
//  },
// };
