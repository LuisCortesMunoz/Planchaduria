const BACKEND_URL = "https://docker-planchaduria.onrender.com";

const G = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isAdmin: JSON.parse(localStorage.getItem("isAdmin") || "false"),
  orders: [],
  filtered: [],
  currentId: null,
  delId: null,
  material: ""
};

document.addEventListener("DOMContentLoaded", async () => {
  bindModalClosers();
  await restoreSession();
});

function bindModalClosers() {
  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  document.getElementById("confirm-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("confirm-overlay")) closeConfirm();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeModal();
      closeConfirm();
    }
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
  const headers = { "Content-Type": "application/json" };

  if (withAuth && G.token) {
    headers["Authorization"] = `Bearer ${G.token}`;
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Error de servidor");
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
  const email = val("reg-email").trim();
  const telefono = val("reg-phone").trim();
  const password = val("reg-pass");

  if (!nombre || !apellido || !email || !password) {
    toast("Completa todos los campos obligatorios.", "error");
    return;
  }

  if (password.length < 6) {
    toast("La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  try {
    const data = await api("/api/auth/register", "POST", {
      nombre,
      apellido,
      email,
      telefono,
      password
    });

    setSession(data.token, data.user);
    toast("¡Cuenta creada! Bienvenido.", "success");
    goTo("screen-menu-client");
    loadCuenta();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function clientLogout() {
  clearSession();
  toast("Sesión cerrada.", "info");
  goTo("screen-splash");
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

async function adminLogout() {
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
  document.getElementById("np-step1").classList.toggle("hidden", n !== 1);
  document.getElementById("np-step2").classList.toggle("hidden", n !== 2);
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("np-entrega").min = tomorrow.toISOString().split("T")[0];
}

function npVolver() {
  showStep(1);
}

async function npFinalizar() {
  if (!G.token) {
    toast("Debes iniciar sesión.", "error");
    return;
  }

  const fechaEntrega = val("np-entrega");
  if (!fechaEntrega) {
    toast("Selecciona la fecha de entrega.", "error");
    return;
  }

  try {
    await api("/api/orders", "POST", {
      tipoPrenda: val("np-nombre").trim(),
      material: G.material,
      cantidad: parseInt(val("np-cantidad")) || 1,
      fechaEntrega,
      notas: val("np-instrucciones").trim()
    }, true);

    toast("Tu prenda fue registrada con éxito.", "success");
    resetNuevaPrenda();
    goTo("screen-menu-client");
  } catch (err) {
    toast(err.message, "error");
  }
}

/* =========================
   PANTALLAS CLIENTE
========================= */
async function loadMisPrendas() {
  const list = document.getElementById("mis-prendas-list");
  list.innerHTML = '<p class="empty-msg">Cargando…</p>';

  try {
    const data = await api("/api/orders/my", "GET", null, true);
    const pedidos = data.orders || [];

    if (!pedidos.length) {
      list.innerHTML = '<p class="empty-msg">No tienes prendas registradas aún.</p>';
      return;
    }

    list.innerHTML = pedidos.map(p => {
      const fotosHtml = (p.fotos || []).length
        ? `
          <div class="pedido-fotos">
            ${(p.fotos || []).map(f => `
              <div class="pedido-foto-item">
                <img src="${BACKEND_URL}${f.url}" alt="Foto ${p.Folio}">
                <span>${esc(f.fecha_hora || "")}</span>
              </div>
            `).join("")}
          </div>
        `
        : `<p class="sin-fotos">Aún no hay fotos para este pedido.</p>`;

      return `
        <div class="prenda-item pedido-card-col">
          <div class="prenda-item-top">
            <div class="prenda-item-info">
              <span class="prenda-item-name">${esc(p.tipoPrenda)}</span>
              <span class="prenda-item-sub">${fmtDate(p.fechaIngreso)} · ${esc(p.material || "")} · ${p.cantidad} pza.</span>
              <span>${badgeHtml(p.Estado)}</span>
            </div>
            <span class="prenda-item-id">${esc(p.Folio || "")}</span>
          </div>
          ${fotosHtml}
        </div>
      `;
    }).join("");
  } catch (err) {
    list.innerHTML = '<p class="empty-msg">Error al cargar prendas.</p>';
  }
}
async function buscarPedido() {
  const folio = val("tracking-input").trim().toUpperCase();

  if (!folio) {
    toast("Ingresa un ID de seguimiento.", "error");
    return;
  }

  const result = document.getElementById("tracking-result");
  const empty = document.getElementById("tracking-empty");

  result.classList.add("hidden");
  empty.style.display = "none";

  try {
    const data = await api(`/api/orders/track/${encodeURIComponent(folio)}`);
    const p = data.order;

    document.getElementById("tr-id").textContent = p.Folio || folio;
    document.getElementById("tr-prenda").textContent = p.tipoPrenda || "—";
    document.getElementById("tr-cliente").textContent = p.cliente || "—";
    document.getElementById("tr-entrega").textContent = fmtDate(p.FechaEntrega);
    document.getElementById("tr-estado").textContent = estadoLabel(p.Estado);

    result.classList.remove("hidden");
  } catch (err) {
    empty.style.display = "block";
    empty.textContent = `No se encontró ningún pedido con ID ${folio}.`;
  }
}

async function loadCuenta() {
  if (!G.user) return;

  document.getElementById("cuenta-name").textContent = G.user.nombreCompleto || G.user.email;
  document.getElementById("cuenta-email").textContent = G.user.email;
}

/* =========================
   ADMIN
========================= */
function showAdmin() {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.style.display = "";
  });

  const adminScreen = document.getElementById("screen-admin");
  adminScreen.style.display = "flex";
  adminScreen.classList.add("active");

  document.getElementById("adm-user-pill").textContent = (G.user?.email || "Admin").split("@")[0];
}

async function loadAdminData() {
  try {
    const [ordersData, clientsData] = await Promise.all([
      api("/api/admin/orders", "GET", null, true),
      api("/api/admin/clients", "GET", null, true)
    ]);

    G.orders = ordersData.orders || [];
    G.filtered = [...G.orders];

    updateMetrics();
    renderDashRecent();
    applyFilters();
    renderClientes(clientsData.clients || []);
  } catch (err) {
    toast(err.message, "error");
  }
}

function admNav(btn) {
  const targetId = btn.dataset.view;

  document.querySelectorAll(".adm-nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  document.querySelectorAll(".adm-view").forEach(v => v.classList.remove("active-adm-view"));
  document.getElementById(targetId)?.classList.add("active-adm-view");

  const titles = {
    "adm-view-dashboard": "Dashboard",
    "adm-view-pedidos": "Pedidos",
    "adm-view-nuevo": "Nuevo Pedido",
    "adm-view-clientes": "Clientes"
  };

  document.getElementById("adm-page-title").textContent = titles[targetId] || "";
  closeSidebar();
}

function admNavById(viewId) {
  const btn = document.querySelector(`[data-view="${viewId}"]`);
  if (btn) admNav(btn);
}

function updateMetrics() {
  const cnt = { pendiente: 0, en_proceso: 0, planchado: 0, listo: 0, entregado: 0 };

  G.orders.forEach(o => {
    if (cnt[o.Estado] !== undefined) cnt[o.Estado]++;
  });

  document.getElementById("m-total").textContent = G.orders.length;
  document.getElementById("m-pend").textContent = cnt.pendiente;
  document.getElementById("m-proc").textContent = cnt.en_proceso + cnt.planchado;
  document.getElementById("m-list").textContent = cnt.listo;
  document.getElementById("m-ent").textContent = cnt.entregado;
}

function renderDashRecent() {
  const tbody = document.getElementById("dash-tbody");
  const list = G.orders.slice(0, 6);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="t-empty">Sin pedidos aún.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>${esc(o.Folio || "—")}</strong></td>
      <td>${esc(o.cliente)}</td>
      <td>${esc(o.tipoPrenda)}</td>
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
    const matchText = !search ||
      (o.cliente || "").toLowerCase().includes(search) ||
      (o.tipoPrenda || "").toLowerCase().includes(search) ||
      (o.Folio || "").toLowerCase().includes(search);

    const matchStatus = !status || o.Estado === status;
    return matchText && matchStatus;
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
      <td>${esc(o.cliente)}</td>
      <td>${esc(o.tipoPrenda)}</td>
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

function admOpenNew() {
  ["adm-f-cliente","adm-f-telefono","adm-f-prenda","adm-f-cantidad","adm-f-precio","adm-f-notas"].forEach(id => setVal(id, ""));
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
  const fechaEntrega = val("adm-f-entrega");

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

  if (!ingreso || !fechaEntrega) {
    toast("Debes completar las fechas.", "error");
    return;
  }

  if (fechaEntrega < ingreso) {
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
    FechaEntrega: fechaEntrega,
    notas: val("adm-f-notas").trim()
  };

  try {
    if (editId) {
      payload.Estado = val("adm-f-estado");
      await api(`/api/admin/orders/${editId}`, "PATCH", payload, true);
      toast("Pedido actualizado.", "success");
    } else {
      await api("/api/admin/orders", "POST", payload, true);
      toast("Pedido registrado.", "success");
    }

    admOpenNew();
    admNavById("adm-view-pedidos");
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
  }
}

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
      <div class="det-item"><span class="det-lbl">Cliente</span><span class="det-val">${esc(o.cliente)}</span></div>
      <div class="det-item"><span class="det-lbl">Teléfono</span><span class="det-val">${esc(o.telefono || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Prenda</span><span class="det-val">${esc(o.tipoPrenda)}</span></div>
      <div class="det-item"><span class="det-lbl">Material</span><span class="det-val">${esc(o.material || "—")}</span></div>
      <div class="det-item"><span class="det-lbl">Cantidad</span><span class="det-val">${o.cantidad || 1} pza.</span></div>
      <div class="det-item"><span class="det-lbl">Precio</span><span class="det-val">${o.precio ? `$${parseFloat(o.precio).toFixed(2)} MXN` : "—"}</span></div>
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
    await api(`/api/admin/orders/${G.currentId}`, "PATCH", {
      Estado: newEstado
    }, true);

    toast("Estado actualizado.", "success");
    closeModal();
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
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
    await api(`/api/admin/orders/${G.delId}`, "DELETE", null, true);
    toast("Pedido eliminado.", "info");
    closeConfirm();
    closeModal();
    await loadAdminData();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderClientes(clients) {
  const tbody = document.getElementById("clientes-tbody");
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="t-empty">No hay clientes registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td>${esc(c.nombreCompleto || c.email)}</td>
      <td>${esc(c.email || "—")}</td>
      <td>${esc(c.telefono || "—")}</td>
      <td style="text-align:center">${c.totalPedidos || 0}</td>
    </tr>
  `).join("");
}

/* =========================
   SIDEBAR ADMIN
========================= */
function toggleSidebar() {
  const s = document.getElementById("adm-sidebar");
  const ov = document.getElementById("sidebar-overlay");
  s.classList.toggle("open");
  ov.classList.toggle("hidden", !s.classList.contains("open"));
}

function closeSidebar() {
  document.getElementById("adm-sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.add("hidden");
}

/* =========================
   HELPERS
========================= */
function badgeHtml(Estado) {
  const map = {
    pendiente: ["b-pendiente", "⏳ Pendiente"],
    en_proceso: ["b-en_proceso", "🔄 En proceso"],
    planchado: ["b-planchado", "👔 Planchado"],
    listo: ["b-listo", "✅ Listo"],
    entregado: ["b-entregado", "🏠 Entregado"]
  };
  const [cls, label] = map[Estado] || ["b-pendiente", Estado || "—"];
  return `<span class="badge ${cls}">${label}</span>`;
}

function estadoLabel(Estado) {
  const labels = {
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    planchado: "Planchado",
    listo: "Listo para entrega",
    entregado: "Entregado"
  };
  return labels[Estado] || Estado || "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
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

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
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

function toast(msg, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}
