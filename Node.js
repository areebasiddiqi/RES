class Node {
	constructor(nodeId_, lat_, lon_) {
		this.nodeId = nodeId_;
		this.lat = lat_;
		this.lon = lon_;
		this.pos = createVector(1, 1);
		
		// Add safety checks for map variables before using p5.prototype.map()
		if (typeof mapminlon !== 'undefined' && typeof mapmaxlon !== 'undefined' && 
			typeof mapWidth !== 'undefined' && typeof mapHeight !== 'undefined' && 
			typeof mapminlat !== 'undefined' && typeof mapmaxlat !== 'undefined') {
			this.x = p5.prototype.map(this.lon, mapminlon, mapmaxlon, 0, mapWidth);
			this.y = p5.prototype.map(this.lat, mapminlat, mapmaxlat, mapHeight, 0);
		} else {
			// Set default values if map variables are not initialized yet
			this.x = 0;
			this.y = 0;
		}
		
		this.edges = [];
	}

	// Method to update x,y coordinates when map bounds are set
	updateCoordinates() {
		if (typeof mapminlon !== 'undefined' && typeof mapmaxlon !== 'undefined' && 
			typeof mapWidth !== 'undefined' && typeof mapHeight !== 'undefined' && 
			typeof mapminlat !== 'undefined' && typeof mapmaxlat !== 'undefined') {
			this.x = p5.prototype.map(this.lon, mapminlon, mapmaxlon, 0, mapWidth);
			this.y = p5.prototype.map(this.lat, mapminlat, mapmaxlat, mapHeight, 0);
		}
	}

	show() {
		noStroke();
		colorMode(HSB);
		fill(0, 255, 255, 100);
		ellipse(this.x, this.y, 2);
	}

	highlight() {
		noStroke();
		colorMode(HSB);
		fill(0, 255, 255, 0.5);
		ellipse(this.x, this.y, 15);
	}
}