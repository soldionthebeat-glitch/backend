const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

mongoose.connect("mongodb://127.0.0.1:27017/sello")
  .then(() => console.log("Mongo conectado"))
  .catch(console.error);

const User = mongoose.model("User", {
  email: String,
  password: String,
  role: { type: String, default: "user" }
});

async function createAdmin() {
  const hashed = await bcrypt.hash("123", 10);

  const user = new User({
    email: "sodli@gmail.com",
    password: hashed,
    role: "admin"
  });

  await user.save();
  console.log("Admin creado");
  mongoose.disconnect();
}

createAdmin();
