import { entryKey, recommend } from "./recommendations.js";
import { recommendLoadout, unlockedLoadoutArtifacts } from "./loadouts.js";
import { buildUnlockRoute } from "./unlock-routes.js";
import { buildUnlockLoadouts } from "./unlock-loadouts.js";

const $ = (id) => document.getElementById(id);
const tabs = Array.from(document.querySelectorAll("[data-tab]"));
const statuses = Array.from(document.querySelectorAll("[data-status]"));
const atlas = new Image();
let snapshot;
let selectedTab = "skill";
let status = "locked";
let favoriteKeys = null;
let favoritesOnly = false;
let savingFavorite = false;
let closed = false;
let refreshing = false;
let stopping = false;

atlas.src = "./icons.png";
atlas.addEventListener("load", () => {
  if (snapshot) render();
});

const text = (tag, value, className) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
};

const normalize = (value) => value.normalize("NFC").toLowerCase().replace(/\s+/g, "");
const isHigh = ({ grade }) => grade === "상급" || grade === "특급";
const gradeStars = { 하급: "☆", 중급: "☆☆", 상급: "☆☆☆", 특급: "★" };

function gradeLabel(grade) {
  const stars = gradeStars[grade];
  if (!stars) return text("span", grade);
  const label = text("span", "", grade === "특급" ? "grade-stars grade-special" : "grade-stars");
  label.title = grade;
  const visible = text("span", stars);
  visible.setAttribute("aria-hidden", "true");
  label.append(visible, text("span", grade, "sr-only"));
  return label;
}

function iconFrame(icon) {
  const frame = text("div", "", "icon-frame");
  frame.setAttribute("aria-hidden", "true");
  if (icon >= 0 && atlas.complete && atlas.naturalWidth) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 44;
    const across = atlas.naturalWidth / 44;
    canvas.getContext("2d").drawImage(atlas, (icon % across) * 44,
      Math.floor(icon / across) * 44, 44, 44, 0, 0, 44, 44);
    frame.append(canvas);
  }
  return frame;
}

function unlockState(item) {
  return text("span", item.unlocked ? "해금됨" : "미해금", item.unlocked ? "entry-state is-open" : "entry-state");
}

function renderUnlockLoadouts(loadouts) {
  const content = $("unlock-loadout-content");
  content.replaceChildren();
  $("unlock-loadout").hidden = loadouts.length === 0;
  $("unlock-route").classList.toggle("has-loadout", loadouts.length > 0);
  for (const loadout of loadouts) {
    const build = text("div", "", "unlock-build");
    if (loadout.label) build.append(text("h4", loadout.label, "unlock-build-label"));

    for (const { tag, target, current, planned } of loadout.synergies) {
      const progress = planned < target
        ? `추천 조합 ${planned}/${target} · 추가 ${target - planned} 필요`
        : `추천 조합 ${planned}/${target}`;
      const summary = text("p", "", "unlock-build-synergy");
      summary.append(text("strong", `${tag} 시너지`), " ",
        progress, current < planned ? ` · 현재 해금 기준 ${current}/${target}` : "");
      build.append(summary);
    }

    const groups = [
      ["공격 스킬", loadout.attacks], ["버프 스킬", loadout.buffs], ["유물", loadout.artifacts],
      ["사용 유물", loadout.used],
    ];
    const locked = [];
    for (const [label, picks] of groups) {
      if (!picks.length) continue;
      const group = text("div", "", "unlock-build-group");
      const heading = text("div", label, "unlock-build-group-label");
      const list = text("ul", "", "unlock-build-picks");
      list.setAttribute("aria-label", label);
      for (const { item, note } of picks) {
        const pick = text("li", "", "unlock-build-pick");
        const details = text("div", "", "unlock-build-pick-details");
        const name = text("div", item.name, "unlock-build-pick-name");
        if (!item.unlocked) {
          name.append(text("span", "미해금", "unlock-build-locked"));
          locked.push(item);
        }
        details.append(name);
        if (note) details.append(text("div", note, "unlock-build-pick-note"));
        pick.append(iconFrame(item.icon), details);
        list.append(pick);
      }
      group.append(heading, list);
      build.append(group);
    }
    for (const note of loadout.notes) build.append(text("p", note, "unlock-build-note"));
    if (locked.length) {
      const details = text("details", "", "unlock-build-requirements");
      details.append(text("summary", "추천 항목의 미해금 조건"));
      const list = text("ul", "");
      for (const item of locked) {
        const row = text("li", "");
        row.append(text("strong", item.name), " · ", item.condition);
        list.append(row);
      }
      details.append(list);
      build.append(details);
    }
    content.append(build);
  }
}

