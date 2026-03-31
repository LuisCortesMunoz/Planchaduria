/* =========================================================
   Planchado Express — app.js (Backend API mode)
========================================================= */

const API = "https://docker-planchaduria.onrender.com";
const ADMIN_EMAILS = ["admin@planchadoexpress.com"]; // ajusta si quieres

const G = {
  user: null,
  isAdmin: false,
  orders: [],
  filtered: [],
  currentId: null,
  delId: null,
  material: "",
};

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await checkSession();
  } catch (err) {
    console.error(err);
    goTo("screen-splash");
  }
});

/* =========================================================
   HELPERS API
========================================================= */
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

async function apiForm(path, formData) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

/* =========================================================
   NAVEGACIÓN
========================================================= */
function goTo(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

/* =========================================================
   AUTH
========================================================= */
async function checkSession() {
  try {
    const me = await api("/auth/me");
    G.user = me.user;
    G.isAdmin = !!me.user?.isAdmin;

    if (G.isAdmin) {
      document.getElementById("adm-user-pill").textContent = (G.user.email || "admin").split("@")[0];
      showAdmin();
      await subscribeOrders();
    } else if (G.user) {
      goTo("screen-menu-client");
      await loadCuenta();
    } else {
      goTo("screen-splash");
    }
  } catch {
    G.user = null;
    G.isAdmin = false;
    goTo("screen-splash");
  }
}

async function loginClient() {
  const email = val("cl-email");
  const pass  = val("cl-pass");
  if (!email || !pass) { toast("Completa todos los campos.", "error"); return; }

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pass })
    });

    G.user = data.user;
    G.isAdmin = !!data.user?.isAdmin;

    if (G.isAdmin) {
      toast("Usa el acceso de administrador.", "error");
      await clientLogout();
      return;
    }

    toast("¡Bienvenido de nuevo!", "success");
    goTo("screen-menu-client");
    await loadCuenta();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function registerClient() {
  const nombre   = val("reg-nombre");
  const apellido = val("reg-apellido");
  const email    = val("reg-email");
  const phone    = val("reg-phone");
  const pass     = val("reg-pass");

  if (!nombre || !apellido || !email || !pass) {
    toast("Completa todos los campos obligatorios.", "error");
    return;
  }
  if (pass.length < 6) {
    toast("La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nombre, apellido, email, telefono: phone, password: pass })
    });

    G.user = data.user;
    G.isAdmin = !!data.user?.isAdmin;
    toast("¡Cuenta creada! Bienvenido.", "success");
    goTo("screen-menu-client");
    await loadCuenta();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function clientLogout() {
  await api("/auth/logout", { method: "POST" });
  G.user = null;
  G.isAdmin = false;
  goTo("screen-splash");
  toast("Sesión cerrada.", "info");
}

async function loginAdmin() {
  const email = val("adm-email");
  const pass  = val("adm-pass");
  if (!email || !pass) { toast("Completa el correo y contraseña.", "error"); return; }

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pass })
    });

    G.user = data.user;
    G.isAdmin = !!data.user?.isAdmin;

    if (!G.isAdmin) {
      await clientLogout();
      toast("Acceso denegado. No tienes permisos de administrador.", "error");
      return;
    }

    document.getElementById("adm-user-pill").textContent = email.split("@")[0];
    toast("¡Bienvenido al panel!", "success");
    showAdmin();
    await subscribeOrders();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function adminLogout() {
  await api("/auth/logout", { method: "POST" });
  G.user = null;
  G.isAdmin = false;
  closeSidebar();
  goTo("screen-splash");
  toast("Sesión cerrada.", "info");
}

/* =========================================================
   PEDIDOS
========================================================= */
async function subscribeOrders() {
  const data = await api("/orders");
  G.orders = data.orders || [];
  applyFilters();
  updateMetrics();
  renderDashRecent();
  renderClientes();
}

async function generarFolio() {
  const data = await api("/orders/next-folio");
  return { Folio: data.Folio, Contador: data.Contador };
}

