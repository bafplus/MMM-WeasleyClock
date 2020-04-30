/* global Module */

/* Magic Mirror
 * Module: MMM-WeasleyClock
 *
 * By Brian Hepler
 * MIT Licensed.
 */

Module.register("MMM-WeasleyClock", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000,
		uniqueId: "default",
		debug: false,
		locations: ["Home","School","Work","Mortal Peril","Jail","Food","Traveling"],
		people: ["Brian","Deverina","Dementor"],
		host: "weasleymirror.duckdns.org",
		port: 8883,
		uniqueId: "notunique",
		clockStyle: "table",
	},

	colorCycle: ["blue","green","yellow","purple","red","white","gray"],
	requiresVersion: "2.1.0", // Required version of MagicMirror

	getScripts: function() {
		return [
			"svg.js"
		];
	},

	start: function() {
		Log.info("Starting module: " + this.name);
		//Flag for check if module is loaded
		this.loaded = false;
		var people = this.config.people;

		this.locationSet = new Set(this.config.locations);
		this.locationMap = new Map();

		// Make sure mandatory locations are present
		this.config.locations = this.uniqueArray(this.config.locations);
		if (this.config.locations.indexOf("Lost") === -1) { this.config.locations.push("Lost"); }
		if (this.config.locations.indexOf("Traveling") === -1) { this.config.locations.push("Traveling"); }

		// Set people to default location
		for (n=0; n<people.length; n++) {
			console.log("Processing person: " + people[n]);
			this.locationMap.set(people[n], "Lost");
		}

		// send config to node helper
		this.sendSocketNotification("MMM-WeasleyClock-CONFIG", this.config);
	},

	getDom: function() {

		var wrapper = document.createElement("div");
		wrapper.id = "weasleyClockID";
		wrapper.className = "weasleyClock";

		var people = this.config.people;
		var locations = this.config.locations;
		const numPoints = locations.length;
		const numPeople = people.length;

		if (this.config.clockStyle == "table") {

			var locTable = document.createElement("table");
			locTable.className = "table";

			var thr = document.createElement("tr");
			var thp = document.createElement("th");
			var thl = document.createElement("th");
			thp.innerHTML = "<u>Who</u>";
			thl.innerHTML = "<u>Where</u>";
			thr.appendChild(thp);
			thr.appendChild(thl);
			locTable.appendChild(thr);

			for (i=0; i<people.length; i++) {
				var tr = document.createElement("tr");
				var personTd = document.createElement("td");
				var personLocationTd = document.createElement("td");

				personTd.innerHTML = people[i];
				personTd.id = "perLbl-" + people[i];
				personTd.className = "person";

				var loc = this.locationMap.get(people[i]);
				if (loc != null) { personLocationTd.innerHTML = loc; }
				else { personLocationTd.innerHTML = "Lost"; }
				personLocationTd.id = "perLoc-" + people[i];
				personLocationTd.className = "location";

				tr.appendChild(personTd);
				tr.appendChild(personLocationTd);
				locTable.appendChild(tr);
			}
			wrapper.appendChild(locTable);

		} else if (this.config.clockStyle == "clock") {
			// build the clock
			var draw = SVG(wrapper).size("100%","100%");
			draw.viewbox(-100, -100, 200, 200);

			// draw the center hub
			var point = draw.circle("2%").fill("grey").stroke("1").cy(0).cx(0);
			const radLength = 65;

			for (i=0; i<numPoints; i++) {
				console.log("Placing " + locations[i]);
				const plier = 2 * Math.PI / numPoints * i;
				console.log("Multiplier around circle: " + plier);

				var cordx = Math.cos(plier) * radLength;
				var cordy = Math.sin(plier) * radLength;
				console.log("Coordinates: " + cordx + "," + cordy);
				var spot = draw.circle("1%").fill("blue").stroke("1").cx(cordx).cy(cordy);

				var locText = draw.text(locations[i]).x(cordx).y(cordy).fill("white");
				locText.attr("id","loc" + locations[i]);
				locText.font({
					anchor: "middle",
					size: "small",
					family: "satisfy, blackjack, cursive"
				});
			}

			// create hands for people
			for (j=0; j < numPeople; j++) {
				var hand = this.createHand(draw, people[j]);
				hand.attr("fill",this.colorCycle[j]);

				// testing rotation
				hand.rotate((360 / numPoints * j),0,0);
				console.log("Added person " + people[j]);
			}
		}
		return wrapper;
	},

	getStyles: function () {
		return [
			"MMM-WeasleyClock.css",
		];
	},

	/**
	 * Update a person to traveling status
	 * @param {String} name The name of one member of the person array
	 * @param {Object} data The Owntracks message for evaluation
	 */
	processTraveling: function(name, data) {
		if (this.locationMap.get(name) != null) {
			console.log(name + " is traveling.");
			this.locationMap.set(name,"Traveling");
			this.updateDom();
		} else if (this.config.debug) {
			console.log(name + " is not one of us. Goodbye.");
		}

	},

	/**
	 * Update a person to LOST status.
	 * @param {*} name Name of the tracked person
	 */
	processLost: function(name) {
		if (this.locationMap.get(name) != null) {
			if (this.config.debug) { console.log(name + " is now lost. :("); }
			this.locationMap.set(name,"Lost");
			this.updateDom();
		} else if (this.config.debug) {
			console.log(name + " is not one of us. Shun the unbeliever!");
		}
	},

	/**
	 * Processes the messages that Owntracks sends when a user enters or leaves a
	 * defined region. Can't guarantee that these happen every time.
	 * Note: You can be in multiple regions. We're only evaluating the first one.
	 * @param {String} name Name of the person entering/leaving
	 * @param {Object} data Message traffic
	 */
	processUpdate: function(name, data) {
		if (this.config.debug) {
			console.log("Processing location update for '" + name + "'");
			console.log("Regions: " + data.inregions);
		}
		var loc = data.inregions[0];

		if (this.locationSet.has(loc)) {
			if (this.config.debug) { console.log("Found! Updating location map."); }
			this.locationMap.set(name,loc);
			this.updateDom();
		} else if (this.config.debug) {
			console.log("Location '" + loc + "' not found.");
		}
	},

	/**
	 * Process notifications from the back end.
	 * @param {String} notification Type of notification. Root: MMM-WeasleyClock-[type]
	 * Valid types are: WAYPOINT, LOST, TRAVELING, UPDATE
	 * @param {Object} payload The location & person information received from the MQTT server.
	 * @override
	 */
	socketNotificationReceived: function (notification, payload) {
		if (this.config.debug) {
			console.log("Received notification '" + notification + "' from Weasley helper.");
		}
		this.loaded = true;
		this.mqttVal = payload;

		if(notification === "MMM-WeasleyClock-TRAVELING") {
			this.processTraveling(payload.person);
		}

		if(notification === "MMM-WeasleyClock-LOST") {
			this.processLost(payload.person);
		}

		if(notification === "MMM-WeasleyClock-UPDATE") {
			this.processUpdate(payload.person, payload);
		}

		if (notification === "MMM-WeasleyClock-WAYPOINT") {
			this.processNewLocation(payload);
		}
		// this.updateDom();
	},

	roundValue: function(value) {
		if (this.config.roundValue) {
		  value = parseFloat(value).toFixed(this.config.decimals);
		}
		return value;
	  },

	createHand: function(svg, name) {
		var pplHand = svg.text(name + " ->").x(7).y(-5);
		pplHand.attr("id","hand" + name);
		pplHand.font({
			family: "calligraphica, satisfy, cursive",
			anchor: "left",
			size: "x-small"
		});
		return pplHand;
	},

	uniqueArray: function(array) {
		var uniqueArray = [];

		// Loop through array values
		for(i=0; i < array.length; i++){
			if(uniqueArray.indexOf(array[i]) === -1) {
				uniqueArray.push(array[i]);
			}
		}
		return uniqueArray;
	},

});