// ================================
// CONFIG
// ================================
const BACKEND_URL = "https://docker-planchaduria.onrender.com";

const G = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isAdmin: JSON.parse(localStorage.getItem("isAdmin") || "false"),
  lastOrder: null
};

// ================================
// UTILIDADES
// ================================
async function api(path, method = "GET", body = null, withAuth = false) {
  const headers = {};

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (withAuth && G.token) {
    headers["Authorization"] = `Bearer ${G.token}`;
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body
      ? (body instanceof FormData ? body : JSON.stringify(body))
      : null
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.message || "Error de servidor");
  }

  return data;
}

function toast(msg, type = "info") {
  alert(msg); // puedes cambiarlo por tu sistema de toasts
}

// ================================
// LOGIN
// ================================
async function loginClient() {
  const email = document.getElementById("cl-email").value.trim();
  const password = document.getElementById("cl-pass").value;

  if (!email || !password) {
    toast("Completa todos los campos", "error");
    return;
  }

  try {
    const data = await api("/api/auth/login", "POST", { email, password });

    G.token = data.token;
    G.user = data.user;

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    toast("Login correcto", "success");

  } catch (err) {
    toast(err.message, "error");
  }
}

// ================================
// CREAR PEDIDO (NO activa worker)
// ================================
async function crearPedido() {
  const tipoPrenda = document.getElementById("np-prenda").value;
  const material = document.getElementById("np-material").value;
  const cantidad = parseInt(document.getElementById("np-cantidad").value || "1");
  const fechaEntrega = document.getElementById("np-entrega").value;

  try {
    const data = await api("/api/orders", "POST", {
      tipoPrenda,
      material,
      cantidad,
      fechaEntrega
    }, true);

    const order = data.order;

    G.lastOrder = order;

    // 🔥 GENERAR QR SOLO CON FOLIO
    generarQR(order.Folio);

    toast("Pedido creado correctamente", "success");

  } catch (err) {
    toast(err.message, "error");
  }
}

// ================================
// GENERAR QR (SOLO FOLIO)
// ================================
function generarQR(folio) {
  const canvas = document.getElementById("qr-canvas");
  canvas.innerHTML = "";

  new QRCode(canvas, {
    text: String(folio).trim(),
    width: 200,
    height: 200
  });

  document.getElementById("qr-folio").textContent = folio;
}

// ================================
// ACTIVAR PEDIDO DESDE QR (imagen)
// ================================
async function leerQRYActivarPedidoDesdeImagen(file) {
  const reader = new FileReader();

  reader.onload = function () {
    const img = new Image();

    img.onload = async function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (!code) {
        toast("No se detectó QR", "error");
        return;
      }

      let folio = String(code.data).trim().toUpperCase();

      if (!folio.startsWith("#")) {
        folio = "#" + folio;
      }

      try {
        // 🔥 1. BUSCAR PEDIDO
        const data = await api(`/api/orders/track/${folio}`);

        const order = data.order;

        // 🔥 2. ACTIVAR EN BACKEND (NO DUPLICA)
        await api(`/api/worker/activate-by-folio`, "POST", {
          folio: folio
        });

        toast("Pedido activado correctamente", "success");

      } catch (err) {
        toast(err.message, "error");
      }
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(file);
}

// ================================
// EVENTO INPUT FILE QR
// ================================
document.getElementById("qr-input")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    leerQRYActivarPedidoDesdeImagen(file);
  }
});

// ================================
// LOGOUT
// ================================
function logout() {
  localStorage.clear();
  location.reload();
}
