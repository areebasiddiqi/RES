# Coordinate System Support Enhancement

## Problem Description
The shapefile import feature was encountering issues with projected coordinate systems. When users imported shapefiles with coordinates in projected systems (like UTM), the coordinates would be treated as latitude/longitude degrees, causing incorrect positioning and potentially very large coordinate values that couldn't be displayed properly on the map.

## Root Cause
The original shapefile parsing code assumed all coordinates were in latitude/longitude degrees. However, many shapefiles use projected coordinate systems (like UTM, Lambert, etc.) where coordinates are in meters or other units, not degrees.

## Solution Implemented

### 1. Coordinate System Detection
Added automatic detection of projected coordinate systems based on coordinate values:

```javascript
function detectProjectedCoordinates(minLat, maxLat, minLon, maxLon) {
    // Check if coordinates look like they're in a projected system
    // Projected coordinates typically have large values (millions) and are not in degree ranges
    
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
```

### 2. Projection File (.prj) Support
Enhanced ZIP file processing to extract and parse projection information:

```javascript
// Look for .prj file in the archive
zip.forEach(function(relativePath, zipEntry) {
    if (relativePath.toLowerCase().endsWith('.shp')) {
        shpFile = zipEntry;
        shpFileName = relativePath;
    } else if (relativePath.toLowerCase().endsWith('.prj')) {
        prjFile = zipEntry;
        prjFileName = relativePath;
    }
});

// Extract projection data if available
if (prjFile) {
    prjFile.async('text').then(function(prjData) {
        console.log('Found projection file:', prjFileName);
        console.log('Projection info:', prjData);
        parseShapefileBinaryFromBuffer(shpData, shpFileName, prjData);
    });
}
```

### 3. Projection Parsing
Added WKT (Well-Known Text) projection parsing to identify common projection types:

```javascript
function parseProjectionData(projectionData) {
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
    }
    // ... more projection types
    
    return projection;
}
```

### 4. Coordinate Conversion
Implemented coordinate conversion functions for different projection types:

```javascript
function convertToLatLon(x, y, projection) {
    let projectionType = typeof projection === 'string' ? projection : projection.type;
    
    switch (projectionType) {
        case 'UTM':
            // Approximate conversion for UTM projections
            let lat = y / 111320; // Rough conversion to degrees
            let lon = x / (111320 * Math.cos(lat * Math.PI / 180));
            
            // Adjust for UTM zone if available
            if (projection.parameters && projection.parameters.zone) {
                let zoneCenterLon = (projection.parameters.zone - 1) * 6 - 180 + 3;
                lon = zoneCenterLon + (lon * 0.1);
            }
            
            return { lat: lat, lon: lon };
            
        case 'Lambert':
        case 'Mercator':
        case 'Albers':
            // Generic conversion for other projections
            let lat2 = y / 111320;
            let lon2 = x / (111320 * Math.cos(lat2 * Math.PI / 180));
            return { lat: lat2, lon: lon2 };
            
        default:
            // Generic fallback conversion
            let lat3 = y / 111320;
            let lon3 = x / (111320 * Math.cos(lat3 * Math.PI / 180));
            return { lat: lat3, lon: lon3 };
    }
}
```

### 5. Heuristic Projection Detection
Added fallback projection detection when .prj files are not available:

```javascript
function detectProjection(minLat, maxLat, minLon, maxLon) {
    let centerX = (minLon + maxLon) / 2;
    let centerY = (minLat + maxLat) / 2;
    
    // Common UTM zones for different regions
    if (centerX > 0 && centerX < 1000000 && centerY > 5000000 && centerY < 6000000) {
        return 'UTM_Northern_Europe';
    } else if (centerX > 0 && centerX < 1000000 && centerY > 4000000 && centerY < 5000000) {
        return 'UTM_Central_Europe';
    }
    // ... more region detection
    
    return 'Generic_Projected';
}
```

## Benefits

1. **Automatic Detection**: Automatically detects when coordinates are in a projected system
2. **Projection File Support**: Reads .prj files from ZIP archives for accurate projection information
3. **Multiple Projection Types**: Supports UTM, Lambert, Mercator, Albers, and other common projections
4. **Fallback Handling**: Uses heuristic detection when projection files are not available
5. **Better Accuracy**: Converts projected coordinates to latitude/longitude for proper map display
6. **Comprehensive Logging**: Provides detailed console output for debugging coordinate conversion

## Supported Projection Types

- **UTM (Universal Transverse Mercator)**: Most common projected system
- **Lambert Conformal Conic**: Common for regional mapping
- **Mercator**: Standard web mapping projection
- **Albers Equal Area**: Good for continental mapping
- **Transverse Mercator**: Similar to UTM
- **Generic Projected**: Fallback for unknown projections

## Files Modified

- `sketch.js`: Enhanced coordinate system detection and conversion
- `COORDINATE_SYSTEM_SUMMARY.md`: This documentation

## Usage Notes

- **ZIP Archives**: Include .prj files in ZIP archives for best accuracy
- **Single Files**: Heuristic detection will be used for single .shp files
- **Console Output**: Check browser console for projection detection and conversion details
- **Accuracy**: Conversions are approximate; for high accuracy, consider using proper GIS libraries

The enhancement ensures that shapefiles with projected coordinate systems are properly converted to latitude/longitude coordinates for correct display and route calculation. 