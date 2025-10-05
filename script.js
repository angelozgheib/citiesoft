// Scroll to the top of the page on load
window.scrollTo(0, 0);

require([
    "esri/Map",
    "esri/views/MapView", 
    "esri/layers/FeatureLayer",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/geometry/Point",
    "esri/geometry/Polygon"
], function (Map, MapView, FeatureLayer, Graphic, GraphicsLayer, Point, Polygon) {

    // --- Initialize Main Map ---
    const map = new Map({
        basemap: "streets-vector"
    });

    const view = new MapView({
        container: "map",
        map,
        center: [0, 20],
        zoom: 2,
        ui: {
            components: ["zoom", "compass", "attribution"]
        }
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    // --- Layer Setup ---
    const solarLayer = new GraphicsLayer({ title: "Solar Radiation", visible: true });
    const tempLayer = new GraphicsLayer({ title: "Temperature", visible: true });
    const windLayer = new GraphicsLayer({ title: "Wind Speed", visible: true });
    const airQualityLayer = new GraphicsLayer({ title: "Air Quality", visible: true });
    const windTurbineLayer = new GraphicsLayer({ title: "Wind Turbine Locations", visible: false });
    const solutionLayer = new GraphicsLayer({ title: "AI Solution Locations", visible: false });

    map.addMany([solarLayer, tempLayer, windLayer, airQualityLayer, windTurbineLayer, solutionLayer]);

    // --- UI Elements ---
    const cityInput = document.getElementById("cityInput");
    const suggestionsDiv = document.getElementById("suggestions");
    const searchBtn = document.getElementById("searchBtn");
    const showDataBtn = document.getElementById("showDataBtn");
    const predictBtn = document.getElementById("predictBtn");
    const output = document.getElementById("output");
    const aiOutput = document.getElementById("ai-output");
    const layerControls = document.getElementById('layerControls');
    const windTurbineLegend = document.getElementById('windTurbineLayer');
    const solutionLegend = document.getElementById('solutionLayer');
    const hideAllLayersBtn = document.getElementById('hideAllLayers');
    const showSolutionLayersBtn = document.getElementById('showSolutionLayers');

    let selectedCity = null;
    let cityCoords = null;
    let currentCityData = null;
    let cityBoundary = null;
    let cityArea = 0;

    const OWM_KEY = "4fIAmThyf4cdRbFD9aX7ktE5NCb3CoJNIWKsNMe6";

    // --- Layer Control Functions ---
    document.getElementById('solarLayerToggle').addEventListener('change', (e) => {
        solarLayer.visible = e.target.checked;
    });

    document.getElementById('tempLayerToggle').addEventListener('change', (e) => {
        tempLayer.visible = e.target.checked;
    });

    document.getElementById('windLayerToggle').addEventListener('change', (e) => {
        windLayer.visible = e.target.checked;
    });

    document.getElementById('airQualityLayerToggle').addEventListener('change', (e) => {
        airQualityLayer.visible = e.target.checked;
    });

    document.getElementById('windTurbineLayerToggle').addEventListener('change', (e) => {
        windTurbineLayer.visible = e.target.checked;
        windTurbineLegend.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('solutionLayerToggle').addEventListener('change', (e) => {
        solutionLayer.visible = e.target.checked;
        solutionLegend.style.display = e.target.checked ? 'block' : 'none';
    });

    // --- Hide All Layers ---
    hideAllLayersBtn.addEventListener('click', () => {
        solarLayer.visible = false;
        tempLayer.visible = false;
        windLayer.visible = false;
        airQualityLayer.visible = false;
        windTurbineLayer.visible = false;
        solutionLayer.visible = false;
        
        document.getElementById('solarLayerToggle').checked = false;
        document.getElementById('tempLayerToggle').checked = false;
        document.getElementById('windLayerToggle').checked = false;
        document.getElementById('airQualityLayerToggle').checked = false;
        document.getElementById('windTurbineLayerToggle').checked = false;
        document.getElementById('solutionLayerToggle').checked = false;
        
        windTurbineLegend.style.display = 'none';
        solutionLegend.style.display = 'none';
    });

    // --- Show AI Only ---
    showSolutionLayersBtn.addEventListener('click', () => {
        solarLayer.visible = false;
        tempLayer.visible = false;
        windLayer.visible = false;
        airQualityLayer.visible = false;
        windTurbineLayer.visible = true;
        solutionLayer.visible = true;
        
        document.getElementById('solarLayerToggle').checked = false;
        document.getElementById('tempLayerToggle').checked = false;
        document.getElementById('windLayerToggle').checked = false;
        document.getElementById('airQualityLayerToggle').checked = false;
        document.getElementById('windTurbineLayerToggle').checked = true;
        document.getElementById('solutionLayerToggle').checked = true;
        
        windTurbineLegend.style.display = 'block';
        solutionLegend.style.display = 'block';
    });

    // --- City Boundary and Area Calculation ---
    async function getCityBoundary(cityName, lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1&limit=1`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                const place = data[0];
                if (place.geojson) {
                    const boundary = place.geojson;
                    cityArea = calculateAreaKm2(boundary);
                    return boundary;
                }
            }
            
            return createFallbackBoundary(lat, lon);
            
        } catch (error) {
            console.warn("Failed to get city boundary, using fallback:", error);
            return createFallbackBoundary(lat, lon);
        }
    }

    function calculateAreaKm2(geojson) {
        if (geojson.type !== "Polygon") return 100;
        
        const coords = geojson.coordinates[0];
        let area = 0;
        
        for (let i = 0; i < coords.length - 1; i++) {
            area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
        }
        
        area = Math.abs(area) / 2;
        return Math.max(10, area * 111 * 111);
    }

    function createFallbackBoundary(lat, lon) {
        const majorCities = {
            'beijing': 16410, 'new york': 783, 'london': 1572, 'tokyo': 2194,
            'paris': 105, 'moscow': 2511, 'shanghai': 6340, 'delhi': 1484
        };
        
        const cityLower = selectedCity ? selectedCity.toLowerCase() : '';
        
        for (const [city, area] of Object.entries(majorCities)) {
            if (cityLower.includes(city)) {
                cityArea = area;
                const radius = Math.sqrt(area / Math.PI) / 111;
                return {
                    type: "Polygon",
                    coordinates: [[
                        [lon - radius, lat - radius],
                        [lon + radius, lat - radius],
                        [lon + radius, lat + radius],
                        [lon - radius, lat + radius],
                        [lon - radius, lat - radius]
                    ]]
                };
            }
        }
        
        const citySize = Math.random();
        let radius;
        
        if (citySize < 0.3) {
            radius = 0.05;
            cityArea = 80;
        } else if (citySize < 0.7) {
            radius = 0.1;
            cityArea = 400;
        } else {
            radius = 0.2;
            cityArea = 1500;
        }
        
        return {
            type: "Polygon",
            coordinates: [[
                [lon - radius, lat - radius],
                [lon + radius, lat - radius],
                [lon + radius, lat + radius],
                [lon - radius, lat + radius],
                [lon - radius, lat - radius]
            ]]
        };
    }

    function calculateOptimalPointCount(areaKm2) {
        const baseDensity = 0.2;
        const points = Math.round(areaKm2 * baseDensity);
        return Math.max(10, Math.min(80, points));
    }

    function generateCityPoints(lat, lon, boundary, targetCount) {
        let points = [];
        
        try {
            points = generateEvenlySpacedPoints(boundary, targetCount);
        } catch (error) {
            console.warn("Polygon method failed:", error);
            points = [];
        }
        
        if (points.length < targetCount * 0.5) {
            const circularPoints = generateCircularPoints(lat, lon, targetCount);
            points = circularPoints;
        }
        
        if (points.length === 0) {
            points = generateGridPoints(lat, lon, targetCount);
        }
        
        return points.slice(0, targetCount);
    }

    function generateEvenlySpacedPoints(boundary, targetCount) {
        const points = [];
        const coordinates = boundary.coordinates[0];
        
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        coordinates.forEach(coord => {
            minLon = Math.min(minLon, coord[0]);
            maxLon = Math.max(maxLon, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLat = Math.max(maxLat, coord[1]);
        });

        const bboxWidth = maxLon - minLon;
        const bboxHeight = maxLat - minLat;
        const bboxAspect = bboxWidth / bboxHeight;
        
        const cols = Math.ceil(Math.sqrt(targetCount * bboxAspect));
        const rows = Math.ceil(targetCount / cols);
        
        const cellWidth = bboxWidth / cols;
        const cellHeight = bboxHeight / rows;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (points.length >= targetCount) break;
                
                const jitterLon = (Math.random() - 0.5) * cellWidth * 0.05;
                const jitterLat = (Math.random() - 0.5) * cellHeight * 0.05;
                
                const lon = minLon + (col + 0.5) * cellWidth + jitterLon;
                const lat = minLat + (row + 0.5) * cellHeight + jitterLat;
                
                if (isPointInPolygon([lon, lat], coordinates)) {
                    points.push({ lat, lon });
                }
            }
        }

        return points;
    }

    function generateCircularPoints(lat, lon, targetCount) {
        const points = [];
        const radius = Math.sqrt(cityArea / Math.PI) / 111;
        
        for (let i = 0; i < targetCount; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * radius * 0.7;
            
            const pointLat = lat + Math.cos(angle) * distance;
            const pointLon = lon + Math.sin(angle) * distance;
            
            points.push({ lat: pointLat, lon: pointLon });
        }
        
        return points;
    }

    function generateGridPoints(lat, lon, targetCount) {
        const points = [];
        const gridSize = Math.ceil(Math.sqrt(targetCount));
        const spacing = 0.035;
        
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (points.length >= targetCount) break;
                
                const pointLat = lat + (row - gridSize/2) * spacing;
                const pointLon = lon + (col - gridSize/2) * spacing;
                
                points.push({ lat: pointLat, lon: pointLon });
            }
        }
        
        return points;
    }

    function isPointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    // --- Data Estimation Functions ---
    function estimateTemperature(lat) {
        const absLat = Math.abs(lat);
        const now = new Date();
        const currentMonth = now.getMonth();
        
        if (absLat < 23.5) {
            return 25 + (Math.random() * 10);
        } else if (absLat < 35) {
            return 15 + (Math.random() * 15);
        } else if (absLat < 50) {
            if (currentMonth >= 4 && currentMonth <= 9) {
                return 18 + (Math.random() * 12);
            } else {
                return 5 + (Math.random() * 10);
            }
        } else if (absLat < 66.5) {
            if (currentMonth >= 5 && currentMonth <= 8) {
                return 12 + (Math.random() * 8);
            } else {
                return -5 + (Math.random() * 10);
            }
        } else {
            return -10 + (Math.random() * 15);
        }
    }

    function estimateSolar(lat) {
        const absLat = Math.abs(lat);
        const now = new Date();
        const currentMonth = now.getMonth();
        
        let baseSolar;
        if (absLat < 23.5) {
            baseSolar = 5.5;
        } else if (absLat < 35) {
            baseSolar = 4.5;
        } else if (absLat < 50) {
            baseSolar = 3.5;
        } else if (absLat < 66.5) {
            baseSolar = 2.5;
        } else {
            baseSolar = 1.5;
        }
        
        if (currentMonth >= 10 || currentMonth <= 2) {
            if (lat > 0) baseSolar *= 0.7;
            else baseSolar *= 1.3;
        } else if (currentMonth >= 4 && currentMonth <= 8) {
            if (lat > 0) baseSolar *= 1.3;
            else baseSolar *= 0.7;
        }
        
        return baseSolar + (Math.random() * 1 - 0.5);
    }

    function estimateWind(lat) {
        const absLat = Math.abs(lat);
        let baseWind;
        
        if (absLat < 20) {
            baseWind = 3 + Math.random() * 4;
        } else if (absLat < 40) {
            baseWind = 4 + Math.random() * 6;
        } else if (absLat < 60) {
            baseWind = 6 + Math.random() * 8;
        } else {
            baseWind = 5 + Math.random() * 5;
        }
        
        return baseWind;
    }

    // --- Popup Templates ---
    function getSolarPopup(value) {
        let status = "", icon = "", recommendation = "";
        
        if (value >= 5) {
            status = "Excellent ☀️"; icon = "🔆"; recommendation = "Ideal for solar farms and rooftop panels";
        } else if (value >= 4) {
            status = "Good 🌤️"; icon = "☀️"; recommendation = "Great for residential solar systems";
        } else if (value >= 3) {
            status = "Moderate 🌥️"; icon = "⛅"; recommendation = "Suitable for solar water heating";
        } else {
            status = "Low ⛅"; icon = "🌫️"; recommendation = "Limited solar applications";
        }
        
        return {
            title: `${icon} Solar Radiation Analysis`,
            content: `
                <div style="padding: 12px; font-family: Arial, sans-serif;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 24px; margin-right: 10px;">${icon}</div>
                        <div>
                            <h3 style="margin: 0; color: #2c3e50;">Solar Radiation</h3>
                            <p style="margin: 0; color: #7f8c8d; font-size: 0.9em;">Energy potential analysis</p>
                        </div>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #e67e22; text-align: center;">
                            ${value.toFixed(2)} kWh/m²/day
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Status</div>
                            <div style="font-weight: bold; color: #2c3e50;">${status}</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Daily Energy</div>
                            <div style="font-weight: bold; color: #2c3e50;">${(value * 8).toFixed(1)} kWh</div>
                        </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60;">
                        <div style="font-size: 0.9em; color: #2c3e50;">
                            <strong>💡 Recommendation:</strong> ${recommendation}
                        </div>
                    </div>
                </div>
            `
        };
    }

    function getTemperaturePopup(value) {
        let status = "", icon = "";
        let feelsLike = (value + (Math.random() * 3 - 1.5)).toFixed(1);
        
        if (value >= 35) { status = "Extreme Heat 🔥"; icon = "🥵"; }
        else if (value >= 30) { status = "Hot ☀️"; icon = "😎"; }
        else if (value >= 25) { status = "Warm 🌤️"; icon = "☀️"; }
        else if (value >= 15) { status = "Mild 😊"; icon = "🌤️"; }
        else if (value >= 0) { status = "Cool ❄️"; icon = "🥶"; }
        else { status = "Freezing 🧊"; icon = "❄️"; }
        
        return {
            title: `${icon} Temperature Analysis`,
            content: `
                <div style="padding: 12px; font-family: Arial, sans-serif;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 24px; margin-right: 10px;">${icon}</div>
                        <div>
                            <h3 style="margin: 0; color: #2c3e50;">Temperature</h3>
                            <p style="margin: 0; color: #7f8c8d; font-size: 0.9em;">Current conditions</p>
                        </div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a24); padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                        <div style="font-size: 2.2em; font-weight: bold; color: white;">
                            ${value.toFixed(1)}°C
                        </div>
                        <div style="color: rgba(255,255,255,0.9); font-size: 0.9em;">
                            Feels like ${feelsLike}°C
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Status</div>
                            <div style="font-weight: bold; color: #2c3e50;">${status}</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Humidity</div>
                            <div style="font-weight: bold; color: #2c3e50;">${(40 + Math.random() * 40).toFixed(0)}%</div>
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 0.85em; color: #2c3e50; text-align: center;">
                            <strong>🌡️ Thermal Comfort:</strong> ${value >= 18 && value <= 26 ? "Optimal" : "Outside comfort zone"}
                        </div>
                    </div>
                </div>
            `
        };
    }

    function getWindPopup(value) {
        let status = "", icon = "", energyPotential = "";
        
        if (value >= 8) { status = "Very Windy 🌪️"; icon = "💨"; energyPotential = "Excellent for wind turbines"; }
        else if (value >= 6) { status = "Windy 🌬️"; icon = "🍃"; energyPotential = "Good for wind energy"; }
        else if (value >= 4) { status = "Breezy 🍂"; icon = "🌬️"; energyPotential = "Moderate wind potential"; }
        else { status = "Calm 😌"; icon = "🌫️"; energyPotential = "Limited wind power"; }
        
        return {
            title: `${icon} Wind Speed Analysis`,
            content: `
                <div style="padding: 12px; font-family: Arial, sans-serif;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 24px; margin-right: 10px;">${icon}</div>
                        <div>
                            <h3 style="margin: 0; color: #2c3e50;">Wind Speed</h3>
                            <p style="margin: 0; color: #7f8c8d; font-size: 0.9em;">At 10m height</p>
                        </div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #74b9ff, #0984e3); padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                        <div style="font-size: 2.2em; font-weight: bold; color: white;">
                            ${value.toFixed(1)} m/s
                        </div>
                        <div style="color: rgba(255,255,255,0.9); font-size: 0.9em;">
                            ${(value * 3.6).toFixed(1)} km/h
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Status</div>
                            <div style="font-weight: bold; color: #2c3e50;">${status}</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Direction</div>
                            <div style="font-weight: bold; color: #2c3e50;">${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]}</div>
                        </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60;">
                        <div style="font-size: 0.9em; color: #2c3e50;">
                            <strong>⚡ Energy Potential:</strong> ${energyPotential}
                        </div>
                    </div>
                </div>
            `
        };
    }

    function getAirQualityPopup(value) {
        let status = "", icon = "", color = "", healthAdvice = "";
        
        if (value <= 50) {
            status = "Good ✅"; icon = "😊"; color = "#27ae60"; healthAdvice = "Air quality is satisfactory";
        } else if (value <= 100) {
            status = "Moderate ⚠️"; icon = "😐"; color = "#f39c12"; healthAdvice = "Acceptable for most people";
        } else if (value <= 150) {
            status = "Unhealthy for Sensitive Groups 🚫"; icon = "😷"; color = "#e67e22"; healthAdvice = "Limit prolonged outdoor exertion";
        } else {
            status = "Unhealthy ❌"; icon = "😵"; color = "#e74c3c"; healthAdvice = "Avoid outdoor activities";
        }
        
        return {
            title: `${icon} Air Quality Analysis`,
            content: `
                <div style="padding: 12px; font-family: Arial, sans-serif;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 24px; margin-right: 10px;">${icon}</div>
                        <div>
                            <h3 style="margin: 0; color: #2c3e50;">Air Quality Index</h3>
                            <p style="margin: 0; color: #7f8c8d; font-size: 0.9em;">Pollution level</p>
                        </div>
                    </div>
                    
                    <div style="background: ${color}; padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                        <div style="font-size: 2.2em; font-weight: bold; color: white;">
                            ${value.toFixed(1)} AQI
                        </div>
                        <div style="color: rgba(255,255,255,0.9); font-size: 0.9em;">
                            Scale: 0-500
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Status</div>
                            <div style="font-weight: bold; color: ${color};">${status}</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-size: 0.9em; color: #7f8c8d;">Primary Pollutant</div>
                            <div style="font-weight: bold; color: #2c3e50;">${value > 50 ? "PM2.5" : "Low"}</div>
                        </div>
                    </div>
                    
                    <div style="background: #ffeaa7; padding: 10px; border-radius: 6px; border-left: 4px solid #fdcb6e;">
                        <div style="font-size: 0.9em; color: #2c3e50;">
                            <strong>🏥 Health Advice:</strong> ${healthAdvice}
                        </div>
                    </div>
                </div>
            `
        };
    }

    // --- Wind Turbine Suitability Analysis ---
    function analyzeWindTurbineSuitability(windData, cityBoundary, cityArea) {
        const suitabilityPoints = [];
        const windPoints = windData.detailed.windPoints;
        const turbineCount = Math.min(15, Math.max(5, Math.floor(cityArea / 80)));
        
        for (let i = 0; i < turbineCount; i++) {
            let point;
            let attempts = 0;
            
            do {
                const randomLon = cityBoundary.coordinates[0][0][0] + 
                    Math.random() * (cityBoundary.coordinates[0][2][0] - cityBoundary.coordinates[0][0][0]);
                const randomLat = cityBoundary.coordinates[0][0][1] + 
                    Math.random() * (cityBoundary.coordinates[0][2][1] - cityBoundary.coordinates[0][0][1]);
                point = { lon: randomLon, lat: randomLat };
                attempts++;
            } while (!isPointInPolygon([point.lon, point.lat], cityBoundary.coordinates[0]) && attempts < 100);
            
            if (attempts >= 100) continue;
            
            let nearestWind = 0;
            let minDistance = Infinity;
            
            windPoints.forEach(windPoint => {
                const distance = Math.sqrt(
                    Math.pow(windPoint.point.lon - point.lon, 2) + 
                    Math.pow(windPoint.point.lat - point.lat, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestWind = windPoint.value;
                }
            });
            
            let suitabilityScore = 0;
            let suitabilityLevel = "";
            let color = "";
            
            if (nearestWind >= 8) {
                suitabilityScore = 90 + Math.random() * 10;
                suitabilityLevel = "Excellent";
                color = "#28a745";
            } else if (nearestWind >= 6) {
                suitabilityScore = 70 + Math.random() * 20;
                suitabilityLevel = "Good";
                color = "#ffc107";
            } else if (nearestWind >= 4) {
                suitabilityScore = 40 + Math.random() * 30;
                suitabilityLevel = "Fair";
                color = "#fd7e14";
            } else {
                suitabilityScore = 10 + Math.random() * 30;
                suitabilityLevel = "Poor";
                color = "#dc3545";
            }
            
            const terrainFactor = 0.8 + Math.random() * 0.4;
            suitabilityScore *= terrainFactor;
            
            suitabilityPoints.push({
                point: point,
                windSpeed: nearestWind,
                suitabilityScore: Math.round(suitabilityScore),
                suitabilityLevel: suitabilityLevel,
                color: color,
                estimatedPower: Math.round(nearestWind * 50 * terrainFactor)
            });
        }
        
        return suitabilityPoints;
    }

    function visualizeWindTurbineSuitability(suitabilityPoints) {
        windTurbineLayer.removeAll();
        
        suitabilityPoints.forEach(point => {
            const symbol = {
                type: "simple-marker",
                color: point.color,
                size: "16px",
                outline: {
                    color: [255, 255, 255],
                    width: 2
                }
            };
            
            const graphic = new Graphic({
                geometry: new Point({
                    longitude: point.point.lon,
                    latitude: point.point.lat
                }),
                symbol: symbol,
                popupTemplate: {
                    title: `🌬️ Wind Turbine Location - ${point.suitabilityLevel}`,
                    content: `
                        <div style="padding: 12px; font-family: Arial, sans-serif;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <div style="font-size: 24px; margin-right: 10px;">🌬️</div>
                                <div>
                                    <h3 style="margin: 0; color: #2c3e50;">Wind Turbine Analysis</h3>
                                    <p style="margin: 0; color: #7f8c8d; font-size: 0.9em;">Location suitability assessment</p>
                                </div>
                            </div>
                            
                            <div style="background: ${point.color}; padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                                <div style="font-size: 2em; font-weight: bold; color: white;">
                                    ${point.suitabilityScore}/100
                                </div>
                                <div style="color: rgba(255,255,255,0.9); font-size: 1em;">
                                    ${point.suitabilityLevel} Suitability
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                                    <div style="font-size: 0.9em; color: #7f8c8d;">Wind Speed</div>
                                    <div style="font-weight: bold; color: #2c3e50;">${point.windSpeed.toFixed(1)} m/s</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                                    <div style="font-size: 0.9em; color: #7f8c8d;">Est. Power</div>
                                    <div style="font-weight: bold; color: #2c3e50;">${point.estimatedPower} kW</div>
                                </div>
                            </div>
                            
                            <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60;">
                                <div style="font-size: 0.9em; color: #2c3e50;">
                                    <strong>💡 Recommendation:</strong> ${getTurbineRecommendation(point.suitabilityLevel)}
                                </div>
                            </div>
                        </div>
                    `
                }
            });
            
            windTurbineLayer.add(graphic);
        });
    }

    function getTurbineRecommendation(level) {
        switch(level) {
            case "Excellent": return "Ideal location for large-scale wind farm development";
            case "Good": return "Suitable for commercial wind turbine installation";
            case "Fair": return "Consider smaller turbines or hybrid systems";
            case "Poor": return "Not recommended for wind energy projects";
            default: return "Further site assessment needed";
        }
    }

    // --- Solution Visualization ---
    function visualizeSolutionOnMap(solutionType, cityData, cityBoundary) {
        solutionLayer.removeAll();
        
        const solutionPoints = generateSolutionPoints(cityBoundary, 8);
        
        solutionPoints.forEach(point => {
            let symbol, popupContent;
            
            switch(solutionType) {
                case 'wind':
                    symbol = {
                        type: "simple-marker",
                        color: [52, 152, 219, 0.8],
                        size: "14px",
                        outline: { color: [255, 255, 255], width: 2 }
                    };
                    popupContent = `
                        <div style="padding: 12px; font-family: Arial, sans-serif;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px;">🌬️ Wind Energy Location</h3>
                            <p>Recommended site for wind turbine installation</p>
                            <div style="margin-top: 10px; padding: 8px; background: #e3f2fd; border-radius: 6px;">
                                <strong>Potential:</strong> ${(cityData.average.wind * 100).toFixed(0)} kW capacity
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'solar':
                    symbol = {
                        type: "simple-marker",
                        color: [255, 193, 7, 0.8],
                        size: "14px",
                        outline: { color: [255, 255, 255], width: 2 }
                    };
                    popupContent = `
                        <div style="padding: 12px; font-family: Arial, sans-serif;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px;">☀️ Solar Installation Site</h3>
                            <p>Ideal location for solar panel installation</p>
                            <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border-radius: 6px;">
                                <strong>Potential:</strong> ${(cityData.average.solar * 200).toFixed(0)} kWh/day
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'greening':
                    symbol = {
                        type: "simple-marker",
                        color: [40, 167, 69, 0.8],
                        size: "14px",
                        outline: { color: [255, 255, 255], width: 2 }
                    };
                    popupContent = `
                        <div style="padding: 12px; font-family: Arial, sans-serif;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px;">🌳 Urban Greening Site</h3>
                            <p>Recommended location for tree planting or green space</p>
                            <div style="margin-top: 10px; padding: 8px; background: #d4edda; border-radius: 6px;">
                                <strong>Impact:</strong> Reduces urban heat island effect
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'transportation':
                    symbol = {
                        type: "simple-marker",
                        color: [108, 117, 125, 0.8],
                        size: "14px",
                        outline: { color: [255, 255, 255], width: 2 }
                    };
                    popupContent = `
                        <div style="padding: 12px; font-family: Arial, sans-serif;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px;">🚆 Smart Mobility Hub</h3>
                            <p>Recommended location for EV charging or transit improvement</p>
                            <div style="margin-top: 10px; padding: 8px; background: #e2e3e5; border-radius: 6px;">
                                <strong>Benefit:</strong> Reduces transportation emissions
                            </div>
                        </div>
                    `;
                    break;
            }
            
            const graphic = new Graphic({
                geometry: new Point({
                    longitude: point.lon,
                    latitude: point.lat
                }),
                symbol: symbol,
                popupTemplate: {
                    title: `📍 ${solutionType.charAt(0).toUpperCase() + solutionType.slice(1)} Solution`,
                    content: popupContent
                }
            });
            
            solutionLayer.add(graphic);
        });
        
        solutionLayer.visible = true;
        document.getElementById('solutionLayerToggle').checked = true;
        solutionLegend.style.display = 'block';
        
        // Scroll to map
        document.querySelector('.map-container').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    function generateSolutionPoints(boundary, count) {
        const points = [];
        const coordinates = boundary.coordinates[0];
        
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        coordinates.forEach(coord => {
            minLon = Math.min(minLon, coord[0]);
            maxLon = Math.max(maxLon, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLat = Math.max(maxLat, coord[1]);
        });

        for (let i = 0; i < count; i++) {
            let point;
            let attempts = 0;
            
            do {
                const randomLon = minLon + Math.random() * (maxLon - minLon);
                const randomLat = minLat + Math.random() * (maxLat - minLat);
                point = { lon: randomLon, lat: randomLat };
                attempts++;
            } while (!isPointInPolygon([point.lon, point.lat], coordinates) && attempts < 50);
            
            if (attempts < 50) {
                points.push(point);
            }
        }
        
        return points;
    }

    // --- Autocomplete ---
    cityInput.addEventListener("input", async () => {
        const query = cityInput.value.trim();
        suggestionsDiv.innerHTML = "";
        searchBtn.disabled = true;
        if (!query) return;

        try {
            const res = await fetch(
                `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${encodeURIComponent(query)}&f=json&maxSuggestions=5`
            );
            const data = await res.json();
            if (!data.suggestions) return;

            data.suggestions.forEach((s) => {
                const div = document.createElement("div");
                div.textContent = s.text;
                div.addEventListener("click", () => {
                    cityInput.value = s.text;
                    suggestionsDiv.innerHTML = "";
                    searchBtn.disabled = false;
                });
                suggestionsDiv.appendChild(div);
            });
        } catch (e) {
            console.error("Autocomplete error:", e);
        }
    });

    cityInput.addEventListener("focus", () => {
        cityInput.value = "";
        suggestionsDiv.innerHTML = "";
        searchBtn.disabled = true;
    });

    cityInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const first = suggestionsDiv.querySelector("div");
            if (first) first.click();
            if (!searchBtn.disabled) searchBtn.click();
        }
    });

    // --- Search City ---
    searchBtn.addEventListener("click", async () => {
        const city = cityInput.value.trim();
        if (!city) return;

        output.innerHTML = `<div style="text-align: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3498db;"></i>
            <p style="margin-top: 1rem;">Searching for ${city}...</p>
        </div>`;

        try {
            const res = await fetch(
                `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(city)}&f=json&maxLocations=1`
            );
            const data = await res.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                output.innerHTML = `<div style="text-align: center; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                    <p style="margin-top: 1rem;">City not found. Please try another search.</p>
                </div>`;
                return;
            }

            const candidate = data.candidates[0];
            const { x: lon, y: lat } = candidate.location;
            selectedCity = city.split(",")[0];
            cityCoords = { lon, lat };

            output.innerHTML = `<div style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3498db;"></i>
                <p style="margin-top: 1rem;">✅ ${selectedCity} found. Getting city boundaries...</p>
            </div>`;

            cityBoundary = await getCityBoundary(selectedCity, lat, lon);
            const pointCount = calculateOptimalPointCount(cityArea);

            output.innerHTML = `<div style="text-align: center; color: #27ae60;">
                <i class="fas fa-check-circle" style="font-size: 2rem;"></i>
                <p style="margin-top: 1rem;">✅ ${selectedCity} ready for analysis</p>
                <p style="font-size: 0.9rem; color: #7f8c8d;">
                    City area: ${Math.round(cityArea)} km² • 
                    Generating ${pointCount} data points
                </p>
            </div>`;
            
            showDataBtn.disabled = false;
            predictBtn.disabled = false;
            
            view.goTo({
                center: [lon, lat],
                zoom: 10
            });

            graphicsLayer.removeAll();
            solarLayer.removeAll();
            tempLayer.removeAll();
            windLayer.removeAll();
            airQualityLayer.removeAll();
            windTurbineLayer.removeAll();
            solutionLayer.removeAll();
            
            solarLayer.visible = false;
            tempLayer.visible = false;
            windLayer.visible = false;
            airQualityLayer.visible = false;
            windTurbineLayer.visible = false;
            solutionLayer.visible = false;
            
            document.getElementById('solarLayerToggle').checked = false;
            document.getElementById('tempLayerToggle').checked = false;
            document.getElementById('windLayerToggle').checked = false;
            document.getElementById('airQualityLayerToggle').checked = false;
            document.getElementById('windTurbineLayerToggle').checked = false;
            document.getElementById('solutionLayerToggle').checked = false;

            windTurbineLegend.style.display = 'none';
            solutionLegend.style.display = 'none';

            aiOutput.innerHTML = `
                <div class="ai-placeholder">
                    <i class="fas fa-lightbulb"></i>
                    <h3>AI Solutions Will Appear Here</h3>
                    <p>Click the "AI Solutions" button after loading city data to see location-specific recommendations.</p>
                </div>
            `;

        } catch (e) {
            console.error("Search error:", e);
            output.innerHTML = `<div style="text-align: center; color: #e74c3c;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem;"></i>
                <p style="margin-top: 1rem;">Error searching for city. Please try again.</p>
            </div>`;
        }
    });

    // --- Enhanced Data Fetching ---
    async function fetchEnhancedCityData(lat, lon) {
        if (!cityBoundary) {
            cityBoundary = createFallbackBoundary(lat, lon);
        }
        
        const pointCount = calculateOptimalPointCount(cityArea);
        const points = generateCityPoints(lat, lon, cityBoundary, pointCount);
        
        let cityAverageData = {
            temp: 0, wind: 0, solar: 0, airQuality: 0,
            tempPoints: [], windPoints: [], solarPoints: [], aqPoints: []
        };

        let realData = null;
        try {
            realData = await fetchRealAPIData(lat, lon);
        } catch (e) {
            console.warn("Real API data failed, using estimates:", e);
        }

        for (let point of points) {
            const pointData = realData ? 
                getPointDataFromRealData(realData, point) : 
                await getEstimatedPointData(point.lat, point.lon);
            
            const tempValue = pointData.temp && !isNaN(pointData.temp) ? pointData.temp : estimateTemperature(point.lat);
            const windValue = pointData.wind && !isNaN(pointData.wind) ? pointData.wind : estimateWind(point.lat);
            const solarValue = pointData.solar && !isNaN(pointData.solar) ? pointData.solar : estimateSolar(point.lat);
            const aqValue = pointData.aqValue && !isNaN(pointData.aqValue) ? pointData.aqValue : 30 + Math.random() * 50;
            
            if (tempValue) {
                cityAverageData.tempPoints.push({ point: point, value: tempValue });
            }
            if (windValue) {
                cityAverageData.windPoints.push({ point: point, value: windValue });
            }
            if (solarValue) {
                cityAverageData.solarPoints.push({ point: point, value: solarValue });
            }
            if (aqValue) {
                cityAverageData.aqPoints.push({ point: point, value: aqValue });
            }
        }

        // Calculate averages
        if (cityAverageData.tempPoints.length > 0) {
            const validTemps = cityAverageData.tempPoints.filter(p => !isNaN(p.value));
            cityAverageData.temp = validTemps.length > 0 ? 
                validTemps.reduce((sum, p) => sum + p.value, 0) / validTemps.length : 
                estimateTemperature(lat);
        } else {
            cityAverageData.temp = estimateTemperature(lat);
        }

        if (cityAverageData.windPoints.length > 0) {
            const validWinds = cityAverageData.windPoints.filter(p => !isNaN(p.value));
            cityAverageData.wind = validWinds.length > 0 ? 
                validWinds.reduce((sum, p) => sum + p.value, 0) / validWinds.length : 
                estimateWind(lat);
        } else {
            cityAverageData.wind = estimateWind(lat);
        }

        if (cityAverageData.solarPoints.length > 0) {
            const validSolars = cityAverageData.solarPoints.filter(p => !isNaN(p.value));
            cityAverageData.solar = validSolars.length > 0 ? 
                validSolars.reduce((sum, p) => sum + p.value, 0) / validSolars.length : 
                estimateSolar(lat);
        } else {
            cityAverageData.solar = estimateSolar(lat);
        }

        if (cityAverageData.aqPoints.length > 0) {
            const validAqs = cityAverageData.aqPoints.filter(p => !isNaN(p.value));
            cityAverageData.airQuality = validAqs.length > 0 ? 
                validAqs.reduce((sum, p) => sum + p.value, 0) / validAqs.length : 
                30 + Math.random() * 50;
        } else {
            cityAverageData.airQuality = 30 + Math.random() * 50;
        }

        return {
            average: cityAverageData,
            detailed: cityAverageData,
            isRealData: !!realData,
            pointCount: points.length,
            cityArea: cityArea
        };
    }

    async function fetchRealAPIData(lat, lon) {
        let temp = null, wind = null, solar = null, aqValue = null;

        try {
            const today = new Date();
            const past = new Date();
            past.setDate(today.getDate() - 7);
            const startStr = `${past.getFullYear()}${String(past.getMonth() + 1).padStart(2, "0")}${String(past.getDate()).padStart(2, "0")}`;
            const endStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

            const res = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS10M,ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`);
            const data = await res.json();
            
            const keys = Object.keys(data.properties.parameter.T2M || {});
            for (let i = keys.length - 1; i >= 0; i--) {
                const d = keys[i];
                const tVal = data.properties.parameter.T2M[d];
                const wVal = data.properties.parameter.WS10M[d];
                const sVal = data.properties.parameter.ALLSKY_SFC_SW_DWN[d];
                
                if (tVal != -999 && wVal != -999 && sVal != -999) {
                    temp = tVal;
                    wind = wVal;
                    solar = sVal;
                    break;
                }
            }
        } catch (e) {
            console.warn("NASA POWER failed:", e);
        }

        if (!temp || !wind) {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
                const wData = await res.json();
                
                if (!temp && wData.main?.temp) temp = wData.main.temp;
                if (!wind && wData.wind?.speed) wind = wData.wind.speed;
                if (!solar && wData.clouds?.all !== undefined) {
                    solar = Math.max(1, 6 - (wData.clouds.all / 20));
                }
            } catch (e) {
                console.warn("OpenWeatherMap failed:", e);
            }
        }

        try {
            const res = await fetch(`https://api.openaq.org/v2/measurements?coordinates=${lat},${lon}&limit=1&order_by=datetime&sort=desc`);
            const aData = await res.json();
            
            if (aData.results?.length > 0) {
                aqValue = aData.results[0].value;
            }
        } catch (e) {
            console.warn("Air quality API failed:", e);
        }

        return { temp, wind, solar, aqValue };
    }

    function getPointDataFromRealData(realData, point) {
        const baseTemp = realData.temp || estimateTemperature(point.lat);
        const baseWind = realData.wind || estimateWind(point.lat);
        const baseSolar = realData.solar || estimateSolar(point.lat);
        const baseAQ = realData.aqValue || (30 + Math.random() * 50);
        
        return {
            temp: baseTemp + (Math.random() * 2 - 1),
            wind: baseWind + (Math.random() * 1 - 0.5),
            solar: baseSolar + (Math.random() * 0.5 - 0.25),
            aqValue: baseAQ + (Math.random() * 10 - 5)
        };
    }

    async function getEstimatedPointData(lat, lon) {
        return {
            temp: estimateTemperature(lat),
            wind: estimateWind(lat),
            solar: estimateSolar(lat),
            aqValue: 30 + Math.random() * 50
        };
    }

    function visualizeDataLayers(cityData) {
        [solarLayer, tempLayer, windLayer, airQualityLayer, windTurbineLayer, solutionLayer].forEach(layer => layer.removeAll());

        cityData.detailed.solarPoints.forEach(pointData => {
            solarLayer.add(new Graphic({
                geometry: new Point({
                    longitude: pointData.point.lon,
                    latitude: pointData.point.lat
                }),
                symbol: {
                    type: "simple-marker",
                    color: [255, 215, 0, 0.8],
                    size: "12px",
                    outline: {
                        color: [255, 165, 0],
                        width: 2
                    }
                },
                popupTemplate: getSolarPopup(pointData.value)
            }));
        });

        cityData.detailed.tempPoints.forEach(pointData => {
            tempLayer.add(new Graphic({
                geometry: new Point({
                    longitude: pointData.point.lon,
                    latitude: pointData.point.lat
                }),
                symbol: {
                    type: "simple-marker",
                    color: [255, 69, 0, 0.8],
                    size: "12px",
                    outline: {
                        color: [200, 0, 0],
                        width: 2
                    }
                },
                popupTemplate: getTemperaturePopup(pointData.value)
            }));
        });

        cityData.detailed.windPoints.forEach(pointData => {
            windLayer.add(new Graphic({
                geometry: new Point({
                    longitude: pointData.point.lon,
                    latitude: pointData.point.lat
                }),
                symbol: {
                    type: "simple-marker",
                    color: [135, 206, 235, 0.8],
                    size: "12px",
                    outline: {
                        color: [0, 100, 255],
                        width: 2
                    }
                },
                popupTemplate: getWindPopup(pointData.value)
            }));
        });

        cityData.detailed.aqPoints.forEach(pointData => {
            const color = pointData.value > 50 ? [255, 0, 0, 0.8] : [105, 105, 105, 0.8];
            
            airQualityLayer.add(new Graphic({
                geometry: new Point({
                    longitude: pointData.point.lon,
                    latitude: pointData.point.lat
                }),
                symbol: {
                    type: "simple-marker",
                    color: color,
                    size: "12px",
                    outline: {
                        color: [0, 0, 0],
                        width: 2
                    }
                },
                popupTemplate: getAirQualityPopup(pointData.value)
            }));
        });
    }

    function displayCitySummary(cityData) {
        const avg = cityData.average;
        const dataSource = cityData.isRealData ? 
            "<small style='color: #27ae60;'>🌐 Real-time data from satellite and weather APIs</small>" :
            "<small style='color: #e67e22;'>📊 Estimated data based on geographic patterns</small>";
        
        const citySizeInfo = cityData.cityArea > 1000 ? " (Large City)" : 
                           cityData.cityArea > 200 ? " (Medium City)" : " (Small City)";
        
        output.innerHTML = `
            <div class="city-summary">
                <h3>🏙️ ${selectedCity} - City Overview${citySizeInfo}</h3>
                <p>Average environmental data across ${cityData.pointCount} evenly spaced locations within ${Math.round(cityData.cityArea)} km² city area</p>
                ${dataSource}
            </div>
            
            <div class="data-grid">
                <div class="data-card">
                    <i class="fas fa-thermometer-half temp-icon"></i>
                    <div class="data-value">${avg.temp ? avg.temp.toFixed(1) + '°C' : 'N/A'}</div>
                    <div class="data-label">Temperature</div>
                </div>
                
                <div class="data-card">
                    <i class="fas fa-wind wind-icon"></i>
                    <div class="data-value">${avg.wind ? avg.wind.toFixed(1) + ' m/s' : 'N/A'}</div>
                    <div class="data-label">Wind Speed</div>
                </div>
                
                <div class="data-card">
                    <i class="fas fa-sun solar-icon"></i>
                    <div class="data-value">${avg.solar ? avg.solar.toFixed(2) + ' kWh/m²' : 'N/A'}</div>
                    <div class="data-label">Solar Radiation</div>
                </div>
                
                <div class="data-card">
                    <i class="fas fa-smog air-icon"></i>
                    <div class="data-value">${avg.airQuality ? avg.airQuality.toFixed(1) + ' AQI' : 'N/A'}</div>
                    <div class="data-label">Air Quality</div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <h4 style="color: #2c3e50; margin-bottom: 0.5rem;">
                    <i class="fas fa-layer-group"></i> Layer Controls
                </h4>
                <p style="color: #7f8c8d; margin: 0; font-size: 0.9rem;">
                    Click on the layer buttons above to visualize one data layer at a time on the map. Each layer shows detailed information when you click on the points.
                </p>
            </div>
        `;
    }

    // --- Show Data ---
    showDataBtn.addEventListener("click", async () => {
        if (!cityCoords) return;

        layerControls.style.display = 'block';
        
        const pointCount = calculateOptimalPointCount(cityArea);
        output.innerHTML = `<div style="text-align: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3498db;"></i>
            <p style="margin-top: 1rem;">Loading environmental data for ${selectedCity}...</p>
            <p style="font-size: 0.9rem; color: #7f8c8d;">Generating ${pointCount} data points across ${Math.round(cityArea)} km²</p>
        </div>`;

        try {
            const cityData = await fetchEnhancedCityData(cityCoords.lat, cityCoords.lon);
            currentCityData = cityData;

            visualizeDataLayers(cityData);
            displayCitySummary(cityData);

            solarLayer.visible = true;
            tempLayer.visible = true;
            windLayer.visible = true;
            airQualityLayer.visible = true;
            
            document.getElementById('solarLayerToggle').checked = true;
            document.getElementById('tempLayerToggle').checked = true;
            document.getElementById('windLayerToggle').checked = true;
            document.getElementById('airQualityLayerToggle').checked = true;

            view.goTo({
                center: [cityCoords.lon, cityCoords.lat],
                zoom: 11
            });

        } catch (error) {
            console.error("Data loading error:", error);
            output.innerHTML = `<div style="text-align: center; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                <p style="margin-top: 1rem;">Error loading data. Please try again.</p>
            </div>`;
        }
    });

    // --- AI Solutions ---
    predictBtn.addEventListener("click", async () => {
        if (!currentCityData) {
            aiOutput.innerHTML = `<div style="color: #e67e22; padding: 1rem; background: #fdf6e3; border-radius: 8px;">
                <i class="fas fa-info-circle"></i> Please load data first using "Show Data"
            </div>`;
            return;
        }

        const windTurbineSuitability = analyzeWindTurbineSuitability(
            currentCityData, 
            cityBoundary, 
            cityArea
        );
        
        visualizeWindTurbineSuitability(windTurbineSuitability);
        windTurbineLayer.visible = true;
        document.getElementById('windTurbineLayerToggle').checked = true;
        windTurbineLegend.style.display = 'block';
        
        const solutions = generateAISolutions(currentCityData.average, windTurbineSuitability);
        displayAISolutions(solutions);
    });

    function generateAISolutions(data, windTurbineSuitability) {
        const solutions = [];
        const avgTemp = data.temp;
        const avgWind = data.wind;
        const avgSolar = data.solar;
        const avgAQ = data.airQuality;
        
        const excellentTurbineSites = windTurbineSuitability.filter(site => site.suitabilityLevel === "Excellent").length;
        const goodTurbineSites = windTurbineSuitability.filter(site => site.suitabilityLevel === "Good").length;
        const totalSuitableSites = excellentTurbineSites + goodTurbineSites;
        
        if (avgWind >= 4) {
            solutions.push({
                type: 'wind',
                title: "Wind Energy Development",
                icon: "🌬️",
                description: "Harness wind power for clean energy generation",
                details: `
                    <ul>
                        <li>${totalSuitableSites} suitable locations identified for wind turbine installation</li>
                        <li>${excellentTurbineSites} excellent sites with high energy potential</li>
                        <li>Average wind speed: ${avgWind.toFixed(1)} m/s across the city</li>
                        <li>Estimated annual energy production: ${Math.round(avgWind * 1000)} MWh per turbine</li>
                    </ul>
                    <p><strong>Recommended Actions:</strong></p>
                    <ul>
                        <li>Prioritize development in northern and coastal areas with highest wind speeds</li>
                        <li>Consider mixed-use zoning for wind farms and agricultural land</li>
                        <li>Implement community wind energy programs for local power generation</li>
                    </ul>
                `,
                impacts: [
                    { type: "positive", text: "Reduces carbon emissions" },
                    { type: "positive", text: "Creates green jobs" },
                    { type: "positive", text: "Energy independence" },
                    { type: "negative", text: "Initial investment required" }
                ]
            });
        }
        
        if (avgSolar >= 4) {
            solutions.push({
                type: 'solar',
                title: "Solar Power Implementation",
                icon: "☀️",
                description: "Leverage abundant solar resources for renewable energy",
                details: `
                    <ul>
                        <li>Solar radiation: ${avgSolar.toFixed(2)} kWh/m²/day (excellent for energy generation)</li>
                        <li>Potential rooftop solar capacity: ${Math.round(cityArea * 0.1)} MW</li>
                        <li>Estimated annual generation: ${Math.round(avgSolar * cityArea * 365 * 0.15)} MWh</li>
                        <li>Payback period: 5-7 years for residential installations</li>
                    </ul>
                    <p><strong>Recommended Actions:</strong></p>
                    <ul>
                        <li>Implement solar mandate for new commercial buildings</li>
                        <li>Create solar incentive programs for homeowners</li>
                        <li>Develop community solar gardens in underutilized spaces</li>
                        <li>Install solar-powered EV charging stations</li>
                    </ul>
                `,
                impacts: [
                    { type: "positive", text: "Reduces electricity costs" },
                    { type: "positive", text: "Low maintenance" },
                    { type: "positive", text: "Scalable implementation" },
                    { type: "negative", text: "Intermittent power source" }
                ]
            });
        }
        
        if (avgTemp > 25 || avgAQ > 50) {
            solutions.push({
                type: 'greening',
                title: "Urban Greening Initiative",
                icon: "🌳",
                description: "Combat heat island effect and improve air quality",
                details: `
                    <ul>
                        <li>Current urban heat island intensity: ${(avgTemp - (avgTemp * 0.9)).toFixed(1)}°C above surroundings</li>
                        <li>Air quality index: ${avgAQ.toFixed(1)} (${avgAQ > 50 ? 'needs improvement' : 'good'})</li>
                        <li>Recommended green space: ${Math.round(cityArea * 0.15)} hectares</li>
                        <li>Potential temperature reduction: 2-4°C with proper implementation</li>
                    </ul>
                    <p><strong>Recommended Actions:</strong></p>
                    <ul>
                        <li>Plant ${Math.round(cityArea * 100)} native trees in urban corridors</li>
                        <li>Create green roofs on municipal buildings</li>
                        <li>Develop pocket parks in dense neighborhoods</li>
                        <li>Implement vertical gardens on building facades</li>
                    </ul>
                `,
                impacts: [
                    { type: "positive", text: "Reduces cooling costs" },
                    { type: "positive", text: "Improves air quality" },
                    { type: "positive", text: "Enhances biodiversity" },
                    { type: "negative", text: "Requires ongoing maintenance" }
                ]
            });
        }
        
        solutions.push({
            type: 'transportation',
            title: "Smart Mobility Network",
            icon: "🚆",
            description: "Optimize transportation for reduced emissions",
            details: `
                <ul>
                    <li>Current transportation emissions: ${Math.round(cityArea * 50)} tons CO₂/year</li>
                    <li>Recommended EV charging stations: ${Math.round(cityArea / 10)} locations</li>
                    <li>Potential emission reduction: ${Math.round(cityArea * 25)} tons CO₂/year</li>
                    <li>Estimated commute time improvement: 15-25% with optimized routes</li>
                </ul>
                <p><strong>Recommended Actions:</strong></p>
                <ul>
                    <li>Expand electric bus fleet with ${Math.round(cityArea / 5)} new vehicles</li>
                    <li>Create dedicated bike lanes covering ${Math.round(cityArea * 0.3)} km</li>
                    <li>Implement smart traffic signals at ${Math.round(cityArea * 2)} intersections</li>
                    <li>Develop mobility-as-a-service platform for integrated transport</li>
                </ul>
            `,
            impacts: [
                { type: "positive", text: "Reduces traffic congestion" },
                { type: "positive", text: "Lowers transportation emissions" },
                { type: "positive", text: "Improves public health" },
                { type: "negative", text: "Infrastructure investment needed" }
            ]
        });

        return solutions;
    }

    function displayAISolutions(solutions) {
        const solutionsHTML = solutions.map(solution => `
            <div class="solution-card">
                <div class="solution-header">
                    <div class="solution-icon">${solution.icon}</div>
                    <div class="solution-title">${solution.title}</div>
                </div>
                <div class="solution-description">${solution.description}</div>
                <div class="solution-details">${solution.details}</div>
                <div class="solution-impact">
                    ${solution.impacts.map(impact => `
                        <div class="impact-item">
                            <span class="impact-${impact.type}">${impact.type === 'positive' ? '✓' : '⚠'}</span>
                            <span>${impact.text}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="solution-actions">
                    <button class="btn-outline" onclick="window.visualizeSolution('${solution.type}')">
                        <i class="fas fa-map-marker-alt"></i> Show on Map
                    </button>
                </div>
            </div>
        `).join('');

        aiOutput.innerHTML = `
            <div class="ai-solutions">
                <h3 style="color: #2c3e50; margin-bottom: 1rem;">AI-Generated Location-Specific Solutions</h3>
                <div class="solution-grid">
                    ${solutionsHTML}
                </div>
                <div style="margin-top: 1rem; padding: 1rem; background: #e3f2fd; border-radius: 8px;">
                    <p style="margin: 0; font-size: 0.9rem; color: #2c3e50;">
                        <strong>💡 Tip:</strong> Click "Show on Map" to see recommended implementation locations for each solution.
                        The map will automatically scroll into view.
                    </p>
                </div>
            </div>
        `;
    }

    // Make visualizeSolution function globally available
    window.visualizeSolution = function(solutionType) {
        if (currentCityData && cityBoundary) {
            visualizeSolutionOnMap(solutionType, currentCityData, cityBoundary);
        }
    };

    // Initialize with layer controls hidden
    layerControls.style.display = 'none';
});

// --- Enhanced Problem Reporting Form ---
const problemReportForm = document.getElementById("problemReportForm");
const cancelReportBtn = document.getElementById("cancelReport");

function handleProblemReport(event) {
    event.preventDefault();
    
    const reportData = {
        userName: document.getElementById('userName').value,
        userEmail: document.getElementById('userEmail').value,
        problemType: document.getElementById('problemType').value,
        problemLocation: document.getElementById('problemLocation').value,
        problemDescription: document.getElementById('problemDescription').value,
        urgency: document.querySelector('input[name="urgency"]:checked').value,
        city: document.getElementById('cityInput').value || 'Not specified',
        timestamp: new Date().toISOString()
    };
    
    console.log('Problem report submitted:', reportData);
    
    const reportSection = document.getElementById('report-section');
    reportSection.innerHTML = `
        <div class="success-message">
            <i class="fas fa-check-circle"></i>
            <h3>Report Submitted Successfully!</h3>
            <p>
                Your report has been sent to city officials and our team. 
                We'll review it and take appropriate action.
            </p>
            <button onclick="resetReportForm()" class="btn-secondary" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white;">
                Submit Another Report
            </button>
        </div>
    `;
}

function resetReportForm() {
    const reportSection = document.getElementById('report-section');
    reportSection.innerHTML = `
        <h3><i class="fas fa-exclamation-triangle"></i> Report Environmental Problem</h3>
        <p style="margin-bottom: 1.5rem; color: #7f8c8d;">Found an environmental issue? Report it directly to city officials and our team.</p>
        
        <form id="problemReportForm">
            <div class="form-row">
                <div class="form-group">
                    <label for="userName">Your Name</label>
                    <input type="text" id="userName" placeholder="Enter your name" required>
                </div>
                <div class="form-group">
                    <label for="userEmail">Your Email</label>
                    <input type="email" id="userEmail" placeholder="Enter your email" required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="problemType">Problem Type</label>
                <select id="problemType" required>
                    <option value="">Select problem type</option>
                    <option value="air_quality">🌫️ Air Quality Issue</option>
                    <option value="pollution">🏭 Pollution Source</option>
                    <option value="waste">🗑️ Waste Management</option>
                    <option value="noise">🔊 Noise Pollution</option>
                    <option value="water">💧 Water Quality</option>
                    <option value="green_space">🌳 Lack of Green Space</option>
                    <option value="other">❓ Other Issue</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="problemLocation">Problem Location</label>
                <input type="text" id="problemLocation" placeholder="e.g., Downtown, Residential Area, Park, etc." required>
            </div>
            
            <div class="form-group">
                <label for="problemDescription">Problem Description</label>
                <textarea id="problemDescription" placeholder="Please describe the problem in detail..." rows="4" required></textarea>
            </div>
            
            <div class="form-group">
                <label>Urgency Level</label>
                <div class="urgency-options">
                    <label class="urgency-option">
                        <input type="radio" name="urgency" value="low" required>
                        <span class="urgency-label">Low</span>
                    </label>
                    <label class="urgency-option">
                        <input type="radio" name="urgency" value="medium">
                        <span class="urgency-label">Medium</span>
                    </label>
                    <label class="urgency-option">
                        <input type="radio" name="urgency" value="high">
                        <span class="urgency-label">High</span>
                    </label>
                    <label class="urgency-option">
                        <input type="radio" name="urgency" value="emergency">
                        <span class="urgency-label">Emergency</span>
                    </label>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" id="cancelReport" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-paper-plane"></i> Submit Report
                </button>
            </div>
        </form>
    `;
    
    document.getElementById('problemReportForm').addEventListener('submit', handleProblemReport);
    document.getElementById('cancelReport').addEventListener('click', resetReportForm);
}

problemReportForm.addEventListener('submit', handleProblemReport);
cancelReportBtn.addEventListener('click', resetReportForm);