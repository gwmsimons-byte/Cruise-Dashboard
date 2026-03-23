import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/app.js"

with open(filepath, "r") as f:
    content = f.read()

# 1. Update renderTimeline()
start_find = "CRUISE_TIMELINE.forEach((event, index) => {"
# The end of loop is currentBaseDate.setDate(currentBaseDate.getDate() + 1);\n    });
end_find = "currentBaseDate.setDate(currentBaseDate.getDate() + 1);\n    });"

if start_find not in content:
    print("Could not find start of forEach")
    exit(1)

start_idx = content.find(start_find)
end_idx = content.find(end_find, start_idx) + len(end_find)

if start_idx == -1 or end_idx == -1:
    print("Could not locate boundaries for loop")
    exit(1)

new_loop = """for (let index = 0; index < CRUISE_TIMELINE.length; index++) {
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

        card.onclick = (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            setManualTarget(index);
        };

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('touchstart', handleTouchStart, { passive: false });
        card.addEventListener('touchmove', handleTouchMove, { passive: false });
        card.addEventListener('touchend', handleTouchEnd);

        const dateLabel = formatSimpleDate(event.time || event.date);
        const timeLabel = event.time ? new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";

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
                const timeDep = nextEvent.time ? new Date(nextEvent.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
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
    }"""

content_new = content[:start_idx] + new_loop + content[end_idx:]

# 2. Update removeTimelineEvent()
target_splice = "CRUISE_TIMELINE.splice(index, 1);"
new_splice = """const evt = CRUISE_TIMELINE[index];
        const nextEvt = index + 1 < CRUISE_TIMELINE.length ? CRUISE_TIMELINE[index + 1] : null;
        let spliceCount = 1;
        if (evt && nextEvt && evt.type === 'ARRIVAL' && nextEvt.type === 'DEPARTURE' && evt.port === nextEvt.port) {
            spliceCount = 2;
        }
        CRUISE_TIMELINE.splice(index, spliceCount);"""

if target_splice in content_new:
    content_new = content_new.replace(target_splice, new_splice)
    print("Updated splice in removeTimelineEvent")
else:
    print("Could not find splice target")

with open(filepath, "w") as f:
    f.write(content_new)

print("Modification of timeline complete")
