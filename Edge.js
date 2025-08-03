class Edge { //section of road that connects nodes
	constructor(from_, to_, wayid_, surface_ = 'unknown') {
		this.wayid = wayid_;
		this.from = from_;
		this.to = to_;
		this.surface = surface_;
		this.travels = 0;
		this.distance = calcdistance(this.from.lat, this.from.lon, this.to.lat, this.to.lon);
		if (!this.from.edges.includes(this)) {
			this.from.edges.push(this);
		}
		if (!this.to.edges.includes(this)) {
			this.to.edges.push(this);
		}
	}

	show() {
		// Determine stroke weight based on travels
		let strokeW = max(3, min(10, (this.travels + 1) * 2));
		strokeWeight(strokeW);
		
		// Check if we're in preview mode
		if (surfacePreviewMode && surfacePreviewType) {
			if (this.surface === surfacePreviewType) {
				// Highlight the previewed surface type
				stroke(255, 255, 0, 1); // Bright yellow for preview
				strokeWeight(strokeW + 2);
			} else {
				// Dim other surfaces
				stroke(55, 255, 255, 0.2);
			}
		} else {
			// Normal surface-based coloring
			if (surfaceColorMap[this.surface]) {
				let color = surfaceColorMap[this.surface];
				stroke(color[0], color[1], color[2], color[3]);
			} else {
				stroke(55, 255, 255, 0.8);
			}
		}
		
		line(this.from.x, this.from.y, this.to.x, this.to.y);
		fill(0);
		noStroke();
	}

	highlight() {
		strokeWeight(4);
		stroke(20, 255, 255, 1);
		line(this.from.x, this.from.y, this.to.x, this.to.y);
		fill(0);
		noStroke();
	}

	OtherNodeofEdge(node) {
		if (node == this.from) {
			return this.to;
		} else {
			return this.from;
		}
	}

	distanceToPoint(x,y) {  //distance from middle of this edge to give point
		return(dist(x,y,(this.to.x+this.from.x)/2,(this.to.y+this.from.y)/2));
	}
}