function openUnlockRoute(key) {
  const route = buildUnlockRoute(snapshot, key);
  if (!route) return;
  $("unlock-title").textContent = route.goal.name;
  const steps = document.createDocumentFragment();
  for (const step of route.steps) {
    const row = text("li", "", "unlock-step");
    row.dataset.stepKey = step.key;
    const title = text("div", "", "unlock-step-name");
    title.append(iconFrame(step.entry.icon), text("strong", step.entry.name), unlockState(step.entry));
    if (step.key === key) row.classList.add("unlock-goal");
    row.append(title);
    for (const action of step.actions) row.append(text("p", action, "unlock-action"));
    steps.append(row);
  }
  $("unlock-steps").replaceChildren(steps);
  $("unlock-completed").hidden = route.completed.length === 0;
  $("unlock-completed").textContent = "선행 해금 완료 · " + route.completed.join(" · ");
  renderUnlockLoadouts(buildUnlockLoadouts(snapshot, key, route.goal));
  const dialog = $("unlock-route");
  dialog.showModal();
  dialog.scrollTop = 0;
}

$("unlock-close").addEventListener("click", () => $("unlock-route").close());

function favoriteNotice(message) {
  const notice = $("favorite-notice");
  notice.textContent = message;
  notice.hidden = !message;
}

function paintFavoriteButton(button) {
  const favorite = favoriteKeys?.has(button.dataset.favoriteKey) ?? false;
  button.textContent = favorite ? "★" : "☆";
  button.title = favorite ? "즐겨찾기 해제" : "즐겨찾기 추가";
  button.setAttribute("aria-pressed", String(favorite));
  button.disabled = !favoriteKeys || savingFavorite || refreshing || closed || stopping;
}

function updateFavoriteControls() {
  $("favorites-only").disabled = !favoriteKeys;
  for (const button of $("list").querySelectorAll(".favorite-button")) paintFavoriteButton(button);
}

async function requestFavorites(init) {
  const response = await fetch("./favorites", { cache: "no-store", signal: AbortSignal.timeout(5000), ...init });
  if (!response.ok) throw new Error("Favorites request failed");
  return new Set(await response.json());
}

async function loadFavorites() {
  try {
    favoriteKeys = await requestFavorites();
    favoriteNotice("");
  } catch {
    favoriteNotice("즐겨찾기를 불러오지 못했어요. 새로고침해 주세요.");
  }
}

async function toggleFavorite(button) {
  if (button.disabled) return;
  const key = button.dataset.favoriteKey;
  const restoreFocus = document.activeElement === button;
  savingFavorite = true;
  $("refresh").disabled = true;
  updateFavoriteControls();
  try {
    favoriteKeys = await requestFavorites({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, favorite: !favoriteKeys.has(key) }),
    });
    favoriteNotice("");
    if (favoritesOnly) render();
  } catch {
    favoriteNotice("즐겨찾기를 저장하지 못했어요. 다시 시도해 주세요.");
  } finally {
    savingFavorite = false;
    $("refresh").disabled = closed || refreshing || stopping;
    updateFavoriteControls();
    if (restoreFocus && document.activeElement === document.body && !closed && !stopping) {
      (button.isConnected ? button : $("favorites-only")).focus({ preventScroll: true });
    }
  }
}

