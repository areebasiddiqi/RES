# Polygon Selection Feature

## Overview
The RES application now supports polygon-based area selection for more precise road network filtering, in addition to the existing rectangular bounding box selection.

## How to Use

### 1. Enable Polygon Mode
- Click the **"Polygon Select"** button in the top-right corner
- Button changes to blue and shows "Rectangle Select" when active
- Message appears: "Polygon mode: Click points to draw area, double-click to finish"

### 2. Draw Polygon
- **Click** on the map to add polygon vertices
- **Continue clicking** to add more points (minimum 3 required)
- **Double-click** to complete the polygon
- Polygon appears as red outline with semi-transparent fill

### 3. Load Data
- Once polygon is complete, click the main button to load OpenStreetMap data
- Only roads within the polygon area will be loaded
- Proceed with normal RES workflow (select start node, trim roads, solve route)

### 4. Switch Back to Rectangle Mode
- Click **"Rectangle Select"** button to return to normal rectangular selection
- Clears any existing polygon

## Technical Implementation

### Core Components
1. **Polygon Drawing**: Interactive point-by-point polygon creation
2. **Point-in-Polygon**: Ray casting algorithm for geometric filtering
3. **Visual Feedback**: Real-time polygon display with red outline
4. **Data Filtering**: Integration with Overpass API data processing

### Key Functions
- `togglePolygonMode()`: Switches between polygon and rectangle selection
- `addPolygonPoint()`: Adds vertex to polygon on mouse click
- `completePolygon()`: Finalizes polygon on double-click
- `pointInPolygon()`: Tests if coordinates are inside polygon
- `drawPolygon()`: Renders polygon visualization

### Filtering Logic
- Roads are included only if **both endpoints** are inside the polygon
- Uses ray casting algorithm for accurate point-in-polygon detection
- Maintains compatibility with existing surface filters

## Benefits
- **Precise Area Selection**: Define exact boundaries instead of rectangular approximations
- **Complex Shapes**: Handle irregular areas, exclude unwanted regions
- **Better Route Analysis**: Focus on specific neighborhoods, parks, or custom areas
- **Flexible Workflow**: Switch between polygon and rectangle modes as needed

## Limitations
- Requires minimum 3 points to form valid polygon
- Only available in initial map selection mode
- Polygon must be completed before loading data
- Self-intersecting polygons may produce unexpected results

## Example Use Cases
- **Neighborhood Analysis**: Draw around specific residential areas
- **Park Routes**: Exclude roads outside park boundaries
- **Custom Regions**: Define irregular analysis areas
- **Obstacle Avoidance**: Exclude construction zones or private areas

This feature provides much more precise control over the area of analysis compared to simple rectangular selection.
