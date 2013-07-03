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

var lookup = {

	dataset: {},

	// An example of a filter array:
	// [ {"filterYear": 0, 
	//    "FourRivers": {"high": 0, "low": 0},
	//    "LeesFerry":  {"high": 0, "low": 0},
	//    "PNA":        {"high": 0, "low": 0}},
	//    {"filterYear": 1, 
	//    "FourRivers": {"high": 0, "low": 0},
	//    "LeesFerry":  {"high": 0, "low": 0},
	//    "PNA":        {"high": 0, "low": 0}}];
	filters: [],

	setData: function(x) {
		// Store a reference to the dataset that will be filtered.
		this.dataset = x;
		this.initFilters();
	},

	initFilters: function() {
		// Initialize filters after a dataset has been set. 
		// A three year filter is set using the max and min values of each series.
		for (i in range(3)) {
			this.filters.push({"filterYear": parseInt(i),
		                       "FourRivers": {"high": d3.max(lookup.dataset, function(d) { return d["FourRivers"]; }),
		                                      "low": d3.min(lookup.dataset, function(d) { return d["FourRivers"]; })},
		                       "LeesFerry":  {"high": d3.max(lookup.dataset, function(d) { return d["LeesFerry"]; }),
		                                      "low": d3.min(lookup.dataset, function(d) { return d["LeesFerry"]; })},
		                       "PNA":        {"high": d3.max(lookup.dataset, function(d) { return d["PNA"]; }),
		                                      "low": d3.min(lookup.dataset, function(d) { return d["PNA"]; })},
		                      }
		    );
		}
	},

	filter: function(filters, firstrun, candidates) {
		// Filter the dataset based on this.filters. Returns an array of matching years.
		firstrun =  typeof firstrun !== 'undefined' ? firstrun : true;
		candidates =  typeof candidates !== 'undefined' ? candidates : [];
		if (firstrun) {
			filters = this.filters.slice(0); // Not sure if this will corrupt object attribute.
			candidates = range(this.dataset.length - filters.length);
		}
		console.log({"filters": filters, "candidates": candidates}); // DEBUG
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
		console.log({"filters": filters, "candidates": candidates, "good_match": good_match}); // DEBUG
		var i;
		for (i = 0; i < candidates.length; i += 1) {
			if ((this.dataset[candidates[i]].FourRivers >= filter_select.FourRivers.low)
				&& (this.dataset[candidates[i]].FourRivers <= filter_select.FourRivers.high)
				&& (this.dataset[candidates[i]].LeesFerry >= filter_select.LeesFerry.low)
				&& (this.dataset[candidates[i]].LeesFerry <= filter_select.LeesFerry.high)
				&& (this.dataset[candidates[i]].PNA >= filter_select.PNA.low)
				&& (this.dataset[candidates[i]].PNA <= filter_select.PNA.high)) {
				good_match.push(parseInt(candidates[i]) + 1);
			}
		}
		return this.filter(filters = filters, firstrun = false, candidates = good_match);
	},
};