function entryRow(item) {
  const row = text("li", "", "entry");
  const title = text("div", "", "entry-name");
  const labels = document.createElement("div");
  labels.append(text("div", item.name, "name"));
  const details = text("div", "", "entry-details");
  const tags = [item.kindLabel, item.tags].filter((tag) => tag && tag !== item.grade).join(" · ");
  if (item.grade) details.append(gradeLabel(item.grade));
  if (tags) details.append((item.grade ? " · " : "") + tags);
  if (details.hasChildNodes()) labels.append(details);
  title.append(iconFrame(item.icon), labels);
  const actions = text("div", "", "entry-actions");
  const button = text("button", "해금 루트", "quiet unlock-button");
  const key = entryKey(item, selectedTab);
  button.type = "button";
  button.setAttribute("aria-label", item.name + " 해금 루트");
  button.setAttribute("aria-haspopup", "dialog");
  button.addEventListener("click", () => openUnlockRoute(key));
  const star = text("button", "", "quiet favorite-button");
  star.type = "button";
  star.dataset.favoriteKey = key;
  star.setAttribute("aria-label", item.name + " 즐겨찾기");
  paintFavoriteButton(star);
  star.addEventListener("click", () => toggleFavorite(star));
  actions.append(unlockState(item), button, star);
  row.append(title, text("div", item.condition, "entry-condition"), actions);
  return row;
}

function updateTotal(id, items) {
  const open = items.filter((item) => item.unlocked).length;
  $(id + "-open").textContent = open;
  $(id + "-total").textContent = "/ " + items.length;
  $(id + "-meter").style.width = (items.length ? open * 100 / items.length : 0) + "%";
}

function render() {
  const showPlan = selectedTab === "plan";
  $("entries").hidden = showPlan;
  $("plan").hidden = !showPlan;
  if (!snapshot) return;
  if (showPlan) {
    renderPlan();
    return;
  }
  $("grade-field").hidden = selectedTab !== "artifact";
  const list = $("list");
  const query = normalize($("query").value);
  const grade = $("grade").value;
  const source = selectedTab === "skill" ? snapshot.skills : snapshot.artifacts;
  const byGrade = selectedTab !== "artifact" || grade === "all" ? source
    : source.filter((item) => grade === "high" ? isHigh(item) : item.grade === grade);
  const filtered = byGrade.filter((item) => {
    const correctStatus = status === "all" || item.unlocked === (status === "unlocked");
    return correctStatus
      && (!favoritesOnly || favoriteKeys?.has(entryKey(item, selectedTab)))
      && (!query || normalize([item.name, item.condition, item.tags, item.kindLabel].join(" ")).includes(query));
  });
  const rows = document.createDocumentFragment();
  for (const item of filtered) rows.append(entryRow(item));
  list.replaceChildren(rows);
  $("result-count").textContent = `${filtered.length}개 / ${byGrade.length}개`;
  $("list-header").hidden = filtered.length === 0;
  $("empty").hidden = filtered.length > 0;
  $("empty").textContent = favoritesOnly ? "조건에 맞는 즐겨찾기가 없어요." : "조건에 맞는 항목이 없어요.";
}

function loadoutLine(items) {
  const line = text("div", "", "loadout");
  line.append(text("strong", "추천 유물 " + items.length + "종 : ", "loadout-label"));
  const list = text("ul", "", "loadout-items");
  list.setAttribute("aria-label", "추천 유물");
  for (const item of items) {
    const entry = text("li", "", "loadout-item");
    entry.dataset.artifactId = item.id;
    if (item.icon >= 0) entry.append(iconFrame(item.icon));
    entry.append(text("span", item.name, "loadout-name"));
    list.append(entry);
  }
  line.append(list);
  return line;
}

function goalRow(item, loadout) {
  const row = text("li", "", "plan-goal");
  const label = item.grade || "스킬";
  const title = text("div", "", "plan-goal-title");
  const rank = gradeLabel(label);
  rank.classList.add("plan-grade");
  title.append(text("strong", item.name), rank);
  row.append(title, text("p", item.condition, "plan-condition"));
  if (item.prerequisites.length) {
    const names = item.prerequisites.map((entry) => entry.name).join(" · ");
    row.append(text("p", "먼저 해금  " + names, "plan-required"));
  }
  if (loadout?.length) row.append(loadoutLine(loadout));
  return row;
}

function goalList(items, loadoutFor) {
  const list = text("ul", "", "plan-goals");
  for (const item of items) list.append(goalRow(item, loadoutFor?.(item)));
  return list;
}

