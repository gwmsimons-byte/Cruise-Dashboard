import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/app.js"

with open(filepath, "r") as f:
    content = f.read()

target = """function reorderTimeline(from, to) {
    if (from === null || to === null) return;

    // Update manualTargetIndex if the item moved
    if (manualTargetIndex === from) {
        manualTargetIndex = to;
    } else if (from < manualTargetIndex && to >= manualTargetIndex) {
        manualTargetIndex--;
    } else if (from > manualTargetIndex && to <= manualTargetIndex) {
        manualTargetIndex++;
    }

    const item = CRUISE_TIMELINE.splice(from, 1)[0];
    CRUISE_TIMELINE.splice(to, 0, item);"""

new_impl = """function reorderTimeline(from, to) {
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
    
    CRUISE_TIMELINE.splice(insertAt, 0, ...items);"""

if target in content:
    content_new = content.replace(target, new_impl)
    with open(filepath, "w") as f:
        f.write(content_new)
    print("Updated reorderTimeline for combined lists")
else:
    print("Could not find reorderTimeline function target")
