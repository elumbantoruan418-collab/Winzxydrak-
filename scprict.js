// ===========================
// INDEX.JS - WEB + BOT FINAL (FIX)
// ===========================

const express = require("express");
const axios = require("axios");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
const config = require("./config");

// ===========================
// INIT
// ===========================
const app = express();
const PORT = config.PORT || 3000;

// ===========================
// MIDDLEWARE
// ===========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===========================
// GITHUB CONFIG
// ===========================
const GITHUB_API = {
  api: `https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.file}`,
  raw: `https://raw.githubusercontent.com/${config.github.owner}/${config.github.repo}/${config.github.branch}/${config.github.file}`
};

// ===========================
// HELPER GITHUB
// ===========================
async function getUsers() {
  try {
    const res = await axios.get(GITHUB_API.raw, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("❌ Gagal ambil user:", e.message);
    return [];
  }
}

async function saveUsers(users) {
  try {
    const file = await axios.get(GITHUB_API.api, {
      headers: {
        Authorization: `token ${config.github.token}`,
        "User-Agent": "Mozilla/5.0"
      }
    });

    const content = Buffer.from(
      JSON.stringify(users, null, 2)
    ).toString("base64");

    await axios.put(
      GITHUB_API.api,
      {
        message: "Update Premium.json",
        content,
        sha: file.data.sha,
        branch: config.github.branch
      },
      {
        headers: {
          Authorization: `token ${config.github.token}`,
          "User-Agent": "Mozilla/5.0"
        }
      }
    );
  } catch (e) {
    console.error("❌ Gagal simpan user:", e.message);
  }
}

// ===========================
// ROUTE WEB
// ===========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/api/users", async (req, res) => {
  const users = await getUsers();
  res.json(users);
});

// ===========================
// START SERVER
// ===========================
app.listen(PORT, () => {
  console.log("🔥 Web Panel aktif!");
  console.log(`🌐 Local: http://localhost:${PORT}`);
});

// ===========================
// TELEGRAM BOT (OPTIONAL)
// ===========================
if (config.botToken) {
  const bot = new Telegraf(config.botToken);

  bot.start(ctx =>
    ctx.reply(
      "🤖 Bot aktif!",
      Markup.inlineKeyboard([
        [Markup.button.callback("📋 List User", "LIST")]
      ])
    )
  );

  bot.action("LIST", async ctx => {
    const users = await getUsers();
    if (!users.length) return ctx.reply("❌ User kosong");

    const text = users.map(u => `• ${u.username}`).join("\n");
    ctx.reply(text);
  });

  bot.launch()
    .then(() => console.log("🤖 Telegram Bot aktif!"))
    .catch(err => console.error("❌ Bot error:", err.message));
} else {
  console.log("⚠️ Bot Telegram tidak diaktifkan (token kosong)");
}
