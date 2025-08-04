var openlayersmap = new ol.Map({
	target: 'map',
	layers: [
		new ol.layer.Tile({
			source: new ol.source.OSM(),
			opacity: 0.5
		})
	],
	view: new ol.View({
		center: ol.proj.fromLonLat([5.95,47.26]),
		zoom: 12
	})
});

var canvas;
var mapWidth, mapHeight;
var windowX, windowY;
let txtoverpassQuery;
var OSMxml;
var numnodes, numways;
var nodes;
var minlat = Infinity,
	maxlat = -Infinity,
	minlon = Infinity,
	maxlon = -Infinity;
var nodes = [],
	edges = [];
var mapminlat, mapminlon, mapmaxlat, mapmaxlon;
var totaledgedistance = 0;
var closestnodetomouse = -1;
var closestedgetomouse = -1;
var startnode, currentnode;
var selectnodemode = 1,
	solveRESmode = 2,
	choosemapmode = 3,
	trimmode = 4,
	downloadGPXmode = 5,
	importmode = 6,
	polygonmode = 7,
	addsegmentmode = 8;
var mode;
var remainingedges;
var debugsteps = 0;
var bestdistance;
var bestroute;
var bestarea;
var bestdoublingsup;
var showSteps = false;
var showRoads = true;
var iterations, iterationsperframe;
var msgbckDiv, msgDiv, reportbckDiv,reportmsgDiv;
var margin;
var btnTLx, btnTLy, btnBRx, btnBRy; // button's top left and bottom right x and y coordinates.

// Undo functionality variables
var undoStack = []; // Stack to store previous states
var maxUndoSteps = 10; // Maximum number of undo steps to keep

// File import functionality variables
var fileImportDiv, fileInputDiv;
var showFileImport = false;
var importFileInput;

// Polygon selection functionality variables
var polygonPoints = []; // Array of {lat, lon, x, y} points
var isDrawingPolygon = false;
var polygonMode = false;
var polygonComplete = false;
var starttime;
var efficiencyhistory = [],
	distancehistory = [];
var totalefficiencygains = 0;
var isTouchScreenDevice = false;
var totaluniqueroads;

// Add segment functionality variables
var addSegmentMode = false;
var firstNodeForSegment = null;
var secondNodeForSegment = null;
var tempSegmentPreview = null;
var nextNodeId = 1000000; // High number to avoid conflicts with existing nodes
var previousMode = null; // Track the mode before entering add segment mode

// Surface filtering variables
var surfaceFilters = {
	'paved': true,
	'asphalt': true,
	'concrete': true,
	'paving_stones': true,
	'sett': true,
	'cobblestone': true,
	'unhewn_cobblestone': true,
	'metal': true,
	'wood': true,
	'compacted': true,
	'fine_gravel': true,
	'gravel': true,
	'pebblestone': true,
	'unpaved': true,
	'ground': true,
	'dirt': true,
	'grass': true,
	'grass_paver': true,
	'gravel_turf': true,
	'soil': true,
	'rock': true,
	'sand': true,
	'mud': true,
	'ice': true,
	'salt': true,
	'snow': true,
	'woodchips': true,
	'unknown': true
};
var surfaceFilterUI = null;
var showSurfaceFilter = false;

// Enhanced surface filter variables
var surfacePreviewMode = false;
var surfacePreviewType = null;
var surfaceFilterStats = {};
var surfaceColorMap = {
	'paved': [120, 255, 255, 0.8],      // Cyan
	'asphalt': [120, 255, 255, 0.8],    // Cyan
	'concrete': [120, 255, 255, 0.8],   // Cyan
	'paving_stones': [120, 255, 255, 0.8], // Cyan
	'sett': [120, 255, 255, 0.8],       // Cyan
	'cobblestone': [120, 255, 255, 0.8], // Cyan
	'unhewn_cobblestone': [120, 255, 255, 0.8], // Cyan
	'metal': [120, 255, 255, 0.8],      // Cyan
	'wood': [120, 255, 255, 0.8],       // Cyan
	'compacted': [60, 255, 255, 0.8],   // Green
	'fine_gravel': [60, 255, 255, 0.8], // Green
	'gravel': [60, 255, 255, 0.8],      // Green
	'pebblestone': [60, 255, 255, 0.8], // Green
	'unpaved': [30, 255, 255, 0.8],     // Orange
	'ground': [30, 255, 255, 0.8],      // Orange
	'dirt': [30, 255, 255, 0.8],        // Orange
	'grass': [30, 255, 255, 0.8],       // Orange
	'grass_paver': [30, 255, 255, 0.8], // Orange
	'gravel_turf': [30, 255, 255, 0.8], // Orange
	'soil': [30, 255, 255, 0.8],        // Orange
	'rock': [0, 255, 255, 0.8],         // Red
	'sand': [0, 255, 255, 0.8],         // Red
	'mud': [0, 255, 255, 0.8],          // Red
	'ice': [240, 255, 255, 0.8],        // Blue
	'salt': [240, 255, 255, 0.8],       // Blue
	'snow': [240, 255, 255, 0.8],       // Blue
	'woodchips': [30, 255, 255, 0.8],   // Orange
	'unknown': [180, 255, 255, 0.8]     // Magenta
};

function setup() {
	if (navigator.geolocation) { //if browser shares user GPS location, update map to center on it.
		navigator.geolocation.getCurrentPosition(function (position) {
			openlayersmap.getView().setCenter(ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]));
		});
	}
	mapWidth = windowWidth;
	mapHeight = windowHeight;
	windowX = windowWidth;
	windowY = mapHeight //; + 250;
	canvas = createCanvas(windowX, windowY - 34);
	colorMode(HSB);
	mode = choosemapmode;
	iterationsperframe = 1;
	margin = 0.1; // don't pull data in the extreme edges of the map
	showMessage("Zoom to selected area, then click here");

}

function draw() { //main loop called by the P5.js framework every frame
	if (touches.length > 0) {
		isTouchScreenDevice = true;
	} // detect touch screen device such as mobile
	clear();
	drawMask(); //frame the active area on the map
	
	// Draw polygon selection in choose map mode
	if (mode == choosemapmode && polygonMode && polygonPoints.length > 0) {
		drawPolygon();
	}

	if (mode != choosemapmode) {
		if (showRoads) {
			showEdges(); //draw connections between nodes
		}
		if (mode == solveRESmode) {
			iterationsperframe = max(0.01, iterationsperframe - 1 * (5 - frameRate())); // dynamically adapt iterations per frame to hit 5fps
			for (let it = 0; it < iterationsperframe; it++) {
				iterations++;
				let solutionfound = false;
				while (!solutionfound) { //run randomly down least roads until all roads have been run
					// Check if current node has any edges
					if (!currentnode || !currentnode.edges || currentnode.edges.length === 0) {
						console.warn('Current node has no edges, stopping route calculation');
						solutionfound = true;
						break;
					}
					
					shuffle(currentnode.edges, true);
					currentnode.edges.sort((a, b) => a.travels - b.travels); // sort edges around node by number of times traveled, and travel down least.
					let edgewithleasttravels = currentnode.edges[0];
					
					// Check if edge exists
					if (!edgewithleasttravels) {
						console.warn('No edge found for current node, stopping route calculation');
						solutionfound = true;
						break;
					}
					
					let nextNode = edgewithleasttravels.OtherNodeofEdge(currentnode);
					edgewithleasttravels.travels++;
					currentroute.addWaypoint(nextNode, edgewithleasttravels.distance);
					currentnode = nextNode;
					if (edgewithleasttravels.travels == 1) { // then first time traveled on this edge
						remainingedges--; //fewer edges that have not been travelled
					}
					if (remainingedges == 0) { //once all edges have been traveled, the route is complete. Work out total distance and see if this route is the best so far.
						solutionfound = true;
						currentroute.distance += calcdistance(currentnode.lat, currentnode.lon, startnode.lat, startnode.lon);
						if (currentroute.distance < bestdistance) { // this latest route is now record
							bestroute = new Route(null, currentroute);
							bestdistance = currentroute.distance;
							if (efficiencyhistory.length > 1) {
								totalefficiencygains += totaledgedistance / bestroute.distance - efficiencyhistory[efficiencyhistory.length - 1];
							}
							efficiencyhistory.push(totaledgedistance / bestroute.distance);
							distancehistory.push(bestroute.distance);

						}
						currentnode = startnode;
						remainingedges = edges.length;
						currentroute = new Route(currentnode, null);
						resetEdges();
					}
				}
			}
		}
		showNodes();
		if (bestroute != null) {
			bestroute.show();
		}
		if (mode == solveRESmode) {
			drawProgressGraph();
		}
		if (mode == downloadGPXmode){
			showReportOut();
		}
		
		// Show undo status in trim mode
		if (mode == trimmode) {
			drawUndoStatus();
		}
		
		// Show add segment visual feedback
		if (mode == addsegmentmode) {
			drawAddSegmentFeedback();
		}
		
		// Show surface preview status
		drawSurfacePreviewStatus();
		
		// Show surface legend
		drawSurfaceLegend();
		
		//showStatus();
	}
}

function getOverpassData() { //load nodes and edge map data in XML format from OpenStreetMap via the Overpass API
	// Check if polygon mode is active and polygon is complete
	if (polygonMode && !polygonComplete) {
		showMessage('Please complete the polygon selection first.');
		return;
	}
	
	showMessage("Loading map data…");
	canvas.position(0, 34); // start canvas just below logo image
	bestroute = null;
	totaluniqueroads=0;
	var extent = ol.proj.transformExtent(openlayersmap.getView().calculateExtent(openlayersmap.getSize()), 'EPSG:3857', 'EPSG:4326'); //get the coordinates current view on the map
	mapminlat = extent[1];
	mapminlon = extent[0];
	mapmaxlat = extent[3];
	mapmaxlon = extent[2]; //51.62354589659512,0.3054885475158691,51.635853268644496,0.33291145248413084
	dataminlat = extent[1] + (extent[3] - extent[1]) * margin; //51.62662273960746,0.31234427375793455,51.63277642563215,0.3260557262420654
	dataminlon = extent[0] + (extent[2] - extent[0]) * margin;
	datamaxlat = extent[3] - (extent[3] - extent[1]) * margin;
	datamaxlon = extent[2] - (extent[2] - extent[0]) * margin;
	let OverpassURL = "https://overpass-api.de/api/interpreter?data=";
	let overpassquery = "(way({{bbox}})['highway']['highway' !~ 'trunk']['highway' !~ 'motorway']['highway' !~ 'motorway_link']['highway' !~ 'raceway']['highway' !~ 'proposed']['highway' !~ 'construction']['highway' !~ 'service']['highway' !~ 'elevator']['footway' !~ 'crossing']['footway' !~ 'sidewalk']['foot' !~ 'no']['access' !~ 'private']['access' !~ 'no'];node(w)({{bbox}}););out meta;";

	overpassquery = overpassquery.replace("{{bbox}}", dataminlat + "," + dataminlon + "," + datamaxlat + "," + datamaxlon);
	overpassquery = overpassquery.replace("{{bbox}}", dataminlat + "," + dataminlon + "," + datamaxlat + "," + datamaxlon);
	OverpassURL = OverpassURL + encodeURI(overpassquery);
	httpGet(OverpassURL, 'text', false, function (response) {
		let OverpassResponse = response;
		var parser = new DOMParser();
		OSMxml = parser.parseFromString(OverpassResponse, "text/xml");
		var XMLnodes = OSMxml.getElementsByTagName("node")
		var XMLways = OSMxml.getElementsByTagName("way")
		numnodes = XMLnodes.length;
		numways = XMLways.length;
		for (let i = 0; i < numnodes; i++) {
			var lat = XMLnodes[i].getAttribute('lat');
			var lon = XMLnodes[i].getAttribute('lon');
			minlat = min(minlat, lat);
			maxlat = max(maxlat, lat);
			minlon = min(minlon, lon);
			maxlon = max(maxlon, lon);
		}
		nodes = [];
		edges = [];
		for (let i = 0; i < numnodes; i++) {
			var lat = XMLnodes[i].getAttribute('lat');
			var lon = XMLnodes[i].getAttribute('lon');
			var nodeid = XMLnodes[i].getAttribute('id');
			let node = new Node(nodeid, lat, lon);
			nodes.push(node);
		}
		//parse ways into edges
		for (let i = 0; i < numways; i++) {
			let wayid = XMLways[i].getAttribute('id');
			
			// Extract surface information from way tags
			let surface = 'unknown';
			let wayTags = XMLways[i].getElementsByTagName('tag');
			for (let k = 0; k < wayTags.length; k++) {
				if (wayTags[k].getAttribute('k') === 'surface') {
					surface = wayTags[k].getAttribute('v');
					break;
				}
			}
			
			let nodesinsideway = XMLways[i].getElementsByTagName('nd');
			for (let j = 0; j < nodesinsideway.length - 1; j++) {
				fromnode = getNodebyId(nodesinsideway[j].getAttribute("ref"));
				tonode = getNodebyId(nodesinsideway[j + 1].getAttribute("ref"));
				if (fromnode != null & tonode != null) {
					// Only create edge if surface type is enabled in filters
					if (surfaceFilters[surface] !== false) {
						// Check polygon filtering if polygon mode is active
						let includeEdge = true;
						if (polygonMode && polygonComplete) {
							// Check if edge intersects with the polygon (includes endpoints inside or line crossing through)
							includeEdge = lineIntersectsPolygon(fromnode.lat, fromnode.lon, tonode.lat, tonode.lon, polygonPoints);
						}
						
						if (includeEdge) {
							let newEdge = new Edge(fromnode, tonode, wayid, surface);
							edges.push(newEdge);
							totaledgedistance += newEdge.distance;
						}
					}
				}
			}
		}
		mode = selectnodemode;
		showMessage("Click on start of route");
		
		// Calculate surface statistics after loading data
		calculateSurfaceStats();
		
		// Update surface filter UI if it's open
		if (showSurfaceFilter && surfaceFilterUI) {
			updateSurfaceFilterUI();
		}
	});
}

