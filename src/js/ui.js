function toggleDrawerMenu(isOpen) {
  const drawer = document.getElementById("drawer-menu");
  const overlay = document.getElementById("drawer-overlay");
  if (!drawer || !overlay) return;
  drawer.classList.toggle("active", isOpen);
  overlay.classList.toggle("active", isOpen);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function withButtonLoading(button, asyncCallback, loadingText = "通信中...") {
  if (!button || button.disabled) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = loadingText;
  try {
    await asyncCallback();
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = originalText;
  }
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initScrollTopButton() {
  const scrollTopBtn = document.getElementById("btn-scroll-top");
  if (!scrollTopBtn) return;

  window.addEventListener("scroll", () => {
    scrollTopBtn.classList.toggle("visible", window.scrollY > 200);
  });
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function showModal(titleText, contentElement) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "app-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal-panel";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("span");
  title.className = "modal-title";
  title.textContent = titleText;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn-close";
  closeBtn.setAttribute("aria-label", "閉じる");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body";
  body.appendChild(contentElement);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
}

function closeModal() {
  const existing = document.getElementById("app-modal-overlay");
  if (existing) existing.remove();
}

// カレンダー表示の共通規格（Home・予約ページで共有）
const SCHEDULE_PIXELS_PER_MINUTE = 2;
const SCHEDULE_DAY_START_MINUTES = 7 * 60;
const SCHEDULE_DAY_END_MINUTES = 21 * 60;
const SCHEDULE_LANE_LABEL_WIDTH = 34;
const SCHEDULE_ROOM_ORDER = { "①": 0, "②": 1, "③": 2, "Main": 3 };
const SCHEDULE_ROOM_NAMES = { "①": "部室", "②": "機材庫", "③": "教室", "Main": "メイン" };

function getScheduleMinutesFromTime(value) {
  const parts = String(value).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function getScheduleRoomPriority(room) {
  return Object.prototype.hasOwnProperty.call(SCHEDULE_ROOM_ORDER, room) ? SCHEDULE_ROOM_ORDER[room] : 99;
}

// 時間帯ごとの重なりだけでレーンを決め、空いている時間帯は予約枠を広げる
function layoutScheduleTimedEvents(events, timeline, createEventElement) {
  const timedEvents = events.filter((event) => !event.isAllDay);
  timedEvents.forEach((event) => {
    const start = getScheduleMinutesFromTime(event.startTime);
    const end = getScheduleMinutesFromTime(event.endTime);
    const overlappingRooms = [...new Set(timedEvents
      .filter((candidate) => {
        const candidateStart = getScheduleMinutesFromTime(candidate.startTime);
        const candidateEnd = getScheduleMinutesFromTime(candidate.endTime);
        return candidateEnd > start && end > candidateStart;
      })
      .map((candidate) => candidate.room))]
      .sort((a, b) => getScheduleRoomPriority(a) - getScheduleRoomPriority(b));
    const laneIndex = overlappingRooms.indexOf(event.room);
    const laneCount = Math.max(overlappingRooms.length, 1);
    const element = createEventElement(event, false);
    element.style.top = `${(start - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
    element.style.height = `${Math.max((end - start) * SCHEDULE_PIXELS_PER_MINUTE, 20)}px`;
    element.style.left = `${(laneIndex / laneCount) * 100}%`;
    element.style.width = `calc(${100 / laneCount}% - 2px)`;
    timeline.appendChild(element);
  });
}

function buildScheduleTimeline(className, hourLineClassName, date, showLabels = false) {
  const timeline = document.createElement("div");
  timeline.className = className;
  timeline.style.height = `${(SCHEDULE_DAY_END_MINUTES - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
  for (let minutes = SCHEDULE_DAY_START_MINUTES; minutes < SCHEDULE_DAY_END_MINUTES; minutes += 60) {
    const hourLine = document.createElement("div");
    hourLine.className = hourLineClassName;
    hourLine.style.height = `${60 * SCHEDULE_PIXELS_PER_MINUTE}px`;
    if (showLabels) hourLine.textContent = String(Math.floor(minutes / 60));
    timeline.appendChild(hourLine);
  }
  if (showLabels) {
    const endHour = document.createElement("div");
    endHour.className = `${hourLineClassName} schedule-time-axis-end-hour`;
    endHour.textContent = String(SCHEDULE_DAY_END_MINUTES / 60);
    timeline.appendChild(endHour);
  }
  if (date && isScheduleToday(date)) {
    const indicator = document.createElement("div");
    indicator.className = "schedule-current-time-line";
    if (date.getDay() === 0) indicator.classList.add("is-sunday");
    indicator.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "schedule-current-time-label";
    label.textContent = "☆now!";
    indicator.appendChild(label);
    timeline.appendChild(indicator);
  }
  return timeline;
}

function buildScheduleTimeAxis(className) {
  const axis = document.createElement("div");
  axis.className = `${className}-time-axis`;
  const header = document.createElement("div");
  header.className = `${className}-time-axis-header`;
  axis.appendChild(header);
  axis.appendChild(buildScheduleTimeline(`${className}-time-axis-timeline`, `${className}-time-axis-hour-line`, null, true));
  return axis;
}

function isScheduleToday(date) {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function updateScheduleCurrentTimeIndicators() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isVisible = currentMinutes >= SCHEDULE_DAY_START_MINUTES && currentMinutes <= SCHEDULE_DAY_END_MINUTES;
  document.querySelectorAll(".schedule-current-time-line").forEach((indicator) => {
    indicator.style.top = `${(currentMinutes - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
    indicator.hidden = !isVisible;
  });
}

function scrollScheduleToCurrentTime(container) {
  if (!container || !document.querySelector(".schedule-current-time-line:not([hidden])")) return;
  const indicator = document.querySelector(".schedule-current-time-line:not([hidden])");
  const target = indicator.offsetTop - 8;
  container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}

function scrollScheduleToToday(container, className) {
  if (!container || container.dataset.scheduleView !== "week") return;
  const todayColumn = container.querySelector(`.${className}-day.is-today`);
  if (!todayColumn) return;
  const containerRect = container.getBoundingClientRect();
  const columnRect = todayColumn.getBoundingClientRect();
  const target = container.scrollLeft + columnRect.left - containerRect.left -
    (container.clientWidth - todayColumn.clientWidth) / 2;
  container.scrollLeft = Math.max(0, target);
}

function startScheduleCurrentTimeUpdates() {
  updateScheduleCurrentTimeIndicators();
  if (window.scheduleCurrentTimeTimer) clearInterval(window.scheduleCurrentTimeTimer);
  window.scheduleCurrentTimeTimer = setInterval(updateScheduleCurrentTimeIndicators, 60 * 1000);
}

function getScheduleCalendarDates(view, anchorDate) {
  const anchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const firstDay = first.getDay();
    const start = new Date(first);
    start.setDate(start.getDate() - firstDay);
    const dates = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      dates.push(date);
    }
    return dates;
  }
  if (view === "day") return [anchor];
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatScheduleDate(date, includeYear = false) {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const year = includeYear ? `${date.getFullYear()}/` : "";
  return `${year}${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

function formatSchedulePeriod(view, dates) {
  if (view === "month") {
    return `${dates[14].getFullYear()}年${dates[14].getMonth() + 1}月`;
  }
  if (view === "day") return formatScheduleDate(dates[0], true);
  return `${dates[0].getMonth() + 1}/${dates[0].getDate()}-${dates[6].getMonth() + 1}/${dates[6].getDate()}`;
}

function createScheduleMonthEvent(event, createEventElement) {
  const element = createEventElement(event, true);
  element.classList.add("schedule-month-event");
  element.style.position = "static";
  element.style.width = "100%";
  element.style.height = "auto";
  element.style.left = "auto";
  element.style.top = "auto";
  return element;
}

function renderScheduleCalendar(container, events, dates, view, createEventElement, className) {
  const eventsByDate = {};
  events.forEach((event) => {
    const date = String(event.start || "").slice(0, 10);
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(event);
  });
  container.textContent = "";
  container.dataset.scheduleView = view;
  const grid = document.createElement("div");
  grid.className = `${className}-grid schedule-grid`;

  if (view === "month") {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekdayRow = document.createElement("div");
    weekdayRow.className = `${className}-weekday-row schedule-weekday-row`;
    weekdays.forEach((weekday) => {
      const weekdayCell = document.createElement("div");
      weekdayCell.className = `${className}-weekday-cell schedule-weekday-cell`;
      weekdayCell.textContent = weekday;
      weekdayRow.appendChild(weekdayCell);
    });
    container.appendChild(weekdayRow);
    dates.forEach((date) => {
      const cell = document.createElement("section");
      cell.className = `${className}-month-day schedule-month-day${isScheduleToday(date) ? " is-today" : ""}`;
      if (date.getMonth() !== dates[14].getMonth()) cell.classList.add("is-outside-month");
      const heading = document.createElement("div");
      heading.className = `${className}-month-day-title schedule-month-day-title`;
      heading.textContent = String(date.getDate());
      cell.appendChild(heading);
      (eventsByDate[getScheduleDateString(date)] || []).forEach((event) => {
        cell.appendChild(createScheduleMonthEvent(event, createEventElement));
      });
      grid.appendChild(cell);
    });
    container.appendChild(grid);
    return;
  }

  const scrollLayout = document.createElement("div");
  scrollLayout.className = `${className}-scroll-layout schedule-scroll-layout`;
  const timeAxis = buildScheduleTimeAxis(className);
  scrollLayout.appendChild(timeAxis);
  dates.forEach((date) => {
    const day = document.createElement("section");
    day.className = `${className}-day schedule-day${isScheduleToday(date) ? " is-today" : ""}`;
    const heading = document.createElement("div");
    heading.className = `${className}-day-title schedule-day-title`;
    const dateLabel = document.createElement("span");
    dateLabel.className = `${className}-day-title-date schedule-day-title-date`;
    dateLabel.textContent = formatScheduleDate(date);
    heading.appendChild(dateLabel);
    const dayEvents = eventsByDate[getScheduleDateString(date)] || [];
    const allDayEvents = dayEvents.filter((event) => event.isAllDay);
    if (allDayEvents.length > 0) {
      const chips = document.createElement("div");
      chips.className = `${className}-allday-chips schedule-allday-chips`;
      allDayEvents.forEach((event) => {
        const chip = document.createElement("span");
        chip.className = `${className}-allday-chip schedule-allday-chip`;
        chip.textContent = event.title || "終日";
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          showScheduleEventDetail(event);
        });
        chips.appendChild(chip);
      });
      heading.appendChild(chips);
    }
    day.appendChild(heading);
    const timeline = buildScheduleTimeline(`${className}-timeline schedule-timeline`, `${className}-hour-line schedule-hour-line`, date);
    layoutScheduleTimedEvents(dayEvents, timeline, createEventElement);
    if (dayEvents.length === 0) {
      const empty = document.createElement("div");
      empty.className = `${className}-empty`;
      empty.textContent = "予約なし";
      timeline.appendChild(empty);
    }
    day.appendChild(timeline);
    grid.appendChild(day);
  });
  scrollLayout.appendChild(grid);
  container.appendChild(scrollLayout);
  startScheduleCurrentTimeUpdates();
  requestAnimationFrame(() => {
    scrollScheduleToToday(container, className);
    scrollScheduleToCurrentTime(container);
  });
}

function getScheduleDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function showScheduleEventDetail(event) {
  const body = document.createElement("div");
  const rows = [
    ["時間", event.isAllDay ? "終日" : `${event.startTime} - ${event.endTime}`],
    ["練習場所", SCHEDULE_ROOM_NAMES[event.room] || event.room],
    ["バンド名", event.title || "-"],
    ["代表者", event.repName || "-"],
    ["譲ります", event.transferStatus || "なし"]
  ];
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "modal-row";
    const labelEl = document.createElement("span");
    labelEl.className = "modal-row-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "modal-row-value";
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    body.appendChild(row);
  });
  showModal("予約の詳細", body);
}