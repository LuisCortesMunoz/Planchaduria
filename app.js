const API_BASE = "https://docker-flask-servidor-render.onrender.com";

const el = (id) => document.getElementById(id);

const log = (msg) => {
  el("log").textContent =
    `${new Date().toLocaleTimeString()}  ${msg}\n` + el("log").textContent;
};

function makeUrl(path) {
  return `${API_BASE}${path}`;
}

let ledState = Array(8).fill(false);

const colorInput = el("color");
const ledButtons = document.querySelectorAll(".led-btn");

function renderButtons() {
  ledButtons.forEach((btn) => {
    const idx = Number(btn.dataset.led);
    if (ledState[idx]) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

async function sendToBackend() {
  const payload = {
    hex: colorInput.value,
    leds: ledState
  };

  try {
    const res = await fetch(makeUrl("/api/set_leds"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Request failed");

    log(`OK -> hex=${data.state.hex}, leds=${JSON.stringify(data.state.leds)}`);
  } catch (err) {
    log(`ERROR -> ${err.message}`);
  }
}

// Toggle LEDs (auto-send)
ledButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const idx = Number(btn.dataset.led);
    ledState[idx] = !ledState[idx];
    renderButtons();
    await sendToBackend();
  });
});

// All ON / OFF (auto-send)
el("btnAllOn").addEventListener("click", async () => {
  ledState = Array(8).fill(true);
  renderButtons();
  await sendToBackend();
});

el("btnAllOff").addEventListener("click", async () => {
  ledState = Array(8).fill(false);
  renderButtons();
  await sendToBackend();
});

// ✅ INSTANT: each color movement sends immediately
colorInput.addEventListener("input", () => {
  sendToBackend();
});

renderButtons();
log("Ready.");