function showNodes() {
	let closestnodetomousedist = Infinity;
	for (let i = 0; i < nodes.length; i++) {
		if (showRoads) {
			nodes[i].show();
		}
		if (mode == selectnodemode) {
			disttoMouse = dist(nodes[i].x, nodes[i].y, mouseX, mouseY);
			if (disttoMouse < closestnodetomousedist) {
				closestnodetomousedist = disttoMouse;
				closestnodetomouse = i;
			}
		}
	}
	if (mode == selectnodemode) {
		startnode = nodes[closestnodetomouse];
	}
	if (startnode != null && (!isTouchScreenDevice || mode != selectnodemode)) {
		startnode.highlight();
	}
}

function showEdges() {
	let closestedgetomousedist = Infinity;
	for (let i = 0; i < edges.length; i++) {
		// Show polygon-preserved edges with different styling
		if (polygonMode && polygonComplete && edges[i].travels === 0) {
			// This edge was preserved because it intersects the polygon
			strokeWeight(max(3, min(10, 2)));
			stroke(120, 255, 255, 0.6); // Different color for polygon-preserved edges
			line(edges[i].from.x, edges[i].from.y, edges[i].to.x, edges[i].to.y);
		} else {
			edges[i].show();
		}
		
		if (mode == trimmode) {
			let dist = edges[i].distanceToPoint(mouseX, mouseY)
			if (dist < closestedgetomousedist) {
				closestedgetomousedist = dist;
				closestedgetomouse = i;
			}
		}
	}
	if (closestedgetomouse >= 0 && !isTouchScreenDevice) {
		edges[closestedgetomouse].highlight();
	}

}

function resetEdges() {
	for (let i = 0; i < edges.length; i++) {
		edges[i].travels = 0;
	}
}

function removeOrphans() { // remove unreachable nodes and edges
	resetEdges();
	currentnode = startnode;
	floodfill(currentnode, 1); // recursively walk every unwalked route until all connected nodes have been reached at least once, then remove unwalked ones.
	let newedges = [];
	let newnodes = [];
	totaledgedistance = 0;
	
			// If polygon mode is active, be more conservative about removing edges
		let keepPolygonEdges = polygonMode && polygonComplete;
		let preservedCount = 0;
		
		for (let i = 0; i < edges.length; i++) {
			let shouldKeep = edges[i].travels > 0;
			
			// If polygon mode is active, also keep edges that intersect with the polygon
			if (keepPolygonEdges && !shouldKeep) {
				let intersects = lineIntersectsPolygon(edges[i].from.lat, edges[i].from.lon, 
													edges[i].to.lat, edges[i].to.lon, polygonPoints);
				if (intersects) {
					shouldKeep = true;
					preservedCount++;
				}
			}
			
			if (shouldKeep) {
				newedges.push(edges[i]);
				totaledgedistance += edges[i].distance;
				if (!newnodes.includes(edges[i].from)) {
					newnodes.push(edges[i].from);
				}
				if (!newnodes.includes(edges[i].to)) {
					newnodes.push(edges[i].to);
				}
			}
		}
		
		// Log polygon preservation info
		if (keepPolygonEdges && preservedCount > 0) {
			console.log(`Polygon mode: Preserved ${preservedCount} edges that intersect the polygon`);
		}
		
		edges = newedges;
		nodes = newnodes;
		
		// Validate that we still have edges after orphan removal
		if (edges.length === 0) {
			console.warn('All edges were removed during orphan removal. This may indicate disconnected data.');
			showMessage('Warning: No connected roads found. Check if your data contains valid road segments.');
		} else {
			console.log('Orphan removal complete. Remaining edges:', edges.length, 'nodes:', nodes.length);
		}
		
		resetEdges();
}

function floodfill(node, stepssofar) {
	// Add safety check to prevent infinite recursion
	if (!node || !node.edges || stepssofar > 10000) {
		console.warn('Floodfill safety check triggered. Node:', node, 'Steps:', stepssofar);
		return;
	}
	
	for (let i = 0; i < node.edges.length; i++) {
		if (node.edges[i].travels == 0) {
			node.edges[i].travels = stepssofar;
			let otherNode = node.edges[i].OtherNodeofEdge(node);
			if (otherNode && otherNode !== node) {
				floodfill(otherNode, stepssofar + 1);
			}
		}
	}
}

function solveRES() {
	// Check if surface filters are active
	let hasActiveSurfaceFilters = false;
	for (let surface in surfaceFilters) {
		if (surfaceFilters[surface] === false) {
			hasActiveSurfaceFilters = true;
			break;
		}
	}
	
	// Only remove orphans if no surface filters are active
	// (connectivity is already handled in mousePressed for filtered networks)
	if (!hasActiveSurfaceFilters) {
		removeOrphans();
	}
	
	// Validate that we have a valid network
	if (!currentnode || !currentnode.edges || currentnode.edges.length === 0) {
		console.error('No valid starting node or no edges available for route calculation');
		showMessage('Error: No valid route network found. Please check your data.');
		return;
	}
	
	if (edges.length === 0) {
		console.error('No edges available for route calculation');
		showMessage('Error: No roads available for route calculation.');
		return;
	}
	
	showRoads = false;
	remainingedges = edges.length;
	currentroute = new Route(currentnode, null);
	bestroute = new Route(currentnode, null);
	bestdistance = Infinity;
	iterations = 0;
	iterationsperframe = 1;
	starttime = millis();
	
	console.log('Starting route calculation with', edges.length, 'edges and', nodes.length, 'nodes');
}

function mousePressed() { // clicked on map to select a node
	// Handle polygon selection in choose map mode
	if (mode == choosemapmode && polygonMode && isDrawingPolygon && mouseY > 34) {
		addPolygonPoint(mouseX, mouseY);
		return;
	}
	
	if (mode == choosemapmode && mouseY < btnBRy && mouseY > btnTLy && mouseX > btnTLx && mouseX < btnBRx) { // Was in Choose map mode and clicked on button
		getOverpassData();
		return;
	}
	if (mode == selectnodemode && mouseY < mapHeight) { // Select node mode, and clicked on map
		showNodes(); //find node closest to mouse
		
		// Save initial state before entering trim mode
		saveNetworkState();
		
		mode = trimmode;
		let message = 'Click on roads to trim, then click here. Press Ctrl+Z to undo.';
		if (polygonMode && polygonComplete) {
			message += ' (Polygon mode: Roads intersecting your selected area will be preserved)';
		}
		showMessage(message);
		
		// For surface-filtered networks, we need to ensure the selected start node
		// is part of a connected component. If it's isolated, we should warn the user.
		let hasActiveSurfaceFilters = false;
		for (let surface in surfaceFilters) {
			if (surfaceFilters[surface] === false) {
				hasActiveSurfaceFilters = true;
				break;
			}
		}
		
		if (!hasActiveSurfaceFilters) {
			removeOrphans(); // deletes parts of the network that cannot be reached from start
		} else {
			// For surface-filtered networks, check if the selected start node is isolated
			// and if so, find the largest connected component that includes it
			let connectedEdges = [];
			let visitedNodes = new Set();
			
			// Use floodfill to find all reachable edges from the start node
			function findConnectedComponent(node) {
				if (!node || visitedNodes.has(node)) return;
				visitedNodes.add(node);
				
				for (let edge of node.edges) {
					if (!connectedEdges.includes(edge)) {
						connectedEdges.push(edge);
						let otherNode = edge.OtherNodeofEdge(node);
						findConnectedComponent(otherNode);
					}
				}
			}
			
			findConnectedComponent(startnode);
			
			// If the connected component is too small, warn the user
			if (connectedEdges.length < edges.length * 0.1) { // Less than 10% of total edges
				console.log('Warning: Selected start node is in a small connected component');
				showMessage('Warning: Selected start node is isolated. Consider choosing a different start point or adjusting surface filters.');
			}
			
			// Keep only the connected component for route calculation
			edges = connectedEdges;
			nodes = Array.from(visitedNodes);
			
			console.log('Surface filters active - using connected component with', edges.length, 'edges');
		}
		return;
	}
	if (mode == trimmode) {
		showEdges(); // find closest edge
		if (mouseY < btnBRy && mouseY > btnTLy && mouseX > btnTLx && mouseX < btnBRx) { // clicked on button
			// Clear undo stack when leaving trim mode
			undoStack = [];
			
			mode = solveRESmode;
			showMessage('Calculating… Click to stop when satisfied');
			showNodes(); // recalculate closest node
			solveRES();
			return;
		} else { // clicked on edge to remove it
			trimSelectedEdge();
		}
	}
	if (mode == solveRESmode && mouseY < btnBRy && mouseY > btnTLy && mouseX > btnTLx && mouseX < btnBRx) { // Was busy solving and user clicked on button
		mode = downloadGPXmode;
		hideMessage();
		//calculate total unique roads (ways):
		let uniqueways=[];
		for (let i = 0; i < edges.length; i++) {
			if (!uniqueways.includes(edges[i].wayid)) {
				uniqueways.push(edges[i].wayid);
			}
		}
		totaluniqueroads=uniqueways.length;
		return;
	}
	if (mode == downloadGPXmode && mouseY < height/2+200+40 && mouseY > height/2+200 && mouseX > width/2-140 && mouseX < width/2-140+280) { // Clicked Download Route rect(width/2-140,height/2+200,280,40);
		bestroute.exportGPX();
		return;
	}
	if (mode == addsegmentmode && mouseY < mapHeight) { // Add segment mode, clicked on map
		handleAddSegmentClick(mouseX, mouseY);
		return;
	}
}

function doubleClicked() {
	// Complete polygon on double-click
	if (mode == choosemapmode && polygonMode && isDrawingPolygon && mouseY > 34) {
		completePolygon();
		return false; // Prevent default behavior
	}
}

function keyPressed() {
	// Toggle surface filter UI with 'S' key
	if (key === 's' || key === 'S') {
		if (showSurfaceFilter) {
			hideSurfaceFilterUI();
		} else {
			showSurfaceFilterUI();
		}
	}
	
	// Toggle surface preview mode with 'P' key
	if (key === 'p' || key === 'P') {
		if (surfacePreviewMode) {
			surfacePreviewMode = false;
			surfacePreviewType = null;
			showMessage('Surface preview disabled');
		} else {
			showMessage('Surface preview mode: Use the Surface Filters panel to preview specific surfaces');
		}
	}
	
	// Complete polygon with Enter key
	if (keyCode === ENTER) {
		if (mode === choosemapmode && polygonMode && isDrawingPolygon) {
			completePolygon();
		}
	}
	
	// Undo trimming with Ctrl+Z (only in trim mode)
	if ((key === 'z' || key === 'Z') && (keyIsDown(CONTROL) || keyIsDown(17))) {
		if (mode === trimmode) {
			undoTrimming();
		}
	}
	
	// Toggle add segment mode with 'A' key
	if (key === 'a' || key === 'A') {
		toggleAddSegmentMode();
	}
	
	// Cancel add segment mode with Escape key
	if (keyCode === ESCAPE) {
		if (mode === addsegmentmode) {
			toggleAddSegmentMode();
		}
	}
}

