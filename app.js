// ================================
// app.js
// ================================
const BACKEND_URL = "https://docker-planchaduria.onrender.com";

const G = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isAdmin: JSON.parse(localStorage.getItem("isAdmin") || "false"),
  orders: [],
  filtered: [],
  currentId: null,
  delId: null,
  material: "",
  pendingRegister: null,
  pendingReset: null
};

document.addEventListener("DOMContentLoaded", async () => {
  bindModalClosers();
  bindPasswordToggles();
  createPhotoViewer();
  createQRModal();
  initResponsive();
  aplicarLimitesFechaEntrega();
  restorePendingRegister();
  restorePendingReset();
  await restoreSession();
});

document.addEventListener("change", e => {
  if (e.target && e.target.id === "np-entrega") {
    validarFechaEntregaInput();
  }
});

document.addEventListener("input", e => {
  if (e.target && e.target.id === "reset-code") {
    const code = e.target.value.replace(/\D/g, "").slice(0, 6);
    e.target.value = code;

    if (code.length === 6) {
      verifyPasswordResetCode();
    }
  }
});

function bindModalClosers() {
  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  document.getElementById("confirm-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("confirm-overlay")) closeConfirm();
  });

  document.getElementById("sidebar-overlay")?.addEventListener("click", () => {
    closeSidebar();
  });

  document.getElementById("verify-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("verify-overlay")) {
      closeVerifyModal();
    }
  });

  document.getElementById("reset-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("reset-overlay")) {
      closeResetPasswordModal();
    }
  });

  document.addEventListener("click", e => {
    const img = e.target.closest(".clickable-photo");
    if (img) {
      openImageViewer(
        img.getAttribute("data-fullsrc") || img.getAttribute("src") || "",
        img.getAttribute("alt") || "Foto"
      );
    }

    const overlay = e.target.closest("#photo-viewer-overlay");
    if (overlay && e.target.id === "photo-viewer-overlay") {
      closeImageViewer();
    }

    if (e.target.closest("#photo-viewer-close")) {
      closeImageViewer();
    }

    // Cerrar modal QR al hacer clic fuera
    const qrOverlay = document.getElementById("qr-modal-overlay");
    if (qrOverlay && e.target === qrOverlay) {
      closeQRModal();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeModal();
      closeConfirm();
      closeSidebar();
      closeImageViewer();
      closeVerifyModal();
      closeResetPasswordModal();
      closeQRModal();
    }
  });
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-toggle-pass]").forEach(btn => {
    btn.addEventListener("click", () => {
      const inputId = btn.getAttribute("data-toggle-pass");
      const input = document.getElementById(inputId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁";
      }
    });
  });
}

async function restoreSession() {
  if (!G.token) {
    goTo("screen-splash");
    return;
  }

  try {
    const data = await api("/api/auth/me", "GET", null, true);
    G.user = data.user;
    G.isAdmin = data.user.isAdmin;

    localStorage.setItem("user", JSON.stringify(G.user));
    localStorage.setItem("isAdmin", JSON.stringify(G.isAdmin));

    if (G.isAdmin) {
      showAdmin();
      await loadAdminData();
    } else {
      goTo("screen-menu-client");
      loadCuenta();
    }
  } catch (err) {
    clearSession();
    goTo("screen-splash");
  }
}

function goTo(screenId) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.style.display = "";
  });

  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

async function api(path, method = "GET", body = null, withAuth = false) {
  const headers = {};

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (withAuth && G.token) {
    headers["Authorization"] = `Bearer ${G.token}`;
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body
      ? (body instanceof FormData ? body : JSON.stringify(body))
      : null
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || "Error de servidor");
    error.payload = data;
    throw error;
  }

  return data;
}

function setSession(token, user) {
  G.token = token;
  G.user = user;
  G.isAdmin = !!user.isAdmin;

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("isAdmin", JSON.stringify(G.isAdmin));
}

function clearSession() {
  G.token = "";
  G.user = null;
  G.isAdmin = false;
  G.orders = [];
  G.filtered = [];
  G.currentId = null;
  G.delId = null;

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("isAdmin");
}

function fotoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${BACKEND_URL}${value}`;
  }

  return `${BACKEND_URL}/${value}`;
}

/* =========================
   AUTH CLIENTE
========================= */
async function loginClient() {
  const email = val("cl-email").trim();
  const password = val("cl-pass");

  if (!email || !password) {
    toast("Completa todos los campos.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/login", "POST", { email, password });

    if (data.user.isAdmin) {
      toast("Usa el acceso de administrador.", "error");
      return;
    }

    setSession(data.token, data.user);
    toast("¡Bienvenido de nuevo!", "success");
    goTo("screen-menu-client");
    loadCuenta();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function registerClient() {
  const nombre = val("reg-nombre").trim();
  const apellido = val("reg-apellido").trim();
  const email = val("reg-email").trim().toLowerCase();
  const telefono = val("reg-phone").trim();
  const password = val("reg-pass");

  const soloLetras = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
  const soloNumeros = /^\d+$/;

  if (!nombre || !apellido || !email || !password) {
    toast("Completa todos los campos obligatorios.", "error");
    return;
  }

  if (nombre.length < 1 || !soloLetras.test(nombre)) {
    toast("El nombre debe contener al menos un carácter válido.", "error");
    return;
  }

  if (apellido.length < 1 || !soloLetras.test(apellido)) {
    toast("El apellido debe contener al menos un carácter válido.", "error");
    return;
  }

  if (telefono && !soloNumeros.test(telefono)) {
    toast("El teléfono debe contener solo números.", "error");
    return;
  }

  if (password.length < 6) {
    toast("La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/request-register-code", "POST", {
      nombre,
      apellido,
      email,
      telefono,
      password
    });

    savePendingRegister({
      nombre,
      apellido,
      email,
      telefono
    });

    toast(data.message || "Te enviamos un código a tu correo.", "success");
    openVerifyModal(
      email,
      data.message || "Ingresa el código que enviamos a tu correo."
    );
  } catch (err) {
    toast(err.message, "error");
  }
}

async function verifyRegisterCode() {
  const code = val("ver-code").trim();
  const email = (G.pendingRegister?.email || val("ver-email").trim()).toLowerCase();

  if (!email) {
    toast("No se encontró el correo a verificar.", "error");
    return;
  }

  if (!code) {
    toast("Ingresa el código de verificación.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/verify-register-code", "POST", {
      email,
      code
    });

    if (!data.token || !data.user) {
      clearPendingRegister();
      closeVerifyModal();
      toast(data.message || "Cuenta creada correctamente.", "success");
      goTo("screen-login-client");
      return;
    }

    setSession(data.token, data.user);
    clearPendingRegister();
    closeVerifyModal();

    toast(data.message || "Cuenta verificada correctamente.", "success");

    setVal("reg-nombre", "");
    setVal("reg-apellido", "");
    setVal("reg-email", "");
    setVal("reg-phone", "");
    setVal("reg-pass", "");

    goTo("screen-menu-client");
    loadCuenta();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function resendRegisterCode() {
  const email = (G.pendingRegister?.email || val("ver-email").trim()).toLowerCase();

  if (!email) {
    toast("No se encontró el correo para reenviar el código.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/resend-register-code", "POST", { email });
    toast(data.message || "Código reenviado.", "success");
    setVerifyMessage(data.message || "Te enviamos un nuevo código.");
  } catch (err) {
    toast(err.message, "error");
  }
}

function clientLogout() {
  clearSession();
  toast("Sesión cerrada.", "info");
  goTo("screen-splash");
}

/* =========================
   MODAL VERIFICACIÓN REGISTRO
========================= */
function openVerifyModal(email = "", message = "") {
  setVal("ver-code", "");
  setVal("ver-email", email);
  setVerifyMessage(message || "Ingresa el código de verificación.");
  document.getElementById("verify-overlay")?.classList.remove("hidden");
}

function closeVerifyModal() {
  document.getElementById("verify-overlay")?.classList.add("hidden");
}

function setVerifyMessage(message) {
  const el = document.getElementById("ver-message");
  if (el) el.textContent = message || "";
}

function savePendingRegister(data) {
  G.pendingRegister = data || null;
  localStorage.setItem("pendingRegister", JSON.stringify(G.pendingRegister));
}

function restorePendingRegister() {
  try {
    G.pendingRegister = JSON.parse(localStorage.getItem("pendingRegister") || "null");
  } catch {
    G.pendingRegister = null;
  }
}

function clearPendingRegister() {
  G.pendingRegister = null;
  localStorage.removeItem("pendingRegister");
}

/* =========================
   RECUPERAR CONTRASEÑA
========================= */
function openResetPasswordModal(prefillEmail = "") {
  const email = prefillEmail || val("cl-email").trim() || G.pendingReset?.email || "";

  setVal("reset-email", email);
  setVal("reset-code", "");
  setVal("reset-new-pass", "");
  setVal("reset-confirm-pass", "");
  setResetMessage("Escribe tu correo para enviarte un código de recuperación.");
  showResetStep(1);
  document.getElementById("reset-overlay")?.classList.remove("hidden");
}

function closeResetPasswordModal() {
  document.getElementById("reset-overlay")?.classList.add("hidden");
}

function showResetStep(n) {
  document.getElementById("reset-step1")?.classList.toggle("hidden", n !== 1);
  document.getElementById("reset-step2")?.classList.toggle("hidden", n !== 2);
  document.getElementById("reset-step3")?.classList.toggle("hidden", n !== 3);

  document.getElementById("reset-actions-step1")?.classList.toggle("hidden", n !== 1);
  document.getElementById("reset-actions-step2")?.classList.toggle("hidden", n !== 2);
  document.getElementById("reset-actions-step3")?.classList.toggle("hidden", n !== 3);
}

function setResetMessage(message) {
  const el = document.getElementById("reset-message");
  if (el) el.textContent = message || "";
}

function savePendingReset(data) {
  G.pendingReset = data || null;
  localStorage.setItem("pendingReset", JSON.stringify(G.pendingReset));
}

function restorePendingReset() {
  try {
    G.pendingReset = JSON.parse(localStorage.getItem("pendingReset") || "null");
  } catch {
    G.pendingReset = null;
  }
}

function clearPendingReset() {
  G.pendingReset = null;
  localStorage.removeItem("pendingReset");
}

async function requestPasswordResetCode() {
  const email = val("reset-email").trim().toLowerCase();

  if (!email) {
    toast("Escribe tu correo.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/request-reset-code", "POST", { email });

    savePendingReset({
      email,
      codeVerified: false
    });

    setVal("reset-email", email);
    setVal("reset-code", "");
    setResetMessage(data.message || "Te enviamos un código de recuperación a tu correo.");
    showResetStep(2);
    toast(data.message || "Código enviado.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function verifyPasswordResetCode() {
  const email = (G.pendingReset?.email || val("reset-email").trim()).toLowerCase();
  const code = val("reset-code").trim();

  if (!email) {
    toast("No se encontró el correo.", "error");
    return;
  }

  if (code.length !== 6) {
    return;
  }

  try {
    const data = await api("/api/auth/verify-reset-code", "POST", {
      email,
      code
    });

    savePendingReset({
      email,
      code,
      codeVerified: true
    });

    setResetMessage(data.message || "Código correcto. Ahora escribe tu nueva contraseña.");
    showResetStep(3);
    toast(data.message || "Código verificado.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function resendPasswordResetCode() {
  const email = (G.pendingReset?.email || val("reset-email").trim()).toLowerCase();

  if (!email) {
    toast("No se encontró el correo para reenviar el código.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/resend-reset-code", "POST", { email });
    setVal("reset-code", "");
    setResetMessage(data.message || "Te enviamos un nuevo código.");
    toast(data.message || "Código reenviado.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function confirmPasswordReset() {
  const email = (G.pendingReset?.email || val("reset-email").trim()).toLowerCase();
  const code = G.pendingReset?.code || val("reset-code").trim();
  const newPassword = val("reset-new-pass");
  const confirmPassword = val("reset-confirm-pass");

  if (!email) {
    toast("No se encontró el correo.", "error");
    return;
  }

  if (!code) {
    toast("No se encontró el código de verificación.", "error");
    return;
  }

  if (!newPassword || !confirmPassword) {
    toast("Escribe y confirma tu nueva contraseña.", "error");
    return;
  }

  if (newPassword.length < 6) {
    toast("La nueva contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    toast("Las contraseñas no coinciden.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/confirm-reset-password", "POST", {
      email,
      code,
      newPassword
    });

    clearPendingReset();
    closeResetPasswordModal();

    setVal("cl-email", email);
    setVal("cl-pass", "");

    if (data.token && data.user) {
      setSession(data.token, data.user);
      toast(data.message || "Contraseña actualizada correctamente.", "success");
      goTo("screen-menu-client");
      loadCuenta();
      return;
    }

    toast(data.message || "Contraseña actualizada correctamente. Inicia sesión.", "success");
    goTo("screen-login-client");
  } catch (err) {
    toast(err.message, "error");
  }
}

/* =========================
   AUTH ADMIN
========================= */
async function loginAdmin() {
  const email = val("adm-email").trim();
  const password = val("adm-pass");

  if (!email || !password) {
    toast("Completa correo y contraseña.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/login", "POST", { email, password });

    if (!data.user.isAdmin) {
      toast("Acceso denegado. No tienes permisos de administrador.", "error");
      return;
    }

    setSession(data.token, data.user);
    toast("¡Bienvenido al panel!", "success");
    showAdmin();
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
  }
}

function adminLogout() {
  clearSession();
  closeSidebar();
  toast("Sesión cerrada.", "info");
  goTo("screen-splash");
}

/* =========================
   NUEVA PRENDA CLIENTE
========================= */
function resetNuevaPrenda() {
  G.material = "";
  setVal("np-nombre", "");
  setVal("np-cantidad", "1");
  setVal("np-instrucciones", "");
  setVal("np-entrega", "");
  document.querySelectorAll(".mat-btn").forEach(b => b.classList.remove("selected"));
  showStep(1);
}

function showStep(n) {
  document.getElementById("np-step1")?.classList.toggle("hidden", n !== 1);
  document.getElementById("np-step2")?.classList.toggle("hidden", n !== 2);
}

function selectMaterial(btn) {
  document.querySelectorAll(".mat-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  G.material = btn.textContent.trim();
}

function npContinuar() {
  const nombre = val("np-nombre").trim();
  const cantidad = parseInt(val("np-cantidad")) || 0;

  if (!nombre) {
    toast("Escribe el nombre de la prenda.", "error");
    return;
  }

  if (cantidad < 1) {
    toast("La cantidad debe ser al menos 1.", "error");
    return;
  }

  if (!G.material) {
    toast("Selecciona el material.", "error");
    return;
  }

  showStep(2);
  aplicarLimitesFechaEntrega();

  const el = document.getElementById("np-entrega");
  if (el) {
    setTimeout(() => {
      aplicarLimitesFechaEntrega();
    }, 100);
  }
}

function npVolver() {
  showStep(1);
}

async function npFinalizar() {
  if (!G.token) {
    toast("Debes iniciar sesión.", "error");
    return;
  }

  validarFechaEntregaInput();

  const tipoPrenda = val("np-nombre").trim();
  const cantidad = parseInt(val("np-cantidad")) || 1;
  const fechaEntrega = val("np-entrega");
  const notas = val("np-instrucciones").trim();

  if (!tipoPrenda) {
    toast("Escribe el nombre de la prenda.", "error");
    return;
  }

  if (!G.material) {
    toast("Selecciona el material.", "error");
    return;
  }

  if (!fechaEntrega) {
    toast("Selecciona la fecha de entrega.", "error");
    return;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const minFecha = new Date(hoy);
  const maxFecha = new Date(hoy);
  maxFecha.setDate(maxFecha.getDate() + 30);
  maxFecha.setHours(0, 0, 0, 0);

  const fechaSeleccionada = new Date(`${fechaEntrega}T00:00:00`);

  if (fechaSeleccionada < minFecha) {
    toast("La fecha de entrega debe ser desde hoy.", "error");
    return;
  }

  if (fechaSeleccionada > maxFecha) {
    toast("Solo puedes elegir una fecha dentro de los próximos 30 días.", "error");
    return;
  }

  try {
    const payload = {
      tipoPrenda,
      material: G.material,
      cantidad,
      fechaEntrega,
      notas
    };

    const data = await api("/api/orders", "POST", payload, true);

    let folioReal =
      data?.order?.Folio ||
      data?.order?.folio ||
      data?.Folio ||
      data?.folio ||
      "";

    if (!folioReal) {
      const myOrders = await api("/api/orders/my", "GET", null, true);
      const pedidos = Array.isArray(myOrders?.orders) ? myOrders.orders : [];

      const coincidencias = pedidos.filter(p =>
        String(p?.tipoPrenda || "").trim().toLowerCase() === tipoPrenda.toLowerCase() &&
        String(p?.material || "").trim().toLowerCase() === String(G.material || "").trim().toLowerCase() &&
        Number(p?.cantidad || 0) === Number(cantidad) &&
        String(p?.FechaEntrega || p?.fechaEntrega || "").slice(0, 10) === fechaEntrega
      );

      coincidencias.sort((a, b) => {
        const fa = new Date(a?.created_at || a?.fechaIngreso || a?.updated_at || 0).getTime();
        const fb = new Date(b?.created_at || b?.fechaIngreso || b?.updated_at || 0).getTime();
        return fb - fa;
      });

      folioReal = coincidencias[0]?.Folio || coincidencias[0]?.folio || "";
    }

    resetNuevaPrenda();
    goTo("screen-menu-client");

    mostrarModalConfirmacion({
      ...data,
      order: {
        ...(data?.order || {}),
        Folio: folioReal || data?.order?.Folio || data?.Folio || data?.folio || "—"
      }
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

/* =========================
   QR: UTILIDADES DE BLINDAJE VISUAL
========================= */
function aplicarBlindajeVisualQR(elemento) {
  if (!elemento) return;

  elemento.classList.add("qr-safe-box");
  elemento.setAttribute("data-qr-safe", "true");

  elemento.style.background = "#ffffff";
  elemento.style.color = "#000000";
  elemento.style.filter = "none";
  elemento.style.webkitFilter = "none";
  elemento.style.mixBlendMode = "normal";
  elemento.style.webkitPrintColorAdjust = "exact";
  elemento.style.printColorAdjust = "exact";
  elemento.style.forcedColorAdjust = "none";
  elemento.style.webkitForcedColorAdjust = "none";
  elemento.style.colorScheme = "light";
}

function generarImagenQRDesdeCanvas(canvas) {
  if (!canvas) return null;

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/* =========================
   QR CENTRALIZADO Y BLINDADO
========================= */
function renderQREnCanvas(canvas, folio) {
  if (!canvas) return;

  const size = 180;
  const textoQR = String(folio || "").trim();

  canvas.width = size;
  canvas.height = size;

  aplicarBlindajeVisualQR(canvas);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const tempWrap = document.createElement("div");
  tempWrap.style.position = "fixed";
  tempWrap.style.left = "-99999px";
  tempWrap.style.top = "0";
  tempWrap.style.width = `${size}px`;
  tempWrap.style.height = `${size}px`;
  tempWrap.style.background = "#FFFFFF";
  tempWrap.style.padding = "0";
  tempWrap.style.margin = "0";
  tempWrap.style.opacity = "0";
  tempWrap.style.pointerEvents = "none";
  tempWrap.style.zIndex = "-1";
  aplicarBlindajeVisualQR(tempWrap);
  document.body.appendChild(tempWrap);

  try {
    new QRCode(tempWrap, {
      text: textoQR,
      width: size,
      height: size,
      colorDark: "#000000",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.H
    });

    const dibujarQR = () => {
      const qrCanvas = tempWrap.querySelector("canvas");
      const qrImg = tempWrap.querySelector("img");

      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (qrCanvas) {
        canvas.width = qrCanvas.width || size;
        canvas.height = qrCanvas.height || size;
        aplicarBlindajeVisualQR(canvas);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(qrCanvas, 0, 0);

        const dataUrl = generarImagenQRDesdeCanvas(canvas);
        if (dataUrl) {
          canvas.dataset.qrPng = dataUrl;
        }
      } else if (qrImg) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width || size;
          canvas.height = img.height || size;
          aplicarBlindajeVisualQR(canvas);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const dataUrl = generarImagenQRDesdeCanvas(canvas);
          if (dataUrl) {
            canvas.dataset.qrPng = dataUrl;
          }
        };
        img.src = qrImg.src;
      }

      ctx.restore();

      try {
        document.body.removeChild(tempWrap);
      } catch {}
    };

    setTimeout(dibujarQR, 120);
  } catch (e) {
    console.warn("QR no disponible:", e);
    try {
      document.body.removeChild(tempWrap);
    } catch {}
  }
}

/* =========================
   MODAL DE CONFIRMACIÓN AL REGISTRAR PRENDA
========================= */
function mostrarModalConfirmacion(data) {
  const order = data?.order || data?.pedido || data || {};

  const folio =
    order?.Folio ||
    order?.folio ||
    data?.Folio ||
    data?.folio ||
    "—";

  const ahora = new Date();

  const fecha = ahora.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const hora = ahora.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });

  document.getElementById("conf-folio").textContent = folio;
  document.getElementById("conf-fecha").textContent = fecha;
  document.getElementById("conf-hora").textContent = hora;

  const canvas = document.getElementById("conf-qr-canvas");

  const qrWrap = canvas?.closest(".conf-qr-wrap");
  if (qrWrap) {
    qrWrap.classList.add("qr-safe-box");
    qrWrap.style.background = "#ffffff";
    qrWrap.style.padding = "12px";
    qrWrap.style.borderRadius = "8px";
    qrWrap.style.display = "inline-block";
    aplicarBlindajeVisualQR(qrWrap);
  }

  if (!canvas) {
    document.getElementById("modal-confirmacion")?.classList.remove("hidden");
    return;
  }

  renderQREnCanvas(canvas, folio);

  document.getElementById("modal-confirmacion")?.classList.remove("hidden");
}

function cerrarModalConfirmacion() {
  document.getElementById("modal-confirmacion")?.classList.add("hidden");
}

/* =========================
   MODAL QR REUTILIZABLE
========================= */
function createQRModal() {
  if (document.getElementById("qr-modal-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "qr-modal-overlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:320px; text-align:center;">
      <div class="modal-hd">
        <h3>Código QR del pedido</h3>
        <button class="modal-x" onclick="closeQRModal()" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-bd" style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px 0;">
        <p id="qr-modal-folio" style="font-weight:700; font-size:1.1rem; letter-spacing:.05em;"></p>
        <div id="qr-modal-canvas-wrap" class="qr-safe-box" style="background:#ffffff; padding:12px; border-radius:8px; display:inline-block;">
          <canvas id="qr-modal-canvas"></canvas>
        </div>
        <p style="font-size:.78rem; color:#888; margin:0;">Escanea este código para consultar tu pedido</p>
      </div>
      <div class="modal-ft" style="justify-content:center;">
        <button class="btn-dark" onclick="closeQRModal()">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const wrap = document.getElementById("qr-modal-canvas-wrap");
  const canvas = document.getElementById("qr-modal-canvas");
  aplicarBlindajeVisualQR(wrap);
  aplicarBlindajeVisualQR(canvas);
}

function abrirQRPedido(folio) {
  if (!folio || folio === "—") {
    toast("No hay folio disponible para este pedido.", "error");
    return;
  }

  const overlay = document.getElementById("qr-modal-overlay");
  if (!overlay) return;

  setText("qr-modal-folio", folio);

  const canvas = document.getElementById("qr-modal-canvas");
  const wrap = document.getElementById("qr-modal-canvas-wrap");
  aplicarBlindajeVisualQR(wrap);
  aplicarBlindajeVisualQR(canvas);

  renderQREnCanvas(canvas, folio);

  overlay.classList.remove("hidden");
}

function closeQRModal() {
  document.getElementById("qr-modal-overlay")?.classList.add("hidden");
}

/* =========================
   ACTIVAR PEDIDO DESDE QR POR IMAGEN
========================= */
async function leerQRYActivarPedido() {
  if (!G.token) {
    toast("Debes iniciar sesión.", "error");
    return;
  }

  if (typeof jsQR === "undefined") {
    toast("Falta cargar la librería jsQR en el HTML.", "error");
    return;
  }

  const input = document.getElementById("qr-image-input");
  const file = input?.files?.[0];

  if (!file) {
    toast("Selecciona una imagen con el QR.", "error");
    return;
  }

  try {
    const qrText = await decodificarQRDesdeImagen(file);

    if (!qrText) {
      toast("No se pudo leer el QR de la imagen.", "error");
      return;
    }

    let payloadQR = null;

    try {
      payloadQR = JSON.parse(qrText);
    } catch {
      payloadQR = {
        folio_local: String(qrText).trim()
      };
    }

    const folioLeidoRaw = String(payloadQR.folio_local || payloadQR.folio || qrText || "").trim();
    const folioLeido = folioLeidoRaw.startsWith("#") ? folioLeidoRaw.toUpperCase() : `#${folioLeidoRaw.toUpperCase()}`;

    setText("qr-folio-leido", folioLeido || "—");
    setText("qr-folio-render", folioLeido || "—");
    setText("qr-mensaje", "QR leído correctamente.");
    document.getElementById("qr-resultado")?.style.setProperty("display", "block");

    if (!folioLeido || folioLeido === "#") {
      throw new Error("No se pudo obtener un folio válido desde el QR.");
    }

    const data = await api(`/api/worker/activate-by-folio/${encodeURIComponent(folioLeido)}`, "POST", {}, false);

    const folioRender =
      data?.order?.Folio ||
      data?.order?.folio ||
      folioLeido ||
      "—";

    setText("qr-folio-render", folioRender);
    setText("qr-mensaje", `Pedido activado correctamente. Folio leído: ${folioLeido}`);
    toast(`Pedido activado. Folio leído: ${folioLeido}`, "success");
  } catch (err) {
    toast(err.message || "No se pudo activar el pedido desde el QR.", "error");
    setText("qr-mensaje", err.message || "Error");
    document.getElementById("qr-resultado")?.style.setProperty("display", "block");
  }
}

function decodificarQRDesdeImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (!code || !code.data) {
            resolve(null);
            return;
          }

          resolve(code.data);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/* =========================
   PANTALLAS CLIENTE
========================= */

async function loadMisPrendas() {
  const list = document.getElementById("mis-prendas-list");
  if (!list) return;

  list.innerHTML = '<p class="empty-msg">Cargando…</p>';

  try {
    const data = await api("/api/orders/my", "GET", null, true);
    const pedidos = data.orders || [];

    if (!pedidos.length) {
      list.innerHTML = '<p class="empty-msg">No tienes prendas registradas aún.</p>';
      return;
    }

    list.innerHTML = pedidos.map(p => {
      const folio = esc(p.Folio || p.folio || "");
      const folioRaw = String(p.Folio || p.folio || "").trim();

      const fotos = Array.isArray(p.fotos) ? p.fotos : [];
      const fotosHtml = fotos.length
        ? `
          <div class="pedido-fotos">
            ${fotos.map(f => {
              const fullSrc = fotoUrl(f.url);
              return `
                <div class="pedido-foto-item">
                  <img
                    src="${fullSrc}"
                    data-fullsrc="${fullSrc}"
                    class="clickable-photo"
                    alt="Foto ${folio}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  >
                  <span>${esc(f.fecha_hora || "")}</span>
                </div>
              `;
            }).join("")}
          </div>
        `
        : `<p class="sin-fotos">Aún no hay fotos para este pedido.</p>`;

      const qrBtnHtml = folioRaw
        ? `<button
             class="btn-qr-pedido"
             onclick="abrirQRPedido('${folioRaw.replace(/'/g, "\\'")}')"
             title="Ver QR del pedido"
             style="
               display:inline-flex;
               align-items:center;
               gap:6px;
               margin-top:10px;
               padding:7px 14px;
               background:transparent;
               border:1.5px solid #e63329;
               color:#e63329;
               border-radius:8px;
               font-size:.8rem;
               font-weight:600;
               cursor:pointer;
               transition:background .15s, color .15s;
             "
             onmouseover="this.style.background='#e63329';this.style.color='#fff'"
             onmouseout="this.style.background='transparent';this.style.color='#e63329'"
           >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
               <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
               <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
               <rect x="17" y="17" width="2" height="5"/><rect x="19" y="19" width="4" height="2"/>
             </svg>
             Ver QR
           </button>`
        : "";

      return `
        <div class="prenda-item pedido-card-col">
          <div class="prenda-item-top">
            <div class="prenda-item-info">
              <span class="prenda-item-name">${esc(p.tipoPrenda)}</span>
              <span class="prenda-item-sub">${fmtDate(p.fechaIngreso)} · ${esc(p.material || "")} · ${p.cantidad} pza.</span>
              <span>${badgeHtml(p.Estado)}</span>
            </div>
            <span class="prenda-item-id">${folio}</span>
          </div>
          ${fotosHtml}
          ${qrBtnHtml}
        </div>
      `;
    }).join("");
  } catch (err) {
    list.innerHTML = '<p class="empty-msg">Error al cargar prendas.</p>';
  }
}