async function addPedido(payload) {
  try {
    const data = await api("/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    toast(`Pedido ${data.order.Folio} registrado. ✅`, "success");
    return data.order;
  } catch (err) {
    console.error(err);
    toast("Error al guardar el pedido.", "error");
    return null;
  }
}

async function updatePedido(id, payload) {
  try {
    await api(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    toast("Pedido actualizado. ✅", "success");
    await subscribeOrders();
    return true;
  } catch (err) {
    console.error(err);
    toast("Error al actualizar.", "error");
    return false;
  }
}

async function deletePedido(id) {
  try {
    await api(`/orders/${id}`, { method: "DELETE" });
    toast("Pedido eliminado.", "info");
    await subscribeOrders();
    return true;
  } catch (err) {
    console.error(err);
    toast("Error al eliminar.", "error");
    return false;
  }
}

/* =========================================================
   NUEVA PRENDA
========================================================= */
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
  const nombre   = val("np-nombre");
  const cantidad = parseInt(val("np-cantidad")) || 0;
  if (!nombre)      { toast("Escribe el nombre de la prenda.", "error"); return; }
  if (cantidad < 1) { toast("La cantidad debe ser al menos 1.", "error"); return; }
  if (!G.material)  { toast("Selecciona el material.", "error"); return; }

  showStep(2);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("np-entrega").min = tomorrow.toISOString().split("T")[0];
}

function npVolver() { showStep(1); }

async function npFinalizar() {
  if (!G.user) { toast("Debes iniciar sesión.", "error"); return; }

  const FechaEntrega = val("np-entrega");
  if (!FechaEntrega) { toast("Selecciona la fecha de entrega.", "error"); return; }

  const payload = {
    cliente:       G.user.nombreCompleto || G.user.email,
    clienteUid:    G.user.uid,
    tipoPrenda:    val("np-nombre"),
    material:      G.material,
    cantidad:      parseInt(val("np-cantidad")) || 1,
    fechaIngreso:  today(),
    FechaEntrega,
    notas:         val("np-instrucciones"),
    telefono:      G.user.telefono || "",
    precio:        null,
    origenCliente: true
  };

  const order = await addPedido(payload);
  if (!order) return;

  try {
    await api("/process/start", {
      method: "POST",
      body: JSON.stringify({
        orderId: order.id,
        folio: order.Folio,
        cantidad: order.cantidad,
        clienteUid: order.clienteUid
      })
    });

    toast("Pedido registrado e iniciado correctamente.", "success");
    goTo("screen-menu-client");
    resetNuevaPrenda();
  } catch (err) {
    toast(`Pedido guardado, pero no se pudo iniciar el proceso: ${err.message}`, "error");
  }
}

/* =========================================================
   CLIENTE
========================================================= */
async function loadMisPrendas() {
  if (!G.user) return;

  const list = document.getElementById("mis-prendas-list");
  list.innerHTML = '<p class="empty-msg">Cargando…</p>';

  try {
    const data = await api("/orders?mine=1");
    const orders = data.orders || [];

    if (!orders.length) {
      list.innerHTML = '<p class="empty-msg">No tienes prendas registradas aún.</p>';
      return;
    }

    const html = await Promise.all(orders.map(async (p) => {
      let photosHtml = "";
      try {
        const photosData = await api(`/orders/${p.id}/photos`);
        const photos = photosData.photos || [];
        if (photos.length) {
          photosHtml = `
            <div class="historial-photos">
              ${photos.map(ph => `
                <div class="historial-photo-card">
                  <img src="${esc(ph.url)}" alt="${esc(ph.file_name)}">
                  <div class="historial-photo-meta">${esc(ph.file_name.replace(".jpg",""))}</div>
                </div>
              `).join("")}
            </div>
          `;
        }
      } catch {}

      return `
        <div class="prenda-item" style="display:block">
          <div class="prenda-item-info">
            <span class="prenda-item-name">${esc(p.tipoPrenda)}</span>
            <span class="prenda-item-sub">${fmtDate(p.fechaIngreso)} · ${p.material || ""} · ${p.cantidad} pza.</span>
            <span>${badgeHtml(p.Estado)}</span>
            <span class="prenda-item-id">${esc(p.Folio || "")}</span>
          </div>
          ${photosHtml}
        </div>`;
    }));

    list.innerHTML = html.join("");
  } catch (err) {
    list.innerHTML = '<p class="empty-msg">Error al cargar prendas.</p>';
  }
}

async function buscarPedido() {
  const FolioIngresado = val("tracking-input").trim().toUpperCase();
  if (!FolioIngresado) { toast("Ingresa un ID de seguimiento.", "error"); return; }

  const result = document.getElementById("tracking-result");
  const empty  = document.getElementById("tracking-empty");
  result.classList.add("hidden");
  empty.style.display = "none";

  try {
    const data = await api(`/orders/by-folio/${encodeURIComponent(FolioIngresado)}`);
    const p = data.order;

    document.getElementById("tr-id").textContent      = p.Folio || FolioIngresado;
    document.getElementById("tr-prenda").textContent  = p.tipoPrenda  || "—";
    document.getElementById("tr-cliente").textContent = p.cliente     || "—";
    document.getElementById("tr-entrega").textContent = fmtDate(p.FechaEntrega);
    document.getElementById("tr-estado").textContent  = estadoLabel(p.Estado);
    result.classList.remove("hidden");
  } catch (err) {
    empty.style.display = "block";
    empty.textContent = `No se encontró ningún pedido con ID ${FolioIngresado}.`;
  }
}

async function loadCuenta() {
  if (!G.user) return;
  document.getElementById("cuenta-name").textContent  = G.user.nombreCompleto || G.user.email;
  document.getElementById("cuenta-email").textContent = G.user.email;
}

/* =========================================================
   ADMIN
========================================================= */
function showAdmin() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const adminScreen = document.getElementById("screen-admin");
  adminScreen.style.display = "flex";
  adminScreen.classList.add("active");
}

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