function positionMap(minlon_, minlat_, maxlon_, maxlat_) {
	extent = [minlon_, minlat_, maxlon_, maxlat_];
	//try to fit the map to these coordinates
	openlayersmap.getView().fit(ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857'), openlayersmap.getSize());
	//capture the exact coverage of the map after fitting
	var extent = ol.proj.transformExtent(openlayersmap.getView().calculateExtent(openlayersmap.getSize()), 'EPSG:3857', 'EPSG:4326');
	mapminlat = extent[1];
	mapminlon = extent[0];
	mapmaxlat = extent[3];
	mapmaxlon = extent[2];
	
	// Update coordinates for all existing nodes
	updateAllNodeCoordinates();
}

// Function to update coordinates for all nodes
function updateAllNodeCoordinates() {
	for (let node of nodes) {
		node.updateCoordinates();
	}
}

function calcdistance(lat1, long1, lat2, long2) {
	lat1 = radians(lat1);
	long1 = radians(long1);
	lat2 = radians(lat2);
	long2 = radians(long2);
	return 2 * asin(sqrt(pow(sin((lat2 - lat1) / 2), 2) + cos(lat1) * cos(lat2) * pow(sin((long2 - long1) / 2), 2))) * 6371.0;
}

function getNodebyId(id) {
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].nodeId == id) {
			return nodes[i];
		}
	}
	return null;
}

function showMessage(msg) {
	if (msgDiv) {
		hideMessage();
	}
	let ypos = 20;
	let btnwidth = 320;
	msgbckDiv = createDiv('');
	msgbckDiv.style('position', 'fixed');
	msgbckDiv.style('width', btnwidth + 'px');
	msgbckDiv.style('top', ypos + 45 + 'px');
	msgbckDiv.style('left', '50%');
	msgbckDiv.style('background', 'black');
	msgbckDiv.style('opacity', '0.3');
	msgbckDiv.style('-webkit-transform', 'translate(-50%, -50%)');
	msgbckDiv.style('transform', 'translate(-50%, -50%)');
	msgbckDiv.style('height', '30px');
	msgbckDiv.style('border-radius', '7px');
	msgDiv = createDiv('');
	msgDiv.style('position', 'fixed');
	msgDiv.style('width', btnwidth + 'px');
	msgDiv.style('top', ypos + 57 + 'px');
	msgDiv.style('left', '50%');
	msgDiv.style('color', 'white');
	msgDiv.style('background', 'none');
	msgDiv.style('opacity', '1');
	msgDiv.style('-webkit-transform', 'translate(-50%, -50%)');
	msgDiv.style('transform', 'translate(-50%, -50%)');
	msgDiv.style('font-family', '"Lucida Sans Unicode", "Lucida Grande", sans-serif');
	msgDiv.style('font-size', '16px');
	msgDiv.style('text-align', 'center');
	msgDiv.style('vertical-align', 'middle');
	msgDiv.style('height', '50px');
	msgDiv.html(msg);
	btnTLx = windowWidth / 2 - 200; // area that is touch/click sensitive
	btnTLy = ypos - 4;
	btnBRx = btnTLx + 400;
	btnBRy = btnTLy + 32;
}

function hideMessage() {
	msgbckDiv.remove();
	msgDiv.remove();
}

function drawMask() {
	noFill();
	stroke(0, 0, 255, 0.4);
	strokeWeight(0.5);
	rect(windowWidth * margin, windowHeight * margin, windowWidth * (1 - 2 * margin), windowHeight * (1 - 2 * margin));
}

function trimSelectedEdge() {
	if (closestedgetomouse >= 0) {
		// Save current state before trimming
		saveNetworkState();
		
		let edgetodelete = edges[closestedgetomouse];
		edges.splice(edges.findIndex((element) => element == edgetodelete), 1);
		for (let i = 0; i < nodes.length; i++) { // remove references to the deleted edge from within each of the nodes
			if (nodes[i].edges.includes(edgetodelete)) {
				nodes[i].edges.splice(nodes[i].edges.findIndex((element) => element == edgetodelete), 1);
			}
		}
		removeOrphans(); // deletes parts of the network that no longer can be reached.
		closestedgetomouse = -1;
	}
}

// Save current network state to undo stack
function saveNetworkState() {
	// Deep copy the current edges and nodes
	let edgesCopy = [];
	let nodesCopy = [];
	
	// Create a map to track copied nodes
	let nodeMap = new Map();
	
	// First, copy all nodes
	for (let i = 0; i < nodes.length; i++) {
		let originalNode = nodes[i];
		let nodeCopy = {
			nodeId: originalNode.nodeId,
			lat: originalNode.lat,
			lon: originalNode.lon,
			x: originalNode.x,
			y: originalNode.y,
			edges: [] // Will be populated when copying edges
		};
		nodesCopy.push(nodeCopy);
		nodeMap.set(originalNode.nodeId, nodeCopy);
	}
	
	// Then, copy all edges and update node references
	for (let i = 0; i < edges.length; i++) {
		let originalEdge = edges[i];
		let fromNodeCopy = nodeMap.get(originalEdge.from.nodeId);
		let toNodeCopy = nodeMap.get(originalEdge.to.nodeId);
		
		let edgeCopy = {
			wayid: originalEdge.wayid,
			from: fromNodeCopy,
			to: toNodeCopy,
			surface: originalEdge.surface,
			travels: originalEdge.travels,
			distance: originalEdge.distance
		};
		
		// Add edge references to nodes
		fromNodeCopy.edges.push(edgeCopy);
		toNodeCopy.edges.push(edgeCopy);
		
		edgesCopy.push(edgeCopy);
	}
	
	// Save state to undo stack
	let networkState = {
		edges: edgesCopy,
		nodes: nodesCopy,
		totaledgedistance: totaledgedistance,
		startnodeId: startnode ? startnode.nodeId : null
	};
	
	undoStack.push(networkState);
	
	// Limit undo stack size
	if (undoStack.length > maxUndoSteps) {
		undoStack.shift(); // Remove oldest state
	}
}

// Restore network state from undo stack
function undoTrimming() {
	if (undoStack.length === 0) {
		showMessage('No more undo steps available');
		return;
	}
	
	// Get the last saved state
	let lastState = undoStack.pop();
	
	// Restore nodes as proper Node class instances
	nodes = [];
	let nodeMap = new Map();
	
	for (let i = 0; i < lastState.nodes.length; i++) {
		let nodeData = lastState.nodes[i];
		let restoredNode = new Node(nodeData.nodeId, nodeData.lat, nodeData.lon);
		// Preserve the calculated x,y coordinates
		restoredNode.x = nodeData.x;
		restoredNode.y = nodeData.y;
		restoredNode.edges = []; // Will be populated when restoring edges
		nodes.push(restoredNode);
		nodeMap.set(nodeData.nodeId, restoredNode);
	}
	
	// Restore edges as proper Edge class instances
	edges = [];
	for (let i = 0; i < lastState.edges.length; i++) {
		let edgeData = lastState.edges[i];
		let fromNode = nodeMap.get(edgeData.from.nodeId);
		let toNode = nodeMap.get(edgeData.to.nodeId);
		
		// Manually create edge object to avoid constructor side effects
		let restoredEdge = Object.create(Edge.prototype);
		restoredEdge.wayid = edgeData.wayid;
		restoredEdge.from = fromNode;
		restoredEdge.to = toNode;
		restoredEdge.surface = edgeData.surface;
		restoredEdge.travels = edgeData.travels;
		restoredEdge.distance = edgeData.distance;
		
		// Manually add edge references to nodes
		fromNode.edges.push(restoredEdge);
		toNode.edges.push(restoredEdge);
		
		edges.push(restoredEdge);
	}
	
	totaledgedistance = lastState.totaledgedistance;
	
	// Restore startnode reference
	if (lastState.startnodeId) {
		startnode = nodeMap.get(lastState.startnodeId);
	}
	
	// Reset edge selection
	closestedgetomouse = -1;
	
	// Restore the trim mode message with click functionality
	showMessage('Click on roads to trim, then click here. Press Ctrl+Z to undo.');
}

// Draw undo status indicator
function drawUndoStatus() {
	if (undoStack.length > 0) {
		// Draw undo status in bottom-left corner
		fill(0, 0, 0, 0.7);
		noStroke();
		rect(10, height - 60, 200, 50, 5);
		
		fill(255, 255, 255);
		textAlign(LEFT);
		textSize(12);
		text('Undo available: ' + undoStack.length + ' step(s)', 15, height - 40);
		text('Press Ctrl+Z to undo', 15, height - 25);
	}
}

function drawProgressGraph() {
	if (efficiencyhistory.length > 0) {
		noStroke();
		fill(0, 0, 0, 0.3);
		let graphHeight = 100;
		rect(0, height - graphHeight, windowWidth, graphHeight);
		fill(0, 5, 225, 255);
		textAlign(LEFT);
		textSize(12);
		// Add safety check for bestroute
		let bestRouteText = bestroute && bestroute.distance ? nf(bestroute.distance, 0, 1) + "km" : "N/A";
		let efficiencyText = efficiencyhistory.length > 0 ? round(efficiencyhistory[efficiencyhistory.length - 1] * 100) + "%" : "N/A";
		text("Routes tried: " + (iterations.toLocaleString()) + ", Length of all roads: " + nf(totaledgedistance, 0, 1) + "km, Best route: " + bestRouteText + " (" + efficiencyText + ")", 15, height - graphHeight + 18);
		textAlign(CENTER);
		textSize(12);
		        for (let i = 0; i < efficiencyhistory.length; i++) {
            fill(i * 128 / efficiencyhistory.length, 255, 205, 1);
            // Add safety check for efficiencyhistory length
            let maxIndex = Math.max(1, efficiencyhistory.length);
            let startx = p5.prototype.map(i, 0, maxIndex, 0, windowWidth);
			let starty = height - graphHeight * efficiencyhistory[i];
			rect(startx, starty, windowWidth / efficiencyhistory.length, graphHeight * efficiencyhistory[i]);
			fill(0, 5, 0);
			text(round(distancehistory[i]) + "km", startx + windowWidth / efficiencyhistory.length / 2, height - 5);
		}
	}
}

function showReportOut() {

	fill(250,255,0,0.6);
	noStroke();
	rect(width/2-150,height/2-250,300,500);
	fill(250,255,0,0.15);
	rect(width/2-147,height/2-247,300,500);
	strokeWeight(1);
	stroke(20,255,255,0.8);
	line(width/2-150,height/2-200,width/2+150,height/2-200);
	noStroke();
	fill(0,0,255,1);
	textSize(28);
	textAlign(CENTER);
	text('Route Summary',width/2,height/2-215);
	fill(0,0,255,0.75);
	textSize(16);
	text('Total roads covered',width/2,height/2-170+0*95);
	text('Total length of all roads',width/2,height/2-170+1*95);
	text('Length of final route',width/2,height/2-170+2*95);
	text('Efficiency',width/2,height/2-170+3*95);

	textSize(36);
	fill(20,255,255,1);
	text(totaluniqueroads,width/2,height/2-120+0*95);
	text(nf(totaledgedistance, 0, 1) + "km",width/2,height/2-120+1*95);
	// Add safety checks for bestroute
	let bestRouteDistance = bestroute && bestroute.distance ? nf(bestroute.distance, 0, 1) + "km" : "N/A";
	let efficiencyPercent = bestroute && bestroute.distance ? round(100 * totaledgedistance / bestroute.distance) + "%" : "N/A";
	text(bestRouteDistance,width/2,height/2-120+2*95);
	text(efficiencyPercent,width/2,height/2-120+3*95);

	fill(20,255,100,0.75);
	rect(width/2-140,height/2+200,280,40);
	fill(0,0,255,1);
	textSize(28);
	text('Download Route',width/2,height/2+230);
}