async function buscarPedido() {
  const raw = val("tracking-input").trim();
  if (!raw) {
    toast("Ingresa un ID.", "error");
    return;
  }

  const folio = normalizeFolio(raw);

  try {
    const data = await api(`/api/orders/track/${encodeURIComponent(folio)}`, "GET", null, true);
    const p = data.order;

    setText("tr-id", p.Folio || "—");
    setText("tr-prenda", p.tipoPrenda || "—");
    setText("tr-cliente", p.cliente || p.nombre || "—");
    setText("tr-entrega", fmtDate(p.FechaEntrega || p.fechaEntrega));
    setText("tr-estado", p.Estado || "—");

    document.getElementById("tracking-result")?.classList.remove("hidden");
    document.getElementById("tracking-empty")?.classList.add("hidden");
  } catch (err) {
    document.getElementById("tracking-result")?.classList.add("hidden");
    document.getElementById("tracking-empty")?.classList.remove("hidden");
    toast(err.message || "No se encontró el pedido.", "error");
  }
}

function loadCuenta() {
  if (!G.user) return;
  setText("cuenta-name", `${G.user.nombre || ""} ${G.user.apellido || ""}`.trim() || "Usuario");
  setText("cuenta-email", G.user.email || "—");
}

/* =========================
   ADMIN
========================= */
function showAdmin() {
  goTo("screen-admin-layout");
}

