// =============================================================================
// 1. CONFIGURATIE & VERTALINGEN
// =============================================================================

const translations = {
    en: {
        heading: "HEADING", distance: "DISTANCE", sog: "SOG", location: "LOCATION",
        wind: "WIND", waves: "WAVES", settings_title: "Settings",
        language: "Language", units: "Units", night_mode: "Night Mode",
        records_title: "Trip Records", max_speed: "Max Speed:", max_wind: "Max Wind:",
        max_waves: "Max Waves:", reset_btn: "Reset Records",
        active_leg: "ACTIVE VOYAGE",
        dst: "Daylight Saving", // <--- Toegevoegd
        btn_on: "ON",
        btn_off: "OFF"
    },
    nl: {
        heading: "KOERS", distance: "AFSTAND", sog: "SOG", location: "LOCATIE",
        wind: "WIND", waves: "GOLVEN", settings_title: "Instellingen",
        language: "Taal", units: "Eenheden", night_mode: "Nachtmodus",
        records_title: "Trip Records", max_speed: "Max Snelheid:", max_wind: "Max Wind:",
        max_waves: "Max Golven:", reset_btn: "Reset Records",
        active_leg: "ACTIEVE ETAPPE",
        dst: "Zomertijd", // <--- Toegevoegd
        btn_on: "AAN",
        btn_off: "UIT"
    },
    de: {
        heading: "KURS", distance: "DISTANZ", sog: "SOG", location: "STANDORT",
        wind: "WIND", waves: "WELLEN", settings_title: "Einstellungen",
        language: "Sprache", units: "Einheiten", night_mode: "Nachtmodus",
        records_title: "Fahrtenschreiber", max_speed: "Max Geschw.:", max_wind: "Max Wind:",
        max_waves: "Max Wellen:", reset_btn: "Zurücksetzen",
        active_leg: "AKTUELLER ABSCHNITT",
        dst: "Sommerzeit", // <--- Toegevoegd
        btn_on: "AN",
        btn_off: "AUS"
    },
    fr: {
        heading: "CAP", distance: "DISTANCE", sog: "SOG", location: "POSITION",
        wind: "VENT", waves: "VAGUES", settings_title: "Paramètres",
        language: "Langue", units: "Unités", night_mode: "Mode Nuit",
        records_title: "Enregistrements", max_speed: "Vitesse Max:", max_wind: "Vent Max:",
        max_waves: "Vagues Max:", reset_btn: "Réinitialiser",
        active_leg: "VOYAGE ACTIF",
        dst: "Heure d'été", // <--- Toegevoegd (C'est bon!)
        btn_on: "ACTIF",    // <--- "Aan" in chique Frans
        btn_off: "ARRÊT"    // <--- "Uit" in chique Frans
    }
};

let settings = {
    lang: localStorage.getItem('cmp_lang') || 'en',
    speedUnit: localStorage.getItem('cmp_speedUnit') || 'KN',
    nightMode: localStorage.getItem('cmp_nightMode') === 'true',
    // Nieuw: Tijd weergave (UTC is standaard, true = Lokale tijd/DST)
    showLocalTime: localStorage.getItem('cmp_showLocalTime') === 'true',
    maxSpeed: parseFloat(localStorage.getItem('cmp_maxSpeed')) || 0,
    maxWind: parseFloat(localStorage.getItem('cmp_maxWind')) || 0,
    maxWaves: parseFloat(localStorage.getItem('cmp_maxWaves')) || 0,
    // Nieuw: Opslag voor weer-data om API calls te beperken
    lastWeatherUpdate: 0,
    lastWeatherLat: parseFloat(localStorage.getItem('cmp_lastWeatherLat')) || null,
    lastWeatherLon: parseFloat(localStorage.getItem('cmp_lastWeatherLon')) || null,
    cachedWind: "--",
    cachedWaves: "--"
};

let map, shipMarker, isFollowing = true;
let currentPos = {
    lat: parseFloat(localStorage.getItem('cmp_last_lat')) || -34.60,
    lon: parseFloat(localStorage.getItem('cmp_last_lon')) || -58.38,
    heading: 0,
    speed: 0
};
let lastPos = null, lastTimestamp = 0; // Voor handmatige snelheidsberekening
let mapMoveTimeout;
let activeRoute = null;
let cruisePortsDB = []; // Fix: Declareer de database variabele
let lastNotifiedCrossing = null; // Voor spam-check
let lastNotifiedTime = 0;
let itineraryMarkers = []; // Opslag voor poort markers op de kaart
let currentEvent = null; // Het huidige of laatste event
let nextEvent = null;    // Het eerstvolgende event

mapboxgl.accessToken = 'pk.eyJ1IjoiZ3dtc2ltb25zIiwiYSI6ImNtbDFiemZidTAyZWczZHNlM2VobHV4YWwifQ._x5-LdvQ35Bsw11DPFjzPA';

let manualTargetIndex = null; // Gebruikers selectie voor Nav-Card/ETA
let isDragging = false;
let longPressTimer = null;
let touchStartX = 0;
let touchStartY = 0;
let drugItemIndex = null;


// =============================================================================
// 2. KAART & INITIALISATIE
// =============================================================================
function initMap(lat, lon) {
    if (map) return;
    map = new mapboxgl.Map({
        container: 'map',
        style: settings.nightMode ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/outdoors-v12',
        center: [lon, lat],
        zoom: 11,
        pitch: 45,
        attributionControl: false,
        projection: 'globe' // Aardbol weergave instellen
    });

    // We hebben de 'setWheelZoomRate' WEGGEHAALD om de standaard soepele zoom terug te krijgen.

    map.on('mousedown', () => stopFollowing());
    map.on('touchstart', () => stopFollowing());
    map.on('wheel', () => stopFollowing());

    map.on('style.load', () => {
        // Voeg een atmosfeer / ruimte achtergrond toe aan de globe
        map.setFog({}); 
        
        addBaseLayers();
        createShipMarker(currentPos.lat, currentPos.lon);
    });

    map.on('load', () => {
        initCursorListener();
        checkItinerary();
    });
}

// =============================================================================
// 2.1 ROUTE ENGINE 
// =============================================================================
function setRoute(points, endName = "Destination") {
    if (!points || points.length < 2) return;

    activeRoute = {
        path: points.map(p => [p.lon, p.lat]),
        totalDistanceNM: 0,
        waypoints: points.slice(1, -1),
        destination: { ...points[points.length - 1], name: endName }
    };

    // Afstand berekenen over het hele pad
    for (let i = 0; i < points.length - 1; i++) {
        activeRoute.totalDistanceNM += calculateDistance(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon);
    }

    drawRouteLine(activeRoute.path);
    updateDistance();
}

function getEventCoords(event) {
    if (!event) return null;
    if (event.coords) return event.coords;
    if (event.lat !== undefined && event.lon !== undefined) return { lat: event.lat, lon: event.lon };

    const key = event.port ? event.port.toUpperCase() : null;
    if (key && WAYPOINTS[key]) return WAYPOINTS[key];

    return null;
}

// =============================================================================
// 2.2 TEST ITINERARY MANAGER
// =============================================================================

// Zet dit op NULL als je op reis bent! (Dan pakt hij de echte datum)
// Zet dit op een datumstring (bijv. "2026-04-08") om te testen wat je dan ziet.
let simulationDate = null;

function checkItinerary() {
    let now = new Date();
    if (simulationDate) {
        now = new Date(simulationDate);
        console.log("⚠️ SIMULATIE MODUS: Datum is " + simulationDate);
    }

    // 1. Vind waar we ons bevinden in de tijdlijn
    //    BELANGRIJK: Sla events ZONDER datum over (bijv. WAYPOINTS met time:null)
    //    new Date(null) = 1 jan 1970, wat altijd in het verleden ligt en het systeem misleidt.
    let currentState = null;
    currentEvent = null;
    nextEvent = null;

    for (let i = 0; i < CRUISE_TIMELINE.length; i++) {
        const ev = CRUISE_TIMELINE[i];

        // Sla events zonder geldige datum over bij het bepalen van de huidige positie
        if (!ev.time && !ev.date) continue;

        let eventTime = new Date(ev.time || ev.date);

        if (eventTime <= now) {
            currentEvent = ev;
            // Zoek het eerstvolgende event MET een geldige datum als nextEvent
            for (let j = i + 1; j < CRUISE_TIMELINE.length; j++) {
                if (CRUISE_TIMELINE[j].time || CRUISE_TIMELINE[j].date) {
                    nextEvent = CRUISE_TIMELINE[j];
                    break;
                }
            }
        } else {
            if (!nextEvent) nextEvent = ev;
            break;
        }
    }

    if (!currentEvent) {
        if (CRUISE_TIMELINE.length > 0) {
            // We zijn nog niet begonnen aan de cruise
            currentEvent = { type: "WAITING", name: "Before Departure" };

            // Toon de route vanaf de allereerste haven (Departure BA)
            const firstWithDate = CRUISE_TIMELINE.findIndex(ev => ev.time || ev.date);

            // Het doel (nextEvent) moet de VOLGENDE belangrijke haven zijn (Arrival Rio)
            // zodat de route-lijn de tussenliggende waypoints meepakt.
            let nextStopIdx = -1;
            if (firstWithDate !== -1) {
                nextStopIdx = CRUISE_TIMELINE.findIndex((ev, idx) => idx > firstWithDate && (ev.time || ev.date));
            }

            nextEvent = nextStopIdx !== -1 ? CRUISE_TIMELINE[nextStopIdx] : CRUISE_TIMELINE[0];
            currentState = "AT_SEA";
        } else {
            console.log("Geen actieve route gevonden in de tijdlijn.");
            return;
        }
    }

    // 2. Bepaal de status
    if (currentEvent.type === "ARRIVAL" && nextEvent && nextEvent.type === "DEPARTURE" && nextEvent.port === currentEvent.port) {
        currentState = "IN_PORT";
    } else if (currentEvent.type === "DEPARTURE" || currentEvent.type === "SEA_DAY" || currentEvent.type === "WAYPOINT") {
        currentState = "AT_SEA";
    }

    // 3. Update de UI
    updateTimelineUI(currentState, currentEvent, nextEvent);

    // 4. Update de kaart (Route tekenen)
    let points = [];
    let startIdx = CRUISE_TIMELINE.indexOf(currentEvent);

    // Specifieke fix voor de route-lijn vòòr vertrek
    if (currentEvent.type === "WAITING") {
        startIdx = CRUISE_TIMELINE.findIndex(ev => ev.time || ev.date);
        if (startIdx === -1) startIdx = 0;
    }

    const endIdx = CRUISE_TIMELINE.indexOf(nextEvent);
    let targetIdx = manualTargetIndex !== null ? manualTargetIndex : endIdx;

    if (startIdx !== -1 && targetIdx !== -1) {
        const firstPointCoords = getEventCoords(CRUISE_TIMELINE[startIdx]);
        const distToStart = firstPointCoords ? calculateDistance(currentPos.lat, currentPos.lon, firstPointCoords.lat, firstPointCoords.lon) : 0;

        // Als we ver weg zijn (thuis?), begin bij de haven, niet bij GPS
        if (distToStart > 500) {
            if (firstPointCoords) points.push(firstPointCoords);
        } else {
            points.push({ lat: currentPos.lat, lon: currentPos.lon });
        }

        // Verzamel ALLE tussenliggende waypoints/stops naar het doel
        // Dit zorgt ervoor dat de stippellijn netjes de route van de eerste leg volgt
        for (let i = startIdx + 1; i <= targetIdx; i++) {
            const coords = getEventCoords(CRUISE_TIMELINE[i]);
            if (coords) points.push(coords);
        }
    } else if (nextEvent) {
        // Fallback: van huidige GPS naar volgende punt (bijv. als startIdx -1 is)
        const nextCoords = getEventCoords(nextEvent);
        if (nextCoords) {
            points.push({ lat: currentPos.lat, lon: currentPos.lon });
            points.push(nextCoords);
        }
    }

    if (points.length >= 2) {
        setRoute(points, nextEvent ? (nextEvent.name || nextEvent.port) : "Destination");
    }

    // 5. TEKEN DE VOLLEDIGE ROUTE & POORTEN (Altijd tonen)
    updateItineraryMarkers();
    drawFullRoute();
}

