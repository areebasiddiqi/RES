# GPX and Shapefile Import Feature

## Overview
The RES (Run Every Street) application now supports importing external road data from GPX files and Shapefiles, allowing you to analyze custom route networks beyond OpenStreetMap data.

## Supported Formats

### GPX Files (.gpx)
- **Tracks** (`<trk>` elements): GPS tracks recorded during activities
- **Routes** (`<rte>` elements): Planned routes with waypoints
- **Track Points**: Individual GPS coordinates that form the road network

### Shapefiles (.shp, .zip)
- **Status**: Partially implemented (placeholder for future development)
- **Note**: Currently shows message to use GPX format instead
- **Future**: Will support ESRI Shapefiles containing line geometries

## How to Use

### 1. Access Import Feature
- Click the **"Import File"** button in the top-right corner of the interface
- This opens the file import dialog

### 2. Select File
- Choose a GPX file (.gpx extension)
- Supported sources: GPS devices, route planning software, fitness apps
- File size limit: Depends on browser memory (typically several MB)

### 3. Import Process
- File is parsed to extract track/route coordinates
- Coordinates are converted to nodes (intersections) and edges (road segments)
- Map automatically zooms to fit the imported data
- Network statistics are calculated

### 4. Continue with Analysis
- After import, click on any node to select starting point
- Proceed with normal RES workflow: trim roads, solve route, export GPX

## Technical Details

### Data Conversion
- **Coordinate Tolerance**: 0.00001 degrees (~1 meter) for node deduplication
- **Node Creation**: Automatic merging of nearby coordinates
- **Edge Creation**: Sequential points in tracks/routes become connected road segments
- **Way IDs**: Auto-generated for imported segments

### Map Integration
- Imported data replaces OpenStreetMap data
- Map bounds automatically adjusted to fit imported network
- OpenLayers map repositioned to show full network extent

## Sample Data
A sample GPX file (`sample_roads.gpx`) is included demonstrating:
- Multiple tracks forming a connected road network
- Intersections where tracks meet
- Loop roads for comprehensive route testing

## Limitations
- **Shapefile Support**: Not yet fully implemented
- **File Size**: Large files may cause browser performance issues
- **Coordinate Systems**: Assumes WGS84 (GPS standard)
- **Road Attributes**: Limited to basic connectivity (no road types, speeds, etc.)

## Future Enhancements
1. **Full Shapefile Support**: Complete implementation with shapefile.js library
2. **KML/KMZ Support**: Google Earth format compatibility
3. **Road Attributes**: Import road names, types, surface information
4. **Batch Import**: Multiple file support
5. **Data Validation**: Better error handling and format checking

## Troubleshooting

### Common Issues
- **"No track or route data found"**: GPX file may contain only waypoints, not tracks/routes
- **"Error parsing GPX file"**: File may be corrupted or use unsupported GPX extensions
- **Empty network**: Check that GPX contains connected track segments

### File Requirements
- Valid XML structure
- Contains `<trk>` or `<rte>` elements
- Track points have lat/lon attributes
- Minimum 2 points per track for edge creation

## Example GPX Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Main Road</name>
    <trkseg>
      <trkpt lat="47.2600" lon="5.9500"/>
      <trkpt lat="47.2610" lon="5.9510"/>
      <trkpt lat="47.2620" lon="5.9520"/>
    </trkseg>
  </trk>
</gpx>
```

This feature enables analysis of custom road networks, private trails, planned routes, or any GPS-tracked path data for comprehensive route efficiency analysis.