async function loadAdminData() {
  await loadOrders();
  renderStats();
  renderOrders();
}

async function loadOrders() {
  const data = await api("/api/admin/orders", "GET", null, true);
  G.orders = Array.isArray(data.orders) ? data.orders : [];
  G.filtered = [...G.orders];
}

function renderStats() {
  setText("stat-total", String(G.orders.length));
  setText("stat-pend", String(G.orders.filter(o => (o.Estado || "").toLowerCase() === "pendiente").length));
  setText("stat-proceso", String(G.orders.filter(o => (o.Estado || "").toLowerCase() === "en proceso").length));
  setText("stat-listo", String(G.orders.filter(o => (o.Estado || "").toLowerCase() === "listo").length));
}

function renderOrders() {
  const box = document.getElementById("orders-list");
  if (!box) return;

  if (!G.filtered.length) {
    box.innerHTML = '<p class="empty-msg">No hay pedidos.</p>';
    return;
  }

  box.innerHTML = G.filtered.map(o => `
    <div class="admin-order-card">
      <div class="admin-order-top">
        <div>
          <div class="admin-order-folio">${esc(o.Folio || "—")}</div>
          <div class="admin-order-sub">${esc(o.cliente || o.nombre || "Cliente")} · ${fmtDate(o.fechaIngreso)}</div>
        </div>
        <div>${badgeHtml(o.Estado)}</div>
      </div>

      <div class="admin-order-body">
        <div><b>Prenda:</b> ${esc(o.tipoPrenda || "—")}</div>
        <div><b>Material:</b> ${esc(o.material || "—")}</div>
        <div><b>Cantidad:</b> ${esc(String(o.cantidad || "—"))}</div>
        <div><b>Entrega:</b> ${fmtDate(o.FechaEntrega || o.fechaEntrega)}</div>
      </div>

      <div class="admin-order-actions">
        <button class="btn-outline-dark" onclick="openDetail('${escAttr(o.id)}')">Ver detalle</button>
        <button class="btn-red" onclick="openEditStatus('${escAttr(o.id)}')">Editar estado</button>
        <button class="btn-danger-red" onclick="askDelete('${escAttr(o.id)}')">Eliminar</button>
      </div>
    </div>
  `).join("");
}