function showStatus() {
	if (startnode != null) {
		let textx = 2;
		let texty = mapHeight - 400;
		fill(0, 5, 225);
		noStroke();
		textSize(12);
		textAlign(LEFT);
		text("Total number nodes: " + nodes.length, textx, texty);
		text("Total number road sections: " + edges.length, textx, texty + 20);
		text("Length of roads: " + nf(totaledgedistance, 0, 3) + "km", textx, texty + 40);
		if (bestroute != null) {
			if (bestroute.waypoints.length > 0) {
				text("Best route: " + nf(bestroute.distance, 0, 3) + "km, " + nf(100 * totaledgedistance / bestroute.distance, 0, 2) + "%", textx, texty + 60);
			}
			text("Routes tried: " + iterations, textx, texty + 80);
			text("Frame rate: " + frameRate(), textx, texty + 100);
			text("Solutions per frame: " + iterationsperframe, textx, texty + 120);
			text("Iterations/second: " + iterations / (millis() - starttime) * 1000, textx, texty + 140);
			text("best routes: " + efficiencyhistory.length, textx, texty + 160);
			text("efficiency gains: " + nf(100 * totalefficiencygains, 0, 2) + "% and " + nf(100 * totalefficiencygains / (millis() - starttime) * 1000, 0, 2) + "% gains/sec:", textx, texty + 180); //
			text("isTouchScreenDevice: " + isTouchScreenDevice, textx, texty + 200);
		}
	}
}

function createSurfaceFilterUI() {
	if (surfaceFilterUI) {
		surfaceFilterUI.remove();
	}
	
	surfaceFilterUI = createDiv('');
	surfaceFilterUI.style('position', 'fixed');
	surfaceFilterUI.style('top', '80px');
	surfaceFilterUI.style('right', '10px');
	surfaceFilterUI.style('width', '300px');
	surfaceFilterUI.style('max-height', '500px');
	surfaceFilterUI.style('overflow-y', 'auto');
	surfaceFilterUI.style('background', 'rgba(0, 0, 0, 0.9)');
	surfaceFilterUI.style('color', 'white');
	surfaceFilterUI.style('padding', '15px');
	surfaceFilterUI.style('border-radius', '8px');
	surfaceFilterUI.style('font-family', '"Lucida Sans Unicode", "Lucida Grande", sans-serif');
	surfaceFilterUI.style('font-size', '12px');
	surfaceFilterUI.style('border', '2px solid #4CAF50');
	
	let title = createDiv('Surface Filters & Preview');
	title.style('font-weight', 'bold');
	title.style('margin-bottom', '15px');
	title.style('text-align', 'center');
	title.style('font-size', '14px');
	title.style('color', '#4CAF50');
	title.parent(surfaceFilterUI);
	
	// Add toggle all buttons
	let toggleAllDiv = createDiv('');
	toggleAllDiv.style('margin-bottom', '15px');
	toggleAllDiv.style('text-align', 'center');
	toggleAllDiv.parent(surfaceFilterUI);
	
	let selectAllBtn = createButton('Select All');
	selectAllBtn.style('margin-right', '5px');
	selectAllBtn.style('padding', '5px 10px');
	selectAllBtn.style('font-size', '11px');
	selectAllBtn.style('background-color', '#4CAF50');
	selectAllBtn.style('color', 'white');
	selectAllBtn.style('border', 'none');
	selectAllBtn.style('border-radius', '3px');
	selectAllBtn.mousePressed(() => {
		for (let surface in surfaceFilters) {
			surfaceFilters[surface] = true;
		}
		updateSurfaceFilterUI();
	});
	selectAllBtn.parent(toggleAllDiv);
	
	let deselectAllBtn = createButton('Deselect All');
	deselectAllBtn.style('padding', '5px 10px');
	deselectAllBtn.style('font-size', '11px');
	deselectAllBtn.style('background-color', '#f44336');
	deselectAllBtn.style('color', 'white');
	deselectAllBtn.style('border', 'none');
	deselectAllBtn.style('border-radius', '3px');
	deselectAllBtn.mousePressed(() => {
		for (let surface in surfaceFilters) {
			surfaceFilters[surface] = false;
		}
		updateSurfaceFilterUI();
	});
	deselectAllBtn.parent(toggleAllDiv);
	
	// Add preview mode toggle
	let previewDiv = createDiv('');
	previewDiv.style('margin-bottom', '15px');
	previewDiv.style('text-align', 'center');
	previewDiv.parent(surfaceFilterUI);
	
	let previewLabel = createDiv('Preview Mode: Click a surface to highlight it');
	previewLabel.style('font-size', '11px');
	previewLabel.style('margin-bottom', '5px');
	previewLabel.style('color', '#FFD700');
	previewLabel.parent(previewDiv);
	
	// Calculate surface statistics
	calculateSurfaceStats();
	
	// Create checkboxes for each surface type with statistics
	// Left checkbox: Filter (include/exclude this surface type from data)
	// 👁 button: Preview (highlight this surface type on the map)
	for (let surface in surfaceFilters) {
		let checkboxDiv = createDiv('');
		checkboxDiv.style('margin-bottom', '8px');
		checkboxDiv.style('padding', '5px');
		checkboxDiv.style('border-radius', '3px');
		checkboxDiv.style('background', surfaceFilters[surface] ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)');
		checkboxDiv.parent(surfaceFilterUI);
		
		let surfaceRow = createDiv('');
		surfaceRow.style('display', 'flex');
		surfaceRow.style('align-items', 'center');
		surfaceRow.style('justify-content', 'space-between');
		surfaceRow.parent(checkboxDiv);
		
		let leftDiv = createDiv('');
		leftDiv.style('display', 'flex');
		leftDiv.style('align-items', 'center');
		leftDiv.parent(surfaceRow);
		
		// Color indicator
		let colorIndicator = createDiv('');
		colorIndicator.style('width', '12px');
		colorIndicator.style('height', '12px');
		colorIndicator.style('border-radius', '2px');
		colorIndicator.style('margin-right', '8px');
		if (surfaceColorMap[surface]) {
			let color = surfaceColorMap[surface];
			colorIndicator.style('background', `hsb(${color[0]}, ${color[1]}%, ${color[2]}%)`);
		} else {
			colorIndicator.style('background', '#888');
		}
		colorIndicator.parent(leftDiv);
		
		let checkbox = createCheckbox(surface.replace('_', ' '), surfaceFilters[surface]);
		checkbox.style('color', 'white');
		checkbox.style('margin-right', '8px');
		checkbox.changed(() => {
			surfaceFilters[surface] = checkbox.checked();
			checkboxDiv.style('background', surfaceFilters[surface] ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)');
		});
		checkbox.parent(leftDiv);
		
		// Preview button
		let previewBtn = createButton('👁');
		previewBtn.style('padding', '2px 6px');
		previewBtn.style('font-size', '10px');
		previewBtn.style('background-color', '#FFD700');
		previewBtn.style('color', 'black');
		previewBtn.style('border', 'none');
		previewBtn.style('border-radius', '2px');
		previewBtn.style('margin-right', '8px');
		previewBtn.mousePressed(() => {
			toggleSurfacePreview(surface);
		});
		previewBtn.parent(leftDiv);
		
		// Statistics
		let statsDiv = createDiv('');
		statsDiv.style('font-size', '10px');
		statsDiv.style('color', '#ccc');
		if (surfaceFilterStats[surface]) {
			statsDiv.html(`${surfaceFilterStats[surface].count} roads (${surfaceFilterStats[surface].percentage.toFixed(1)}%)`);
		} else {
			statsDiv.html('0 roads');
		}
		statsDiv.parent(surfaceRow);
	}
	
	// Add apply filters button
	let applyBtn = createButton('Apply Filters & Reload Data');
	applyBtn.style('width', '100%');
	applyBtn.style('margin-top', '15px');
	applyBtn.style('padding', '8px');
	applyBtn.style('background-color', '#4CAF50');
	applyBtn.style('color', 'white');
	applyBtn.style('border', 'none');
	applyBtn.style('border-radius', '5px');
	applyBtn.style('font-weight', 'bold');
	applyBtn.mousePressed(() => {
		reloadDataWithFilters();
	});
	applyBtn.parent(surfaceFilterUI);
	
	// Add close button
	let closeBtn = createButton('Close');
	closeBtn.style('width', '100%');
	closeBtn.style('margin-top', '8px');
	closeBtn.style('padding', '5px');
	closeBtn.style('background-color', '#666');
	closeBtn.style('color', 'white');
	closeBtn.style('border', 'none');
	closeBtn.style('border-radius', '3px');
	closeBtn.mousePressed(() => {
		hideSurfaceFilterUI();
	});
	closeBtn.parent(surfaceFilterUI);
}

function updateSurfaceFilterUI() {
	if (surfaceFilterUI) {
		surfaceFilterUI.remove();
		createSurfaceFilterUI();
	}
}

function showSurfaceFilterUI() {
	showSurfaceFilter = true;
	createSurfaceFilterUI();
}

function hideSurfaceFilterUI() {
	showSurfaceFilter = false;
	if (surfaceFilterUI) {
		surfaceFilterUI.remove();
		surfaceFilterUI = null;
	}
}

function reloadDataWithFilters() {
	// Reset preview mode when applying new filters
	if (surfacePreviewMode) {
		surfacePreviewMode = false;
		surfacePreviewType = null;
		showMessage('Preview mode reset due to filter changes');
	}
	
	// Reload the map data with current surface filters
	getOverpassData();
}

// File import UI functions
function showFileImportUI() {
	if (fileImportDiv) {
		hideFileImportUI();
		return;
	}
	
	showFileImport = true;
	
	// Create background div
	fileImportDiv = createDiv('');
	fileImportDiv.style('position', 'fixed');
	fileImportDiv.style('top', '50%');
	fileImportDiv.style('left', '50%');
	fileImportDiv.style('transform', 'translate(-50%, -50%)');
	fileImportDiv.style('background', 'rgba(0, 0, 0, 0.9)');
	fileImportDiv.style('color', 'white');
	fileImportDiv.style('padding', '20px');
	fileImportDiv.style('border-radius', '10px');
	fileImportDiv.style('z-index', '1000');
	fileImportDiv.style('width', '400px');
	fileImportDiv.style('font-family', '"Lucida Sans Unicode", "Lucida Grande", sans-serif');
	
	// Add title
	let title = createDiv('Import Road Data');
	title.style('font-size', '18px');
	title.style('font-weight', 'bold');
	title.style('margin-bottom', '15px');
	title.style('text-align', 'center');
	title.parent(fileImportDiv);
	
	// Add description
	let desc = createDiv('Select a GPX file or Shapefile containing road/track data:');
	desc.style('font-size', '14px');
	desc.style('margin-bottom', '10px');
	desc.parent(fileImportDiv);
	
	// Add shapefile specific info
	let shpInfo = createDiv('For Shapefiles: Upload .shp file directly or .zip archive (Polyline/Polygon types supported)');
	shpInfo.style('font-size', '12px');
	shpInfo.style('color', '#aaa');
	shpInfo.style('margin-bottom', '15px');
	shpInfo.parent(fileImportDiv);
	
	// Create file input
	importFileInput = createFileInput(handleFileImport);
	importFileInput.style('margin-bottom', '15px');
	importFileInput.style('width', '100%');
	importFileInput.attribute('accept', '.gpx,.shp,.zip');
	importFileInput.parent(fileImportDiv);
	
	// Add supported formats info
	let formats = createDiv('Supported formats: GPX (.gpx), Shapefile (.shp, .zip)');
	formats.style('font-size', '12px');
	formats.style('color', '#ccc');
	formats.style('margin-bottom', '15px');
	formats.parent(fileImportDiv);
	
	// Add close button
	let closeBtn = createButton('Close');
	closeBtn.style('background', '#666');
	closeBtn.style('color', 'white');
	closeBtn.style('border', 'none');
	closeBtn.style('padding', '8px 16px');
	closeBtn.style('border-radius', '5px');
	closeBtn.style('cursor', 'pointer');
	closeBtn.style('float', 'right');
	closeBtn.mousePressed(hideFileImportUI);
	closeBtn.parent(fileImportDiv);
}

function hideFileImportUI() {
	if (fileImportDiv) {
		fileImportDiv.remove();
		fileImportDiv = null;
	}
	if (importFileInput) {
		importFileInput = null;
	}
	showFileImport = false;
}

