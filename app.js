/* ══════════════════════════════════════════════════════════════
   Planchado Express — app.js
   ─────────────────────────────────────────────────────────────
   SECCIONES:
     1.  Configuración Firebase
     2.  Estado global
     3.  Inicialización
     4.  Navegación de pantallas
     5.  Auth — Cliente
     6.  Auth — Administrador
     7.  Suscripción en tiempo real (Firestore)
     8.  CRUD Pedidos
     9.  Flujo: Nueva Prenda (cliente)
    10.  Pantallas cliente: Mis Prendas, Estado, Cuenta
    11.  Panel Admin: Dashboard
    12.  Panel Admin: Lista de Pedidos + Filtros
    13.  Panel Admin: Formulario (crear / editar)
    14.  Panel Admin: Modal de detalle
    15.  Panel Admin: Clientes
    16.  Helpers: badges, fechas, IDs, toast, etc.

   VARIABLES HOMOLOGADAS:
     Folio          → String   — ID de seguimiento del pedido
     Contador       → Number   — Número secuencial interno
     FechaCreacion  → Timestamp — Fecha de creación (serverTimestamp)
     Estado         → String   — Estado del pedido
     FolioIngresado → String   — Folio capturado por el admin / cliente
     Validado       → Boolean  — Si el pedido fue revisado/validado
     FechaEntrega   → Timestamp (ISO string) — Fecha estimada de entrega
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   1. CONFIGURACIÓN FIREBASE
   ✅  Usando Firebase Compat SDK (cargado en index.html)
   ⚠️  IMPORTANTE!!! usar import/export aquí — incompatible con compat SDK
══════════════════════════════════════════════ */
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

// Colecciones Firestore
const COL_PEDIDOS  = "pedidos";
const COL_USUARIOS = "usuarios";

// UID del administrador 
// Es el del admin supremo que cree manual en la base de datos va?
const ADMIN_UID = "HrGtBnzEtBXLK19YpeI8wTAaSM42";

/* ══════════════════════════════════════════════
   2. ESTADO GLOBAL
══════════════════════════════════════════════ */
const G = {
  db:        null,
  auth:      null,
  user:      null,      // usuario actual autenticado
  isAdmin:   false,     // true solo si user.uid === ADMIN_UID
  orders:    [],        // todos los pedidos (admin)
  filtered:  [],        // pedidos filtrados
  unsub:     null,      // unsubscribe del listener
  currentId: null,      // pedido en modal/edición
  delId:     null,      // pedido pendiente de borrar
  material:  "",        // material seleccionado en nueva prenda
};