function filterOrders() {
  const q = val("admin-search").trim().toLowerCase();
  const status = val("admin-filter-status").trim().toLowerCase();

  G.filtered = G.orders.filter(o => {
    const text = [
      o.Folio,
      o.tipoPrenda,
      o.material,
      o.cliente,
      o.nombre,
      o.Estado
    ].join(" ").toLowerCase();

    const matchQ = !q || text.includes(q);
    const matchStatus = !status || (o.Estado || "").toLowerCase() === status;
    return matchQ && matchStatus;
  });

  renderOrders();
}

function openDetail(id) {
  const order = G.orders.find(x => String(x.id) === String(id));
  if (!order) return;

  G.currentId = id;

  const fotos = Array.isArray(order.fotos) ? order.fotos : [];
  const fotosHtml = fotos.length
    ? `
      <div class="pedido-fotos" style="margin-top:10px;">
        ${fotos.map(f => {
          const src = fotoUrl(f.url);
          return `
            <div class="pedido-foto-item">
              <img
                src="${src}"
                data-fullsrc="${src}"
                class="clickable-photo"
                alt="Foto del pedido ${esc(order.Folio || "")}"
                loading="lazy"
                referrerpolicy="no-referrer"
              >
              <span>${esc(f.fecha_hora || "")}</span>
            </div>
          `;
        }).join("")}
      </div>
    `
    : `<p class="sin-fotos" style="margin-top:10px;">Aún no hay fotos para este pedido.</p>`;

  openModal(`
    <div class="detail-grid">
      <div><span>Folio</span><b>${esc(order.Folio || "—")}</b></div>
      <div><span>Cliente</span><b>${esc(order.cliente || order.nombre || "—")}</b></div>
      <div><span>Teléfono</span><b>${esc(order.telefono || "—")}</b></div>
      <div><span>Prenda</span><b>${esc(order.tipoPrenda || "—")}</b></div>
      <div><span>Material</span><b>${esc(order.material || "—")}</b></div>
      <div><span>Cantidad</span><b>${esc(String(order.cantidad || "—"))}</b></div>
      <div><span>Fecha ingreso</span><b>${fmtDate(order.fechaIngreso)}</b></div>
      <div><span>Entrega</span><b>${fmtDate(order.FechaEntrega || order.fechaEntrega)}</b></div>
      <div><span>Estado</span><b>${esc(order.Estado || "—")}</b></div>
      <div class="full-row"><span>Notas</span><b>${esc(order.notas || "—")}</b></div>
      <div class="full-row"><span>Fotos</span>${fotosHtml}</div>
    </div>
  `, "Detalle del pedido");
}