// Handle file import
function handleFileImport(file) {
	if (!file) return;
	
	showMessage('Processing file: ' + file.name);
	
	let fileName = file.name.toLowerCase();
	if (fileName.endsWith('.gpx')) {
		// Parse GPX file
		parseGPXFile(file);
	} else if (fileName.endsWith('.shp') || fileName.endsWith('.zip')) {
		// Parse Shapefile
		parseShapefile(file);
	} else {
		showMessage('Unsupported file format. Please select a GPX or Shapefile.');
		return;
	}
	
	hideFileImportUI();
}

// Parse GPX file
function parseGPXFile(file) {
	try {
		// p5.File object has a 'data' property containing the file content
		let rawData = file.data;
		let xmlText;
		
		// Check if data is base64 encoded (data URL format)
		if (rawData.startsWith('data:')) {
			// Extract base64 part and decode it
			let base64Data = rawData.split(',')[1];
			if (base64Data) {
				try {
					xmlText = atob(base64Data);
				} catch (e) {
					showMessage('Error: Could not decode file data.');
					return;
				}
			} else {
				showMessage('Error: Invalid file data format.');
				return;
			}
		} else {
			// Data is already plain text
			xmlText = rawData;
		}
		
		// Debug: Log the first 200 characters of the decoded file
		console.log('Decoded file content preview:', xmlText.substring(0, 200));
		console.log('Decoded file size:', xmlText.length);
		
		if (!xmlText || xmlText.trim().length === 0) {
			showMessage('Error: File appears to be empty.');
			return;
		}
		
		let parser = new DOMParser();
		let xmlDoc = parser.parseFromString(xmlText, 'text/xml');
		
		// Check for parsing errors
		let parserError = xmlDoc.getElementsByTagName('parsererror');
		if (parserError.length > 0) {
			console.error('XML Parser Error:', parserError[0].textContent);
			showMessage('Error: Invalid XML format - ' + parserError[0].textContent);
			return;
		}
		
		// Check if it's a valid GPX file
		let gpxRoot = xmlDoc.getElementsByTagName('gpx');
		if (gpxRoot.length === 0) {
			showMessage('Error: Not a valid GPX file - missing <gpx> root element.');
			return;
		}
		
		// Clear existing data
		nodes = [];
		edges = [];
		
		// Extract tracks and routes from GPX
		let tracks = xmlDoc.getElementsByTagName('trk');
		let routes = xmlDoc.getElementsByTagName('rte');
		
		let allCoordinates = [];
		
		// Process tracks
		for (let i = 0; i < tracks.length; i++) {
			let trackPoints = tracks[i].getElementsByTagName('trkpt');
			let trackCoords = [];
			for (let j = 0; j < trackPoints.length; j++) {
				let lat = parseFloat(trackPoints[j].getAttribute('lat'));
				let lon = parseFloat(trackPoints[j].getAttribute('lon'));
				if (!isNaN(lat) && !isNaN(lon)) {
					trackCoords.push({lat: lat, lon: lon});
				}
			}
			if (trackCoords.length > 0) {
				allCoordinates.push(trackCoords);
			}
		}
		
		// Process routes
		for (let i = 0; i < routes.length; i++) {
			let routePoints = routes[i].getElementsByTagName('rtept');
			let routeCoords = [];
			for (let j = 0; j < routePoints.length; j++) {
				let lat = parseFloat(routePoints[j].getAttribute('lat'));
				let lon = parseFloat(routePoints[j].getAttribute('lon'));
				if (!isNaN(lat) && !isNaN(lon)) {
					routeCoords.push({lat: lat, lon: lon});
				}
			}
			if (routeCoords.length > 0) {
				allCoordinates.push(routeCoords);
			}
		}
		
		if (allCoordinates.length === 0) {
			showMessage('No track or route data found in GPX file.');
			return;
		}
		
		// Convert coordinates to nodes and edges
		convertCoordinatesToNetwork(allCoordinates);
		
		showMessage('GPX file imported successfully! ' + edges.length + ' road segments loaded.');
		
	} catch (error) {
		console.error('Error parsing GPX file:', error);
		showMessage('Error parsing GPX file. Please check the file format.');
	}
}

// Parse Shapefile
function parseShapefile(file) {
	try {
		showMessage('Processing shapefile: ' + file.name);
		
		// Check if it's a ZIP file containing shapefile components
		if (file.name.toLowerCase().endsWith('.zip')) {
			parseShapefileZip(file);
		} else if (file.name.toLowerCase().endsWith('.shp')) {
			// Single .shp file - need to handle binary format
			parseShapefileBinary(file);
		} else {
			showMessage('Please provide a .zip file containing shapefile components or a .shp file.');
		}
		
	} catch (error) {
		console.error('Error parsing shapefile:', error);
		showMessage('Error parsing shapefile. Please check the file format.');
	}
}

// Parse shapefile from ZIP archive
function parseShapefileZip(file) {
	try {
		showMessage('Extracting shapefile from ZIP archive...');
		
		// Handle p5.js file object - check if it has data property
		if (file.data) {
			// p5.js file object with base64 data
			let rawData = file.data;
			let arrayBuffer;
			
			if (rawData.startsWith('data:')) {
				// Extract base64 part and decode it
				let base64Data = rawData.split(',')[1];
				if (base64Data) {
					let binaryString = atob(base64Data);
					arrayBuffer = new ArrayBuffer(binaryString.length);
					let uint8Array = new Uint8Array(arrayBuffer);
					for (let i = 0; i < binaryString.length; i++) {
						uint8Array[i] = binaryString.charCodeAt(i);
					}
				} else {
					throw new Error('Invalid base64 data');
				}
			} else {
				// Direct binary data
				arrayBuffer = rawData;
			}
			
			// Process the ZIP data directly
			processZipData(arrayBuffer);
			
		} else {
			// Standard File/Blob object - use FileReader
			let reader = new FileReader();
			reader.onload = function(e) {
				let arrayBuffer = e.target.result;
				processZipData(arrayBuffer);
			};
			
			reader.onerror = function() {
				showMessage('Error reading ZIP file.');
			};
			
			reader.readAsArrayBuffer(file);
		}
		
	} catch (error) {
		console.error('Error parsing ZIP shapefile:', error);
		showMessage('Error parsing ZIP shapefile: ' + error.message);
	}
}

// Process ZIP data (extracted from parseShapefileZip for reuse)
function processZipData(arrayBuffer) {
	try {
		// Use JSZip to extract the archive
		JSZip.loadAsync(arrayBuffer).then(function(zip) {
			// Look for .shp file in the archive
			let shpFile = null;
			let shpFileName = '';
			let prjFile = null;
			let prjFileName = '';
			
			zip.forEach(function(relativePath, zipEntry) {
				if (relativePath.toLowerCase().endsWith('.shp')) {
					shpFile = zipEntry;
					shpFileName = relativePath;
				} else if (relativePath.toLowerCase().endsWith('.prj')) {
					prjFile = zipEntry;
					prjFileName = relativePath;
				}
			});
			
			if (!shpFile) {
				showMessage('No .shp file found in ZIP archive. Please ensure the archive contains a shapefile.');
				return;
			}
			
			showMessage('Found shapefile: ' + shpFileName + '. Extracting...');
			
			// Extract the .shp file as ArrayBuffer
			shpFile.async('arraybuffer').then(function(shpData) {
				// If .prj file exists, extract it too
				if (prjFile) {
					prjFile.async('text').then(function(prjData) {
						console.log('Found projection file:', prjFileName);
						console.log('Projection info:', prjData);
						parseShapefileBinaryFromBuffer(shpData, shpFileName, prjData);
					}).catch(function(error) {
						console.warn('Error reading .prj file:', error);
						parseShapefileBinaryFromBuffer(shpData, shpFileName);
					});
				} else {
					parseShapefileBinaryFromBuffer(shpData, shpFileName);
				}
				
			}).catch(function(error) {
				console.error('Error extracting .shp file:', error);
				showMessage('Error extracting shapefile from ZIP archive.');
			});
			
		}).catch(function(error) {
			console.error('Error reading ZIP file:', error);
			showMessage('Error reading ZIP archive. Please check the file format.');
		});
		
	} catch (error) {
		console.error('Error processing ZIP data:', error);
		showMessage('Error processing ZIP data: ' + error.message);
	}
}

// Parse binary .shp file
function parseShapefileBinary(file) {
	try {
		// Handle p5.js file object - check if it has data property
		if (file.data) {
			// p5.js file object with base64 data
			let rawData = file.data;
			let arrayBuffer;
			
			if (rawData.startsWith('data:')) {
				// Extract base64 part and decode it
				let base64Data = rawData.split(',')[1];
				if (base64Data) {
					let binaryString = atob(base64Data);
					arrayBuffer = new ArrayBuffer(binaryString.length);
					let uint8Array = new Uint8Array(arrayBuffer);
					for (let i = 0; i < binaryString.length; i++) {
						uint8Array[i] = binaryString.charCodeAt(i);
					}
				} else {
					throw new Error('Invalid base64 data');
				}
			} else {
				// Direct binary data
				arrayBuffer = rawData;
			}
			
			// Process the shapefile data directly
			parseShapefileBinaryFromBuffer(arrayBuffer, file.name);
			
		} else {
			// Standard File/Blob object - use FileReader
			let reader = new FileReader();
			reader.onload = function(e) {
				let arrayBuffer = e.target.result;
				parseShapefileBinaryFromBuffer(arrayBuffer, file.name);
			};
			
			reader.onerror = function() {
				showMessage('Error reading shapefile. Please check the file.');
			};
			
			reader.readAsArrayBuffer(file);
		}
		
	} catch (error) {
		console.error('Error parsing binary shapefile:', error);
		showMessage('Error parsing shapefile: ' + error.message);
	}
}

// Parse shapefile from ArrayBuffer (used by both file and ZIP parsing)
function parseShapefileBinaryFromBuffer(arrayBuffer, fileName, projectionData) {
	try {
		let dataView = new DataView(arrayBuffer);
		
		// Parse shapefile header (100 bytes)
		let fileCode = dataView.getInt32(0, false); // Big endian
		let fileLength = dataView.getInt32(24, false) * 2; // Big endian, in 16-bit words
		let version = dataView.getInt32(28, true); // Little endian
		let shapeType = dataView.getInt32(32, true); // Little endian
		
		// Validate shapefile header
		if (fileCode !== 9994) {
			throw new Error('Invalid shapefile format - incorrect file code');
		}
		
		if (version !== 1000) {
			throw new Error('Unsupported shapefile version');
		}
		
		// Check if shape type is supported and get shape type name
		let shapeTypeName = getShapeTypeName(shapeType);
		if (!isShapeTypeSupported(shapeType)) {
			showMessage('Shapefile contains shape type ' + shapeType + ' (' + shapeTypeName + '). Supported types: Point, PointZ, PointM, Polyline, PolylineZ, PolylineM, Polygon, PolygonZ, PolygonM, MultiPoint, MultiPointZ, MultiPointM.');
			return;
		}
		
		showMessage('Parsing shapefile with shape type: ' + shapeTypeName);
		
		// Parse records starting after header (byte 100)
		let allCoordinates = [];
		let offset = 100;
		
		while (offset < arrayBuffer.byteLength - 8) {
			// Record header (8 bytes)
			let recordNumber = dataView.getInt32(offset, false); // Big endian
			let contentLength = dataView.getInt32(offset + 4, false) * 2; // Big endian, in 16-bit words
			
			offset += 8;
			
			if (offset + contentLength > arrayBuffer.byteLength) {
				break; // Prevent reading beyond file
			}
			
			// Shape record
			let recordShapeType = dataView.getInt32(offset, true); // Little endian
			offset += 4;
			
			// Parse different shape types
			let coords = parseShapeRecord(dataView, offset, contentLength - 4, recordShapeType);
			if (coords && coords.length > 0) {
				allCoordinates = allCoordinates.concat(coords);
			}
			
			offset += contentLength - 4; // Move to next record
		}
			
		console.log('Total coordinate arrays extracted:', allCoordinates.length);
		if (allCoordinates.length > 0) {
			console.log('First coordinate array length:', allCoordinates[0].length);
			if (allCoordinates[0].length > 0) {
				console.log('First coordinate:', allCoordinates[0][0]);
			}
		}
		
		// Convert coordinates to network
		convertCoordinatesToNetwork(allCoordinates, projectionData);
		
		showMessage('Shapefile imported successfully! ' + edges.length + ' road segments loaded.');
		
	} catch (error) {
		console.error('Error parsing shapefile from buffer:', error);
		showMessage('Error parsing shapefile: ' + error.message);
	}
}