function updateItineraryMarkers() {
    if (!map) return;

    // Verwijder oude markers
    itineraryMarkers.forEach(m => m.remove());
    itineraryMarkers = [];

    CRUISE_TIMELINE.forEach((event, idx) => {
        const coords = getEventCoords(event);
        if (!coords) return;

        const el = document.createElement('div');
        el.className = 'port-marker ' + (event.type === 'WAYPOINT' ? 'waypoint-variant' : 'stop-variant');

        // Verschillende iconen per type
        let icon = "⚓";
        if (event.type === "SEA_DAY") icon = "🌊";
        if (event.type === "WAYPOINT") icon = "📍";

        el.innerHTML = `<span>${icon}</span>`;
        if (manualTargetIndex === idx) el.classList.add('active');

        // Maak popup content
        let popupHTML = `<strong>${event.name || event.port}</strong><br>${event.type}`;
        if (event.type === 'WAYPOINT') {
            popupHTML += `<br><small style="opacity:0.7">Double-tap to delete</small>`;
            popupHTML += `<br><button onclick="removeTimelineEvent(${idx})" style="margin-top:8px; background:#ff3b30; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">Delete Waypoint</button>`;
        }

        const marker = new mapboxgl.Marker({
            element: el,
            draggable: (event.type === 'WAYPOINT')
        })
            .setLngLat([coords.lon, coords.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
            .addTo(map);

        // -- INTERACTIE: SLEPEN (Alleen voor waypoints) --
        if (event.type === 'WAYPOINT') {
            marker.on('dragend', () => {
                const lngLat = marker.getLngLat();
                CRUISE_TIMELINE[idx].coords = { lat: lngLat.lat, lon: lngLat.lng };
                saveTimeline();
                checkItinerary(); // Herteken route
                triggerHaptic('impactHeavy');
            });

            // -- INTERACTIE: DUBBEL-TAP VERWIJDEREN --
            let lastTap = 0;
            let tapTimeout;
            el.addEventListener('click', (e) => {
                const now = new Date().getTime();
                const timesince = now - lastTap;

                if ((timesince < 500) && (timesince > 0)) {
                    // Double tap detected
                    clearTimeout(tapTimeout);
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("📍 Waypoint double-tap detected, removing...");

                    // Direct verwijderen bij dubbel-tik (zonder modal voor snelheid)
                    CRUISE_TIMELINE.splice(idx, 1);
                    if (manualTargetIndex === idx) manualTargetIndex = null;
                    else if (manualTargetIndex > idx) manualTargetIndex--;
                    saveTimeline();
                    renderTimeline();
                    checkItinerary();
                    triggerHaptic('notificationError');
                } else {
                    // Single tap - wait a bit to see if it becomes a double tap
                    tapTimeout = setTimeout(() => {
                        setManualTarget(idx);
                    }, 300);
                }
                lastTap = now;
            });
        } else {
            // Click handler voor normale poorten (geen waypoints)
            el.addEventListener('click', () => {
                setManualTarget(idx);
            });
        }

        itineraryMarkers.push(marker);
    });
}

function drawFullRoute() {
    if (!map) return;
    // Gebruiker gaf aan dat de rechte lijnen tussen havens achterwege kunnen blijven voor de grafische rust.
    // We tonen alleen de actieve etappe (die wel de waypoints volgt).
    if (map.getLayer('full-route-line')) {
        map.removeLayer('full-route-line');
        if (map.getSource('full-route-source')) map.removeSource('full-route-source');
    }
}

function findLastPort(event) {
    if (event.port) return event.port;
    // Zoek terug in de tijdlijn naar de laatste poort
    const idx = CRUISE_TIMELINE.indexOf(event);
    for (let i = idx; i >= 0; i--) {
        if (CRUISE_TIMELINE[i].port) return CRUISE_TIMELINE[i].port;
    }
    return null;
}

function findNextPort(event) {
    if (event.port) return event.port;
    // Zoek vooruit in de tijdlijn
    const idx = CRUISE_TIMELINE.indexOf(event);
    for (let i = idx; i < CRUISE_TIMELINE.length; i++) {
        if (CRUISE_TIMELINE[i].port) return CRUISE_TIMELINE[i].port;
    }
    return null;
}

function updateTimelineUI(state, current, next) {
    const legNameEl = document.getElementById('leg-name');
    const portLabelEl = document.getElementById('next-port-label');

    if (state === "IN_PORT") {
        if (legNameEl) legNameEl.innerText = "Current Port: " + current.name;
        if (portLabelEl) {
            portLabelEl.innerText = "Next: Sailing to " + (next ? next.name : "Destination");
        }
    } else {
        if (legNameEl) {
            legNameEl.innerText = current.type === "SEA_DAY" ? "Sailing: " + (current.name || "Open Sea") : "Leg: " + current.name + " ➜ " + (next ? next.name : "?");
        }
        if (portLabelEl && next) {
            portLabelEl.innerText = "Next: " + next.name;
        }
    }
}

function drawRouteLine(geoJsonCoords) {
    if (!map || !map.isStyleLoaded()) {
        console.log("📂 Map style not ready yet, skipping drawRouteLine for now.");
        return;
    }

    // Als de laag al bestaat, update de data
    if (map.getSource('route-source')) {
        map.getSource('route-source').setData({
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': geoJsonCoords
            }
        });
        // Forceer update van visuele eigenschappen
        map.setPaintProperty('route-line', 'line-width', 8);
        map.setPaintProperty('route-line', 'line-opacity', 1.0);
    } else {
        // Maak de laag aan (witte stippellijn)
        map.addSource('route-source', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': geoJsonCoords
                }
            }
        });

        map.addLayer({
            'id': 'route-line',
            'type': 'line',
            'source': 'route-source',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#00d4ff', // Cyan
                'line-width': 8,
                'line-dasharray': [1, 1],
                'line-opacity': 1.0
            }
        });
    }
}

