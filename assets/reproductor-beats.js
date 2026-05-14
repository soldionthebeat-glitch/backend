// Reproductor de beats sin función de descarga
class ReproductorBeats {
  constructor(container) {
    this.container = container;
    this.currentTrack = null;
    this.isPlaying = false;
    this.init();
  }

  init() {
    if (this.container) {
      this.render();
      this.attachEventListeners();
    }
  }

  render() {
    const audio = this.container.querySelector('audio');
    if (!audio) return;

    // Desactivar controles nativos y opciones de descarga
    audio.removeAttribute('controls');
    audio.setAttribute('preload', 'metadata');
    try {
      audio.setAttribute('controlsList', 'nodownload');
    } catch (e) {}
    audio.addEventListener('contextmenu', (ev) => ev.preventDefault());

    // Evitar insertar UI duplicada
    if (this.container.querySelector('.reproductor-beats')) return;

    const coverSrc = audio.dataset.cover || '/img/default-beat.png';
    const title = audio.dataset.title || 'Beat';
    const producer = audio.dataset.producer || 'Productor';

    const reproducerHTML = `
      <div class="reproductor-beats">
        <div class="beat-info">
          <div class="beat-cover">
            <img src="${coverSrc}" alt="Beat" />
          </div>
          <div class="beat-details">
            <h3 class="beat-title">${title}</h3>
            <p class="beat-producer">${producer}</p>
          </div>
        </div>

        <div class="reproductor-controls">
          <div class="progress-container">
            <span class="tiempo-actual">0:00</span>
            <div class="progress-bar">
              <div class="progress-fill"></div>
              <input type="range" class="progress-slider" min="0" max="100" value="0" />
            </div>
            <span class="tiempo-total">0:00</span>
          </div>

          <div class="botones-control">
            <button class="btn-play-pause" title="Reproducir/Pausar">
              <span class="icon">▶</span>
            </button>
            <button class="btn-volumen" title="Volumen">
              <span class="icon">🔊</span>
            </button>
            <input type="range" class="slider-volumen" min="0" max="100" value="70" title="Volumen" />
          </div>
        </div>

        <div class="reproductor-info">
          <p>Reproductor exclusivo - No disponible para descarga</p>
        </div>
      </div>
    `;

    this.container.insertAdjacentHTML('beforeend', reproducerHTML);
  }

  attachEventListeners() {
    const audio = this.container.querySelector('audio');
    if (!audio) return;

    const playPauseBtn = this.container.querySelector('.btn-play-pause');
    const progressSlider = this.container.querySelector('.progress-slider');
    const volumeSlider = this.container.querySelector('.slider-volumen');
    const progressFill = this.container.querySelector('.progress-fill');
    const timeActual = this.container.querySelector('.tiempo-actual');
    const timeTotal = this.container.querySelector('.tiempo-total');

    // Variable para saber si estamos arrastrando el slider
    let isDragging = false;

    // Play/Pause
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playPauseBtn.querySelector('.icon').textContent = '⏸';
        this.isPlaying = true;
      } else {
        audio.pause();
        playPauseBtn.querySelector('.icon').textContent = '▶';
        this.isPlaying = false;
      }
    });

    // Actualizar duración
    audio.addEventListener('loadedmetadata', () => {
      timeTotal.textContent = this.formatTime(audio.duration);
      progressSlider.max = audio.duration;
    });

    // Actualizar progreso
    audio.addEventListener('timeupdate', () => {
      if (!isDragging) {
        progressSlider.value = audio.currentTime;
        progressFill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
        timeActual.textContent = this.formatTime(audio.currentTime);
      }
    });

    // Detector de arrastre - inicio
    progressSlider.addEventListener('mousedown', () => {
      isDragging = true;
    });

    // Detector de arrastre - fin
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Cambiar progreso (solo cuando se suelta)
    progressSlider.addEventListener('change', () => {
      audio.currentTime = progressSlider.value;
      progressFill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
      timeActual.textContent = this.formatTime(audio.currentTime);
    });

    // Volumen
    volumeSlider.addEventListener('input', (e) => {
      audio.volume = e.target.value / 100;
    });

    // Resetear cuando termina
    audio.addEventListener('ended', () => {
      playPauseBtn.querySelector('.icon').textContent = '▶';
      this.isPlaying = false;
      progressSlider.value = 0;
      progressFill.style.width = '0%';
    });
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

// Inicializar reproductores al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  // Encontrar todos los contenedores de audio
  document.querySelectorAll('[data-reproductor="beat"]').forEach(container => {
    new ReproductorBeats(container);
  });
});