// Helper functions for coordinate system detection and transformation
function detectProjectedCoordinates(minLat, maxLat, minLon, maxLon) {
	// Check if coordinates look like they're in a projected system
	// Projected coordinates typically have large values (millions) and are not in degree ranges
	let latRange = Math.abs(maxLat - minLat);
	let lonRange = Math.abs(maxLon - minLon);
	
	// If coordinates are in the millions or have very large ranges, likely projected
	if (Math.abs(minLat) > 1000 || Math.abs(maxLat) > 1000 || 
		Math.abs(minLon) > 1000 || Math.abs(maxLon) > 1000) {
		return true;
	}
	
	// If ranges are very large (typical of projected systems)
	if (latRange > 1000 || lonRange > 1000) {
		return true;
	}
	
	// If coordinates are clearly not in valid lat/lon ranges
	if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
		return true;
	}
	
	return false;
}

function parseProjectionData(projectionData) {
	// Parse WKT (Well-Known Text) projection data
	// This is a basic parser for common projection types
	
	let projection = {
		type: 'Unknown',
		parameters: {}
	};
	
	// Check for common projection types
	if (projectionData.includes('UTM')) {
		projection.type = 'UTM';
		// Extract UTM zone if available
		let zoneMatch = projectionData.match(/UTM zone (\d+)/i);
		if (zoneMatch) {
			projection.parameters.zone = parseInt(zoneMatch[1]);
		}
	} else if (projectionData.includes('Lambert')) {
		projection.type = 'Lambert';
	} else if (projectionData.includes('Mercator')) {
		projection.type = 'Mercator';
	} else if (projectionData.includes('Albers')) {
		projection.type = 'Albers';
	} else if (projectionData.includes('Transverse_Mercator')) {
		projection.type = 'Transverse_Mercator';
	} else {
		projection.type = 'Generic_Projected';
	}
	
	console.log('Parsed projection:', projection);
	return projection;
}

function convertProjectedToLatLon(coordinateArrays, minLat, maxLat, minLon, maxLon, projection) {
	// Use provided projection or fall back to detection
	if (!projection) {
		projection = detectProjection(minLat, maxLat, minLon, maxLon);
		console.log('Detected projection:', projection);
	}
	
	let convertedArrays = [];
	
	try {
		for (let coords of coordinateArrays) {
			let convertedCoords = [];
			for (let coord of coords) {
				let x = coord[1]; // Longitude in projected system
				let y = coord[0]; // Latitude in projected system
				
				// Convert to lat/lon using the projection information
				let latLon = convertToLatLon(x, y, projection);
				convertedCoords.push([latLon.lat, latLon.lon]);
			}
			convertedArrays.push(convertedCoords);
		}
	} catch (error) {
		console.error('Error during coordinate conversion:', error);
		// Return original coordinates if conversion fails
		return coordinateArrays;
	}
	
	return convertedArrays;
}

function detectProjection(minLat, maxLat, minLon, maxLon) {
	// Simple projection detection based on coordinate ranges
	// This is a basic heuristic - for accuracy you'd need the actual projection info from the shapefile
	
	let centerX = (minLon + maxLon) / 2;
	let centerY = (minLat + maxLat) / 2;
	
	// Common UTM zones for different regions
	if (centerX > 0 && centerX < 1000000 && centerY > 5000000 && centerY < 6000000) {
		return 'UTM_Northern_Europe';
	} else if (centerX > 0 && centerX < 1000000 && centerY > 4000000 && centerY < 5000000) {
		return 'UTM_Central_Europe';
	} else if (centerX > 0 && centerX < 1000000 && centerY > 3000000 && centerY < 4000000) {
		return 'UTM_Southern_Europe';
	} else {
		// Default to a generic conversion
		return 'Generic_Projected';
	}
}

function convertToLatLon(x, y, projection) {
	// Handle both string-based and object-based projection formats
	let projectionType = typeof projection === 'string' ? projection : projection.type;
	
	// Validate input coordinates
	if (isNaN(x) || isNaN(y)) {
		console.warn('Invalid coordinates for conversion:', x, y);
		return { lat: 0, lon: 0 };
	}
	
	// Simple conversion functions for common projections
	// This is a basic approximation - for accuracy you'd want proper projection libraries
	
	let lat, lon;
	
	switch (projectionType) {
		case 'UTM':
		case 'UTM_Northern_Europe':
		case 'UTM_Central_Europe':
		case 'UTM_Southern_Europe':
			// Approximate conversion for UTM projections
			// This is a simplified conversion - not accurate for all cases
			lat = y / 111320; // Rough conversion to degrees
			lon = x / (111320 * Math.cos(lat * Math.PI / 180));
			
			// Adjust for UTM zone if available
			if (projection.parameters && projection.parameters.zone) {
				// Basic zone adjustment (this is very approximate)
				let zoneCenterLon = (projection.parameters.zone - 1) * 6 - 180 + 3;
				lon = zoneCenterLon + (lon * 0.1); // Rough adjustment
			}
			break;
			
		case 'Lambert':
		case 'Mercator':
		case 'Albers':
		case 'Transverse_Mercator':
			// Generic conversion for other projections
			lat = y / 111320;
			lon = x / (111320 * Math.cos(lat * Math.PI / 180));
			break;
			
		case 'Generic_Projected':
		default:
			// Generic conversion - very rough approximation
			// This is just a fallback and may not be accurate
			lat = y / 111320;
			lon = x / (111320 * Math.cos(lat * Math.PI / 180));
			break;
	}
	
	// Validate output coordinates
	if (isNaN(lat) || isNaN(lon)) {
		console.warn('Invalid conversion result:', lat, lon, 'for input:', x, y);
		return { lat: 0, lon: 0 };
	}
	
	// Clamp to valid lat/lon ranges
	lat = Math.max(-90, Math.min(90, lat));
	lon = Math.max(-180, Math.min(180, lon));
	
	return { lat: lat, lon: lon };
}

// Helper functions for shape type support
function getShapeTypeName(shapeType) {
	const shapeTypes = {
		0: 'Null Shape',
		1: 'Point',
		3: 'Polyline',
		5: 'Polygon',
		8: 'MultiPoint',
		11: 'PointZ',
		13: 'PolylineZ',
		15: 'PolygonZ',
		18: 'MultiPointZ',
		21: 'PointM',
		23: 'PolylineM',
		25: 'PolygonM',
		28: 'MultiPointM'
	};
	return shapeTypes[shapeType] || 'Unknown (' + shapeType + ')';
}

function isShapeTypeSupported(shapeType) {
	// Support all point and line types that could represent road networks
	const supportedTypes = [1, 3, 5, 8, 11, 13, 15, 18, 21, 23, 25, 28];
	return supportedTypes.includes(shapeType);
}

// Parse any supported shape record
function parseShapeRecord(dataView, offset, contentLength, shapeType) {
	switch (shapeType) {
		case 1: // Point
		case 11: // PointZ
		case 21: // PointM
			return parsePointRecord(dataView, offset, contentLength, shapeType);
		case 3: // Polyline
		case 13: // PolylineZ
		case 23: // PolylineM
			return parsePolylineRecord(dataView, offset, contentLength, shapeType);
		case 5: // Polygon
		case 15: // PolygonZ
		case 25: // PolygonM
			return parsePolygonRecord(dataView, offset, contentLength, shapeType);
		case 8: // MultiPoint
		case 18: // MultiPointZ
		case 28: // MultiPointM
			return parseMultiPointRecord(dataView, offset, contentLength, shapeType);
		default:
			console.warn('Unsupported shape type in record:', shapeType);
			return [];
	}
}

// Parse point record (Point, PointZ, PointM)
function parsePointRecord(dataView, offset, contentLength, shapeType) {
	let coordinates = [];
	
	// Read X, Y coordinates (always present)
	let x = dataView.getFloat64(offset, true); // Longitude
	let y = dataView.getFloat64(offset + 8, true); // Latitude
	offset += 16;
	
	// For Z types, skip Z coordinate
	if (shapeType === 11 || shapeType === 13 || shapeType === 15 || shapeType === 18) {
		offset += 8; // Skip Z coordinate
	}
	
	// For M types, skip M coordinate
	if (shapeType === 21 || shapeType === 23 || shapeType === 25 || shapeType === 28) {
		offset += 8; // Skip M coordinate
	}
	
	// Check for valid coordinates
	if (!isNaN(x) && !isNaN(y)) {
		// For points, create a small line segment to represent the point
		// This allows points to be included in the road network
		let pointCoords = [
			[y, x], // [lat, lon] format
			[y + 0.00001, x + 0.00001] // Small offset to create a line
		];
		coordinates.push(pointCoords);
	}
	
	return coordinates;
}

// Parse multi-point record (MultiPoint, MultiPointZ, MultiPointM)
function parseMultiPointRecord(dataView, offset, contentLength, shapeType) {
	let coordinates = [];
	
	// Skip bounding box (32 bytes)
	offset += 32;
	
	// Number of points
	let numPoints = dataView.getInt32(offset, true);
	offset += 4;
	
	// For Z types, skip Z range
	if (shapeType === 18) {
		offset += 16; // Skip Z min/max
	}
	
	// For M types, skip M range
	if (shapeType === 28) {
		offset += 16; // Skip M min/max
	}
	
	// Read all points
	for (let i = 0; i < numPoints; i++) {
		let x = dataView.getFloat64(offset, true); // Longitude
		let y = dataView.getFloat64(offset + 8, true); // Latitude
		offset += 16;
		
		// For Z types, skip Z coordinate
		if (shapeType === 18) {
			offset += 8;
		}
		
		// For M types, skip M coordinate
		if (shapeType === 28) {
			offset += 8;
		}
		
		// Check for valid coordinates
		if (!isNaN(x) && !isNaN(y)) {
			// Create a small line segment for each point
			let pointCoords = [
				[y, x], // [lat, lon] format
				[y + 0.00001, x + 0.00001] // Small offset to create a line
			];
			coordinates.push(pointCoords);
		}
	}
	
	return coordinates;
}

// Parse polyline record from shapefile
function parsePolylineRecord(dataView, offset, contentLength, shapeType) {
	let coordinates = [];
	
	// Skip bounding box (32 bytes)
	offset += 32;
	
	// Number of parts and points
	let numParts = dataView.getInt32(offset, true);
	let numPoints = dataView.getInt32(offset + 4, true);
	offset += 8;
	
	// Parts array (4 bytes per part)
	let parts = [];
	for (let i = 0; i < numParts; i++) {
		parts.push(dataView.getInt32(offset, true));
		offset += 4;
	}
	
	// For Z types, skip Z range
	if (shapeType === 13 || shapeType === 15) {
		offset += 16; // Skip Z min/max
	}
	
	// For M types, skip M range
	if (shapeType === 23 || shapeType === 25) {
		offset += 16; // Skip M min/max
	}
	
	// Points array (16 bytes per point - X,Y as doubles)
	for (let part = 0; part < numParts; part++) {
		let startPoint = parts[part];
		let endPoint = (part < numParts - 1) ? parts[part + 1] : numPoints;
		
		let partCoords = [];
		for (let i = startPoint; i < endPoint; i++) {
			let x = dataView.getFloat64(offset, true); // Longitude
			let y = dataView.getFloat64(offset + 8, true); // Latitude
			offset += 16;
			
			// For Z types, skip Z coordinate
			if (shapeType === 13 || shapeType === 15) {
				offset += 8;
			}
			
			// For M types, skip M coordinate
			if (shapeType === 23 || shapeType === 25) {
				offset += 8;
			}
			
			// Check for valid coordinates
			if (!isNaN(x) && !isNaN(y)) {
				partCoords.push([y, x]); // [lat, lon] format
			} else {
				console.warn('Invalid coordinate found:', x, y);
			}
		}
		
		if (partCoords.length > 1) {
			coordinates.push(partCoords);
			console.log('Added polyline part with', partCoords.length, 'points');
		}
	}
	
	return coordinates;
}

// Parse polygon record from shapefile (treat as polylines for road networks)
function parsePolygonRecord(dataView, offset, contentLength, shapeType) {
	// Polygons have the same structure as polylines for our purposes
	return parsePolylineRecord(dataView, offset, contentLength, shapeType);
}

