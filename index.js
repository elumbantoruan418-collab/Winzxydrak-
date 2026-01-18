// ===========================
// INDEX.JS - WEB + BOT FINAL
// LOGIN VIA Premium.json (GitHub)
// ADD / DEL VIA BOT OWNER
// ===========================

const express = require("express");
const axios = require("axios");
const path = require("path");
const os = require("os");
const { Telegraf, Markup } = require("telegraf");
const config = require("./config");

// ===========================
// INIT
// ===========================
const app = express();
const PORT = config.PORT || 3000;
const bot = new Telegraf(config.botToken);
const userState = {};

// ===========================
// GITHUB CONFIG
// ===========================
const GITHUB_API = {
  api: `https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.file}`,
  raw: `https://raw.githubusercontent.com/${config.github.owner}/${config.github.repo}/${config.github.branch}/${config.github.file}`
};

// ===========================
// MIDDLEWARE WEB
// ===========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===========================
// HELPER GITHUB
// ===========================
async function getUsers() {
  const res = await axios.get(GITHUB_API.raw, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return Array.isArray(res.data) ? res.data : [];
}

async function saveUsers(users) {
  const file = await axios.get(GITHUB_API.api, {
    headers: {
      Authorization: `token ${config.github.token}`
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
        Authorization: `token ${config.github.token}`
      }
    }
  );
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ===========================
// AUTO DELETE EXPIRED
// ===========================
async function cleanExpiredUsers() {
  const users = await getUsers();
  const today = new Date().toISOString().split("T")[0];
  const active = users.filter(u => u.expired >= today);

  if (active.length !== users.length) {
    await saveUsers(active);
    console.log("🗑 User expired dihapus otomatis");
  }
}

// ===========================
// WEB ROUTES
// ===========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/auth", async (req, res) => {
  const { username, password } = req.body;

  await cleanExpiredUsers();
  const users = await getUsers();

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) return res.send("❌ Username atau password salah");
  if (new Date(user.expired) < new Date())
    return res.send("❌ Akun sudah expired");

  res.redirect(`/dashboard?user=${username}`);
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ================== OWNER CHECK ==================
const OWNER_ID = Number(config.ownerId);

function isOwner(ctx) {
  return ctx?.from?.id === OWNER_ID;
}

// ================== KEYBOARD ==================
// ================== START ==================
bot.start(async ctx => {
  const name = ctx.from.first_name || "User";
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak ada";

  const text = `
🔥 <b>WINZ XTR FRAMEWORK</b> 🔥
Halo <b>${name}</b> 👋
Selamat datang di layanan nomor virtual terbaik!

╭── ♻️ <b>STATUS AKUN ANDA</b>
│👤 Nama: <b>${name}</b>
│🆔 ID Pengguna: <code>${userId}</code>
│🔗 Username: ${username}
│📚 <a href="https://t.me/shop_murah_gaskan">Panduan Lengkap</a>
│📢 Owner: @Winz_oficial
╰──────────────
`;

  return ctx.replyWithPhoto(config.botPhoto, {
    caption: text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "➕ ADD USER", callback_data: "owner_add" },
          { text: "➖ DEL USER", callback_data: "owner_del" }
        ]
      ]
    }
  });
});
bot.action("owner_add", async ctx => {
  try {
    await ctx.answerCbQuery(); // WAJIB

    if (!isOwner(ctx)) {
      return ctx.reply(
        "❌ Kamu bukan owner\nTidak bisa menggunakan menu ini\n\nHanya Winz yang bisa"
      );
    }

    userState[ctx.from.id] = { step: "add_username" };
    return ctx.reply("🆔 Masukkan username:");
  } catch (err) {
    console.error("ADD ERROR:", err);
  }
});
bot.action("owner_del", async ctx => {
  try {
    await ctx.answerCbQuery(); // WAJIB

    if (!isOwner(ctx)) {
      return ctx.reply(
        "❌ Kamu bukan owner\nTidak bisa menggunakan menu ini\n\nHanya Winz yang bisa"
      );
    }

    userState[ctx.from.id] = { step: "del_username" };
    return ctx.reply("🗑 Masukkan username yang mau dihapus:");
  } catch (err) {
    console.error("DEL ERROR:", err);
  }
});
// ================== TEXT HANDLER ==================
bot.on("text", async ctx => {
  if (!isOwner(ctx)) return;
  if (ctx.message.text.startsWith("/")) return;

  const state = userState[ctx.from.id];
  if (!state) return;

  const text = ctx.message.text.trim();

  // ===== ADD USER =====
  if (state.step === "add_username") {
    state.username = text;
    state.step = "add_password";
    return ctx.reply("🔐 Masukkan password:");
  }

  if (state.step === "add_password") {
    state.password = text;
    state.step = "add_expired";
    return ctx.reply("⏳ Durasi hari (contoh: 30):");
  }

  if (state.step === "add_expired") {
    const days = Number(text);
    if (!days || days <= 0) {
      return ctx.reply("❌ Durasi harus angka");
    }

    const users = await getUsers();

    if (users.find(u => u.username === state.username)) {
      delete userState[ctx.from.id];
      return ctx.reply("❌ Username sudah ada");
    }

    users.push({
      username: state.username,
      password: state.password,
      role: "Premium",
      expired: addDays(days)
    });

    await saveUsers(users);
    delete userState[ctx.from.id];
    return ctx.reply("✅ User berhasil ditambahkan");
  }

  // ===== DEL USER =====
  if (state.step === "del_username") {
    const users = await getUsers();
    const filtered = users.filter(u => u.username !== text);

    if (filtered.length === users.length) {
      delete userState[ctx.from.id];
      return ctx.reply("❌ Username tidak ditemukan");
    }

    await saveUsers(filtered);
    delete userState[ctx.from.id];
    return ctx.reply("🗑 User berhasil dihapus");
  }
});

// ===========================
// START ALL
// ===========================

// ================== IMPORT ==================


bot.launch();
setInterval(cleanExpiredUsers, 1000 * 60 * 60);

app.listen(PORT, "0.0.0.0", () => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find(i => i.family === "IPv4" && !i.internal)?.address || "localhost";

  console.log("Bot Telegram aktif");
  console.log(`🚀 Web : http://localhost:${PORT}`);
  console.log(`🌐 LAN : http://${ip}:${PORT}`);
});