function updateMetrics() {
  const cnt = { pendiente:0, en_proceso:0, planchado:0, listo:0, entregado:0 };
  G.orders.forEach(o => { if (cnt[o.Estado] !== undefined) cnt[o.Estado]++; });

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
      <td>${esc(o.cliente)}</td>
      <td>${esc(o.tipoPrenda)}</td>
      <td>${fmtDate(o.fechaIngreso)}</td>
      <td>${badgeHtml(o.Estado)}</td>
      <td><div class="tbl-actions"><button class="tbl-btn" onclick="openModal('${o.id}')">👁</button></div></td>
    </tr>`).join("");
}

function applyFilters() {
  const search = (document.getElementById("adm-search")?.value || "").toLowerCase();
  const status = document.getElementById("adm-filter-st")?.value || "";

  G.filtered = G.orders.filter(o => {
    const matchText = !search ||
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
    </tr>`).join("");
}

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
  const editId   = val("adm-edit-id");
  const cliente  = val("adm-f-cliente").trim();
  const prenda   = val("adm-f-prenda").trim();
  const cantidad = parseInt(val("adm-f-cantidad")) || 0;
  const ingreso  = val("adm-f-ingreso");
  const FechaEntrega = val("adm-f-entrega");

  if (!cliente)      { toast("El nombre del cliente es obligatorio.", "error"); return; }
  if (!prenda)       { toast("El nombre de la prenda es obligatorio.", "error"); return; }
  if (cantidad < 1)  { toast("La cantidad debe ser al menos 1.", "error"); return; }
  if (!ingreso)      { toast("La fecha de ingreso es obligatoria.", "error"); return; }
  if (!FechaEntrega) { toast("La fecha de entrega es obligatoria.", "error"); return; }
  if (FechaEntrega < ingreso) { toast("La entrega no puede ser antes del ingreso.", "error"); return; }

  const data = {
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

  let ok;
  if (editId) {
    data.Estado = val("adm-f-estado");
    data.Validado = data.Estado === "entregado";
    ok = await updatePedido(editId, data);
  } else {
    const order = await addPedido(data);
    ok = !!order;
  }

  if (ok) {
    admOpenNew();
    admNavById("adm-view-pedidos");
    await subscribeOrders();
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
    </div>`;

  document.getElementById("modal-st-sel").value = o.Estado;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  G.currentId = null;
}

async function admUpdateStatus() {
  if (!G.currentId) return;
  const newEstado = document.getElementById("modal-st-sel").value;
  const ok = await updatePedido(G.currentId, {
    Estado: newEstado,
    Validado: newEstado === "entregado"
  });
  if (ok) closeModal();
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
  await deletePedido(G.delId);
  closeConfirm();
  closeModal();
}

async function renderClientes() {
  try {
    const data = await api("/users");
    const users = data.users || [];
    const tbody = document.getElementById("clientes-tbody");
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="t-empty">No hay clientes registrados.</td></tr>';
      return;
    }

    const pedidosCount = {};
    G.orders.forEach(o => {
      if (o.clienteUid) pedidosCount[o.clienteUid] = (pedidosCount[o.clienteUid] || 0) + 1;
    });

    tbody.innerHTML = users.map(c => {
      const nombre = `${c.nombre || ""} ${c.apellido || ""}`.trim() || c.email;
      return `
        <tr>
          <td>${esc(nombre)}</td>
          <td>${esc(c.email || "—")}</td>
          <td>${esc(c.telefono || "—")}</td>
          <td style="text-align:center">${pedidosCount[c.uid] || 0}</td>
        </tr>`;
    }).join("");
  } catch {}
}

/* =========================================================
   SIDEBAR / HELPERS
========================================================= */
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
  const [y, m, d] = iso.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

function today() { return new Date().toISOString().split("T")[0]; }

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
  if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
  else                         { inp.type = "password"; btn.textContent = "👁"; }
}

function toast(msg, type = "info") {
  const icons = { success:"✅", error:"❌", info:"ℹ️" };
  const c  = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); closeConfirm(); }
});

document.getElementById("modal-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});
document.getElementById("confirm-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("confirm-overlay")) closeConfirm();
});
