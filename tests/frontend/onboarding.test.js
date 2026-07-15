const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const onboarding = fs.readFileSync(path.join(root, "frontend", "assets", "js", "onboarding.js"), "utf8");
const components = fs.readFileSync(path.join(root, "frontend", "assets", "js", "components.js"), "utf8");

test("first-use tour has separate admin and staff landing flows", () => {
    assert.match(onboarding, /role === "admin" \? "\/dashboard\.html" : "\/orders\.html"/);
    assert.match(onboarding, /#dashboardRange/);
    assert.match(onboarding, /#productSearch/);
    assert.match(onboarding, /#checkoutButton/);
    assert.match(onboarding, /pos_glasses_tour_/);
});

test("shared menu exposes restart and self-hosts TourGuide JS", () => {
    assert.match(components, /data-tour-restart/);
    assert.match(components, /\/vendor\/tourguide\/tour\.js/);
    assert.match(components, /\/vendor\/tourguide\/css\/tour\.min\.css/);
});

test("auto first-use tour never redirects away from non-landing pages", () => {
    assert.match(onboarding, /Auto first-use must never hijack navigation/);
    assert.match(onboarding, /only auto-start on the role landing page/);
    assert.match(onboarding, /if \(manual\) \{\s*window\.location\.href = `\$\{landing\}\?tour=1`/);
    assert.match(onboarding, /!localStorage\.getItem\(storageKey\(user\)\) && isOnLanding\(user\)/);
});

test("tour start uses a stable group, not the localStorage key", () => {
    // Regression: client.start(storageKey) filtered out every step because
    // TourGuideClient.start(group) keeps only steps with matching step.group.
    assert.match(onboarding, /const TOUR_GROUP = "pos-glasses-onboarding"/);
    assert.match(onboarding, /await client\.start\(TOUR_GROUP\)/);
    assert.doesNotMatch(onboarding, /client\.start\(storageKey/);
    assert.doesNotMatch(onboarding, /client\.start\(key\)/);
    assert.match(onboarding, /Never pass the localStorage key as the group/);
});

test("Hướng dẫn restart uses event delegation so re-rendered menus keep working", () => {
    assert.match(onboarding, /closest\?\.\("\[data-tour-restart\]"\)/);
    assert.match(onboarding, /startTour\(\{ manual: true \}\)/);
});
