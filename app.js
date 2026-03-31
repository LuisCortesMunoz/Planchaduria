/* ══════════════════════════════════════════════════════════════
   Planchado Express — app.js
   Frontend → Backend Flask(Render) → Firebase
   Se conserva diseño y pantallas del HTML actual
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   1. CONFIG
══════════════════════════════════════════════ */
const API_BASE = "https://docker-planchaduria.onrender.com";

const firebaseConfig = {
  apiKey:            "AIzaSyBVR2rFkIiBDPigHiqU82cV-iMyZvXza98",
  authDomain:        "db-planchaduria.firebaseapp.com",
  databaseURL:       "https://db-planchaduria-default-rtdb.firebaseio.com",
  projectId:         "db-planchaduria",
  storageBucket:     "db-planchaduria.firebasestorage.app",
  messagingSenderId: "88489323952",
  appId:             "1:88489323952:web:7df0eb2d438d62430f3a75",
  measurementId:     "G-D16JVMYYRM"
};

const ADMIN_UID = "HrGtBnzEtBXLK19YpeI8wTAaSM42";

/* ══════════════════════════════════════════════
   2. ESTADO GLOBAL
══════════════════════════════════════════════ */
const G = {
  auth: null,
  user: null,
  isAdmin: false,
  orders: [],
  filtered: [],
  currentId: null,
  delId: null,
  material: "",
  clients: []
};

/* ══════════════════════════════════════════════
   3. INIT
══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    firebase.initializeApp(firebaseConfig);
    G.auth = firebase.auth();
    console.log("✅ Firebase Auth conectado");
  } catch (err) {
    console.error(err);
    toast("Error al iniciar Firebase Auth.", "error");
    return;
  }

  G.auth.onAuthStateChanged(async (user) => {
    G.user = user || null;
    G.isAdmin = !!(user && user.uid === ADMIN_UID);

    if (!user) {
      goTo("screen-splash");
      hideAdminScreen();
      return;
    }

    if (G.isAdmin) {
      showAdmin();
      document.getElementById("adm-user-pill").textContent = (user.email || "Admin").split("@")[0];
      await reloadAdminData();
    } else {
      hideAdminScreen();
      goTo("screen-menu-client");
      await loadCuenta();
    }
  });
});

/* ══════════════════════════════════════════════
   4. API HELPERS
══════════════════════════════════════════════ */
async function getIdToken() {
  const user = G.auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(true);
}

async function apiFetch(path, options = {}) {
  const token = await getIdToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.error || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/* ══════════════════════════════════════════════
   5. NAV
══════════════════════════════════════════════ */
function goTo(screenId) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    if (s.id === "screen-admin") s.style.display = "none";
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    if (screenId === "screen-admin") target.style.display = "flex";
  }
}

function showAdmin() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const adminScreen = document.getElementById("screen-admin");
  adminScreen.style.display = "flex";
  adminScreen.classList.add("active");
}

function hideAdminScreen() {
  const adminScreen = document.getElementById("screen-admin");
  if (adminScreen) {
    adminScreen.classList.remove("active");
    adminScreen.style.display = "none";
  }
}

/* ══════════════════════════════════════════════
   6. AUTH CLIENTE
══════════════════════════════════════════════ */
async function loginClient() {
  const email = val("cl-email").trim();
  const pass  = val("cl-pass");

  if (!email || !pass) {
    toast("Completa todos los campos.", "error");
    return;
  }

  try {
    const cred = await G.auth.signInWithEmailAndPassword(email, pass);

    if (cred.user.uid === ADMIN_UID) {
      await G.auth.signOut();
      toast("Usa el acceso de administrador.", "error");
      return;
    }

    toast("¡Bienvenido de nuevo!", "success");
  } catch (err) {
    toast(authError(err), "error");
  }
}