function addBaseLayers() {
    // Alleen OpenSeaMap (Boeien) - Golf overlay is verwijderd
    if (!map.getSource('openseamap')) {
        map.addSource('openseamap', {
            'type': 'raster',
            'tiles': ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
            'tileSize': 256
        });
        map.addLayer({ 'id': 'openseamap-layer', 'type': 'raster', 'source': 'openseamap' });
    }

    // Voeg Evenaar (Equator) toe aan de kaart
    if (!map.getSource('equator')) {
        map.addSource('equator', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    // Multiple points om te zorgen dat de lijn goed rond de aarde getekend wordt
                    'coordinates': [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]
                }
            }
        });

        map.addLayer({
            'id': 'equator-line',
            'type': 'line',
            'source': 'equator',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#ff3b30', // Rood voor de evenaar
                'line-width': 2,
                'line-dasharray': [4, 4], // Stippellijn
                'line-opacity': 0.8
            }
        });
    }

    // === SHADOWBROKER WAVES LAYER ===
    if (!map.getSource('waves-source')) {
        map.addSource('waves-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Gebruik een vector SVG pijl (komt overeen met het screenshot idee)
        const arrowSvg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 5 L30 20 L23 20 L23 35 L17 35 L17 20 L10 20 Z" fill="black"/>
        </svg>`;
        const img = new Image();
        img.onload = () => {
            if (!map.hasImage('wave-arrow')) {
                map.addImage('wave-arrow', img, { sdf: true });
            }
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg);

        // Vector Pijlen Layer
        map.addLayer({
            'id': 'waves-arrow-layer',
            'type': 'symbol',
            'source': 'waves-source',
            'layout': {
                'icon-image': 'wave-arrow',
                'icon-rotation-alignment': 'map',
                // Golven reizen weg VAN de richting waar ze vandaan komen (+180 graden)
                'icon-rotate': ['+', ['get', 'dirpw'], 180],
                'icon-size': [
                    'interpolate', ['linear'], ['get', 'swh'],
                    2, 0.4,
                    8, 1.2
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            },
            'paint': {
                'icon-color': [
                    'interpolate', ['linear'], ['get', 'swh'],
                    2.0, '#00d4ff', // cyaan
                    4.0, '#0055ff', // blauw
                    6.0, '#8b00ff', // paars
                    8.0, '#e6007e', // magenta
                    10.0, '#ff0000' // rood (extreem)
                ],
                'icon-opacity': 0.9
            }
        });

        // Tekst Label Layer (bijv "6.5 m")
        map.addLayer({
            'id': 'waves-text-layer',
            'type': 'symbol',
            'source': 'waves-source',
            'layout': {
                'text-field': ['concat', ['to-string', ['get', 'swh']], ' m'],
                'text-size': 12,
                'text-offset': [0, 1.8],
                'text-anchor': 'top',
                'text-allow-overlap': false
            },
            'paint': {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0,0,0,0.8)',
                'text-halo-width': 1.5
            }
        });

        // Activeren van dynamisch ophalen wanneer de kaart beweegt
        map.on('moveend', fetchGlobalWaves);
        map.on('zoomend', fetchGlobalWaves);
        setTimeout(fetchGlobalWaves, 1000); // Initial fetch
    }
}

// =============================================================================
// 3. DATA LOGICA (GPS, Records & Weer)
// =============================================================================
function handleSuccess(pos) {
    const crd = pos.coords;
    const now = Date.now();

    // 1. Ruwe snelheid van sensor (kan null zijn)
    let rawSpeed = crd.speed;

    // 2. Handmatige snelheidsberekening als sensor faalt (voor binnen/wandelen)
    if ((rawSpeed === null || rawSpeed === undefined || rawSpeed === 0) && lastPos) {
        const d = calculateDistance(lastPos.lat, lastPos.lon, crd.latitude, crd.longitude);
        const dt = (now - lastTimestamp) / 3600000; // uren

        if (dt > 0.0002) { // Elke 0.7 seconden minimaal checken voor stabiliteit
            const calcKnots = d / dt;
            // GPS Jitter filter: alleen snelheden tussen 0.5 knopen en 50 knopen (voor lopen/varen)
            if (calcKnots > 0.5 && calcKnots < 50) {
                rawSpeed = calcKnots / 1.94384; // Terug naar m/s
            }
        }
    }

    // Bewaar voor volgende fix
    lastPos = { lat: crd.latitude, lon: crd.longitude };
    lastTimestamp = now;

    const finalSpeed = rawSpeed || 0;

    currentPos = {
        lat: crd.latitude, lon: crd.longitude,
        heading: crd.heading || 0, speed: finalSpeed
    };

    // Opslaan voor herstart (Throttled: alleen opslaan als er > 0.0001 verandering is of elke 30 sec)
    const lastSavedLat = parseFloat(localStorage.getItem('cmp_last_lat'));
    const lastSavedLon = parseFloat(localStorage.getItem('cmp_last_lon'));
    if (!lastSavedLat || Math.abs(crd.latitude - lastSavedLat) > 0.0001 || Math.abs(crd.longitude - lastSavedLon) > 0.0001) {
        localStorage.setItem('cmp_last_lat', crd.latitude);
        localStorage.setItem('cmp_last_lon', crd.longitude);
    }

    // --- COÖRDINATEN UPDATEN (GESTAPELD) ---
    const coordsEl = document.getElementById('coords');
    if (coordsEl) {
        coordsEl.innerHTML = `<span>${crd.latitude.toFixed(5)}</span><span>${crd.longitude.toFixed(5)}</span>`;
    }

    // 3. Snelheid omzetten naar gekozen eenheid
    let speedVal = 0;
    if (settings.speedUnit === 'KN') speedVal = finalSpeed * 1.94384;
    else if (settings.speedUnit === 'KMH') speedVal = finalSpeed * 3.6;
    else if (settings.speedUnit === 'MPH') speedVal = finalSpeed * 2.23694;

    const speedDisplay = document.getElementById('snelheid');
    if (speedDisplay) {
        // Iets soepeler tonen: alles boven 0.05 tonen we
        speedDisplay.innerText = speedVal > 0.05 ? speedVal.toFixed(1) : "0.0";
    }

    // --- NIEUW: KOERSGETAL UPDATEN ---
    const headingEl = document.getElementById('digital-heading');
    if (headingEl && crd.heading !== null) {
        // We ronden het getal af voor het display
        headingEl.innerText = Math.round(crd.heading) + "°";
    }
    // --------------------------------

    // Max Snelheid Record Check
    if (speedVal > settings.maxSpeed) {
        settings.maxSpeed = speedVal;
        localStorage.setItem('cmp_maxSpeed', settings.maxSpeed);
        updateRecordsUI();
    }

    updateMapPosition(crd.latitude, crd.longitude, crd.heading, speedVal);

    // Alleen kompas draaien als er een geldige koers is
    if (crd.heading !== null) {
        updateCompass(crd.heading);
    }

    updateDistance();
    checkCrossings(crd.latitude, crd.longitude, speedVal);
    fetchMarineData(crd.latitude, crd.longitude);
}

// CROSSING ALERTS LOGIC (Equator & Meridian)
function checkCrossings(lat, lon, speedKnots) {
    const threshold = 1.0; // Check binnen 1 graad (~60 NM)
    const alertEl = document.getElementById('crossing-alert');
    const titleEl = document.getElementById('crossing-title');
    const distEl = document.getElementById('crossing-eta'); // We hergebruiken het ID maar tonen afstand
    const progressEl = document.getElementById('crossing-progress-bar');

    if (!alertEl) return;

    let targetName = null;
    let distNM = 0;

    // 1. Check Equator (Lat 0)
    if (Math.abs(lat) < threshold) {
        targetName = "Equator Crossing";
        distNM = Math.abs(lat) * 60;
    }

    if (targetName) {
        titleEl.innerText = targetName;

        // Afstand tonen op basis van gekozen eenheid
        let distText = distNM.toFixed(1) + " nm";
        if (settings.speedUnit === 'KMH') {
            distText = (distNM * 1.852).toFixed(1) + " km";
        }
        distEl.innerText = distText;

        // --- NOTIFICATIE OP TELEFOON ---
        // Alleen vuren als we binnen 10 km (5.4 nm) zijn en nog niet eerder voor dit type hebben gemeld in het afgelopen half uur
        const thresholdNM = 5.4; // ~10km
        const now = Date.now();

        if (distNM < thresholdNM && (lastNotifiedCrossing !== targetName || (now - lastNotifiedTime > 1800000))) {
            lastNotifiedCrossing = targetName;
            lastNotifiedTime = now;

            // 1. Trillen op de telefoon
            triggerHaptic('notificationSuccess');

            // 2. Systeem notificatie (indien toegestaan)
            if (window.Notification && Notification.permission === "granted") {
                new Notification(targetName, {
                    body: "Approaching within " + distText,
                    icon: "icons/icon-192.webp"
                });
            }
            console.log("🔔 Systeem notificatie verstuurd!");
        }

        // Progress bar: 0-100% gebaseerd op de 1 graad threshold
        const progress = Math.max(0, Math.min(100, 100 - (distNM / 60 * 100)));
        if (progressEl) progressEl.style.width = progress + "%";

        alertEl.classList.remove('hidden');
    } else {
        alertEl.classList.add('hidden');
    }
}

// SIMULATIE HELPER (Voor in de console!)
// Gebruik: simulateCrossing('equator') of simulateCrossing('meridian')
function simulateCrossing(type) {
    const originalPos = { ...currentPos };

    if (type === 'equator') {
        // Vlakbij evenaar (bijv. 0.05 graden = ~5.4 NM = 10 KM)
        handleSuccess({
            coords: {
                latitude: 0.05,
                longitude: currentPos.lon,
                speed: 10,
                heading: 0
            }
        });
    }

    console.log("🚀 Simulatie gestart voor:", type);
    console.log("ℹ️ Wacht even tot de updates verwerkt zijn.");

    // Na 10 seconden herstellen we de oude data
    setTimeout(() => {
        handleSuccess({
            coords: {
                latitude: originalPos.lat,
                longitude: originalPos.lon,
                speed: originalPos.speed,
                heading: originalPos.heading
            }
        });
        console.log("⚓ Simulatie beëindigd, positie hersteld.");
    }, 10000);
}


// =============================================================================
// WEER & API (Met Throttle)
// =============================================================================
async function fetchMarineData(lat, lon, force = false) {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000; // Verhoogd naar 30 min op verzoek van gebruiker

    // Bereken afstand vanaf laatste update (indien beschikbaar)
    let distSinceLast = 999;
    if (settings.lastWeatherLat && settings.lastWeatherLon) {
        distSinceLast = calculateDistance(lat, lon, settings.lastWeatherLat, settings.lastWeatherLon);
    }

    // CHECK: Alleen overslaan als we NIET forceren, 
    // EN binnen de 30 min zitten,
    // EN we minder dan 5 NM hebben gevaren sedert de laatste check.
    if (!force && (now - settings.lastWeatherUpdate < thirtyMinutes) && distSinceLast < 5.0 && settings.cachedWind !== "--") {
        // Stilzwijgend overslaan om de console en accu te sparen
        return;
    }

    if (lat === undefined || lon === undefined) return;

    if (force) {
        console.log("🔍 Handmatige weer-check voor nieuwe locatie...");
    } else {
        console.log("🌍 Nieuwe weer-data ophalen (Regulier of afstand " + distSinceLast.toFixed(1) + " NM)...");
    }

    let waveHeight = settings.cachedWaves !== "--" ? settings.cachedWaves : 0;
    let bft = settings.cachedWind !== "--" ? settings.cachedWind : 0;

    try {
        // We splitsen de fetches op zodat een missende marine-spot de wind-update niet blokkeert
        const mPromise = fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height`)
            .then(r => r.json())
            .catch(() => null);

        const wPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m&wind_speed_unit=kmh`)
            .then(r => r.json())
            .catch(() => null);

        const [mData, wData] = await Promise.all([mPromise, wPromise]);

        if (mData && mData.current) {
            waveHeight = mData.current.wave_height;
        }

        if (wData && wData.current) {
            const windSpeedKmh = wData.current.wind_speed_10m;
            bft = kmhToBeaufort(windSpeedKmh);
        }

        // UI Updaten
        updateWeatherUI(bft, waveHeight, Date.now(), !force);

        if (!force) {
            settings.lastWeatherUpdate = now;
            settings.lastWeatherLat = lat;
            settings.lastWeatherLon = lon;
            settings.cachedWind = bft;
            settings.cachedWaves = waveHeight;

            localStorage.setItem('cmp_lastWeatherLat', lat);
            localStorage.setItem('cmp_lastWeatherLon', lon);

            if (bft > settings.maxWind) { settings.maxWind = bft; localStorage.setItem('cmp_maxWind', bft); }
            if (waveHeight > settings.maxWaves) { settings.maxWaves = waveHeight; localStorage.setItem('cmp_maxWaves', waveHeight); }
            updateRecordsUI();
        }
    } catch (err) {
        console.warn("⚠️ Weer-update mislukt:", err);
    }
}

async function fetchGlobalWaves() {
    if (!map || !map.isStyleLoaded() || !wavesVisible) return;

    // Haal de huidige kaartgrenzen op om data te beperken
    const bounds = map.getBounds();
    const min_lon = bounds.getWest();
    const max_lon = bounds.getEast();
    const min_lat = bounds.getSouth();
    const max_lat = bounds.getNorth();

    // Ontdek host IP, of gebruik het lokale Mac IP voor de telefoon
    let url;
    const isCapacitor = window.Capacitor && window.Capacitor.isNative;
    const host = window.location.hostname;

    if (isCapacitor) {
        // iOS App: Altijd direct naar de online Koyeb database verbinden!
        url = `https://opposite-rosetta-cruisedash-94c0866d.koyeb.app/api/waves?min_lon=${min_lon}&max_lon=${max_lon}&min_lat=${min_lat}&max_lat=${max_lat}&min_height=2.0`;
    } else if (host === 'localhost' || host === '127.0.0.1' || host === '') {
        // Laptop lokale test (buiten Koyeb)
        url = `http://192.168.1.142:8000/api/waves?min_lon=${min_lon}&max_lon=${max_lon}&min_lat=${min_lat}&max_lat=${max_lat}&min_height=2.0`;
    } else {
        // Productiemodus via webbrowser op de Koyeb site zelf
        url = `/api/waves?min_lon=${min_lon}&max_lon=${max_lon}&min_lat=${min_lat}&max_lat=${max_lat}&min_height=2.0`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        const source = map.getSource('waves-source');
        if (source) {
            source.setData(data);
        }
    } catch (e) {
        console.warn('⚠️ Global Waves ophalen mislukt (Staat de Python API aan?):', e);
    }
}