function planDetails(id, label, openIds) {
  const details = text("details", "", "plan-details");
  details.dataset.planId = id;
  details.open = openIds.has(id);
  details.append(text("summary", label));
  return details;
}

function routeCard(route, order, openIds, artifacts) {
  const card = text("article", "", order === 1 ? "route-card route-first" : "route-card");
  card.dataset.route = route.id;
  const header = text("div", "", "route-header");
  if (order) header.append(text("span", String(order), "route-order"));
  header.append(text("h3", route.title));
  card.append(header, text("p", route.tip, "route-tip"));
  const available = route.items.filter((item) => item.prerequisites.length === 0);
  const waiting = route.items.filter((item) => item.prerequisites.length > 0);
  const ordered = [...available, ...waiting];
  const loadout = recommendLoadout(artifacts, route.id, ordered[0]?.key);
  if (loadout.length) card.append(loadoutLine(loadout));
  const defaultIds = new Set(loadout.map((item) => item.id));
  const goalLoadout = (goal) => {
    const items = recommendLoadout(artifacts, route.id, goal.key);
    if (items.length !== loadout.length || items.some((item) => !defaultIds.has(item.id))) return items;
    return [];
  };
  const preview = available.length ? Math.min(available.length, 3) : 2;
  card.append(goalList(ordered.slice(0, preview), goalLoadout));
  const rest = ordered.slice(preview);
  if (rest.length) {
    const detail = planDetails("more-" + route.id, "이어서 할 목표 " + rest.length + "개", openIds);
    detail.append(goalList(rest, goalLoadout));
    card.append(detail);
  }
  return card;
}

function renderPlan() {
  const container = $("plan-content");
  const openIds = new Set(Array.from(container.querySelectorAll("details[open]"),
    (details) => details.dataset.planId));
  const plan = recommend(snapshot);
  const artifacts = unlockedLoadoutArtifacts(snapshot);
  const heading = text("div", "", "plan-heading");
  heading.append(text("h2", "무투가 기준 추천"),
    text("p", "미해금 스킬·상급·특급 유물 " + plan.remaining + "개", "plan-subtitle"));
  const content = document.createDocumentFragment();
  content.append(heading);
  if (plan.remaining === 0) {
    content.append(text("p", "스킬과 상급·특급 유물을 모두 해금했어요.", "empty"));
    container.replaceChildren(content);
    return;
  }

  const first = plan.ready.slice(0, 4);
  if (first.length) {
    const cards = text("div", "", "plan-cards");
    for (const [i, route] of first.entries()) cards.append(routeCard(route, i + 1, openIds, artifacts));
    content.append(cards);
  }
  const later = [...plan.ready.slice(4), ...plan.following];
  if (later.length) {
    const more = planDetails("later-routes", "다음 추천 " + later.length + "개", openIds);
    const cards = text("div", "", "plan-cards");
    for (const [i, route] of later.entries()) cards.append(routeCard(route, first.length + i + 1, openIds, artifacts));
    more.append(cards);
    content.append(more);
  }
  if (plan.character.length) {
    const group = planDetails("characters", "다른 캐릭터가 필요한 목표", openIds);
    const cards = text("div", "", "plan-cards");
    for (const route of plan.character) cards.append(routeCard(route, 0, openIds, artifacts));
    group.append(cards);
    content.append(group);
  }
  if (plan.other.length) {
    const extra = planDetails("other", "개별 해금 조건 " + plan.other.length + "개", openIds);
    extra.append(goalList(plan.other));
    content.append(extra);
  }
  container.replaceChildren(content);
}

function activateTab(name, focus = false) {
  selectedTab = name;
  for (const tab of tabs) {
    const active = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  }
  if (name !== "plan") $("entries").setAttribute("aria-labelledby", "tab-" + name);
  render();
}