// Convert coordinate arrays to network of nodes and edges
function convertCoordinatesToNetwork(coordinateArrays, projectionData = null) {
	let nodeId = 1;
	let wayId = 1;
	
	// Calculate bounds for map positioning
	let minLat = Infinity, maxLat = -Infinity;
	let minLon = Infinity, maxLon = -Infinity;
	
			for (let coords of coordinateArrays) {
			for (let coord of coords) {
				// coord is in [lat, lon] format from parsePolylineRecord
				let lat = coord[0];
				let lon = coord[1];
				minLat = Math.min(minLat, lat);
				maxLat = Math.max(maxLat, lat);
				minLon = Math.min(minLon, lon);
				maxLon = Math.max(maxLon, lon);
			}
		}
	
			// Check if we have valid bounds
		if (minLat === Infinity || maxLat === -Infinity || minLon === Infinity || maxLon === -Infinity) {
			console.error('No valid coordinates found in shapefile');
			showMessage('Error: No valid coordinates found in shapefile');
			return;
		}
		
		// Detect if coordinates are in a projected coordinate system
		let isProjected = detectProjectedCoordinates(minLat, maxLat, minLon, maxLon);
		
		if (isProjected) {
			console.log('Detected projected coordinate system. Converting to lat/lon...');
			
			// Use projection data if available, otherwise use heuristic detection
			let projection = null;
			if (projectionData) {
				projection = parseProjectionData(projectionData);
				console.log('Using projection from .prj file:', projection);
			} else {
				projection = detectProjection(minLat, maxLat, minLon, maxLon);
				console.log('Using detected projection:', projection);
			}
			
			coordinateArrays = convertProjectedToLatLon(coordinateArrays, minLat, maxLat, minLon, maxLon, projection);
			
			// Recalculate bounds after conversion
			minLat = Infinity; maxLat = -Infinity; minLon = Infinity; maxLon = -Infinity;
			for (let coords of coordinateArrays) {
				for (let coord of coords) {
					let lat = coord[0];
					let lon = coord[1];
					minLat = Math.min(minLat, lat);
					maxLat = Math.max(maxLat, lat);
					minLon = Math.min(minLon, lon);
					maxLon = Math.max(maxLon, lon);
				}
			}
		} else {
			console.log('Coordinates appear to be in lat/lon format (no conversion needed)');
		}
		
		console.log('Shapefile bounds:', minLat, maxLat, minLon, maxLon);
		console.log('Number of coordinate arrays:', coordinateArrays.length);
	
	// Add some padding to the bounds
	let latPadding = (maxLat - minLat) * 0.1;
	let lonPadding = (maxLon - minLon) * 0.1;
	minLat -= latPadding;
	maxLat += latPadding;
	minLon -= lonPadding;
	maxLon += lonPadding;
	
	// Set map bounds
	mapminlat = minLat;
	mapmaxlat = maxLat;
	mapminlon = minLon;
	mapmaxlon = maxLon;
	
	// Position the OpenLayers map
	positionMap(minLon, minLat, maxLon, maxLat);
	
	// Convert each coordinate array to connected nodes and edges
	for (let coords of coordinateArrays) {
		if (coords.length < 2) continue;
		
		let prevNode = null;
		
		for (let i = 0; i < coords.length; i++) {
			let coord = coords[i];
			
			// coord is in [lat, lon] format from parsePolylineRecord
			let lat = coord[0];
			let lon = coord[1];
			
			// Create or find existing node at this location
			let node = findOrCreateNode(lat, lon, nodeId++);
			
			// Create edge between previous and current node
			if (prevNode && node !== prevNode) {
				let edge = new Edge(prevNode, node, wayId, 'imported');
				edges.push(edge);
			}
			
			prevNode = node;
		}
		
		wayId++;
	}
	
	// Update coordinates for all nodes now that map bounds are set
	for (let node of nodes) {
		node.updateCoordinates();
	}
	
	// Set first node as start node
	if (nodes.length > 0) {
		startnode = nodes[0];
		closestnodetomouse = 0;
	}
	
	// Calculate total edge distance
	totaledgedistance = 0;
	for (let edge of edges) {
		totaledgedistance += edge.distance;
	}
	
	// Disable map interactions after import
	disableMapInteractions();
	
	// Position canvas properly
	canvas.position(0, 34);
	
	// Set mode to select node mode so user can choose starting point
	mode = selectnodemode;
	showMessage('Data imported! Click on a node to select starting point.');
	
	// Update surface filter UI if it's open
	if (showSurfaceFilter && surfaceFilterUI) {
		updateSurfaceFilterUI();
	}
}

// Find existing node at location or create new one
function findOrCreateNode(lat, lon, nodeId) {
	// Check if a node already exists at this location (within small tolerance)
	let tolerance = 0.00001; // About 1 meter
	
	for (let node of nodes) {
		if (Math.abs(node.lat - lat) < tolerance && Math.abs(node.lon - lon) < tolerance) {
			return node;
		}
	}
	
	// Create new node
	let node = new Node(nodeId, lat, lon);
	nodes.push(node);
	return node;
}

// Disable OpenLayers map interactions after import
function disableMapInteractions() {
	// Get all interactions from the map
	let interactions = openlayersmap.getInteractions();
	
	// Disable all interactions (zoom, pan, etc.)
	interactions.forEach(function(interaction) {
		interaction.setActive(false);
	});
	
	// Also disable map controls
	let controls = openlayersmap.getControls();
	controls.forEach(function(control) {
		if (control.setActive) {
			control.setActive(false);
		}
	});
}

// Position OpenLayers map to show the given bounds (newer version)
function positionMapNew(minLon, minLat, maxLon, maxLat) {
	try {
		// Validate input parameters
		if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) {
			console.error('Invalid coordinates passed to positionMap:', minLon, minLat, maxLon, maxLat);
			return;
		}
		
		// Check if coordinates are in valid ranges
		if (minLon >= maxLon || minLat >= maxLat) {
			console.error('Invalid coordinate bounds:', minLon, minLat, maxLon, maxLat);
			return;
		}
		
		// Calculate center point
		let centerLon = (minLon + maxLon) / 2;
		let centerLat = (minLat + maxLat) / 2;
		
		// Transform to Web Mercator projection
		let center = ol.proj.fromLonLat([centerLon, centerLat]);
		
		// Calculate appropriate zoom level based on bounds
		let lonDiff = maxLon - minLon;
		let latDiff = maxLat - minLat;
		let maxDiff = Math.max(lonDiff, latDiff);
		
		// Rough zoom calculation - adjust as needed
		let zoom = Math.max(1, Math.min(18, 14 - Math.log2(maxDiff)));
		
		// Set the map view
		openlayersmap.getView().setCenter(center);
		openlayersmap.getView().setZoom(zoom);
		
		console.log('Map positioned to bounds:', minLon, minLat, maxLon, maxLat, 'zoom:', zoom);
	} catch (error) {
		console.error('Error positioning map:', error);
	}
}

// Polygon selection functions
function togglePolygonMode() {
	if (mode === choosemapmode) {
		polygonMode = !polygonMode;
		updatePolygonButton();
		
		if (polygonMode) {
			showMessage('Polygon mode: Click points to draw area, press Enter to finish');
			polygonPoints = [];
			isDrawingPolygon = true;
			polygonComplete = false;
		} else {
			showMessage('Rectangle mode: Zoom to selected area, then click here');
			polygonPoints = [];
			isDrawingPolygon = false;
			polygonComplete = false;
		}
	}
}

function updatePolygonButton() {
	let btn = document.getElementById('polygonBtn');
	if (btn) {
		if (polygonMode) {
			btn.style.background = 'rgba(0,100,200,0.8)';
			btn.innerHTML = 'Rectangle Select';
		} else {
			btn.style.background = 'rgba(0,0,0,0.7)';
			btn.innerHTML = 'Polygon Select';
		}
	}
}

function addPolygonPoint(x, y) {
	if (!isDrawingPolygon) return;
	
	// Convert screen coordinates to lat/lon
	let extent = openlayersmap.getView().calculateExtent(openlayersmap.getSize());
	let transformedExtent = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
	
	// Use windowWidth/windowHeight directly to avoid undefined variables
	let canvasWidth = windowWidth || windowX || width;
	let canvasHeight = (windowHeight || windowY || height) - 34;
	
	// Validate that we have valid dimensions and extent
	if (!canvasWidth || !canvasHeight || !transformedExtent) {
		console.error('Invalid canvas dimensions or map extent for polygon point conversion');
		return;
	}
	
	// Check if transformedExtent contains valid numbers
	if (isNaN(transformedExtent[0]) || isNaN(transformedExtent[1]) || 
		isNaN(transformedExtent[2]) || isNaN(transformedExtent[3])) {
		console.error('Invalid transformed extent:', transformedExtent);
		return;
	}
	
	// Check if canvas dimensions are valid
	if (isNaN(canvasWidth) || isNaN(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
		console.error('Invalid canvas dimensions:', canvasWidth, canvasHeight);
		return;
	}
	
	// Check if input coordinates are valid
	if (isNaN(x) || isNaN(y)) {
		console.error('Invalid input coordinates:', x, y);
		return;
	}
	
	let lon = p5.prototype.map(x, 0, canvasWidth, transformedExtent[0], transformedExtent[2]);
	let lat = p5.prototype.map(y, 0, canvasHeight, transformedExtent[3], transformedExtent[1]);
	
	// Check if calculated coordinates are valid
	if (isNaN(lon) || isNaN(lat)) {
		console.error('Invalid calculated coordinates:', lon, lat);
		return;
	}
	
	polygonPoints.push({lat: lat, lon: lon, x: x, y: y});
	
	if (polygonPoints.length >= 3) {
		showMessage('Polygon: ' + polygonPoints.length + ' points. Press Enter to finish.');
	}
}

function completePolygon() {
	if (polygonPoints.length >= 3) {
		polygonComplete = true;
		isDrawingPolygon = false;
		showMessage('Polygon complete! Click here to load data for this area.');
	} else {
		showMessage('Need at least 3 points to complete polygon.');
	}
}

function drawPolygon() {
	if (polygonPoints.length < 2) return;
	
	// Draw polygon outline
	stroke(255, 100, 100, 0.8);
	strokeWeight(2);
	fill(255, 100, 100, 0.1);
	
	beginShape();
	for (let point of polygonPoints) {
		vertex(point.x, point.y - 34); // Adjust for header
	}
	if (polygonComplete) {
		endShape(CLOSE);
	} else {
		endShape();
	}
	
	// Draw points
	fill(255, 100, 100, 1);
	noStroke();
	for (let point of polygonPoints) {
		ellipse(point.x, point.y - 34, 8, 8);
	}
}

// Point-in-polygon test using ray casting algorithm
function pointInPolygon(lat, lon, polygon) {
	let x = lon, y = lat;
	let inside = false;
	
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		let xi = polygon[i].lon, yi = polygon[i].lat;
		let xj = polygon[j].lon, yj = polygon[j].lat;
		
		if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	
	return inside;
}

// Check if a line segment intersects with a polygon
function lineIntersectsPolygon(fromLat, fromLon, toLat, toLon, polygon) {
	// First check if either endpoint is inside the polygon
	if (pointInPolygon(fromLat, fromLon, polygon) || pointInPolygon(toLat, toLon, polygon)) {
		return true;
	}
	
	// Then check if the line segment intersects any polygon edge
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		let polyEdgeFromLat = polygon[j].lat;
		let polyEdgeFromLon = polygon[j].lon;
		let polyEdgeToLat = polygon[i].lat;
		let polyEdgeToLon = polygon[i].lon;
		
		if (lineSegmentsIntersect(fromLat, fromLon, toLat, toLon, 
								 polyEdgeFromLat, polyEdgeFromLon, polyEdgeToLat, polyEdgeToLon)) {
			return true;
		}
	}
	
	return false;
}

