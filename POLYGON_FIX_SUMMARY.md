# Polygon Selection Bug Fix

## Problem Description
The polygon selection feature was experiencing a bug where roads would disappear after selecting a start point outside the polygon area. This happened because:

1. **Original filtering logic**: The code only included edges where **both endpoints** were inside the polygon
2. **Orphan removal**: When a start point outside the polygon was selected, the `removeOrphans()` function would remove all roads that couldn't be reached from the start point
3. **Result**: Roads inside the polygon were lost because they couldn't be reached from the external start point

## Root Cause
The issue was in the polygon filtering logic in `getOverpassData()` function (lines 270-275 in sketch.js):

```javascript
// OLD CODE - Only included edges where both endpoints were inside
let fromInside = pointInPolygon(fromnode.lat, fromnode.lon, polygonPoints);
let toInside = pointInPolygon(tonode.lat, tonode.lon, polygonPoints);
includeEdge = fromInside && toInside; // BOTH must be inside
```

## Solution Implemented

### 1. Enhanced Polygon Filtering
Changed the filtering logic to include edges that **intersect** with the polygon:

```javascript
// NEW CODE - Include edges that intersect the polygon
includeEdge = lineIntersectsPolygon(fromnode.lat, fromnode.lon, 
                                   tonode.lat, tonode.lon, polygonPoints);
```

### 2. Added Line-Polygon Intersection Detection
Implemented sophisticated intersection detection that checks:
- If either endpoint is inside the polygon
- If the line segment crosses through the polygon

```javascript
function lineIntersectsPolygon(fromLat, fromLon, toLat, toLon, polygon) {
    // Check if either endpoint is inside
    if (pointInPolygon(fromLat, fromLon, polygon) || 
        pointInPolygon(toLat, toLon, polygon)) {
        return true;
    }
    
    // Check if line crosses polygon edges
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (lineSegmentsIntersect(fromLat, fromLon, toLat, toLon, 
                                 polygon[j].lat, polygon[j].lon, 
                                 polygon[i].lat, polygon[i].lon)) {
            return true;
        }
    }
    return false;
}
```

### 3. Enhanced Orphan Removal
Modified `removeOrphans()` to preserve polygon-intersecting edges even when they can't be reached from the start point:

```javascript
// If polygon mode is active, also keep edges that intersect with the polygon
if (keepPolygonEdges && !shouldKeep) {
    let intersects = lineIntersectsPolygon(edges[i].from.lat, edges[i].from.lon, 
                                         edges[i].to.lat, edges[i].to.lon, polygonPoints);
    if (intersects) {
        shouldKeep = true;
        preservedCount++;
    }
}
```

### 4. Visual Feedback
Added visual indicators for polygon-preserved edges:
- Different color (cyan) for edges preserved due to polygon intersection
- Console logging to track how many edges are preserved
- Updated user messages to explain polygon mode behavior

### 5. Improved User Experience
- Added informative messages when polygon mode is active
- Visual distinction between reachable and polygon-preserved edges
- Better feedback about what's happening during the process

## Testing
Created `test_polygon.html` to verify the intersection logic works correctly with various test cases:
- Points inside/outside polygons
- Line segments crossing through polygons
- Line segments completely outside polygons

## Benefits
1. **Fixes the bug**: Roads no longer disappear when selecting start points outside the polygon
2. **More flexible**: Users can now select start points anywhere and still access roads inside their selected area
3. **Better UX**: Clear visual feedback and informative messages
4. **Robust logic**: Handles edge cases like roads that cross polygon boundaries

## Files Modified
- `sketch.js`: Main application logic
- `test_polygon.html`: Test suite for polygon intersection logic
- `POLYGON_FIX_SUMMARY.md`: This documentation

The fix ensures that when using polygon selection, roads intersecting the selected area are preserved regardless of where the start point is chosen, providing a much more intuitive and reliable user experience. 