// === TACTICAL WAVE OVERLAY TOGGLE ===
let wavesVisible = true;
window.toggleWaves = function() {
    if (!map || !map.isStyleLoaded()) return;
    wavesVisible = !wavesVisible;
    const visibility = wavesVisible ? 'visible' : 'none';
    
    if (map.getLayer('waves-arrow-layer')) {
        map.setLayoutProperty('waves-arrow-layer', 'visibility', visibility);
    }
    if (map.getLayer('waves-text-layer')) {
        map.setLayoutProperty('waves-text-layer', 'visibility', visibility);
    }
    
    const btn = document.getElementById('waveToggleBtn');
    if (btn) {
        if (wavesVisible) {
            btn.classList.add('wave-active');
            fetchGlobalWaves(); // Haal direct actuele data als je hem net aanzet
        } else {
            btn.classList.remove('wave-active');
        }
    }
}

// === TIMEZONES OVERLAY (Option 2) ===
let zonesVisible = false;
window.toggleZones = function() {
    if (!map || !map.isStyleLoaded()) return;
    zonesVisible = !zonesVisible;
    
    if (!map.getSource('timezones-source')) {
        map.addSource('timezones-source', {
            type: 'geojson',
            data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson'
        });
        
        map.addLayer({
            'id': 'timezones-fill',
            'type': 'fill',
            'source': 'timezones-source',
            'paint': {
                'fill-color': [
                    'match',
                    ['get', 'map_color8'],
                    1, 'rgba(0, 212, 255, 0.3)',   /* Cyaan */
                    2, 'rgba(191, 90, 242, 0.3)',  /* Paars */
                    3, 'rgba(50, 215, 75, 0.3)',   /* Groen */
                    4, 'rgba(255, 159, 10, 0.3)',  /* Oranje */
                    5, 'rgba(255, 55, 95, 0.3)',   /* Roze */
                    6, 'rgba(10, 132, 255, 0.3)',  /* Blauw */
                    7, 'rgba(255, 214, 10, 0.3)',  /* Geel */
                    8, 'rgba(0, 199, 190, 0.3)',   /* Mint */
                    'rgba(255, 255, 255, 0.1)'
                ],
                'fill-opacity': 1
            }
        });

        map.addLayer({
            'id': 'timezones-line',
            'type': 'line',
            'source': 'timezones-source',
            'paint': {
                'line-color': 'rgba(255, 255, 255, 0.2)', /* Witte grenslijn */
                'line-width': 1,
                'line-dasharray': [3, 3] 
            }
        });
    }

    const visibility = zonesVisible ? 'visible' : 'none';
    if (map.getLayer('timezones-fill')) map.setLayoutProperty('timezones-fill', 'visibility', visibility);
    if (map.getLayer('timezones-line')) map.setLayoutProperty('timezones-line', 'visibility', visibility);

    const btn = document.getElementById('tzToggleBtn');
    if (btn) {
        if (zonesVisible) btn.classList.add('tz-active');
        else btn.classList.remove('tz-active');
    }
}

// === DAY/NIGHT TERMINATOR — Canvas Raster met echte pixel-voor-pixel gradient ===
let dayNightVisible = false;
let terminatorInterval;

function computeSunDeclination(date) {
    const D2R = Math.PI / 180;
    const d = (date / 86400000) + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * D2R;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const e = 23.439 * D2R;
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const GMST = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    const GHA = GMST * 15 * D2R;
    return { dec, GHA };
}

function buildTerminatorCanvas(date) {
    const W = 1024, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const { dec, GHA } = computeSunDeclination(date);
    const D2R = Math.PI / 180;
    const sinDec = Math.sin(dec), cosDec = Math.cos(dec);

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    for (let py = 0; py < H; py++) {
        const lat = (0.5 - py / H) * Math.PI; // -π/2 tot π/2
        const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
        for (let px = 0; px < W; px++) {
            const lon = (px / W - 0.5) * 2 * Math.PI; // -π tot π
            const HA = GHA - lon;
            // Zonne-hoogte in graden
            const sinAlt = sinLat * sinDec + cosLat * cosDec * Math.cos(HA);
            const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / D2R;

            let alpha = 0;
            if (altDeg < 0) {
                // Smoothstep gradient van horizon (0°) tot astronomische nacht (-18°)
                const t = Math.min(1, altDeg / -18);
                // Cubic smoothstep: heel vloeiend, geen harde kanten
                const smooth = t * t * (3 - 2 * t);
                alpha = Math.round(smooth * 175); // max 175/255 ≈ 68% opaciteit
            }

            const idx = (py * W + px) * 4;
            data[idx]     = 0;   // R
            data[idx + 1] = 7;   // G
            data[idx + 2] = 32;  // B — donkerblauw (middernacht)
            data[idx + 3] = alpha;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

// Hoeken voor de full-world image overlay in Mapbox (equirectangular)
const TERMINATOR_COORDS = [[-180, 85.051129], [180, 85.051129], [180, -85.051129], [-180, -85.051129]];

function updateTerminatorCanvas() {
    const src = map.getSource('terminator-canvas-src');
    if (!src) return;
    src.updateImage({ url: buildTerminatorCanvas(Date.now()), coordinates: TERMINATOR_COORDS });
}

window.toggleDayNight = function() {
    if (!map || !map.isStyleLoaded()) return;
    dayNightVisible = !dayNightVisible;

    if (!map.getSource('terminator-canvas-src')) {
        map.addSource('terminator-canvas-src', {
            type: 'image',
            url: buildTerminatorCanvas(Date.now()),
            coordinates: TERMINATOR_COORDS
        });
        map.addLayer({
            id: 'terminator-canvas-layer',
            type: 'raster',
            source: 'terminator-canvas-src',
            paint: { 'raster-opacity': 1, 'raster-fade-duration': 500 }
        });
    }

    const visibility = dayNightVisible ? 'visible' : 'none';
    if (map.getLayer('terminator-canvas-layer')) {
        map.setLayoutProperty('terminator-canvas-layer', 'visibility', visibility);
    }

    if (dayNightVisible) {
        updateTerminatorCanvas();
        terminatorInterval = setInterval(updateTerminatorCanvas, 60000);
    } else {
        if (terminatorInterval) clearInterval(terminatorInterval);
    }

    const btn = document.getElementById('dayNightToggleBtn');
    if (btn) {
        if (dayNightVisible) btn.classList.add('dn-active');
        else btn.classList.remove('dn-active');
    }
}

function updateWeatherUI(wind, waves, timestamp = Date.now(), saveToCache = true) {
    const windEl = document.getElementById('wind');
    const waveEl = document.getElementById('golven');

    if (!windEl || !waveEl) return;

    // Prevent flickering to "--" if we have current data and the new data is missing
    if (wind === "--" && windEl.innerText !== "--") return;

    windEl.innerText = wind;
    waveEl.innerText = waves;

    // Weer is "stale" als het ouder is dan 1 uur
    const isStale = (Date.now() - timestamp) > 1000 * 60 * 60;

    const envCard = document.querySelector('.env-card');
    if (envCard) {
        // Reset alle status-classes
        envCard.classList.remove('state-stale', 'state-ship', 'state-scout');

        if (isStale) {
            envCard.classList.add('state-stale');
        } else if (saveToCache) {
            envCard.classList.add('state-ship');
        } else {
            envCard.classList.add('state-scout');
        }
    }
}

// Hulpfunctie om cache te laden bij opstarten
function loadWeatherCache() {
    const cached = localStorage.getItem('cmp_cached_weather');
    if (cached) {
        const data = JSON.parse(cached);
        updateWeatherUI(data.wind, data.waves, data.time);
    }
}

// =============================================================================
// 4. INSTELLINGEN & VERTALINGEN
// =============================================================================
function toggleLanguage() {
    const langs = ['en', 'nl', 'de', 'fr'];
    let idx = langs.indexOf(settings.lang);
    settings.lang = langs[(idx + 1) % langs.length];
    localStorage.setItem('cmp_lang', settings.lang);

    // 1. Update alle teksten (DISTANCE, SOG, etc)
    updateUI();

    // 2. Update de datum direct (van ZO naar SUN)
    updateTimeDisplay();

    // 3. Update ook de tekst op de Zomertijd-knop
    const dstBtn = document.getElementById('dst-btn');
    if (dstBtn) {
        const t = translations[settings.lang];
        dstBtn.innerText = settings.dst ? t.btn_on : t.btn_off;
    }
}

function toggleUnits() {
    // 1. Wissel tussen 'KN', 'KMH' en 'MPH'
    if (settings.speedUnit === 'KN') {
        settings.speedUnit = 'KMH';
    } else if (settings.speedUnit === 'KMH') {
        settings.speedUnit = 'MPH';
    } else {
        settings.speedUnit = 'KN';
    }
    localStorage.setItem('cmp_speedUnit', settings.speedUnit);

    // 2. Update alle getallen op het scherm (snelheid wordt omgerekend)
    // De handleSuccess bevat de weergave logica, bij gebrek aan een handleSuccess trigger verversen we de UI handmatig
    // We roepen handleSuccess aan met de laatst bekende positie (indien beschikbaar)
    if (currentPos && currentPos.lat) {
        handleSuccess({
            coords: {
                latitude: currentPos.lat,
                longitude: currentPos.lon,
                heading: currentPos.heading,
                speed: currentPos.speed
            }
        });
    }

    // 3. Update de knop tekst
    updateUI();
}

function toggleDST() {
    // Wissel de waarde (true/false)
    settings.dst = !settings.dst;

    // Sla op (optioneel, zodat hij het onthoudt na verversen)
    localStorage.setItem('cmp_dst', settings.dst);

    // Update de knop tekst
    const dstBtn = document.getElementById('dst-btn');
    if (dstBtn) {
        const t = translations[settings.lang];
        dstBtn.innerText = settings.dst ? t.btn_on : t.btn_off;
        dstBtn.classList.toggle('active', settings.dst);
    }

    // Update de klok direct (oranje of wit)
    updateTimeDisplay();
}

function updateUI() {
    const t = translations[settings.lang];
    if (!t) return;

    // A. Vertaal alle standaard labels (zoals "Language", "Settings")
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });

    // B. UPDATE DE KNOPPEN OP BASIS VAN DE ECHTE STATUS

    // 1. DST (Zomertijd)
    const dstBtn = document.getElementById('dst-btn');
    if (dstBtn) {
        dstBtn.innerText = settings.dst ? t.btn_on : t.btn_off;
        dstBtn.classList.toggle('active', settings.dst); // Maakt hem blauw als hij AAN is
    }

    // 2. Night Mode
    const nightBtn = document.getElementById('nightModeBtn');
    if (nightBtn) {
        // Check de body class voor de waarheid
        const isNight = document.body.classList.contains('night-mode');
        nightBtn.innerText = isNight ? t.btn_on : t.btn_off;
        nightBtn.classList.toggle('active', isNight);
    }

    // 3. Units (Eenheden)
    const unitBtn = document.getElementById('unitBtn');
    const speedUnitDisplay = document.getElementById('speedUnitDisplay');
    const distUnitDisplay = document.getElementById('distUnitDisplay');

    if (unitBtn) {
        // Toon wat er GESELECTEERD is
        unitBtn.innerText = settings.speedUnit + (settings.speedUnit === 'KN' ? " / NM" : " / KM");
        if (speedUnitDisplay) speedUnitDisplay.innerText = settings.speedUnit;
        if (distUnitDisplay) distUnitDisplay.innerText = settings.speedUnit === 'KN' ? "NM" : "KM";
    }
    // 4. Taal (voor nu nog even de oude knop, straks de nieuwe)
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.innerText = settings.lang.toUpperCase();
    }
}

