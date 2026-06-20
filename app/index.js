import clock from "clock";
import document from "document";
import { preferences } from "user-settings";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { display } from "display";
import * as util from "../common/utils";

// --- Element handles -------------------------------------------------------
const timeLabel = document.getElementById("timeLabel");
const dateLabel = document.getElementById("dateLabel");
const hrLabel = document.getElementById("hrLabel");
const stepsLabel = document.getElementById("stepsLabel");

// --- Clock -----------------------------------------------------------------
clock.granularity = "seconds";

clock.ontick = (evt) => {
  const now = evt.date;
  let hours = now.getHours();
  const mins = util.zeroPad(now.getMinutes());

  if (preferences.clockDisplay === "12h") {
    hours = hours % 12 || 12;
  } else {
    hours = util.zeroPad(hours);
  }

  timeLabel.text = `${hours}:${mins}`;
  dateLabel.text = util.formatDate(now);

  updateStats();
};

// --- Activity stats --------------------------------------------------------
function updateStats() {
  if (stepsLabel) {
    stepsLabel.text = `${(today.adjusted.steps || 0).toLocaleString()}`;
  }
}

// --- Heart rate ------------------------------------------------------------
let hrm;
if (HeartRateSensor) {
  hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", () => {
    if (hrLabel) {
      hrLabel.text = `${hrm.heartRate || "--"}`;
    }
  });
  hrm.start();
}

// Stop/start the sensor with the display to save battery.
display.addEventListener("change", () => {
  if (!hrm) return;
  display.on ? hrm.start() : hrm.stop();
});
