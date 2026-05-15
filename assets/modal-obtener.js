const API_OBTENER_URL = window.API_URL || (
  ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:"
    ? "http://localhost:5000"
    : "https://backend-j3sk.onrender.com"
);

class ModalObtener {
  constructor() {
    this.modal = null;
    this.currentBeat = null;
    this.init();
  }

  init() {
    if (document.getElementById("modalObtener")) {
      this.modal = document.getElementById("modalObtener");
      return;
    }

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-obtener" id="modalObtener" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modalObtenerTitle">
          <button class="modal-close" id="modalClose" type="button" aria-label="Cerrar">&times;</button>
          <h2 id="modalObtenerTitle">Tomar beat</h2>
          <p id="modalBeatSummary">Completa tus datos y la descarga comenzara automaticamente.</p>

          <form id="formObtener">
            <div class="form-group">
              <label for="producerName">Nombre de productor *</label>
              <input type="text" id="producerName" name="producerName" placeholder="Tu nombre artistico" autocomplete="name" required />
            </div>

            <div class="form-group">
              <label for="producerEmail">Correo electronico *</label>
              <input type="email" id="producerEmail" name="producerEmail" placeholder="tu@email.com" autocomplete="email" required />
            </div>

            <div id="formError" class="modal-error" role="alert"></div>

            <div class="modal-actions">
              <button type="submit" class="btn-descargar">Tomar y descargar</button>
              <button type="button" class="btn-cancelar" id="modalCancel">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `);

    this.modal = document.getElementById("modalObtener");
    this.attachEventListeners();
  }

  attachEventListeners() {
    document.getElementById("modalClose").addEventListener("click", () => this.close());
    document.getElementById("modalCancel").addEventListener("click", () => this.close());
    document.getElementById("formObtener").addEventListener("submit", (event) => this.handleSubmit(event));

    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal) this.close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.modal.classList.contains("active")) this.close();
    });
  }

  open(beatInfo) {
    this.currentBeat = beatInfo || {};
    const summary = document.getElementById("modalBeatSummary");
    summary.textContent = `${this.currentBeat.name || "Beat"} - Prod. ${this.currentBeat.producer || "Desconocido"}`;
    this.modal.classList.add("active");
    this.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("producerName")?.focus(), 50);
  }

  close() {
    this.modal.classList.remove("active");
    this.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.getElementById("formObtener")?.reset();
    this.setError("");
  }

  setError(message) {
    const errorDiv = document.getElementById("formError");
    if (errorDiv) errorDiv.textContent = message || "";
  }

  async handleSubmit(event) {
    event.preventDefault();

    const name = document.getElementById("producerName").value.trim();
    const email = document.getElementById("producerEmail").value.trim();
    const submitBtn = event.target.querySelector(".btn-descargar");
    const originalBtnText = submitBtn.textContent;

    this.setError("");

    if (!name || !email) {
      this.setError("Completa nombre de productor y correo electronico.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setError("Ingresa un correo electronico valido.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparando descarga...";

    try {
      const headers = { "Content-Type": "application/json" };
      const token = localStorage.getItem("token");
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_OBTENER_URL}/beats/take/${this.currentBeat.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, email })
      });

      const data = await this.parseResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Este beat ya no esta disponible.");
      }

      const beat = data && data._id ? data : this.currentBeat;
      this.registrarToma(name, email, beat);
      await this.triggerDownload(beat.fileUrl || this.currentBeat.fileUrl, beat.name || this.currentBeat.name);
      this.markBeatAsTakenInUI(beat);

      if (typeof window.cargarBeats === "function") {
        window.cargarBeats();
      }

      this.close();
    } catch (error) {
      console.error(error);
      this.setError(error.message || "No se pudo tomar el beat. Intenta nuevamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }

  async parseResponse(response) {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  registrarToma(name, email, beat) {
    const tomas = JSON.parse(localStorage.getItem("beatTomas") || "[]");
    tomas.push({
      id: beat._id || this.currentBeat.id || Date.now(),
      beatName: beat.name || this.currentBeat.name || "Beat",
      beatProducer: beat.producer || this.currentBeat.producer || "Desconocido",
      beatId: beat._id || this.currentBeat.id || "",
      producerName: name,
      producerEmail: email,
      timestamp: beat.assignedAt || new Date().toISOString(),
      fecha: new Date(beat.assignedAt || Date.now()).toLocaleString("es-AR")
    });
    localStorage.setItem("beatTomas", JSON.stringify(tomas));
  }

  async triggerDownload(fileUrl, beatName) {
    if (!fileUrl) throw new Error("El beat no tiene archivo de audio disponible.");

    const fileName = `${(beatName || "beat").replace(/[^\w\s-]/g, "").trim() || "beat"}.mp3`;

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("No se pudo leer el archivo.");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.clickDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (error) {
      this.clickDownload(fileUrl, fileName);
    }
  }

  clickDownload(url, fileName) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  markBeatAsTakenInUI(beat) {
    const id = beat._id || beat.id || this.currentBeat.id;
    if (!id) return;

    const btn = document.querySelector(`[data-beat-id="${CSS.escape(String(id))}"]`);
    const card = btn?.closest(".beat-card");
    if (!card) return;

    card.classList.add("is-taken");
    const badge = card.querySelector(".taken-badge");
    if (badge) {
      badge.textContent = "Tomado";
      badge.classList.remove("available");
    }

    const actions = card.querySelector(".beat-actions");
    if (actions) actions.innerHTML = `<button type="button" disabled>No disponible</button>`;
  }
}

window.modalObtener = new ModalObtener();

document.addEventListener("click", (event) => {
  const btn = event.target.closest(".btn-obtener");
  if (!btn) return;

  event.preventDefault();
  window.modalObtener.open({
    id: btn.dataset.beatId || "",
    name: btn.dataset.beatName || "Beat",
    producer: btn.dataset.beatProducer || "Desconocido",
    fileUrl: btn.dataset.beatFile || ""
  });
});



