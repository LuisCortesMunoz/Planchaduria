let BACKEND_URL = localStorage.getItem("backendUrl") || "";

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("backendUrl").value = BACKEND_URL;
    if (BACKEND_URL) {
        actualizarEstado();
    }
});

function guardarBackend() {
    const valor = document.getElementById("backendUrl").value.trim().replace(/\/$/, "");
    if (!valor) {
        alert("Ingresa una URL válida");
        return;
    }
    BACKEND_URL = valor;
    localStorage.setItem("backendUrl", BACKEND_URL);
    alert("URL guardada");
    actualizarEstado();
}

async function guardarCantidad() {
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (isNaN(cantidad) || cantidad < 0) {
        alert("Ingresa una cantidad válida");
        return;
    }

    const response = await fetch(`${BACKEND_URL}/set_cantidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: cantidad })
    });

    const data = await response.json();
    alert(data.message);
    actualizarEstado();
}

async function activarSistema() {
    const response = await fetch(`${BACKEND_URL}/activar`, { method: "POST" });
    const data = await response.json();
    alert(data.message);
    actualizarEstado();
}

async function desactivarSistema() {
    const response = await fetch(`${BACKEND_URL}/desactivar`, { method: "POST" });
    const data = await response.json();
    alert(data.message);
    actualizarEstado();
}

async function actualizarEstado() {
    const response = await fetch(`${BACKEND_URL}/estado`);
    const data = await response.json();

    document.getElementById("activo").innerText = data.data.activo ? "ON" : "OFF";
    document.getElementById("cantidadActual").innerText = data.data.cantidad;
    document.getElementById("estado").innerText = data.data.estado;
    document.getElementById("updatedAt").innerText = data.data.updated_at || "-";
}

async function cargarGaleria() {
    const response = await fetch(`${BACKEND_URL}/fotos`);
    const data = await response.json();

    const galeria = document.getElementById("galeria");
    galeria.innerHTML = "";

    if (!data.fotos || data.fotos.length === 0) {
        galeria.innerHTML = "<p>No hay fotos aún.</p>";
        return;
    }

    data.fotos.forEach(foto => {
        const img = document.createElement("img");
        img.src = `${BACKEND_URL}${foto.url}`;
        img.alt = foto.nombre;
        galeria.appendChild(img);
    });
}
