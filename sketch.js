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
	polygonmode = 7;
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

// Surface filtering variables
var surfaceFilters = {
	'paved': true,
	'asphalt': true,
	'concrete': true,
	'paving_stones': true,
	'sett': true,
	'cobblestone': true,
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
					shuffle(currentnode.edges, true);
					currentnode.edges.sort((a, b) => a.travels - b.travels); // sort edges around node by number of times traveled, and travel down least.
					let edgewithleasttravels = currentnode.edges[0];
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
							// Check if both nodes are inside the polygon
							let fromInside = pointInPolygon(fromnode.lat, fromnode.lon, polygonPoints);
							let toInside = pointInPolygon(tonode.lat, tonode.lon, polygonPoints);
							// Include edge if both endpoints are inside polygon
							includeEdge = fromInside && toInside;
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
		edges[i].show();
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
	for (let i = 0; i < edges.length; i++) {
		if (edges[i].travels > 0) {
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
	edges = newedges;
	nodes = newnodes;
	resetEdges();
}

function floodfill(node, stepssofar) {
	for (let i = 0; i < node.edges.length; i++) {
		if (node.edges[i].travels == 0) {
			node.edges[i].travels = stepssofar;
			floodfill(node.edges[i].OtherNodeofEdge(node), stepssofar + 1);
		}
	}
}

function solveRES() {
	removeOrphans();
	showRoads = false;
	remainingedges = edges.length;
	currentroute = new Route(currentnode, null);
	bestroute = new Route(currentnode, null);
	bestdistance = Infinity;
	iterations = 0;
	iterationsperframe = 1;
	starttime = millis();
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
		showMessage('Click on roads to trim, then click here. Press Ctrl+Z to undo.');
		removeOrphans(); // deletes parts of the network that cannot be reached from start
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
	
	showMessage('Undo successful - restored ' + edges.length + ' road segments');
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
	surfaceFilterUI.style('width', '250px');
	surfaceFilterUI.style('max-height', '400px');
	surfaceFilterUI.style('overflow-y', 'auto');
	surfaceFilterUI.style('background', 'rgba(0, 0, 0, 0.8)');
	surfaceFilterUI.style('color', 'white');
	surfaceFilterUI.style('padding', '10px');
	surfaceFilterUI.style('border-radius', '5px');
	surfaceFilterUI.style('font-family', '"Lucida Sans Unicode", "Lucida Grande", sans-serif');
	surfaceFilterUI.style('font-size', '12px');
	
	let title = createDiv('Surface Filters');
	title.style('font-weight', 'bold');
	title.style('margin-bottom', '10px');
	title.style('text-align', 'center');
	title.parent(surfaceFilterUI);
	
	// Add toggle all buttons
	let toggleAllDiv = createDiv('');
	toggleAllDiv.style('margin-bottom', '10px');
	toggleAllDiv.style('text-align', 'center');
	toggleAllDiv.parent(surfaceFilterUI);
	
	let selectAllBtn = createButton('Select All');
	selectAllBtn.style('margin-right', '5px');
	selectAllBtn.style('padding', '2px 8px');
	selectAllBtn.style('font-size', '10px');
	selectAllBtn.mousePressed(() => {
		for (let surface in surfaceFilters) {
			surfaceFilters[surface] = true;
		}
		updateSurfaceFilterUI();
	});
	selectAllBtn.parent(toggleAllDiv);
	
	let deselectAllBtn = createButton('Deselect All');
	deselectAllBtn.style('padding', '2px 8px');
	deselectAllBtn.style('font-size', '10px');
	deselectAllBtn.mousePressed(() => {
		for (let surface in surfaceFilters) {
			surfaceFilters[surface] = false;
		}
		updateSurfaceFilterUI();
	});
	deselectAllBtn.parent(toggleAllDiv);
	
	// Create checkboxes for each surface type
	for (let surface in surfaceFilters) {
		let checkboxDiv = createDiv('');
		checkboxDiv.style('margin-bottom', '5px');
		checkboxDiv.parent(surfaceFilterUI);
		
		let checkbox = createCheckbox(surface.replace('_', ' '), surfaceFilters[surface]);
		checkbox.style('color', 'white');
		checkbox.changed(() => {
			surfaceFilters[surface] = checkbox.checked();
		});
		checkbox.parent(checkboxDiv);
	}
	
	// Add apply filters button
	let applyBtn = createButton('Apply Filters');
	applyBtn.style('width', '100%');
	applyBtn.style('margin-top', '10px');
	applyBtn.style('padding', '5px');
	applyBtn.style('background-color', '#4CAF50');
	applyBtn.style('color', 'white');
	applyBtn.mousePressed(() => {
		reloadDataWithFilters();
	});
	applyBtn.parent(surfaceFilterUI);
	
	// Add close button
	let closeBtn = createButton('Close');
	closeBtn.style('width', '100%');
	closeBtn.style('margin-top', '5px');
	closeBtn.style('padding', '5px');
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
			
			zip.forEach(function(relativePath, zipEntry) {
				if (relativePath.toLowerCase().endsWith('.shp')) {
					shpFile = zipEntry;
					shpFileName = relativePath;
				}
			});
			
			if (!shpFile) {
				showMessage('No .shp file found in ZIP archive. Please ensure the archive contains a shapefile.');
				return;
			}
			
			showMessage('Found shapefile: ' + shpFileName + '. Extracting...');
			
			// Extract the .shp file as ArrayBuffer
			shpFile.async('arraybuffer').then(function(shpData) {
						// Parse the extracted shapefile data
		console.log('Parsing shapefile binary data, size:', shpData.byteLength);
		parseShapefileBinaryFromBuffer(shpData, shpFileName);
				
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
function parseShapefileBinaryFromBuffer(arrayBuffer, fileName) {
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
		
		// Check if shape type is supported (we want polylines/lines)
		if (shapeType !== 3 && shapeType !== 5) { // 3 = Polyline, 5 = Polygon
			showMessage('Shapefile contains shape type ' + shapeType + '. Only Polyline (3) and Polygon (5) are supported for road networks.');
			return;
		}
		
		showMessage('Parsing shapefile with shape type: ' + (shapeType === 3 ? 'Polyline' : 'Polygon'));
		
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
			
			if (recordShapeType === 3) { // Polyline
				let coords = parsePolylineRecord(dataView, offset, contentLength - 4);
				allCoordinates = allCoordinates.concat(coords);
			} else if (recordShapeType === 5) { // Polygon
				let coords = parsePolygonRecord(dataView, offset, contentLength - 4);
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
		convertCoordinatesToNetwork(allCoordinates);
		
		showMessage('Shapefile imported successfully! ' + edges.length + ' road segments loaded.');
		
	} catch (error) {
		console.error('Error parsing shapefile from buffer:', error);
		showMessage('Error parsing shapefile: ' + error.message);
	}
}

// Parse polyline record from shapefile
function parsePolylineRecord(dataView, offset, contentLength) {
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
	
	// Points array (16 bytes per point - X,Y as doubles)
	for (let part = 0; part < numParts; part++) {
		let startPoint = parts[part];
		let endPoint = (part < numParts - 1) ? parts[part + 1] : numPoints;
		
		let partCoords = [];
		for (let i = startPoint; i < endPoint; i++) {
			let x = dataView.getFloat64(offset, true); // Longitude
			let y = dataView.getFloat64(offset + 8, true); // Latitude
			
			// Check for valid coordinates
			if (!isNaN(x) && !isNaN(y)) {
				partCoords.push([y, x]); // [lat, lon] format
			} else {
				console.warn('Invalid coordinate found:', x, y);
			}
			offset += 16;
		}
		
		if (partCoords.length > 1) {
			coordinates.push(partCoords);
			console.log('Added polyline part with', partCoords.length, 'points');
		}
	}
	
	return coordinates;
}

// Parse polygon record from shapefile (treat as polylines for road networks)
function parsePolygonRecord(dataView, offset, contentLength) {
	// Polygons have the same structure as polylines for our purposes
	return parsePolylineRecord(dataView, offset, contentLength);
}

// Convert coordinate arrays to network of nodes and edges
function convertCoordinatesToNetwork(coordinateArrays) {
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
