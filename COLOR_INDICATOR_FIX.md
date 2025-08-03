# Color Indicator Fix

## Issue
The color indicators in the surface filter UI were not displaying the correct colors because of a format mismatch.

## Root Cause
- The `surfaceColorMap` is defined in HSB format (Hue, Saturation, Brightness)
- The setup function sets `colorMode(HSB)` 
- But the UI color indicators were trying to use HSL format (Hue, Saturation, Lightness)

## Fix Applied
Changed the color indicator in the surface filter UI from:
```javascript
colorIndicator.style('background', `hsl(${color[0]}, ${color[1]}%, ${color[2]}%)`);
```

To:
```javascript
colorIndicator.style('background', `hsb(${color[0]}, ${color[1]}%, ${color[2]}%)`);
```

## Result
Color indicators now display the correct colors that match the actual surface colors on the map:
- Cyan for paved surfaces (asphalt, concrete, etc.)
- Green for gravel surfaces
- Orange for unpaved surfaces  
- Red for rough surfaces
- Blue for weather-affected surfaces
- Magenta for unknown surfaces

The color indicators in the surface filter panel now accurately represent the surface colors used on the map. 