// =============================================================================
// 5. NAVIGATIE & HELPERS
// =============================================================================
function updateDistance() {
    const activeDestNameEl = document.getElementById('active-dest-name');
    let distNM = null;
    let targetName = "--";

    // 1. Check MANUAL TARGET first (User preference)
    if (manualTargetIndex !== null && CRUISE_TIMELINE[manualTargetIndex]) {
        const target = CRUISE_TIMELINE[manualTargetIndex];
        targetName = target.name || target.port || "Selected Stop";

        const portKey = target.port ? target.port.toUpperCase() : null;
        let targetCoords = (portKey ? WAYPOINTS[portKey] : null) || target.coords;

        // --- SLIMME LOGICA VOOR SEADAGEN ---
        if (!targetCoords) {
            const lowerName = targetName.toLowerCase();
            // Is het een kruising (Evenaar)?
            if (lowerName.includes("equator") || lowerName.includes("evenaar")) {
                targetCoords = { lat: 0, lon: currentPos.lon };
            } else {
                // Geen specifieke plek? Toon afstand naar de eerstvolgende haven na deze seaday
                for (let i = manualTargetIndex + 1; i < CRUISE_TIMELINE.length; i++) {
                    const nextT = CRUISE_TIMELINE[i];
                    const nextKey = nextT.port ? nextT.port.toUpperCase() : null;
                    const nextCoords = (nextKey ? WAYPOINTS[nextKey] : null) || nextT.coords;
                    if (nextCoords) {
                        targetCoords = nextCoords;
                        // Optioneel: We houden de naam "Sea Day" maar de afstand is naar de bestemming
                        break;
                    }
                }
            }
        }

        if (targetCoords) {
            distNM = calculateDistance(currentPos.lat, currentPos.lon, targetCoords.lat, targetCoords.lon);
        }
    }
    // 2. Fallback to AUTOMATIC active route
    else if (activeRoute && activeRoute.destination) {
        targetName = activeRoute.destination.name || "Next Port";

        if (activeRoute.waypoints && activeRoute.waypoints.length > 0) {
            let prevPoint = { lat: currentPos.lat, lon: currentPos.lon };
            activeRoute.waypoints.forEach(wp => {
                distNM += calculateDistance(prevPoint.lat, prevPoint.lon, wp.lat, wp.lon);
                prevPoint = wp;
            });
            distNM += calculateDistance(prevPoint.lat, prevPoint.lon, activeRoute.destination.lat, activeRoute.destination.lon);
        } else {
            distNM = calculateDistance(currentPos.lat, currentPos.lon, activeRoute.destination.lat, activeRoute.destination.lon);
        }
    } else {
        return; // Niets te berekenen
    }

    // Update UI
    if (activeDestNameEl) activeDestNameEl.innerText = targetName;



    // Eenheden omzetten
    let displayDist = distNM || 0;
    if (distNM !== null) {
        if (settings.speedUnit === 'KMH') displayDist = distNM * 1.852;
        if (settings.speedUnit === 'MPH') displayDist = distNM * 1.15078;
    }

    // Update Dashboard
    const distValEl = document.getElementById('distanceVal');
    if (distValEl) distValEl.innerText = (distNM !== null) ? displayDist.toFixed(1) : "--";

    // Update Drawer (Route Info Paneel)
    const drawerDist = document.getElementById('dist-remaining');
    if (drawerDist) drawerDist.innerText = (distNM !== null) ? displayDist.toFixed(1) : "--";

    // ETA Berekening
    updateETA(distNM);
}

