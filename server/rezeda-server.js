/* =============================================================================
   REZEDA — сервер данных договоров.

   Этот компьютер хранит справочники контрагентов и раздаёт их другим
   устройствам в той же сети. Зависимостей нет — только стандартный Node.
   Запуск: двойной клик по data-server.cmd (или node server/rezeda-server.js).

   Что делает:
     • отдаёт сам сайт (index.html и картинки) по http://<ip>:8765/
     • GET  /api/data  — справочники Исполнителей и Заказчиков
     • PUT  /api/data  — слияние присланных записей с хранимыми
     • GET  /api/ping  — проверка доступности

   Где лежат данные: %LOCALAPPDATA%\REZEDA\dogovor-data.json — НАМЕРЕННО вне
   папки проекта, чтобы юридические данные (ИНН, паспорта, банковские
   реквизиты) никогда не попали в git и на GitHub.
   ============================================================================= */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.REZEDA_PORT || 8765);
// Токен не обязателен: в домашней или офисной сети обычно не нужен. Если задать
// переменную REZEDA_TOKEN, сервер начнёт требовать её в заголовке или в ?key=
const TOKEN = process.env.REZEDA_TOKEN || "";
const DATA_DIR = process.env.REZEDA_DATA_DIR ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "REZEDA");
const DATA_FILE = path.join(DATA_DIR, "dogovor-data.json");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

/* ── Хранилище ────────────────────────────────────────────────────────────── */
const emptyStore = () => ({ execs: [], clients: [], updatedAt: 0 });

function readStore() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      execs: Array.isArray(d.execs) ? d.execs : [],
      clients: Array.isArray(d.clients) ? d.clients : [],
      updatedAt: d.updatedAt || 0,
    };
  } catch (e) {
    return emptyStore();
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // предыдущая версия остаётся рядом — дешёвая страховка для юрданных
  try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + ".bak"); } catch (e) {}
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE); // атомарно: файл не окажется наполовину записанным
}

// Побеждает запись с более поздним updatedAt. Удаления переживают синхронизацию
// как надгробия (deleted: true), иначе удалённый профиль вернулся бы с
// устройства, которое о нём ещё помнит.
function mergeDir(a, b) {
  const map = new Map();
  (a || []).concat(b || []).forEach((x) => {
    if (!x || !x.id) return;
    const cur = map.get(x.id);
    if (!cur || (x.updatedAt || 0) >= (cur.updatedAt || 0)) map.set(x.id, x);
  });
  return Array.from(map.values());
}

const alive = (l) => (l || []).filter((x) => x && !x.deleted).length;

/* ── HTTP ─────────────────────────────────────────────────────────────────── */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Rezeda-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, code, obj) {
  cors(res);
  const b = Buffer.from(JSON.stringify(obj), "utf8");
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": b.length,
    "Cache-Control": "no-store",
  });
  res.end(b);
}

function authOk(req, url) {
  if (!TOKEN) return true;
  return req.headers["x-rezeda-key"] === TOKEN || url.searchParams.get("key") === TOKEN;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.join(ROOT, rel);
  // никаких выходов за пределы папки проекта и никаких служебных каталогов
  if (!file.startsWith(ROOT) || rel.indexOf("/.") !== -1) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Не найдено");
      return;
    }
    cors(res);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); res.end(); return; }

  if (p === "/api/ping") {
    const s = readStore();
    return json(res, 200, {
      ok: true, name: os.hostname(),
      execs: alive(s.execs), clients: alive(s.clients), updatedAt: s.updatedAt,
    });
  }

  if (p === "/api/data") {
    if (!authOk(req, url)) return json(res, 401, { error: "Нужен ключ доступа" });
    if (req.method === "GET") return json(res, 200, readStore());
    if (req.method === "PUT") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 4e6) req.destroy(); // защита от гигантского тела
      });
      req.on("end", () => {
        let inc;
        try { inc = JSON.parse(body || "{}"); } catch (e) { return json(res, 400, { error: "Некорректный JSON" }); }
        const cur = readStore();
        const next = {
          execs: mergeDir(cur.execs, inc.execs),
          clients: mergeDir(cur.clients, inc.clients),
          updatedAt: Date.now(),
        };
        try { writeStore(next); }
        catch (e) { return json(res, 500, { error: "Не удалось сохранить: " + e.message }); }
        console.log(new Date().toLocaleTimeString("ru-RU") + "  сохранено: исполнителей " +
          alive(next.execs) + ", заказчиков " + alive(next.clients));
        return json(res, 200, next);
      });
      return;
    }
    return json(res, 405, { error: "Метод не поддерживается" });
  }

  serveStatic(req, res, p);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error("");
    console.error("  Порт " + PORT + " занят — возможно, сервер уже запущен в другом окне.");
    console.error("  Запустить на другом порту: set REZEDA_PORT=8080 и снова data-server.cmd");
    console.error("");
  } else {
    console.error("");
    console.error("  Ошибка: " + e.message);
    console.error("");
  }
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  const ifs = os.networkInterfaces();
  const ips = [];
  Object.keys(ifs).forEach((k) => (ifs[k] || []).forEach((n) => {
    if (n.family === "IPv4" && !n.internal) ips.push(n.address);
  }));
  const s = readStore();
  console.log("");
  console.log("  REZEDA - сервер данных договоров");
  console.log("  ---------------------------------------------------------------");
  console.log("  На этом компьютере:  http://localhost:" + PORT + "/");
  ips.forEach((ip) => console.log("  С других устройств:  http://" + ip + ":" + PORT + "/"));
  console.log("");
  console.log("  Данные:              " + DATA_FILE);
  console.log("  Сейчас в базе:       исполнителей " + alive(s.execs) + ", заказчиков " + alive(s.clients));
  console.log("  Доступ:              " + (TOKEN ? "по ключу REZEDA_TOKEN" : "без ключа, только локальная сеть"));
  console.log("");
  console.log("  Окно можно свернуть. Закрытие окна останавливает сервер: сайт");
  console.log("  продолжит работать, но общие данные станут недоступны.");
  console.log("");
});
