/* CRUISE TIMELINE
   A modern, event-based itinerary system.
   Types: 
   - DEPARTURE: Leaving a port.
   - ARRIVAL: Reaching a port.
   - SEA_DAY: Explicitly marked day without port stops (optional, logic handles gaps too).
*/

let CRUISE_TIMELINE = [
    { type: "DEPARTURE", port: "BA_START", name: "Buenos Aires", time: "2026-03-30T17:00:00Z" },

    { type: "SEA_DAY", date: "2026-03-31", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-01", name: "At Sea" },

    { type: "ARRIVAL", port: "RIO_PORT", name: "Rio de Janeiro", time: "2026-04-02T10:30:00Z" },
    { type: "DEPARTURE", port: "RIO_PORT", name: "Rio de Janeiro", time: "2026-04-02T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-03", name: "At Sea" },

    { type: "ARRIVAL", port: "SALVADOR", name: "Salvador de Bahia", time: "2026-04-04T10:30:00Z" },
    { type: "DEPARTURE", port: "SALVADOR", name: "Salvador de Bahia", time: "2026-04-04T17:30:00Z" },

    { type: "SEA_DAY", date: "2026-04-05", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-06", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-07", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-08", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-09", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-10", name: "At Sea" },

    { type: "ARRIVAL", port: "TENERIFE", name: "Santa Cruz de Tenerife", time: "2026-04-11T09:00:00Z" },
    { type: "DEPARTURE", port: "TENERIFE", name: "Santa Cruz de Tenerife", time: "2026-04-11T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-12", name: "At Sea" },

    { type: "ARRIVAL", port: "CADIZ", name: "Cadiz", time: "2026-04-13T10:00:00Z" },
    { type: "DEPARTURE", port: "CADIZ", name: "Cadiz", time: "2026-04-13T19:00:00Z" },

    { type: "ARRIVAL", port: "MALAGA", name: "Malaga", time: "2026-04-14T08:00:00Z" },
    { type: "DEPARTURE", port: "MALAGA", name: "Malaga", time: "2026-04-14T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-15", name: "At Sea" },

    { type: "ARRIVAL", port: "BARCELONA", name: "Barcelona", time: "2026-04-16T05:00:00Z" }
];