async function registerClient() {
  const nombre   = val("reg-nombre").trim();
  const apellido = val("reg-apellido").trim();
  const email    = val("reg-email").trim();
  const phone    = val("reg-phone").trim();
  const pass     = val("reg-pass");

  if (!nombre || !apellido || !email || !pass) {
    toast("Completa los campos obligatorios.", "error");
    return;
  }

  if (pass.length < 6) {
    toast("La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  try {
    const cred = await G.auth.createUserWithEmailAndPassword(email, pass);

    await cred.user.updateProfile({
      displayName: `${nombre} ${apellido}`.trim()
    });

    await apiFetch("/api/me/profile", {
      method: "POST",
      body: JSON.stringify({
        nombre,
        apellido,
        telefono: phone,
        email
      })
    });

    toast("¡Cuenta creada correctamente!", "success");
  } catch (err) {
    toast(authError(err), "error");
  }
}

async function clientLogout() {
  try {
    await G.auth.signOut();
    toast("Sesión cerrada.", "info");
  } catch (err) {
    toast("No se pudo cerrar sesión.", "error");
  }
}

/* ══════════════════════════════════════════════
   7. AUTH ADMIN
══════════════════════════════════════════════ */
async function loginAdmin() {
  const email = val("adm-email").trim();
  const pass  = val("adm-pass");

  if (!email || !pass) {
    toast("Completa el correo y la contraseña.", "error");
    return;
  }

  try {
    const cred = await G.auth.signInWithEmailAndPassword(email, pass);

    if (cred.user.uid !== ADMIN_UID) {
      await G.auth.signOut();
      toast("Acceso denegado. No eres administrador.", "error");
      return;
    }

    toast("Bienvenido al panel.", "success");
  } catch (err) {
    toast(authError(err), "error");
  }
}

async function adminLogout() {
  try {
    await G.auth.signOut();
    closeSidebar();
    toast("Sesión cerrada.", "info");
  } catch (err) {
    toast("No se pudo cerrar sesión.", "error");
  }
}

/* ══════════════════════════════════════════════
   8. CLIENTE — NUEVA PRENDA
══════════════════════════════════════════════ */
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
  document.getElementById("np-step1").classList.toggle("hidden", n !== 1);
  document.getElementById("np-step2").classList.toggle("hidden", n !== 2);
}

