/* MARITIEME WAYPOINTS DATABASE
   Belangrijke bochten en knooppunten voor cruise-navigatie.
*/

const WAYPOINTS = {
    // --- NOORD-EUROPA ---
    "DOVER": { lat: 51.02, lon: 1.46 },   // Nauw van Calais
    "USHANT": { lat: 48.46, lon: -5.70 },  // Puntje Bretagne (Ouessant)
    "FINISTERRE": { lat: 43.00, lon: -9.60 },  // Noord-West Spanje (De hoek om)
    "ST_VINCENT": { lat: 36.98, lon: -9.10 },  // Zuid-West Portugal (De hoek om)

    // --- MIDDELLANDSE ZEE INGANG ---
    "GIBRALTAR": { lat: 35.96, lon: -5.60 },  // Straat van Gibraltar
    "GIB_EAST": { lat: 36.10, lon: -4.90 },  // In de Med, net voorbij de rots
    "CABO_NAO": { lat: 38.75, lon: 0.50 },   // De 'neus' van Spanje, ruim uit de kust

    // --- ATLANTISCHE EILANDEN ---
    "MADEIRA": { lat: 32.63, lon: -16.90 },
    "TENERIFE": { lat: 28.46, lon: -16.25 },
    "SANTA CRUZ DE TENERIFE": { lat: 28.46, lon: -16.25 },
    "VERDE_NORTH": { lat: 17.00, lon: -25.30 }, // Kaapverdië (Noordkant)

    // --- ZUID-AMERIKA ---
    "RECIFE": { lat: -8.05, lon: -34.88 },
    "RECIFE_OFF": { lat: -7.50, lon: -34.00 },
    "SALVADOR DE BAHIA": { lat: -12.97, lon: -38.50 },
    "SALVADOR": { lat: -12.97, lon: -38.50 },
    "CABO_FRIO": { lat: -23.01, lon: -41.90 },
    "RIO DE JANEIRO": { lat: -22.90, lon: -43.17 },
    "RIO": { lat: -22.90, lon: -43.17 },
    "RIO_PORT": { lat: -22.90, lon: -43.17 },
    "BUENOS AIRES": { lat: -34.60, lon: -58.38 },
    "BUENOS_AIRES": { lat: -34.60, lon: -58.38 },
    "BA_START": { lat: -34.60, lon: -58.38 },
    "PUNTA_ESTE": { lat: -35.00, lon: -54.90 },

    // --- CARAÏBEN & NOORD-AMERIKA ---
    "ST_MAARTEN": { lat: 18.00, lon: -63.05 },
    "BARBADOS": { lat: 13.10, lon: -59.60 },
    "FL_STRAITS": { lat: 24.50, lon: -80.00 },
    "MIAMI": { lat: 25.76, lon: -80.19 },

    // --- SPECIFIEKE HAVENS ---
    "CADIZ": { lat: 36.53, lon: -6.28 },
    "MALAGA": { lat: 36.72, lon: -4.42 },
    "BARCELONA": { lat: 41.38, lon: 2.17 },

    // Extra bochten voor deze route
    "BRAZIL_BULGE": { lat: -7.00, lon: -34.50 },  // Het puntje waar je omheen moet bij Recife
    "CABO_NAO": { lat: 38.75, lon: 0.50 },     // De 'neus' van Spanje (bij Valencia)

    // Bij Uruguay/Brazilië (om de kustlijn te volgen)
    "SOUTH_ATLANTIC_1": { lat: -30.00, lon: -48.00 },

    // De grote oversteek (om de Kaapverdische eilanden heen)
    "CV_WEST": { lat: 17.00, lon: -30.00 },

    // In de Straat van Gibraltar (precies in het midden)
    "GIB_STRAIT_MID": { lat: 35.90, lon: -5.75 },

    // Spaanse Oostkust (extra punten om de 'bocht' bij Valencia te verfijnen)
    "ALBORAN_SEA": { lat: 36.30, lon: -3.00 },
    "IBIZA_CHANNEL": { lat: 38.50, lon: 0.80 },

};