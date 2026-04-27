console.log("Go Beats backend iniciando");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// 🔥 URL BASE (Render o local)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const AUDIO_DIR = path.join(UPLOADS_DIR, "audio");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

// 🔥 MONGODB (Atlas)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo conectado"))
  .catch((err) => console.log("Error conectando Mongo:", err.message));

const User = mongoose.model("User", {
  email: String,
  password: String,
  role: { type: String, default: "user" }
});

const Beat = mongoose.model("Beat", {
  name: String,
  producer: String,
  bpm: Number,
  genre: String,
  mood: String,
  key: String,
  fileUrl: String,
  coverUrl: String,
  userId: String,
  available: { type: Boolean, default: true },
  assigned: { type: Boolean, default: false },
  assignedTo: String,
  assignedEmail: String,
  assignedBy: String,
  assignedAt: Date
});

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send("No autorizado");

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).send("No autorizado");

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).send("Token invalido");
  }
}

async function soloAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") {
      return res.status(403).send("Solo administradores");
    }

    req.currentUser = user;
    next();
  } catch {
    res.status(500).send("Error validando admin");
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.mimetype.startsWith("audio") ? AUDIO_DIR : IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, Date.now() + "-" + safeName);
  }
});

const upload = multer({ storage });

function publicUploadUrl(filePath) {
  const relative = path.relative(__dirname, filePath).replace(/\\/g, "/");
  return `${BASE_URL}/${relative}`;
}

function normalizeAssetUrl(value, folder) {
  if (!value) return value;

  let clean = String(value).replace(/\\/g, "/");

  try {
    clean = decodeURIComponent(clean);
  } catch {}

  const timestampFile = clean.match(/(\d{10,}-.+)$/);
  const fileName = timestampFile
    ? timestampFile[1].replace(/[\u0000-\u001f\u007f]/g, "")
    : path.posix.basename(clean).replace(/[\u0000-\u001f\u007f]/g, "");

  if (!fileName || fileName === "." || fileName === "/") return value;

  return `${BASE_URL}/uploads/${folder}/${fileName}`;
}

function beatResponse(beat) {
  const plain = beat.toObject ? beat.toObject() : beat;
  return {
    ...plain,
    fileUrl: normalizeAssetUrl(plain.fileUrl, "audio"),
    coverUrl: normalizeAssetUrl(plain.coverUrl, "images")
  };
}

app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).send("Completa email y contrasena");
  }

  const existe = await User.findOne({ email });
  if (existe) return res.status(400).send("Usuario ya existe");

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({
    email,
    password: hashed,
    role: role === "admin" ? "admin" : "user"
  });

  await user.save();
  res.send("Usuario creado");
});

app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(401).send("Usuario no existe");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(401).send("Contrasena incorrecta");

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

app.get("/me", verificarToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).send("Usuario no existe");

  res.json({ email: user.email, role: user.role });
});

app.get("/beats", async (req, res) => {
  const beats = await Beat.find({ available: true, assigned: false }).sort({ _id: -1 });
  res.json(beats.map(beatResponse));
});

app.get("/all-beats", verificarToken, async (req, res) => {
  const beats = await Beat.find().sort({ _id: -1 });
  res.json(beats.map(beatResponse));
});

app.get("/admin/beats", verificarToken, soloAdmin, async (req, res) => {
  const beats = await Beat.find({ available: true, assigned: false }).sort({ _id: -1 });
  res.json(beats.map(beatResponse));
});

app.get("/admin/descargas", verificarToken, soloAdmin, async (req, res) => {
  const beats = await Beat.find({ assigned: true }).sort({ assignedAt: -1, _id: -1 });
  res.json(beats.map(beatResponse));
});

app.post("/beats/take/:id", verificarToken, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim();
    if (!name) return res.status(400).send("Falta el nombre del productor");
    if (!email) return res.status(400).send("Falta el correo del productor");

    const takerUser = await User.findById(req.user.id);

    const beat = await Beat.findOneAndUpdate(
      { _id: req.params.id, assigned: false },
      {
        assigned: true,
        available: false,
        assignedTo: name,
        assignedEmail: email,
        assignedBy: takerUser ? takerUser.email : req.user.id,
        assignedAt: new Date()
      },
      { new: true }
    );

    if (!beat) return res.status(404).send("Beat no disponible");
    res.json(beatResponse(beat));
  } catch (err) {
    console.log(err);
    res.status(500).send("Error tomando beat");
  }
});

app.post("/upload-beat",
  verificarToken,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const audio = req.files.audio?.[0];
      const cover = req.files.cover?.[0];

      if (!audio) return res.status(400).send("Falta el audio");

      const beat = new Beat({
        name: req.body.name,
        producer: req.body.producer || "Unknown",
        bpm: req.body.bpm,
        genre: req.body.genre,
        mood: req.body.mood,
        key: req.body.key,
        fileUrl: publicUploadUrl(audio.path),
        coverUrl: cover ? publicUploadUrl(cover.path) : "https://via.placeholder.com/600",
        userId: req.user ? req.user.id : undefined
      });

      await beat.save();
      res.send("Beat subido correctamente");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error subiendo beat");
    }
  }
);

app.delete("/beats/:id", verificarToken, async (req, res) => {
  try {
    const beat = await Beat.findById(req.params.id);
    if (!beat) return res.status(404).send("No encontrado");

    if (String(beat.userId) !== String(req.user.id)) {
      const user = await User.findById(req.user.id);
      if (!user || user.role !== "admin") {
        return res.status(403).send("No autorizado");
      }
    }

    await Beat.findByIdAndDelete(req.params.id);
    res.send("Beat eliminado");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error eliminando");
  }
});

app.get("/", (req, res) => {
  res.send("Go Beats backend funcionando");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${BASE_URL}`);
});
app.get("/my-beats", verificarToken, async (req, res) => {
  try {
    const beats = await Beat.find({ userId: req.user.id }).sort({ _id: -1 });
    res.json(beats.map(beatResponse));
  } catch (err) {
    res.status(500).send("Error obteniendo tus beats");
  }
});