function openEditStatus(id) {
  const order = G.orders.find(x => String(x.id) === String(id));
  if (!order) return;

  G.currentId = id;

  openModal(`
    <label class="field-lbl">Nuevo estado</label>
    <select id="edit-status" class="field solo">
      ${["Pendiente", "En proceso", "Listo"].map(s => `
        <option value="${s}" ${String(order.Estado || "").toLowerCase() === s.toLowerCase() ? "selected" : ""}>${s}</option>
      `).join("")}
    </select>
    <button class="btn-dark full" onclick="saveStatus()">Guardar cambios</button>
  `, "Editar estado");
}

async function saveStatus() {
  if (!G.currentId) return;
  const estado = val("edit-status");

  try {
    await api(`/api/admin/orders/${encodeURIComponent(G.currentId)}/status`, "PUT", { Estado: estado }, true);
    closeModal();
    toast("Estado actualizado.", "success");
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
  }
}

function askDelete(id) {
  G.delId = id;
  openConfirm("¿Seguro que deseas eliminar este pedido?", deleteCurrent);
}

async function deleteCurrent() {
  if (!G.delId) return;

  try {
    await api(`/api/admin/orders/${encodeURIComponent(G.delId)}`, "DELETE", null, true);
    G.delId = null;
    closeConfirm();
    toast("Pedido eliminado.", "success");
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
  }
}

