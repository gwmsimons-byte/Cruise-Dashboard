/* CRUISE TIMELINE
   A modern, event-based itinerary system.
   Types: 
   - DEPARTURE: Leaving a port.
   - ARRIVAL: Reaching a port.
   - SEA_DAY: Explicitly marked day without port stops (optional, logic handles gaps too).
*/

let CRUISE_TIMELINE = [
    { type: "DEPARTURE", port: "BA_START", name: "Buenos Aires", time: "2026-03-30T18:00:00Z" },

    // Sea Day (Implicitly between 30/3 and 1/4)
    { type: "SEA_DAY", date: "2026-03-31", name: "South Atlantic Journey" },

    { type: "ARRIVAL", port: "RIO_PORT", name: "Rio de Janeiro", time: "2026-04-01T08:00:00Z" },
    { type: "DEPARTURE", port: "RIO_PORT", name: "Rio de Janeiro", time: "2026-04-02T22:00:00Z" },

    { type: "ARRIVAL", port: "SALVADOR", name: "Salvador de Bahia", time: "2026-04-04T07:00:00Z" },
    { type: "DEPARTURE", port: "SALVADOR", name: "Salvador de Bahia", time: "2026-04-05T18:00:00Z" },

    // The Big Crossing
    { type: "SEA_DAY", date: "2026-04-06", name: "Equator Crossing" },
    { type: "SEA_DAY", date: "2026-04-07" },
    { type: "SEA_DAY", date: "2026-04-08" },
    { type: "SEA_DAY", date: "2026-04-09" },
    { type: "SEA_DAY", date: "2026-04-10" },

    { type: "ARRIVAL", port: "TENERIFE", name: "Santa Cruz de Tenerife", time: "2026-04-12T08:00:00Z" },
    { type: "DEPARTURE", port: "TENERIFE", name: "Santa Cruz de Tenerife", time: "2026-04-13T17:00:00Z" },

    { type: "ARRIVAL", port: "CADIZ", name: "Cadiz", time: "2026-04-15T06:00:00Z" },
    { type: "DEPARTURE", port: "CADIZ", name: "Cadiz", time: "2026-04-15T20:00:00Z" },

    { type: "ARRIVAL", port: "MALAGA", name: "Malaga", time: "2026-04-16T08:00:00Z" },
    { type: "DEPARTURE", port: "MALAGA", name: "Malaga", time: "2026-04-16T18:00:00Z" },

    { type: "ARRIVAL", port: "BARCELONA", name: "Barcelona", time: "2026-04-18T06:00:00Z" }
];