function selectMaterial(btn) {
  document.querySelectorAll(".mat-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  G.material = btn.textContent.trim();
}

function npContinuar() {
  const nombre   = val("np-nombre").trim();
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("np-entrega").min = tomorrow.toISOString().split("T")[0];
}

function npVolver() {
  showStep(1);
}

async function npFinalizar() {
  if (!G.user) {
    toast("Debes iniciar sesión.", "error");
    return;
  }

  const FechaEntrega = val("np-entrega");
  if (!FechaEntrega) {
    toast("Selecciona la fecha de entrega.", "error");
    return;
  }

  const payload = {
    tipoPrenda: val("np-nombre").trim(),
    material: G.material,
    cantidad: parseInt(val("np-cantidad")) || 1,
    FechaEntrega,
    notas: val("np-instrucciones").trim()
  };

  try {
    const data = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    toast(`Tu prenda fue registrada con folio ${data.order?.Folio || ""}`, "success");
    goTo("screen-menu-client");
    resetNuevaPrenda();
  } catch (err) {
    console.error(err);
    toast(err.message || "Error al registrar la prenda.", "error");
  }
}

/* ══════════════════════════════════════════════
   9. CLIENTE — PANTALLAS
══════════════════════════════════════════════ */
async function loadMisPrendas() {
  const list = document.getElementById("mis-prendas-list");
  list.innerHTML = '<p class="empty-msg">Cargando…</p>';

  try {
    const data = await apiFetch("/api/orders/mine");
    const items = data.orders || [];

    if (!items.length) {
      list.innerHTML = '<p class="empty-msg">No tienes prendas registradas aún.</p>';
      return;
    }

    list.innerHTML = items.map(p => `
      <div class="prenda-item">
        <div class="prenda-item-info">
          <span class="prenda-item-name">${esc(p.tipoPrenda)}</span>
          <span class="prenda-item-sub">${fmtDate(p.fechaIngreso)} · ${esc(p.material || "")} · ${p.cantidad || 1} pza.</span>
          <span>${badgeHtml(p.Estado)}</span>
        </div>
        <span class="prenda-item-id">${esc(p.Folio || "")}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = '<p class="empty-msg">Error al cargar prendas.</p>';
  }
}

async function buscarPedido() {
  const FolioIngresado = val("tracking-input").trim().toUpperCase();
  if (!FolioIngresado) {
    toast("Ingresa un ID de seguimiento.", "error");
    return;
  }

  const result = document.getElementById("tracking-result");
  const empty  = document.getElementById("tracking-empty");

  result.classList.add("hidden");
  empty.style.display = "none";

  try {
    const data = await apiFetch(`/api/orders/track/${encodeURIComponent(FolioIngresado)}`);
    const p = data.order;

    document.getElementById("tr-id").textContent      = p.Folio || FolioIngresado;
    document.getElementById("tr-prenda").textContent  = p.tipoPrenda || "—";
    document.getElementById("tr-cliente").textContent = p.cliente || "—";
    document.getElementById("tr-entrega").textContent = fmtDate(p.FechaEntrega);
    document.getElementById("tr-estado").textContent  = estadoLabel(p.Estado);

    result.classList.remove("hidden");
  } catch (err) {
    empty.style.display = "block";
    empty.textContent = err.message || "No se encontró el pedido.";
  }
}

async function loadCuenta() {
  if (!G.user) return;

  try {
    const data = await apiFetch("/api/me/profile");
    const p = data.profile || {};

    const nombre = `${p.nombre || ""} ${p.apellido || ""}`.trim() || G.user.displayName || G.user.email;
    document.getElementById("cuenta-name").textContent  = nombre;
    document.getElementById("cuenta-email").textContent = p.email || G.user.email || "—";
  } catch (err) {
    document.getElementById("cuenta-name").textContent  = G.user.displayName || G.user.email || "—";
    document.getElementById("cuenta-email").textContent = G.user.email || "—";
  }
}

/* ══════════════════════════════════════════════
   10. ADMIN — DATA
══════════════════════════════════════════════ */
async function reloadAdminData() {
  await Promise.all([
    loadAdminOrders(),
    loadAdminClients()
  ]);
  updateMetrics();
  renderDashRecent();
  applyFilters();
  renderClientes();
}

async function loadAdminOrders() {
  try {
    const data = await apiFetch("/api/admin/orders");
    G.orders = data.orders || [];
  } catch (err) {
    console.error(err);
    G.orders = [];
    toast(err.message || "Error al cargar pedidos.", "error");
  }
}

async function loadAdminClients() {
  try {
    const data = await apiFetch("/api/admin/clients");
    G.clients = data.clients || [];
  } catch (err) {
    console.error(err);
    G.clients = [];
  }
}

/* ══════════════════════════════════════════════
   11. ADMIN — NAV
══════════════════════════════════════════════ */
function admNav(btn) {
  const targetId = btn.dataset.view;
  document.querySelectorAll(".adm-nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  document.querySelectorAll(".adm-view").forEach(v => v.classList.remove("active-adm-view"));
  document.getElementById(targetId)?.classList.add("active-adm-view");

  const titles = {
    "adm-view-dashboard": "Dashboard",
    "adm-view-pedidos":   "Pedidos",
    "adm-view-nuevo":     "Nuevo Pedido",
    "adm-view-clientes":  "Clientes"
  };

  document.getElementById("adm-page-title").textContent = titles[targetId] || "";
  closeSidebar();
}

function admNavById(viewId) {
  const btn = document.querySelector(`[data-view="${viewId}"]`);
  if (btn) admNav(btn);
}

/* ══════════════════════════════════════════════
   12. ADMIN — MÉTRICAS Y TABLAS
══════════════════════════════════════════════ */
function updateMetrics() {
  const cnt = { pendiente:0, en_proceso:0, planchado:0, listo:0, entregado:0 };

  G.orders.forEach(o => {
    if (cnt[o.Estado] !== undefined) cnt[o.Estado]++;
  });

  document.getElementById("m-total").textContent = G.orders.length;
  document.getElementById("m-pend").textContent  = cnt.pendiente;
  document.getElementById("m-proc").textContent  = cnt.en_proceso + cnt.planchado;
  document.getElementById("m-list").textContent  = cnt.listo;
  document.getElementById("m-ent").textContent   = cnt.entregado;
}

function renderDashRecent() {
  const tbody = document.getElementById("dash-tbody");
  const list  = G.orders.slice(0, 6);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="t-empty">Sin pedidos aún.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>${esc(o.Folio || "—")}</strong></td>
      <td>${esc(o.cliente || "—")}</td>
      <td>${esc(o.tipoPrenda || "—")}</td>
      <td>${fmtDate(o.fechaIngreso)}</td>
      <td>${badgeHtml(o.Estado)}</td>
      <td>
        <div class="tbl-actions">
          <button class="tbl-btn" onclick="openModal('${o.id}')">👁</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function applyFilters() {
  const search = (document.getElementById("adm-search")?.value || "").toLowerCase();
  const status = document.getElementById("adm-filter-st")?.value || "";

  G.filtered = G.orders.filter(o => {
    const matchText =
      !search ||
      (o.cliente || "").toLowerCase().includes(search) ||
      (o.tipoPrenda || "").toLowerCase().includes(search) ||
      (o.Folio || "").toLowerCase().includes(search);

    const matchSt = !status || o.Estado === status;

    return matchText && matchSt;
  });

  renderPedidosTable();
}

function renderPedidosTable() {
  const tbody = document.getElementById("pedidos-tbody");

  if (!G.filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="t-empty">No hay pedidos que coincidan.</td></tr>';
    return;
  }

  tbody.innerHTML = G.filtered.map(o => `
    <tr>
      <td><strong>${esc(o.Folio || "—")}</strong></td>
      <td>${esc(o.cliente || "—")}</td>
      <td>${esc(o.tipoPrenda || "—")}</td>
      <td>${esc(o.material || "—")}</td>
      <td style="text-align:center">${o.cantidad || 1}</td>
      <td>${fmtDate(o.fechaIngreso)}</td>
      <td>${fmtDate(o.FechaEntrega)}</td>
      <td>${badgeHtml(o.Estado)}</td>
      <td>
        <div class="tbl-actions">
          <button class="tbl-btn" onclick="openModal('${o.id}')">👁</button>
          <button class="tbl-btn" onclick="admOpenEdit('${o.id}')">✏️</button>
          <button class="tbl-btn del" onclick="confirmDelete('${o.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");
}

/* ══════════════════════════════════════════════
   13. ADMIN — FORM
══════════════════════════════════════════════ */
function admOpenNew() {
  ["adm-f-cliente","adm-f-telefono","adm-f-prenda","adm-f-cantidad","adm-f-precio","adm-f-notas"].forEach(id => setVal(id,""));
  setVal("adm-edit-id", "");
  setVal("adm-f-material", "");
  setVal("adm-f-ingreso", today());
  setVal("adm-f-entrega", "");
  setVal("adm-f-estado", "pendiente");
  document.getElementById("adm-form-title").textContent = "Registrar nuevo pedido";
  document.getElementById("adm-status-row").style.display = "none";
}

function admOpenEdit(id) {
  const o = G.orders.find(x => x.id === id);
  if (!o) return;

  setVal("adm-edit-id", id);
  setVal("adm-f-cliente", o.cliente || "");
  setVal("adm-f-telefono", o.telefono || "");
  setVal("adm-f-prenda", o.tipoPrenda || "");
  setVal("adm-f-material", o.material || "");
  setVal("adm-f-cantidad", o.cantidad || 1);
  setVal("adm-f-precio", o.precio || "");
  setVal("adm-f-ingreso", o.fechaIngreso || "");
  setVal("adm-f-entrega", o.FechaEntrega || "");
  setVal("adm-f-notas", o.notas || "");
  setVal("adm-f-estado", o.Estado || "pendiente");

  document.getElementById("adm-form-title").textContent = "Editar pedido";
  document.getElementById("adm-status-row").style.display = "block";

  closeModal();
  admNavById("adm-view-nuevo");
}

async function admSaveOrder() {
  const editId = val("adm-edit-id");
  const cliente = val("adm-f-cliente").trim();
  const prenda = val("adm-f-prenda").trim();
  const cantidad = parseInt(val("adm-f-cantidad")) || 0;
  const ingreso = val("adm-f-ingreso");
  const FechaEntrega = val("adm-f-entrega");

  if (!cliente) {
    toast("El nombre del cliente es obligatorio.", "error");
    return;
  }
  if (!prenda) {
    toast("El nombre de la prenda es obligatorio.", "error");
    return;
  }
  if (cantidad < 1) {
    toast("La cantidad debe ser al menos 1.", "error");
    return;
  }
  if (!ingreso) {
    toast("La fecha de ingreso es obligatoria.", "error");
    return;
  }
  if (!FechaEntrega) {
    toast("La fecha de entrega es obligatoria.", "error");
    return;
  }
  if (FechaEntrega < ingreso) {
    toast("La entrega no puede ser antes del ingreso.", "error");
    return;
  }

  const payload = {
    cliente,
    telefono: val("adm-f-telefono").trim(),
    tipoPrenda: prenda,
    material: val("adm-f-material"),
    cantidad,
    precio: parseFloat(val("adm-f-precio")) || null,
    fechaIngreso: ingreso,
    FechaEntrega,
    notas: val("adm-f-notas").trim()
  };

  try {
    if (editId) {
      payload.Estado = val("adm-f-estado");
      await apiFetch(`/api/admin/orders/${editId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      toast("Pedido actualizado.", "success");
    } else {
      await apiFetch("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("Pedido creado.", "success");
    }

    admOpenNew();
    await reloadAdminData();
    admNavById("adm-view-pedidos");
  } catch (err) {
    console.error(err);
    toast(err.message || "Error al guardar el pedido.", "error");
  }
}

/* ══════════════════════════════════════════════
   14. ADMIN — MODAL
══════════════════════════════════════════════ */
function openModal(id) {
  const o = G.orders.find(x => x.id === id);
  if (!o) return;

  G.currentId = id;

  document.getElementById("modal-bd").innerHTML = `
    <div class="det-grid">
      <div class="det-item"><span class="det-lbl">Folio</span><span class="det-val">${esc(o.Folio || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Estado</span><span class="det-val">${badgeHtml(o.Estado)}</span></div>
      <div class="det-item"><span class="det-lbl">Contador</span><span class="det-val">${o.Contador || "—"}</span></div>
      <div class="det-item"><span class="det-lbl">Validado</span><span class="det-val">${o.Validado ? "✅ Sí" : "⏳ No"}</span></div>
      <div class="det-item"><span class="det-lbl">Cliente</span><span class="det-val">${esc(o.cliente || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Teléfono</span><span class="det-val">${esc(o.telefono || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Prenda</span><span class="det-val">${esc(o.tipoPrenda || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Material</span><span class="det-val">${esc(o.material || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Cantidad</span><span class="det-val">${o.cantidad || 1} pza.</span></div>
      <div class="det-item"><span class="det-lbl">Precio</span><span class="det-val">${o.precio ? `$${Number(o.precio).toFixed(2)} MXN` : "—"}</span></div>
      <div class="det-item"><span class="det-lbl">Ingreso</span><span class="det-val">${fmtDate(o.fechaIngreso)}</span></div>
      <div class="det-item"><span class="det-lbl">Entrega est.</span><span class="det-val">${fmtDate(o.FechaEntrega)}</span></div>
      ${o.notas ? `<div class="det-item full"><span class="det-lbl">Notas</span><span class="det-val">${esc(o.notas)}</span></div>` : ""}
    </div>
  `;

  document.getElementById("modal-st-sel").value = o.Estado || "pendiente";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  G.currentId = null;
}

async function admUpdateStatus() {
  if (!G.currentId) return;

  const newEstado = document.getElementById("modal-st-sel").value;

  try {
    await apiFetch(`/api/admin/orders/${G.currentId}`, {
      method: "PUT",
      body: JSON.stringify({ Estado: newEstado })
    });

    toast("Estado actualizado.", "success");
    closeModal();
    await reloadAdminData();
  } catch (err) {
    console.error(err);
    toast(err.message || "Error al actualizar estado.", "error");
  }
}

function admEditFromModal() {
  if (G.currentId) admOpenEdit(G.currentId);
}

function confirmDelete(id) {
  G.delId = id;
  document.getElementById("confirm-overlay").classList.remove("hidden");
}

function closeConfirm() {
  document.getElementById("confirm-overlay").classList.add("hidden");
  G.delId = null;
}

async function executeDelete() {
  if (!G.delId) return;

  try {
    await apiFetch(`/api/admin/orders/${G.delId}`, { method: "DELETE" });
    toast("Pedido eliminado.", "info");
    closeConfirm();
    closeModal();
    await reloadAdminData();
  } catch (err) {
    console.error(err);
    toast(err.message || "Error al eliminar.", "error");
  }
}

/* ══════════════════════════════════════════════
   15. CLIENTES
══════════════════════════════════════════════ */
function renderClientes() {
  const tbody = document.getElementById("clientes-tbody");
  if (!tbody) return;

  if (!G.clients.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="t-empty">No hay clientes registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = G.clients.map(c => `
    <tr>
      <td>${esc(c.nombreCompleto || c.email || "—")}</td>
      <td>${esc(c.email || "—")}</td>
      <td>${esc(c.telefono || "—")}</td>
      <td style="text-align:center">${c.pedidos || 0}</td>
    </tr>
  `).join("");
}

/* ══════════════════════════════════════════════
   16. SIDEBAR ADMIN
══════════════════════════════════════════════ */
function toggleSidebar() {
  const s  = document.getElementById("adm-sidebar");
  const ov = document.getElementById("sidebar-overlay");
  s.classList.toggle("open");
  ov.classList.toggle("hidden", !s.classList.contains("open"));
}

function closeSidebar() {
  document.getElementById("adm-sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.add("hidden");
}

/* ══════════════════════════════════════════════
   17. HELPERS
══════════════════════════════════════════════ */
function badgeHtml(Estado) {
  const map = {
    pendiente:  ["b-pendiente",  "⏳ Pendiente"],
    en_proceso: ["b-en_proceso", "🔄 En proceso"],
    planchado:  ["b-planchado",  "👔 Planchado"],
    listo:      ["b-listo",      "✅ Listo"],
    entregado:  ["b-entregado",  "🏠 Entregado"]
  };
  const [cls, label] = map[Estado] || ["b-pendiente", Estado || "—"];
  return `<span class="badge ${cls}">${label}</span>`;
}

function estadoLabel(Estado) {
  const labels = {
    pendiente:  "Pendiente",
    en_proceso: "En proceso",
    planchado:  "Planchado",
    listo:      "Listo para entrega",
    entregado:  "Entregado"
  };
  return labels[Estado] || Estado || "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  if (typeof iso !== "string") return "—";

  const onlyDate = iso.includes("T") ? iso.split("T")[0] : iso;
  const parts = onlyDate.split("-");
  if (parts.length !== 3) return iso;

  const [y, m, d] = parts;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;

  if (inp.type === "password") {
    inp.type = "text";
    btn.textContent = "🙈";
  } else {
    inp.type = "password";
    btn.textContent = "👁";
  }
}

function authError(err) {
  const m = {
    "auth/user-not-found":       "Correo no registrado.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/invalid-email":        "Correo inválido.",
    "auth/email-already-in-use": "Este correo ya está registrado.",
    "auth/weak-password":        "Contraseña muy débil.",
    "auth/too-many-requests":    "Demasiados intentos. Intenta más tarde.",
    "auth/invalid-credential":   "Credenciales incorrectas."
  };
  return m[err.code] || err.message || "Error de autenticación.";
}

function toast(msg, type = "info") {
  const icons = { success:"✅", error:"❌", info:"ℹ️" };
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    closeConfirm();
  }
});

document.getElementById("modal-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

document.getElementById("confirm-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("confirm-overlay")) closeConfirm();
});