// Check if two line segments intersect
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
	// Calculate the orientation of three points
	function orientation(px, py, qx, qy, rx, ry) {
		let val = (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
		if (val === 0) return 0; // Collinear
		return (val > 0) ? 1 : 2; // Clockwise or counterclockwise
	}
	
	// Check if point q lies on segment pr
	function onSegment(px, py, qx, qy, rx, ry) {
		return (qx <= Math.max(px, rx) && qx >= Math.min(px, rx) &&
				qy <= Math.max(py, ry) && qy >= Math.min(py, ry));
	}
	
	let o1 = orientation(x1, y1, x2, y2, x3, y3);
	let o2 = orientation(x1, y1, x2, y2, x4, y4);
	let o3 = orientation(x3, y3, x4, y4, x1, y1);
	let o4 = orientation(x3, y3, x4, y4, x2, y2);
	
	// General case
	if (o1 !== o2 && o3 !== o4) return true;
	
	// Special cases for collinear segments
	if (o1 === 0 && onSegment(x1, y1, x3, y3, x2, y2)) return true;
	if (o2 === 0 && onSegment(x1, y1, x4, y4, x2, y2)) return true;
	if (o3 === 0 && onSegment(x3, y3, x1, y1, x4, y4)) return true;
	if (o4 === 0 && onSegment(x3, y3, x2, y2, x4, y4)) return true;
	
	return false;
}

// Add segment functionality
function toggleAddSegmentMode() {
	if (mode === addsegmentmode) {
		// Exit add segment mode and restore previous mode
		mode = previousMode || selectnodemode;
		addSegmentMode = false;
		firstNodeForSegment = null;
		secondNodeForSegment = null;
		tempSegmentPreview = null;
		previousMode = null;
		
		// Restore appropriate message and network state based on restored mode
		if (mode === trimmode) {
			let message = 'Click on roads to trim, then click here. Press Ctrl+Z to undo.';
			if (polygonMode && polygonComplete) {
				message += ' (Polygon mode: Roads intersecting your selected area will be preserved)';
			}
			showMessage(message);
			// Recalculate closest node for trim mode
			showNodes();
			// Refresh network display to ensure proper edge rendering
			refreshNetworkDisplay();
		} else if (mode === solveRESmode) {
			showMessage('Calculating… Click to stop when satisfied');
			// Ensure we have a valid start node for route calculation
			showNodes();
			// Refresh network display to ensure proper edge rendering
			refreshNetworkDisplay();
		} else if (mode === downloadGPXmode) {
			hideMessage();
		} else {
		showMessage('Add segment mode disabled');
			// Refresh network display to ensure proper edge rendering
			refreshNetworkDisplay();
		}
		
		updateAddSegmentButton();
	} else {
		// Enter add segment mode and save current mode
		previousMode = mode;
		mode = addsegmentmode;
		addSegmentMode = true;
		firstNodeForSegment = null;
		secondNodeForSegment = null;
		tempSegmentPreview = null;
		showMessage('Add segment mode: Click to place first node, then click to place second node');
		updateAddSegmentButton();
	}
}

function addSegmentBetweenNodes(node1, node2) {
	if (!node1 || !node2 || node1 === node2) {
		console.warn('Invalid nodes for segment creation');
		return false;
	}
	
	// Check if segment already exists
	for (let edge of edges) {
		if ((edge.from === node1 && edge.to === node2) || 
			(edge.from === node2 && edge.to === node1)) {
			console.warn('Segment already exists between these nodes');
			showMessage('Segment already exists between these nodes');
			return false;
		}
	}
	
	// Create new edge
	let newEdge = new Edge(node1, node2, 'manual_' + Date.now(), 'unknown');
	edges.push(newEdge);
	
	// Recalculate total edge distance
	totaledgedistance += newEdge.distance;
	
	// Recalculate orphan nodes to ensure network connectivity
	if (previousMode === trimmode || previousMode === solveRESmode) {
		removeOrphans();
	}
	
	console.log('Added new segment between nodes:', node1.nodeId, 'and', node2.nodeId);
	showMessage('Segment added successfully!');
	return true;
}

function createNodeAtPosition(x, y) {
	// Convert screen coordinates to lat/lon
	let lon = p5.prototype.map(x, 0, mapWidth, mapminlon, mapmaxlon);
	let lat = p5.prototype.map(y, mapHeight, 0, mapminlat, mapmaxlat);
	
	// Create new node
	let newNode = new Node(nextNodeId++, lat, lon);
	nodes.push(newNode);
	
	console.log('Created new node at:', lat, lon, 'with ID:', newNode.nodeId);
	return newNode;
}

function findClosestNode(x, y, maxDistance = 20) {
	let closestNode = null;
	let closestDistance = Infinity;
	
	for (let node of nodes) {
		let distance = dist(x, y, node.x, node.y);
		if (distance < closestDistance && distance < maxDistance) {
			closestDistance = distance;
			closestNode = node;
		}
	}
	
	return closestNode;
}

function updateAddSegmentButton() {
	let button = document.getElementById('addSegmentButton');
	if (button) {
		if (mode === addsegmentmode) {
			button.style.backgroundColor = '#ff6b6b';
			button.textContent = 'Exit Add Segment';
		} else {
			button.style.backgroundColor = '#4CAF50';
			button.textContent = 'Add Segment';
		}
	}
}

function handleAddSegmentClick(x, y) {
	// First, try to find if there's an existing node nearby
	let closestNode = findClosestNode(x, y, 20);
	
	if (!firstNodeForSegment) {
		// First click - select or create first node
		if (closestNode) {
			// Use existing node
			firstNodeForSegment = closestNode;
			showMessage('First node selected. Click to place second node.');
		} else {
			// Create new node
			firstNodeForSegment = createNodeAtPosition(x, y);
			showMessage('First node created. Click to place second node.');
		}
	} else {
		// Second click - select or create second node and create segment
		let secondNode = null;
		
		if (closestNode) {
			// Use existing node
			secondNode = closestNode;
		} else {
			// Create new node
			secondNode = createNodeAtPosition(x, y);
		}
		
		// Create the segment
		if (addSegmentBetweenNodes(firstNodeForSegment, secondNode)) {
			// Reset for next segment
			firstNodeForSegment = null;
			secondNodeForSegment = null;
			showMessage('Segment added! Click to place first node for next segment.');
		}
	}
}

function drawAddSegmentFeedback() {
	// Highlight the first node if selected
	if (firstNodeForSegment) {
		// Draw a larger circle around the first node
		noStroke();
		fill(255, 255, 0, 0.8); // Yellow highlight
		ellipse(firstNodeForSegment.x, firstNodeForSegment.y, 20, 20);
		
		// Draw a line from first node to mouse cursor
		stroke(255, 255, 0, 0.6);
		strokeWeight(3);
		line(firstNodeForSegment.x, firstNodeForSegment.y, mouseX, mouseY);
		noStroke();
	}
	
	// Show potential connection points (existing nodes near mouse)
	let closestNode = findClosestNode(mouseX, mouseY, 30);
	if (closestNode && closestNode !== firstNodeForSegment) {
		// Highlight potential connection node
		noStroke();
		fill(0, 255, 0, 0.8); // Green highlight
		ellipse(closestNode.x, closestNode.y, 15, 15);
	}
}

// Calculate statistics for each surface type
function calculateSurfaceStats() {
	surfaceFilterStats = {};
	let totalEdges = edges.length;
	
	if (totalEdges === 0) return;
	
	// Count edges by surface type
	for (let edge of edges) {
		let surface = edge.surface;
		if (!surfaceFilterStats[surface]) {
			surfaceFilterStats[surface] = { count: 0, percentage: 0 };
		}
		surfaceFilterStats[surface].count++;
	}
	
	// Calculate percentages
	for (let surface in surfaceFilterStats) {
		surfaceFilterStats[surface].percentage = (surfaceFilterStats[surface].count / totalEdges) * 100;
	}
}

// Toggle surface preview mode
function toggleSurfacePreview(surfaceType) {
	if (surfacePreviewMode && surfacePreviewType === surfaceType) {
		// Turn off preview mode
		surfacePreviewMode = false;
		surfacePreviewType = null;
		showMessage('Surface preview disabled');
	} else {
		// Check if this surface type still exists in the current data
		if (!surfaceFilterStats[surfaceType] || surfaceFilterStats[surfaceType].count === 0) {
			showMessage(`No ${surfaceType.replace('_', ' ')} surfaces found in current data. Try applying different filters.`);
			return;
		}
		
		// Turn on preview mode for this surface
		surfacePreviewMode = true;
		surfacePreviewType = surfaceType;
		showMessage(`Previewing ${surfaceType.replace('_', ' ')} surfaces (${surfaceFilterStats[surfaceType].count} roads)`);
	}
}

// Draw surface preview status
function drawSurfacePreviewStatus() {
	if (surfacePreviewMode && surfacePreviewType) {
		// Draw preview status in top-left corner
		fill(0, 0, 0, 0.8);
		noStroke();
		rect(10, 80, 250, 60, 5);
		
		fill(255, 255, 0);
		textAlign(LEFT);
		textSize(12);
		text('Surface Preview Active', 15, 100);
		text(`Type: ${surfacePreviewType.replace('_', ' ')}`, 15, 115);
		text(`Count: ${surfaceFilterStats[surfacePreviewType] ? surfaceFilterStats[surfacePreviewType].count : 0} roads`, 15, 130);
	}
}

// Draw surface color legend
function drawSurfaceLegend() {
	if (edges.length === 0) return;
	
	// Draw legend in bottom-right corner
	let legendX = width - 200;
	let legendY = height - 200;
	let legendWidth = 180;
	let legendHeight = 180;
	
	fill(0, 0, 0, 0.8);
	noStroke();
	rect(legendX, legendY, legendWidth, legendHeight, 5);
	
	fill(255, 255, 255);
	textAlign(LEFT);
	textSize(12);
	text('Surface Types', legendX + 10, legendY + 20);
	
	let yOffset = 35;
	let xOffset = 10;
	
	// If in preview mode, show the specific surface being previewed
	if (surfacePreviewMode && surfacePreviewType) {
		// Draw the previewed surface type
		if (surfaceColorMap[surfacePreviewType]) {
			let color = surfaceColorMap[surfacePreviewType];
			fill(color[0], color[1], color[2], color[3]);
			noStroke();
			rect(legendX + xOffset, legendY + yOffset - 8, 12, 12);
		}
		
		// Draw the specific surface name
		fill(255, 255, 0); // Yellow text for preview mode
		textSize(10);
		text(surfacePreviewType.replace('_', ' '), legendX + xOffset + 15, legendY + yOffset);
		yOffset += 20;
		
		// Add preview indicator
		fill(255, 255, 0);
		textSize(9);
		text('(Preview Mode)', legendX + xOffset + 15, legendY + yOffset);
		yOffset += 15;
	} else {
		// Show the specific surface types that are currently present in the data
		let visibleSurfaces = [];
		
		// Find all surface types that have roads in the current data
		for (let surface in surfaceFilterStats) {
			if (surfaceFilterStats[surface] && surfaceFilterStats[surface].count > 0) {
				visibleSurfaces.push(surface);
			}
		}
		
		// Sort surfaces by count (most common first)
		visibleSurfaces.sort((a, b) => surfaceFilterStats[b].count - surfaceFilterStats[a].count);
		
		// Show each visible surface type
		for (let surface of visibleSurfaces) {
			// Draw color indicator
			if (surfaceColorMap[surface]) {
				let color = surfaceColorMap[surface];
				fill(color[0], color[1], color[2], color[3]);
				noStroke();
				rect(legendX + xOffset, legendY + yOffset - 8, 12, 12);
			}
			
			// Draw surface name
			fill(255, 255, 255);
			textSize(10);
			text(surface.replace('_', ' '), legendX + xOffset + 15, legendY + yOffset);
			
			// Draw count
			fill(200, 200, 200);
			textSize(9);
			text(`(${surfaceFilterStats[surface].count})`, legendX + xOffset + 15, legendY + yOffset + 10);
			
			yOffset += 25;
		}
		
		// If no surfaces are visible, show a message
		if (visibleSurfaces.length === 0) {
			fill(255, 255, 255);
			textSize(10);
			text('No surfaces visible', legendX + xOffset + 15, legendY + yOffset);
		}
	}
	
	// Add legend toggle hint
	fill(200, 200, 200);
	textSize(9);
	text('Press S for Surface Filters', legendX + 10, legendY + legendHeight - 10);
}

function refreshNetworkDisplay() {
	// Ensure all nodes have updated coordinates
	for (let node of nodes) {
		node.updateCoordinates();
	}
	
	// Reset edge travels to ensure proper display
	resetEdges();
	
	// Recalculate closest node
	showNodes();
	
	// Force redraw of edges
	showEdges();
}