for (const tab of tabs) {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const position = tabs.indexOf(tab);
    const previous = (position + tabs.length - 1) % tabs.length;
    const next = (position + 1) % tabs.length;
    const target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : event.key === "ArrowLeft" ? previous : next;
    activateTab(tabs[target].dataset.tab, true);
  });
}
for (const button of statuses) {
  button.addEventListener("click", () => {
    status = button.dataset.status;
    for (const item of statuses) item.setAttribute("aria-pressed", String(item === button));
    render();
  });
}
$("favorites-only").addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  $("favorites-only").setAttribute("aria-pressed", String(favoritesOnly));
  render();
});
$("query").addEventListener("input", render);
$("grade").addEventListener("change", render);

async function refresh() {
  if (closed || stopping || refreshing || savingFavorite) return;
  refreshing = true;
  $("refresh").disabled = true;
  $("refresh").textContent = "읽는 중";
  $("entries").setAttribute("aria-busy", "true");
  $("plan").setAttribute("aria-busy", "true");
  $("notice").hidden = true;
  updateFavoriteControls();
  try {
    const [progress] = await Promise.allSettled([fetch("./progress", { cache: "no-store" }), loadFavorites()]);
    if (progress.status === "rejected") throw progress.reason;
    const response = progress.value;
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    snapshot = payload;
    updateTotal("skill", payload.skills);
    updateTotal("artifact", payload.artifacts);
    updateTotal("high", payload.artifacts.filter(isHigh));
    const prettyTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" });
    $("save-status").textContent = "세이브 저장 " + prettyTime.format(new Date(payload.saveTime));
    $("catalog-version").textContent = "도감 데이터 " + payload.catalogVersion;
    render();
  } catch (error) {
    $("notice").hidden = false;
    $("notice").textContent = error.message === "Failed to fetch"
      ? "앱에 연결할 수 없어요. 실행파일을 다시 열어 주세요."
      : (error.message || "세이브를 읽는 중 문제가 생겼어요.");
    if (!snapshot) $("save-status").textContent = "세이브를 불러오지 못했습니다.";
  } finally {
    refreshing = false;
    $("refresh").disabled = closed || stopping;
    $("refresh").textContent = "새로고침";
    $("entries").setAttribute("aria-busy", "false");
    $("plan").setAttribute("aria-busy", "false");
    updateFavoriteControls();
  }
}

const launcherLabels = { running: "실행 중", stopping: "종료 중", closed: "종료됨", disconnected: "연결 끊김" };

function updateLauncher(state) {
  const indicator = $("launcher-status");
  if (indicator.dataset.state !== state) {
    indicator.textContent = launcherLabels[state];
    indicator.dataset.state = state;
  }
  $("stop").disabled = state !== "running";
}

async function launcherResponds() {
  try {
    const response = await fetch("./ping", { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return response.status === 204;
  } catch {
    return false;
  }
}

async function checkLauncher() {
  if (stopping || closed) return;
  const running = await launcherResponds();
  if (!stopping && !closed) updateLauncher(running ? "running" : "disconnected");
}

async function stopLauncher() {
  if (stopping || closed) return;
  stopping = true;
  updateLauncher("stopping");
  $("refresh").disabled = true;
  updateFavoriteControls();
  $("notice").hidden = true;
  try {
    const response = await fetch("./stop", { method: "POST", signal: AbortSignal.timeout(4000) });
    if (response.status !== 204) throw new Error("실행기가 종료 요청을 받지 못했어요. 다시 시도해 주세요.");
    const deadline = performance.now() + 8000;
    while (await launcherResponds()) {
      if (performance.now() >= deadline) {
        throw new Error("실행기가 아직 응답 중이에요. 실행기 종료를 다시 눌러 주세요.");
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    closed = true;
    updateLauncher("closed");
    $("notice").textContent = "실행기를 종료했어요. 다시 보려면 실행파일을 열어 주세요.";
  } catch (error) {
    $("notice").textContent = error.message.startsWith("실행기")
      ? error.message : "종료 요청을 확인하지 못했어요. 실행 상태를 확인해 주세요.";
  } finally {
    stopping = false;
    $("notice").hidden = false;
    $("refresh").disabled = closed || refreshing || savingFavorite;
    updateFavoriteControls();
    if (!closed) await checkLauncher();
  }
}

$("refresh").addEventListener("click", refresh);
$("stop").addEventListener("click", stopLauncher);

setInterval(checkLauncher, 15000);
checkLauncher();

refresh();