/* =========================
   SIDEBAR ADMIN
========================= */
function openSidebar() {
  document.getElementById("sidebar-overlay")?.classList.remove("hidden");
  document.getElementById("admin-sidebar")?.classList.add("open");
}

function closeSidebar() {
  document.getElementById("sidebar-overlay")?.classList.add("hidden");
  document.getElementById("admin-sidebar")?.classList.remove("open");
}

/* =========================
   MODALES
========================= */
function openModal(contentHtml, title = "Detalle") {
  setText("modal-title", title);
  document.getElementById("modal-content").innerHTML = contentHtml;
  document.getElementById("modal-overlay")?.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay")?.classList.add("hidden");
  document.getElementById("modal-content").innerHTML = "";
}

function openConfirm(message, onAccept) {
  setText("confirm-text", message);
  document.getElementById("confirm-overlay")?.classList.remove("hidden");
  window.__confirmAccept = onAccept;
}

function closeConfirm() {
  document.getElementById("confirm-overlay")?.classList.add("hidden");
  window.__confirmAccept = null;
}

function confirmAccept() {
  if (typeof window.__confirmAccept === "function") {
    window.__confirmAccept();
  }
}

/* =========================
   RESPONSIVE
========================= */
function initResponsive() {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);

  const onResize = () => {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  };

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
}

/* =========================
   FECHA ENTREGA
========================= */
function aplicarLimitesFechaEntrega() {
  const input = document.getElementById("np-entrega");
  if (!input) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const minFecha = formatDateInput(hoy);

  const maxFecha = new Date(hoy);
  maxFecha.setDate(maxFecha.getDate() + 30);
  const maxFechaStr = formatDateInput(maxFecha);

  input.min = minFecha;
  input.max = maxFechaStr;

  if (input.value) {
    validarFechaEntregaInput();
  }
}

function validarFechaEntregaInput() {
  const input = document.getElementById("np-entrega");
  if (!input || !input.value) return;

  const seleccionada = new Date(`${input.value}T00:00:00`);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const maxFecha = new Date(hoy);
  maxFecha.setDate(maxFecha.getDate() + 30);
  maxFecha.setHours(0, 0, 0, 0);

  if (seleccionada < hoy) {
    input.value = formatDateInput(hoy);
    toast("La fecha no puede ser anterior a hoy.", "error");
    return;
  }

  if (seleccionada > maxFecha) {
    input.value = formatDateInput(maxFecha);
    toast("Solo puedes elegir una fecha dentro de los próximos 30 días.", "error");
  }
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* =========================
   PHOTO VIEWER
========================= */
function createPhotoViewer() {
  if (document.getElementById("photo-viewer-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "photo-viewer-overlay";
  overlay.className = "photo-viewer-overlay hidden";
  overlay.innerHTML = `
    <div class="photo-viewer-box">
      <button id="photo-viewer-close" class="photo-viewer-close" aria-label="Cerrar">✕</button>
      <img id="photo-viewer-img" src="" alt="Vista completa">
      <p id="photo-viewer-caption"></p>
    </div>
  `;

  document.body.appendChild(overlay);
}

function openImageViewer(src, caption = "") {
  const overlay = document.getElementById("photo-viewer-overlay");
  const img = document.getElementById("photo-viewer-img");
  const cap = document.getElementById("photo-viewer-caption");

  if (!overlay || !img || !cap) return;

  img.src = src || "";
  cap.textContent = caption || "";
  overlay.classList.remove("hidden");
}

function closeImageViewer() {
  document.getElementById("photo-viewer-overlay")?.classList.add("hidden");
  const img = document.getElementById("photo-viewer-img");
  if (img) img.src = "";
}

/* =========================
   HELPERS
========================= */
function val(id) {
  return document.getElementById(id)?.value || "";
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escAttr(str) {
  return esc(str).replaceAll("`", "&#96;");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function normalizeFolio(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function badgeHtml(status) {
  const s = String(status || "Pendiente");
  const low = s.toLowerCase();

  const cls =
    low === "listo" ? "badge-green" :
    low === "en proceso" ? "badge-yellow" :
    "badge-red";

  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

function toast(message, type = "info") {
  let wrap = document.getElementById("toast-wrap");

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.style.position = "fixed";
    wrap.style.top = "18px";
    wrap.style.left = "50%";
    wrap.style.transform = "translateX(-50%)";
    wrap.style.zIndex = "99999";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";
    wrap.style.pointerEvents = "none";
    document.body.appendChild(wrap);
  }

  const item = document.createElement("div");
  item.textContent = message;
  item.style.pointerEvents = "auto";
  item.style.padding = "12px 16px";
  item.style.borderRadius = "12px";
  item.style.color = "#fff";
  item.style.fontSize = "14px";
  item.style.fontWeight = "600";
  item.style.boxShadow = "0 10px 25px rgba(0,0,0,.18)";
  item.style.maxWidth = "320px";
  item.style.wordBreak = "break-word";
  item.style.background =
    type === "success" ? "#0f9d58" :
    type === "error" ? "#d93025" :
    "#3c4043";

  wrap.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(-6px)";
    item.style.transition = "all .25s ease";
  }, 2800);

  setTimeout(() => {
    item.remove();
  }, 3200);
}