// Kleine hulpfunctie voor ETA om de code schoon te houden
function updateETA(distNM) {
    const speedKnots = currentPos.speed * 1.94384;
    const etaEl = document.getElementById('eta-val');
    const drawerEtaTime = document.getElementById('eta-time');
    const drawerEtaDate = document.getElementById('eta-date');

    if (speedKnots > 0.5 && etaEl) {
        let arrival;

        // Gebruik de tijd van het manual target als we een tijd hebben
        if (manualTargetIndex !== null && CRUISE_TIMELINE[manualTargetIndex]?.time) {
            arrival = new Date(CRUISE_TIMELINE[manualTargetIndex].time);
        } else {
            const hours = distNM / speedKnots;
            arrival = new Date(Date.now() + hours * 3600000);
        }

        const day = arrival.getUTCDate();
        const month = arrival.getUTCMonth() + 1;
        const timeStr = arrival.getUTCHours().toString().padStart(2, '0') + ":" + arrival.getUTCMinutes().toString().padStart(2, '0');
        const dateStr = day + "/" + month;

        if (etaEl) etaEl.innerText = dateStr + " " + timeStr;

        if (drawerEtaTime) drawerEtaTime.innerText = timeStr;
        if (drawerEtaDate) drawerEtaDate.innerText = dateStr;
    } else {
        if (etaEl) etaEl.innerText = "--:--";
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}


// =============================================================================
// 6. VISUAL ROUTE EDITOR LOGIC
// =============================================================================
let timelineWeatherCache = {};

async function loadCruisePortsDB() {
    try {
        const response = await fetch('cruiseports.json');
        cruisePortsDB = await response.json();
        console.log("⚓ Port Database loaded:", cruisePortsDB.length, "ports");
    } catch (e) {
        console.warn("Could not load cruiseports.json, falling back to WAYPOINTS only.");
    }
}

async function fetchTimelineWeather() {
    // Haal unieke havens op uit de tijdlijn
    const ports = [...new Set(CRUISE_TIMELINE.filter(ev => ev.port).map(ev => ev.port))];

    for (const portKey of ports) {
        if (timelineWeatherCache[portKey]) continue; // Reeds geladen

        const lookupKey = portKey ? portKey.toUpperCase() : null;
        const coords = lookupKey ? WAYPOINTS[lookupKey] : null;
        if (!coords) continue;

        try {
            // Haal 7-daagse forecast op
            const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max&timezone=auto`);
            const data = await resp.json();
            if (data.daily) {
                timelineWeatherCache[portKey] = data.daily;
            }
        } catch (e) {
            console.warn("Failed to fetch timeline weather for", portKey);
        }
    }
    renderTimeline(); // Refresh met echte data
}

function openRouteEditor() {
    const overlay = document.getElementById('route-editor-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        renderTimeline();
        closeSettings();
        if (cruisePortsDB.length === 0) loadCruisePortsDB();
        fetchTimelineWeather(); // Start weer-update

        // Reset scroll indicators
        const hint = document.querySelector('.scroll-hint');
        if (hint) hint.style.opacity = '0.6';
    }
}



function closeRouteEditor() {
    const overlay = document.getElementById('route-editor-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    container.innerHTML = '';

    // Stel de startdatum in op de input als we die hebben
    const startInput = document.getElementById('cruise-start-date');
    if (startInput && CRUISE_TIMELINE.length > 0 && !startInput.value) {
        // Initiele waarde van het eerste item pakken
        const firstDate = CRUISE_TIMELINE[0].time || CRUISE_TIMELINE[0].date;
        if (firstDate) startInput.value = new Date(firstDate).toISOString().split('T')[0];
    }

    // Herbereken datums: elk item is 1 dag verder
    let currentBaseDate = startInput && startInput.value ? new Date(startInput.value) : new Date();

    for (let index = 0; index < CRUISE_TIMELINE.length; index++) {
        const event = CRUISE_TIMELINE[index];
        const nextEvent = index + 1 < CRUISE_TIMELINE.length ? CRUISE_TIMELINE[index + 1] : null;

        if (event.type === 'WAYPOINT') continue;

        let isCombined = false;
        if (event.type === 'ARRIVAL' && nextEvent && nextEvent.type === 'DEPARTURE' && nextEvent.port === event.port) {
             isCombined = true;
        }

        const eventDate = new Date(currentBaseDate);
        if (event.type === 'SEA_DAY') {
            event.date = eventDate.toISOString().split('T')[0];
            event.time = null;
        } else {
            let hours = 8;
            let mins = 0;
            if (event.time) {
                const oldDate = new Date(event.time);
                hours = oldDate.getHours();
                mins = oldDate.getMinutes();
            }
            eventDate.setHours(hours, mins, 0, 0);
            event.time = eventDate.toISOString();
            event.date = null;

            if (isCombined) {
                let h_dep = 18;
                let m_dep = 0;
                if (nextEvent.time) {
                    const oldDate = new Date(nextEvent.time);
                    h_dep = oldDate.getHours();
                    m_dep = oldDate.getMinutes();
                }
                const depDate = new Date(currentBaseDate);
                depDate.setHours(h_dep, m_dep, 0, 0);
                nextEvent.time = depDate.toISOString();
                nextEvent.date = null;
            }
        }

        const card = document.createElement('div');
        card.className = `timeline-card ${event.type === 'SEA_DAY' ? 'sea-day' : ''}`;

        const nowAtStart = simulationDate ? new Date(simulationDate) : new Date();
        const eventDateObj = new Date(event.time || event.date);
        if (eventDateObj < nowAtStart) card.classList.add('past');

        if (manualTargetIndex === index) card.classList.add('active-target');
        card.draggable = true;
        card.dataset.index = index;

        const currentIndex = index; // Fix closure bug
        card.onclick = (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            setManualTarget(currentIndex);
        };

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('touchstart', handleTouchStart, { passive: false });
        card.addEventListener('touchmove', handleTouchMove, { passive: false });
        card.addEventListener('touchend', handleTouchEnd);

        const dateLabel = formatSimpleDate(event.time || event.date);
        const timeLabel = event.time ? new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--";

        let weatherIcon = '☀️';
        let temp = 24;

        if (event.port && timelineWeatherCache[event.port]) {
            const forecast = timelineWeatherCache[event.port];
            const eDate = new Date(event.time || event.date).toISOString().split('T')[0];
            const dateIdx = forecast.time.indexOf(eDate);
            if (dateIdx !== -1) {
                const code = forecast.weather_code[dateIdx];
                temp = Math.round(forecast.temperature_2m_max[dateIdx]);
                if (code > 3) weatherIcon = '🌧️';
                else if (code > 0) weatherIcon = '⛅';
            } else {
                temp = Math.floor(20 + Math.sin(index) * 5);
                weatherIcon = index % 3 === 0 ? '⛅' : '☀️';
            }
        } else {
            temp = Math.floor(22 + Math.cos(index) * 3);
            weatherIcon = index % 5 === 0 ? '🌤️' : '☀️';
        }

        if (event.type === 'SEA_DAY') {
            card.innerHTML = `
                <div class="sea-icon">🌊</div>
                <div class="card-main">
                    <div class="card-title">${event.name || "Sea Day"}</div>
                    <div class="card-details">
                        <div class="detail-item">
                            <span class="detail-label">Date</span>
                            <span class="detail-value">${dateLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="right-actions">
                    <button class="delete-btn" onclick="removeTimelineEvent(${index})">×</button>
                </div>
            `;
        } else {
            let timeLabelCombined = timeLabel;
            if (isCombined) {
                const timeDep = nextEvent.time ? new Date(nextEvent.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--";
                timeLabelCombined = `${timeLabel} - ${timeDep}`;
            }
            
            const badgeText = isCombined ? 'Port' : (event.type === 'ARRIVAL' ? 'Arrival' : 'Departure');

            card.innerHTML = `
                <div class="card-main">
                    <div class="card-header">
                        <div class="card-title">${event.name || event.port}</div>
                        <div class="status-badge status-port">${badgeText}</div>
                    </div>
                    <div class="card-details">
                        <div class="detail-item">
                            <span class="detail-label">Date</span>
                            <span class="detail-value">${dateLabel}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Hours</span>
                            <span class="detail-value">${timeLabelCombined}</span>
                        </div>
                    </div>
                </div>
                <div class="right-actions">
                    <div class="card-weather">
                        <div class="weather-icon">${weatherIcon}</div>
                        <div class="weather-temp">${temp}°</div>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); removeTimelineEvent(${index})">×</button>
                </div>
            `;
        }

        container.appendChild(card);

        if (isCombined) {
            index++; 
        }
        currentBaseDate.setDate(currentBaseDate.getDate() + 1);
    }

    const updateScrollbar = () => {
        const hint = document.querySelector('.scroll-hint');
        const fade = document.querySelector('.scroll-fade-bottom');
        const thumb = document.getElementById('custom-scrollbar-thumb');

        // --- NATIVE SCROLL BEHAVIOR (HINTS & FADE) ---
        if (container.scrollTop > 50) {
            if (hint) hint.style.opacity = '0';
        }

        if (container.scrollHeight - container.scrollTop <= container.clientHeight + 1) {
            if (fade) fade.style.opacity = '0';
        } else {
            if (fade) fade.style.opacity = '1';
        }

        // --- CUSTOM SCROLLBAR INDICATOR ---
        if (thumb) {
            const trackHeight = thumb.parentElement.clientHeight;
            const contentHeight = container.scrollHeight;
            const viewHeight = container.clientHeight;

            // Verhouding van de thumb (niet kleiner dan 20px)
            const thumbHeight = Math.max(20, (viewHeight / contentHeight) * trackHeight);
            thumb.style.height = thumbHeight + "px";

            // Positie berekenen
            const scrollableRange = contentHeight - viewHeight;
            const thumbRange = trackHeight - thumbHeight;

            if (scrollableRange > 0) {
                const scrollPercent = container.scrollTop / scrollableRange;
                thumb.style.top = (scrollPercent * thumbRange) + "px";
                thumb.parentElement.style.opacity = "1";
            } else {
                thumb.parentElement.style.opacity = "0"; // Verberg als alles past
            }
        }
    };

    container.onscroll = updateScrollbar;
    setTimeout(updateScrollbar, 100); // Initial check
}

function updateTimelineDates() {
    // Wordt aangeroepen als de startdatum verandert
    saveTimeline();
    renderTimeline();
    checkItinerary();
}

function formatSimpleDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// DRAG AND DROP LOGIC (Desktop & Touch)
let touchTarget = null;

function handleDragStart(e) {
    drugItemIndex = this.dataset.index;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const targetIndex = this.dataset.index;
    reorderTimeline(drugItemIndex, targetIndex);
    return false;
}

function handleDragEnd() {
    this.style.opacity = '1';
}

// TOUCH SUPPORT (iPhone Fix)
function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    drugItemIndex = this.dataset.index;
    isDragging = false;
    touchTarget = this;

    // Start een timer voor "long press" (400ms)
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        isDragging = true;
        this.classList.add('dragging');
        triggerHaptic('impactHeavy'); // Trilling pas als hij echt "vastklikt"
    }, 400);
}

function handleTouchMove(e) {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    // Als we nog niet slepen, check of we te veel bewegen (dan is het een scroll)
    if (!isDragging) {
        const moveX = Math.abs(currentX - touchStartX);
        const moveY = Math.abs(currentY - touchStartY);
        if (moveX > 10 || moveY > 10) {
            clearTimeout(longPressTimer); // Cancel drag, acteer als scroll
        }
        return; // Laat de browser rustig scrollen
    }

    // ALS WE DRAGGEN:
    e.preventDefault(); // Voorkom scrollen vanaf nu
    const container = document.getElementById('timeline-container');

    // AUTO-SCROLL LOGIC
    if (container) {
        const rect = container.getBoundingClientRect();
        const threshold = 80;
        if (currentY < rect.top + threshold) {
            container.scrollTop -= 10;
        } else if (currentY > rect.bottom - threshold) {
            container.scrollTop += 10;
        }
    }

    // Vind element onder de vinger
    const targetEl = document.elementFromPoint(currentX, currentY);
    const card = targetEl ? targetEl.closest('.timeline-card') : null;

    if (card && card.dataset.index !== drugItemIndex) {
        triggerHaptic('impactLight');
        reorderTimeline(drugItemIndex, card.dataset.index);
        drugItemIndex = card.dataset.index;
    }
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (isDragging) {
        this.classList.remove('dragging');
        triggerHaptic('selection');
        isDragging = false;
    }
}

function triggerHaptic(type) {
    // 1. Probeer Capacitor Haptics (als geïnstalleerd)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        const { Haptics } = window.Capacitor.Plugins;
        try {
            switch (type) {
                case 'impactHeavy':
                    Haptics.impact({ style: 'HEAVY' });
                    break;
                case 'impactMedium':
                    Haptics.impact({ style: 'MEDIUM' });
                    break;
                case 'impactLight':
                    Haptics.impact({ style: 'LIGHT' });
                    break;
                case 'selection':
                    Haptics.selectionStart();
                    break;
                case 'notificationSuccess':
                    Haptics.notification({ type: 'SUCCESS' });
                    break;
                case 'notificationError':
                    Haptics.notification({ type: 'ERROR' });
                    break;
                default:
                    Haptics.selectionChanged();
                    break;
            }
        } catch (e) {
            console.warn("Haptics plugin failed:", e);
        }
    } else if (navigator.vibrate) {
        // 2. Fallback naar Browser Vibrate API (werkt op Android)
        switch (type) {
            case 'impactHeavy': navigator.vibrate(50); break;
            case 'impactMedium': navigator.vibrate(30); break;
            case 'impactLight': navigator.vibrate(10); break;
            case 'notificationError': navigator.vibrate([50, 50, 50]); break;
            default: navigator.vibrate(20); break;
        }
    }
}


function reorderTimeline(from, to) {
    if (from === null || to === null) return;
    const f = parseInt(from);
    const t = parseInt(to);

    // Update manualTargetIndex if the item moved
    if (manualTargetIndex === f) {
        manualTargetIndex = t;
    } else if (f < manualTargetIndex && t >= manualTargetIndex) {
        manualTargetIndex--;
    } else if (f > manualTargetIndex && t <= manualTargetIndex) {
        manualTargetIndex++;
    }

    const event = CRUISE_TIMELINE[f];
    const nextEvent = f + 1 < CRUISE_TIMELINE.length ? CRUISE_TIMELINE[f + 1] : null;
    let isCombined = false;
    
    if (event && nextEvent && event.type === 'ARRIVAL' && nextEvent.type === 'DEPARTURE' && event.port === nextEvent.port) {
        isCombined = true;
    }

    let items = [CRUISE_TIMELINE[f]];
    if (isCombined) items.push(CRUISE_TIMELINE[f + 1]);

    // Remove
    CRUISE_TIMELINE.splice(f, isCombined ? 2 : 1);

    // Insert
    let insertAt = t;
    if (f < t) {
        // Elements shifted left after spline
        insertAt = t - (isCombined ? 0 : 0); // No adjustment if from < to because index 'to' refers to the position PRE-splice
        // Wait, if we drop on targetIndex, we want it inserted there!
    }
    
    CRUISE_TIMELINE.splice(insertAt, 0, ...items);
    triggerHaptic('impactMedium');
    saveTimeline();

    // Ook manual target opslaan als het veranderd is
    if (manualTargetIndex !== null) localStorage.setItem('cmp_manual_target', manualTargetIndex);

    renderTimeline();
    checkItinerary();
}



function removeTimelineEvent(index) {
    triggerHaptic('impactLight');
    showConfirmModal("Delete this stop?", () => {
        triggerHaptic('notificationError');
        const evt = CRUISE_TIMELINE[index];
        const nextEvt = index + 1 < CRUISE_TIMELINE.length ? CRUISE_TIMELINE[index + 1] : null;
        let spliceCount = 1;
        if (evt && nextEvt && evt.type === 'ARRIVAL' && nextEvt.type === 'DEPARTURE' && evt.port === nextEvt.port) {
            spliceCount = 2;
        }
        CRUISE_TIMELINE.splice(index, spliceCount);
        if (manualTargetIndex === index) manualTargetIndex = null;
        else if (manualTargetIndex > index) manualTargetIndex--;
        saveTimeline();
        renderTimeline();
        checkItinerary(); // Update dashboard & map
    });
}

function setManualTarget(index) {
    // Als het al geselecteerd is, toggle het uit (terug naar auto)
    if (manualTargetIndex === index) {
        manualTargetIndex = null;
        localStorage.removeItem('cmp_manual_target');
    } else {
        manualTargetIndex = index;
        localStorage.setItem('cmp_manual_target', index);
        triggerHaptic('impactMedium');
    }

    saveTimeline();
    renderTimeline();
    checkItinerary(); // Update de kaart en route lijn direct
    updateDistance(); // Direct dashboard updaten
}



// CUSTOM MODAL LOGIC
function showConfirmModal(message, onConfirm) {
    const overlay = document.getElementById('custom-modal-overlay');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!overlay || !msgEl) return;

    msgEl.innerText = message;
    overlay.classList.remove('hidden');

    const handleConfirm = () => {
        overlay.classList.add('hidden');
        cleanup();
        if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
        overlay.classList.add('hidden');
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}



function showAddStopUI() {
    const overlay = document.getElementById('port-search-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        document.getElementById('port-search-input').focus();
        filterPorts(); // Toon eerst alles of leeg
    }
}

function closePortSearch() {
    const overlay = document.getElementById('port-search-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function filterPorts() {
    const query = document.getElementById('port-search-input').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    // 1. SEA DAY OPTIE
    if (!query || "sea day".includes(query)) {
        const seaItem = document.createElement('div');
        seaItem.className = 'result-item';
        seaItem.innerHTML = '<strong>🌊 SEA DAY</strong><br><small>Add a day at sea</small>';
        seaItem.onclick = () => addEventToTimeline("SEA_DAY");
        resultsContainer.appendChild(seaItem);
    }

    // 2. SEARCH IN COMPREHENSIVE DB (cruiseports.json)
    if (cruisePortsDB.length > 0) {
        const filtered = cruisePortsDB.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.country.toLowerCase().includes(query)
        ).slice(0, 20); // Top 20 voor performance

        filtered.forEach(port => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `<strong>⚓ ${port.name}</strong>, ${port.country}<br><small>${port.region}</small>`;
            item.onclick = () => addEventToTimeline("ARRIVAL", port.name);
            resultsContainer.appendChild(item);
        });
    }

    // 3. FALLBACK TO WAYPOINTS
    Object.keys(WAYPOINTS).forEach(key => {
        if (!query || key.toLowerCase().includes(query)) {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `<strong>📍 ${key}</strong><br><small>Custom Waypoint</small>`;
            item.onclick = () => addEventToTimeline("ARRIVAL", key);
            resultsContainer.appendChild(item);
        }
    });
}

function addEventToTimeline(type, portKey = null) {
    const name = portKey || (type === "SEA_DAY" ? "Sea Day" : "New Stop");
    let nextDate = new Date();

    // Default: de dag na het laatste item in de tijdlijn
    if (CRUISE_TIMELINE.length > 0) {
        const lastEvent = CRUISE_TIMELINE[CRUISE_TIMELINE.length - 1];
        nextDate = new Date(lastEvent.time || lastEvent.date);
        nextDate.setDate(nextDate.getDate() + 1);
    } else {
        // Als de lijst leeg is: morgen
        nextDate.setDate(nextDate.getDate() + 1);
    }

    const newEvent = {
        type: type,
        name: name,
        port: portKey,
        time: type !== "SEA_DAY" ? nextDate.toISOString() : null,
        date: type === "SEA_DAY" ? nextDate.toISOString().split('T')[0] : null
    };

    CRUISE_TIMELINE.push(newEvent);
    // Sorteer op tijd (simpel)
    CRUISE_TIMELINE.sort((a, b) => new Date(a.time || a.date) - new Date(b.time || b.date));

    triggerHaptic('notificationSuccess');
    saveTimeline();
    renderTimeline();
    checkItinerary();
    closePortSearch();
}


function saveTimeline() {
    localStorage.setItem('cmp_cruise_timeline', JSON.stringify(CRUISE_TIMELINE));
}

function loadTimeline() {
    // Forceer eenmalige reset om caching van oude schema's te voorkomen
    if (!localStorage.getItem('force_load_new_itinerary_v3')) {
        localStorage.removeItem('cmp_cruise_timeline');
        localStorage.setItem('force_load_new_itinerary_v3', 'true');
    }
    const saved = localStorage.getItem('cmp_cruise_timeline');
    if (saved) {
        // Gebruik de variabele direct (NIET window.)
        CRUISE_TIMELINE = JSON.parse(saved);
    }
}


function createShipMarker(lat, lon) {
    if (shipMarker) shipMarker.remove();
    const el = document.createElement('div');
    el.className = 'ship-marker';
    el.innerHTML = '<svg width="40" height="40" viewBox="0 0 40 40"><path d="M20 5L30 35L20 28L10 35L20 5Z" fill="#FFCC00" stroke="white" stroke-width="2"/></svg>';
    shipMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat([lon, lat]).addTo(map);
}

function updateRecordsUI() {
    if (document.getElementById('log-maxSpeed')) document.getElementById('log-maxSpeed').innerText = settings.maxSpeed.toFixed(1);
    if (document.getElementById('log-speedUnit')) document.getElementById('log-speedUnit').innerText = settings.speedUnit;
    if (document.getElementById('log-maxWind')) document.getElementById('log-maxWind').innerText = settings.maxWind;
    if (document.getElementById('log-maxWaves')) document.getElementById('log-maxWaves').innerText = settings.maxWaves.toFixed(1);
}

function resetRecords() {
    settings.maxSpeed = 0; settings.maxWind = 0; settings.maxWaves = 0;
    localStorage.setItem('cmp_maxSpeed', 0); localStorage.setItem('cmp_maxWind', 0); localStorage.setItem('cmp_maxWaves', 0);
    updateRecordsUI();
}

function kmhToBeaufort(kmh) {
    if (kmh < 1) return 0;
    if (kmh < 6) return 1;
    if (kmh < 12) return 2;
    if (kmh < 20) return 3;
    if (kmh < 29) return 4;
    if (kmh < 39) return 5;
    if (kmh < 50) return 6;
    if (kmh < 62) return 7;
    if (kmh < 75) return 8;
    if (kmh < 89) return 9;
    if (kmh < 103) return 10;
    if (kmh < 118) return 11;
    return 12;
}

let currentVisualHeading = 0; // Om de huidige staat bij te houden voor de kortste route

function updateCompass(heading) {
    const strip = document.getElementById('ribbonStrip');
    const degHeading = document.getElementById('digital-heading');
    if (!strip) return;

    // 1. Kortste route berekenen (Shortest Path Interpolation)
    // Dit voorkomt dat het lint 360 graden ronddraait als je van 359 naar 1 gaat.
    let diff = heading - (currentVisualHeading % 360);

    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    currentVisualHeading += diff;

    // 2. Exacte uitlijning met het nieuwe langere lint (start op -1440 graden)
    // De offset is het aantal pixels vanaf het begin van de strip tot de gewenste koers.
    // Met 4px per graad en 20px (halve item breedte) om op het streepje te centreren.
    const offset = (currentVisualHeading + 1440) * 4 + 20;

    // Omdat de strip 'left: 50%' heeft, brengen we de offset naar links
    strip.style.transform = `translateX(-${offset}px)`;

    if (degHeading) degHeading.innerText = Math.round(heading) + "°";
}

// Drawer open/dicht schuiven
function toggleDrawer() {
    const drawer = document.getElementById('route-drawer');
    if (drawer) {
        drawer.classList.toggle('drawer-closed');
        drawer.classList.toggle('drawer-open');
    }
}

// De teksten in het paneel invullen
function updateDrawerUI(leg) {
    if (!leg) return;

    const legNameEl = document.getElementById('leg-name');
    const portLabelEl = document.getElementById('next-port-label');

    if (legNameEl) legNameEl.innerText = leg.name;

    if (portLabelEl) {
        // We maken de naam wat mooier (bijv. RIO_PORT wordt RIO)
        const portClean = leg.endPort.replace('_PORT', '').replace('_START', '').replace('_', ' ');
        portLabelEl.innerText = "Next: " + portClean;
    }
}

function updateMapPosition(lat, lon, heading, speed) {
    if (!map) { initMap(lat, lon); return; }
    if (shipMarker) shipMarker.setLngLat([lon, lat]);
    if (speed > 0.5 && shipMarker) shipMarker.setRotation(heading || 0);
    if (isFollowing) map.easeTo({ center: [lon, lat], duration: 1000 });
}

function initCursorListener() {
    map.on('move', () => {
        const center = map.getCenter();

        // --- COÖRDINATEN UPDATEN TIJDENS SCROLLEN ---
        const coordsEl = document.getElementById('coords');
        if (coordsEl) {
            coordsEl.innerHTML = `<span>${center.lat.toFixed(5)}</span><span>${center.lng.toFixed(5)}</span>`;
        }

        clearTimeout(mapMoveTimeout);
        // De 'true' geeft aan dat het een handmatige 'scout' is (geen invloed op trip records)
        mapMoveTimeout = setTimeout(() => fetchMarineData(center.lat, center.lng, true), 1000);
    });
}

function initRibbon() {
    const strip = document.getElementById('ribbonStrip');
    if (!strip) return;
    strip.innerHTML = '';

    const dirs = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

    // Veel langer maken: -1440 tot 1440 (8 volledige rondjes speling)
    for (let i = -1440; i <= 1440; i += 10) {
        const deg = ((i % 360) + 360) % 360;
        const item = document.createElement('div');
        item.className = 'ribbon-item';

        if (dirs[deg]) {
            item.innerHTML = `<span style="color:var(--accent-color); font-weight:900; font-size:1.15rem">${dirs[deg]}</span>`;
        } else if (deg % 30 === 0) {
            item.innerHTML = `<span style="color:white; font-size:0.85rem; font-weight:600">${deg}</span>`;
        } else {
            item.innerHTML = `<span style="color:rgba(255,255,255,0.45); font-size:0.95rem">|</span>`;
        }
        strip.appendChild(item);
    }
}

function toggleNightMode() {
    // 1. Wissel de status in de variabele
    settings.nightMode = !settings.nightMode;

    // 2. Sla op met de JUISTE naam
    localStorage.setItem('cmp_nightMode', settings.nightMode);

    // 3. Pas de body aan voor de tekstkleuren
    document.body.classList.toggle('night-mode', settings.nightMode);

    // 4. Vertel Mapbox dat de stijl moet veranderen
    if (map) {
        const newStyle = settings.nightMode
            ? 'mapbox://styles/mapbox/navigation-night-v1'
            : 'mapbox://styles/mapbox/outdoors-v12';
        map.setStyle(newStyle);
    }

    // 5. Update de knoppen (tekst en highlight)
    updateUI();
}

function applySettings() {
    document.body.classList.toggle('night-mode', settings.nightMode);
}

function updateTimeDisplay() {
    const now = new Date();
    const timeEl = document.getElementById('gps-time');
    const unitEl = document.querySelector('.status-group .unit-mini');

    if (!timeEl) return;

    let displayHours, displayMinutes;

    if (settings.showLocalTime) {
        // Lokale tijd (telefoon tijd, dus automatisch DST)
        displayHours = now.getHours();
        displayMinutes = now.getMinutes();
        if (unitEl) unitEl.innerText = "LOC"; // Of "LT"
    } else {
        // UTC Tijd (Standaard voor zeevaart)
        displayHours = now.getUTCHours();
        displayMinutes = now.getUTCMinutes();
        if (unitEl) unitEl.innerText = "UTC";
    }

    // Nulletjes toevoegen (bijv 9:5 -> 09:05)
    const hStr = displayHours.toString().padStart(2, '0');
    const mStr = displayMinutes.toString().padStart(2, '0');

    timeEl.innerText = `${hStr}:${mStr}`;
}

function openSettings() { document.getElementById('settings-overlay').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-overlay').classList.add('hidden'); }
function recenterMap() {
    isFollowing = true;
    document.getElementById('recenterBtn').classList.add('hidden');
    map.flyTo({ center: [lon, lat], zoom: 11 });
    loadWeatherCache(); // Herstel de echte weerdata van het schip
}
function stopFollowing() { isFollowing = false; document.getElementById('recenterBtn').classList.remove('hidden'); }

// =============================================================================
// SYSTEM: WAKE LOCK & FULLSCREEN
// =============================================================================
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✅ Screen Wake Lock actief');

            wakeLock.addEventListener('release', () => {
                console.log('⚠️ Screen Wake Lock losgelaten');
            });
        } catch (err) {
            console.error(`❌ Wake Lock error: ${err.name}, ${err.message}`);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) { console.error("WakeLock release error:", err); }
    }
}

// Luister naar wisselen van tab/app
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
    } else {
        // BELANGRIJK: Laat de lock vallen als de app naar de achtergrond gaat
        // Dit voorkomt dat iOS de app (of het systeem) crasht bij suspension
        await releaseWakeLock();
    }
});

// NIEUW: iOS vereist vaak een 'User Gesture' om DeviceOrientation te starten
async function requestCompassPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                initCompassListener();
            }
        } catch (e) {
            console.error("Compass permission error:", e);
        }
    } else {
        // Geen toestemming nodig (Android of oudere iOS)
        initCompassListener();
    }
}

function initCompassListener() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            // webkitCompassHeading is de 'Goudstandaard' voor iPhone
            let heading = e.webkitCompassHeading;

            // Fallback voor Android
            if (heading === undefined) heading = 360 - e.alpha;

            // We updaten alleen als we langzaam gaan of geen GPS fix hebben
            if (currentPos.speed < 0.3 || !currentPos.heading || currentPos.heading === 0) {
                updateCompass(heading);
            }
        }, true);
    }
}

// =============================================================================
// INITIALISATIE: SYSTEEM (Klok, GPS, Netwerk, WakeLock)
// =============================================================================
function updateNetworkStatus() {
    const netIndicator = document.getElementById('net-indicator');
    if (netIndicator) {
        if (navigator.onLine) netIndicator.classList.add('active');
        else netIndicator.classList.remove('active');
    }
}

// =============================================================================
// INITIALISATIE: UI & INTERACTIE
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("⚓ Cruise Dashboard Initializing...");

    // ==========================================
    // 1. INTERACTIVE ELEMENTS (PRIO 1)
    // ==========================================

    // Clicking the nav-card opens the Route Editor
    const navCard = document.querySelector('.nav-card');
    if (navCard) {
        navCard.addEventListener('click', (e) => {
            console.log("🖱️ Nav-card clicked!");
            openRouteEditor();
            triggerHaptic('impactHeavy');
        });
    }

    // Start GPS Tracking immediately
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const satImg = document.getElementById('sat-indicator');
                if (satImg) satImg.classList.add('active');
                handleSuccess(pos);
            },
            (err) => {
                const satImg = document.getElementById('sat-indicator');
                if (satImg) satImg.classList.remove('active');
                console.warn("GPS Error:", err);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }

    // ==========================================
    // 2. CORE INITIALIZATION (PRIO 2)
    // ==========================================

    try {
        if (typeof initRibbon === 'function') initRibbon();
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateRecordsUI === 'function') updateRecordsUI();
        if (typeof applySettings === 'function') applySettings();

        // Initialize Map
        if (typeof initMap === 'function') initMap(currentPos.lat, currentPos.lon);
    } catch (e) { console.warn("Error during core initialization:", e); }

    // 3. Background Services
    try {
        if (typeof updateTimeDisplay === 'function') {
            setInterval(updateTimeDisplay, 1000);
            updateTimeDisplay();
        }
        requestWakeLock();
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
    } catch (e) { console.warn("Error starting services:", e); }

    // 4. Itinerary & Timeline Management
    try {
        if (typeof loadTimeline === 'function') loadTimeline();
        if (typeof loadWeatherCache === 'function') loadWeatherCache();

        // Restore manual selection
        const savedTarget = localStorage.getItem('cmp_manual_target');
        if (savedTarget !== null && savedTarget !== undefined) {
            manualTargetIndex = parseInt(savedTarget);
            console.log("📍 Dashboard restoring manual target index:", manualTargetIndex);
        }

        if (typeof checkItinerary === 'function') checkItinerary();
    } catch (e) { console.warn("Error during itinerary initialization:", e); }

    // Force distance update after a short delay
    setTimeout(() => {
        updateDistance();
    }, 500);

    // Initial Compass Permission
    requestCompassPermission();
    document.addEventListener('click', () => {
        requestCompassPermission();

        // Vraag ook notificatie permissie bij de eerste klik
        if (window.Notification && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }, { once: true });
});

// =============================================================================
// WAYPOINT MANAGEMENT
// =============================================================================
function addWaypointAtCrosshair() {
    if (!map) return;
    const center = map.getCenter();

    // VIND DE JUISTE INVOEG INDEX:
    // We voegen het nieuwe waypoint in precies vòòr het 'volgende' event (nextEvent).
    // Als we in 'WAITING' mode zijn, zorgt dit ervoor dat hij nà de eerste haven komt.
    let insertIndex = CRUISE_TIMELINE.indexOf(nextEvent);

    if (insertIndex === -1) {
        insertIndex = CRUISE_TIMELINE.length;
    }

    // Nooit bij index 0 invoegen (dat is de start-haven).
    if (insertIndex === 0 && CRUISE_TIMELINE.length > 0) {
        insertIndex = 1;
    }

    const waypoint = {
        type: 'WAYPOINT',
        name: 'Waypoint ' + (CRUISE_TIMELINE.filter(e => e.type === 'WAYPOINT').length + 1),
        coords: { lat: center.lat, lon: center.lng },
        time: null,
        date: null // Geen datum voor losse waypoints
    };

    CRUISE_TIMELINE.splice(insertIndex, 0, waypoint);

    saveTimeline();
    renderTimeline();
    checkItinerary();
    triggerHaptic('notificationSuccess');

    // UI Feedback: Sluit search als die open stond
    closePortSearch();
}

function moveWaypoint(index) {
    if (!map) return;
    const center = map.getCenter();
    CRUISE_TIMELINE[index].coords = { lat: center.lat, lon: center.lng };
    saveTimeline();
    renderTimeline();
    checkItinerary();
    triggerHaptic('impactHeavy');
}