/* ══════════════════════════════════════════════
   3. INICIALIZACIÓN
   ✅  Firebase Compat SDK — se inicializa con firebase.initializeApp()
══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  try {
    firebase.initializeApp(firebaseConfig);
    G.db   = firebase.firestore();
    G.auth = firebase.auth();
    console.log("✅ Firebase conectado.");
  } catch (err) {
    console.error("Firebase init error:", err);
    toast("Error al conectar con Firebase. Revisa la configuración.", "error");
  }

  // Escuchar cambios de autenticación
  G.auth.onAuthStateChanged(user => {
    if (user) {
      G.user    = user;
      G.isAdmin = (user.uid === ADMIN_UID);

      if (G.isAdmin) {
        document.getElementById("adm-user-pill").textContent = user.email.split("@")[0];
        showAdmin();
        subscribeOrders();
      } else {
        goTo("screen-menu-client");
        loadCuenta();
      }
    } else {
      G.user    = null;
      G.isAdmin = false;
      if (G.unsub) { G.unsub(); G.unsub = null; }
      goTo("screen-splash");
    }
  });
});

/* ══════════════════════════════════════════════
   4. NAVEGACIÓN ENTRE PANTALLAS (cliente)
══════════════════════════════════════════════ */
function goTo(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

/* ══════════════════════════════════════════════
   5. AUTH — CLIENTE
══════════════════════════════════════════════ */

// Login cliente con email + contraseña
async function loginClient() {
  const email = val("cl-email");
  const pass  = val("cl-pass");
  if (!email || !pass) { toast("Completa todos los campos.", "error"); return; }
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

// Registro de nuevo cliente
async function registerClient() {
  const nombre   = val("reg-nombre");
  const apellido = val("reg-apellido");
  const email    = val("reg-email");
  const phone    = val("reg-phone");
  const pass     = val("reg-pass");

  if (!nombre || !apellido || !email || !pass) { toast("Completa todos los campos obligatorios.", "error"); return; }
  if (pass.length < 6) { toast("La contraseña debe tener al menos 6 caracteres.", "error"); return; }

  try {
    const cred = await G.auth.createUserWithEmailAndPassword(email, pass);
    await G.db.collection(COL_USUARIOS).doc(cred.user.uid).set({
      nombre, apellido, email, telefono: phone,
      FechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast("¡Cuenta creada! Bienvenido.", "success");
  } catch (err) {
    toast(authError(err), "error");
  }
}

// Cerrar sesión cliente
async function clientLogout() {
  await G.auth.signOut();
  toast("Sesión cerrada.", "info");
}

/* ══════════════════════════════════════════════
   6. AUTH — ADMINISTRADOR
══════════════════════════════════════════════ */

async function loginAdmin() {
  const email = val("adm-email");
  const pass  = val("adm-pass");
  if (!email || !pass) { toast("Completa el correo y contraseña.", "error"); return; }
  try {
    const cred = await G.auth.signInWithEmailAndPassword(email, pass);
    if (cred.user.uid !== ADMIN_UID) {
      await G.auth.signOut();
      toast("Acceso denegado. No tienes permisos de administrador.", "error");
      return;
    }
    toast("¡Bienvenido al panel!", "success");
  } catch (err) {
    toast(authError(err), "error");
  }
}

async function adminLogout() {
  await G.auth.signOut();
  closeSidebar();
  toast("Sesión cerrada.", "info");
}

/* ══════════════════════════════════════════════
   7. SUSCRIPCIÓN EN TIEMPO REAL (Firestore)
   📌  Ordenamos por FechaCreacion (campo homologado)
══════════════════════════════════════════════ */
function subscribeOrders() {
  if (G.unsub) G.unsub();

  G.unsub = G.db.collection(COL_PEDIDOS)
    .orderBy("FechaCreacion", "desc")
    .onSnapshot(snap => {
      G.orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilters();
      updateMetrics();
      renderDashRecent();
      renderClientes();
    }, err => {
      console.error("Listener error:", err);
      toast("Error al cargar pedidos en tiempo real.", "error");
    });
}

/* ══════════════════════════════════════════════
   8. CRUD PEDIDOS
   📌  Variables homologadas:
       Folio          → String  (ej. "#00001")
       Contador       → Number  (número secuencial)
       FechaCreacion  → Timestamp
       Estado         → String
       FolioIngresado → String  (folio capturado manualmente)
       Validado       → Boolean
       FechaEntrega   → String ISO (ej. "2026-04-15")
══════════════════════════════════════════════ */

// Genera Folio tipo "#00001" y obtiene el Contador siguiente
async function generarFolio() {
  const snap    = await G.db.collection(COL_PEDIDOS).get();
  const Contador = snap.size + 1;
  const Folio   = "#" + String(Contador).padStart(5, "0");
  return { Folio, Contador };
}

// Crear pedido
async function addPedido(data) {
  try {
    const { Folio, Contador } = await generarFolio();
    await G.db.collection(COL_PEDIDOS).add({
      ...data,
      Folio,
      Contador,
      Estado:         "pendiente",
      FolioIngresado: Folio,        // folio asignado al ingresar
      Validado:       false,        // pendiente de validación
      FechaCreacion:  firebase.firestore.FieldValue.serverTimestamp()
    });
    toast(`Pedido ${Folio} registrado. ✅`, "success");
    return true;
  } catch (err) {
    console.error("addPedido:", err);
    toast("Error al guardar el pedido.", "error");
    return false;
  }
}

// Actualizar pedido
async function updatePedido(id, data) {
  try {
    await G.db.collection(COL_PEDIDOS).doc(id).update({
      ...data,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast("Pedido actualizado. ✅", "success");
    return true;
  } catch (err) {
    console.error("updatePedido:", err);
    toast("Error al actualizar.", "error");
    return false;
  }
}

// Eliminar pedido
async function deletePedido(id) {
  try {
    await G.db.collection(COL_PEDIDOS).doc(id).delete();
    toast("Pedido eliminado.", "info");
    return true;
  } catch (err) {
    console.error("deletePedido:", err);
    toast("Error al eliminar.", "error");
    return false;
  }
}

/* ══════════════════════════════════════════════
   9. FLUJO NUEVA PRENDA (cliente)
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
  const nombre   = val("np-nombre");
  const cantidad = parseInt(val("np-cantidad")) || 0;
  if (!nombre)       { toast("Escribe el nombre de la prenda.", "error"); return; }
  if (cantidad < 1)  { toast("La cantidad debe ser al menos 1.", "error"); return; }
  if (!G.material)   { toast("Selecciona el material.", "error"); return; }
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

  const data = {
    cliente:       G.user.displayName || G.user.email,
    clienteUid:    G.user.uid,
    tipoPrenda:    val("np-nombre"),
    material:      G.material,
    cantidad:      parseInt(val("np-cantidad")) || 1,
    fechaIngreso:  today(),
    FechaEntrega,
    notas:         val("np-instrucciones"),
    telefono:      "",
    precio:        null,
    origenCliente: true
  };

  const ok = await addPedido(data);
  if (ok) {
    toast("Tu prenda fue registrada con éxito.", "success");
    goTo("screen-menu-client");
    resetNuevaPrenda();
  }
}

/* ══════════════════════════════════════════════
   10. PANTALLAS CLIENTE
══════════════════════════════════════════════ */

// Mis prendas — carga pedidos del cliente actual
async function loadMisPrendas() {
  if (!G.user) return;
  const list = document.getElementById("mis-prendas-list");
  list.innerHTML = '<p class="empty-msg">Cargando…</p>';

  try {
    const snap = await G.db.collection(COL_PEDIDOS)
      .where("clienteUid", "==", G.user.uid)
      .orderBy("FechaCreacion", "desc")
      .get();

    if (snap.empty) {
      list.innerHTML = '<p class="empty-msg">No tienes prendas registradas aún.</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const p = { id: d.id, ...d.data() };
      return `
        <div class="prenda-item">
          <div class="prenda-item-info">
            <span class="prenda-item-name">${esc(p.tipoPrenda)}</span>
            <span class="prenda-item-sub">${fmtDate(p.fechaIngreso)} · ${p.material || ""} · ${p.cantidad} pza.</span>
            <span>${badgeHtml(p.Estado)}</span>
          </div>
          <span class="prenda-item-id">${esc(p.Folio || "")}</span>
        </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = '<p class="empty-msg">Error al cargar prendas.</p>';
  }
}

// Estado de prenda — buscar por Folio
async function buscarPedido() {
  const FolioIngresado = val("tracking-input").trim().toUpperCase();
  if (!FolioIngresado) { toast("Ingresa un ID de seguimiento.", "error"); return; }

  const result = document.getElementById("tracking-result");
  const empty  = document.getElementById("tracking-empty");
  result.classList.add("hidden");
  empty.style.display = "none";

  try {
    // Buscar por Folio o FolioIngresado
    const snap = await G.db.collection(COL_PEDIDOS)
      .where("Folio", "==", FolioIngresado)
      .get();

    if (snap.empty) {
      empty.style.display = "block";
      empty.textContent = `No se encontró ningún pedido con ID ${FolioIngresado}.`;
      return;
    }
    const p = { id: snap.docs[0].id, ...snap.docs[0].data() };
    document.getElementById("tr-id").textContent      = p.Folio || FolioIngresado;
    document.getElementById("tr-prenda").textContent  = p.tipoPrenda  || "—";
    document.getElementById("tr-cliente").textContent = p.cliente     || "—";
    document.getElementById("tr-entrega").textContent = fmtDate(p.FechaEntrega);
    document.getElementById("tr-estado").textContent  = estadoLabel(p.Estado);
    result.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    toast("Error al buscar el pedido.", "error");
  }
}

// Cuenta cliente
async function loadCuenta() {
  if (!G.user) return;
  try {
    const doc = await G.db.collection(COL_USUARIOS).doc(G.user.uid).get();
    if (doc.exists) {
      const d = doc.data();
      const nombre = `${d.nombre || ""} ${d.apellido || ""}`.trim();
      document.getElementById("cuenta-name").textContent  = nombre || G.user.email;
      document.getElementById("cuenta-email").textContent = G.user.email;
    } else {
      document.getElementById("cuenta-name").textContent  = G.user.email;
      document.getElementById("cuenta-email").textContent = G.user.email;
    }
  } catch (err) { /* silencioso */ }
}

/* ══════════════════════════════════════════════
   11. PANEL ADMIN — MOSTRAR / NAVEGAR
══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   12. PANEL ADMIN — DASHBOARD
══════════════════════════════════════════════ */
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
      <td>
        <div class="tbl-actions">
          <button class="tbl-btn" onclick="openModal('${o.id}')">👁</button>
        </div>
      </td>
    </tr>`).join("");
}

/* ══════════════════════════════════════════════
   13. PANEL ADMIN — LISTA DE PEDIDOS + FILTROS
══════════════════════════════════════════════ */
function applyFilters() {
  const search = (document.getElementById("adm-search")?.value || "").toLowerCase();
  const status = document.getElementById("adm-filter-st")?.value || "";

  G.filtered = G.orders.filter(o => {
    const matchText = !search ||
      (o.cliente    || "").toLowerCase().includes(search) ||
      (o.tipoPrenda || "").toLowerCase().includes(search) ||
      (o.Folio      || "").toLowerCase().includes(search);
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

/* ══════════════════════════════════════════════
   14. PANEL ADMIN — FORMULARIO CREAR / EDITAR
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

  setVal("adm-edit-id",    id);
  setVal("adm-f-cliente",  o.cliente    || "");
  setVal("adm-f-telefono", o.telefono   || "");
  setVal("adm-f-prenda",   o.tipoPrenda || "");
  setVal("adm-f-material", o.material   || "");
  setVal("adm-f-cantidad", o.cantidad   || 1);
  setVal("adm-f-precio",   o.precio     || "");
  setVal("adm-f-ingreso",  o.fechaIngreso  || "");
  setVal("adm-f-entrega",  o.FechaEntrega  || "");
  setVal("adm-f-notas",    o.notas      || "");
  setVal("adm-f-estado",   o.Estado     || "pendiente");
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

  if (!cliente)       { toast("El nombre del cliente es obligatorio.", "error"); return; }
  if (!prenda)        { toast("El nombre de la prenda es obligatorio.", "error"); return; }
  if (cantidad < 1)   { toast("La cantidad debe ser al menos 1.", "error"); return; }
  if (!ingreso)       { toast("La fecha de ingreso es obligatoria.", "error"); return; }
  if (!FechaEntrega)  { toast("La fecha de entrega es obligatoria.", "error"); return; }
  if (FechaEntrega < ingreso) { toast("La entrega no puede ser antes del ingreso.", "error"); return; }

  const data = {
    cliente,
    telefono:    val("adm-f-telefono").trim(),
    tipoPrenda:  prenda,
    material:    val("adm-f-material"),
    cantidad,
    precio:      parseFloat(val("adm-f-precio")) || null,
    fechaIngreso: ingreso,
    FechaEntrega,
    notas:       val("adm-f-notas").trim()
  };

  let ok;
  if (editId) {
    data.Estado  = val("adm-f-estado");
    data.Validado = data.Estado === "entregado"; // se marca Validado al entregar
    ok = await updatePedido(editId, data);
  } else {
    ok = await addPedido(data);
  }

  if (ok) {
    admOpenNew();
    admNavById("adm-view-pedidos");
  }
}

/* ══════════════════════════════════════════════
   15. PANEL ADMIN — MODAL DE DETALLE
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
    Estado:   newEstado,
    Validado: newEstado === "entregado"
  });
  if (ok) closeModal();
}

function admEditFromModal() {
  if (G.currentId) admOpenEdit(G.currentId);
}

// Confirmar borrado
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

/* ══════════════════════════════════════════════
   16. PANEL ADMIN — CLIENTES
══════════════════════════════════════════════ */
async function renderClientes() {
  try {
    const snap  = await G.db.collection(COL_USUARIOS).get();
    const tbody = document.getElementById("clientes-tbody");
    if (!tbody) return;

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" class="t-empty">No hay clientes registrados.</td></tr>';
      return;
    }

    const pedidosCount = {};
    G.orders.forEach(o => {
      if (o.clienteUid) pedidosCount[o.clienteUid] = (pedidosCount[o.clienteUid] || 0) + 1;
    });

    tbody.innerHTML = snap.docs.map(d => {
      const c = d.data();
      const nombre = `${c.nombre || ""} ${c.apellido || ""}`.trim() || c.email;
      return `
        <tr>
          <td>${esc(nombre)}</td>
          <td>${esc(c.email || "—")}</td>
          <td>${esc(c.telefono || "—")}</td>
          <td style="text-align:center">${pedidosCount[d.id] || 0}</td>
        </tr>`;
    }).join("");
  } catch (err) { /* silencioso */ }
}

/* ══════════════════════════════════════════════
   SIDEBAR ADMIN (mobile)
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
   HELPERS GENERALES
══════════════════════════════════════════════ */

// Badge HTML de estado (usa campo Estado homologado)
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

// Texto legible del Estado
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

// Formato de fecha ISO → "15 mar 2025"
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

// Fecha de hoy en ISO
function today() { return new Date().toISOString().split("T")[0]; }

// Escape HTML (anti-XSS)
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Valor de input
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

// Toggle contraseña visible
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === "password") { inp.type = "text";     btn.textContent = "🙈"; }
  else                         { inp.type = "password"; btn.textContent = "👁"; }
}

// Errores de Auth
function authError(err) {
  const m = {
    "auth/user-not-found":       "Correo no registrado.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/invalid-email":        "Correo inválido.",
    "auth/email-already-in-use": "Este correo ya está registrado.",
    "auth/weak-password":        "Contraseña muy débil (mínimo 6 caracteres).",
    "auth/too-many-requests":    "Demasiados intentos. Intenta más tarde.",
    "auth/invalid-credential":   "Credenciales incorrectas."
  };
  return m[err.code] || `Error: ${err.message}`;
}

// Toast
function toast(msg, type = "info") {
  const icons = { success:"✅", error:"❌", info:"ℹ️" };
  const c  = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

// Cerrar modales con ESC
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); closeConfirm(); }
});

// Cerrar modal al clickear el overlay
document.getElementById("modal-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});
document.getElementById("confirm-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("confirm-overlay")) closeConfirm();
});
