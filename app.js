const BACKEND_URL = "https://docker-planchaduria.onrender.com";

window.addEventListener("DOMContentLoaded", () => {
    actualizarEstado();
});

function validarUsuario(usuario) {
    return /^\d{1,5}$/.test(usuario);
}

async function guardarUsuario() {
    const usuario = document.getElementById("usuarioGuardar").value.trim();

    if (!validarUsuario(usuario)) {
        alert("Usuario inválido. Máximo 5 dígitos.");
        return;
    }

    const response = await fetch(`${BACKEND_URL}/set_usuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario })
    });

    const data = await response.json();
    alert(data.message);

    document.getElementById("usuarioProceso").value = usuario;
    actualizarEstado();
}

async function guardarCantidad() {
    const usuario = document.getElementById("usuarioProceso").value.trim();
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (!validarUsuario(usuario)) {
        alert("Usuario inválido.");
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Cantidad inválida.");
        return;
    }

    const response = await fetch(`${BACKEND_URL}/set_cantidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, cantidad })
    });

    const data = await response.json();
    alert(data.message);
    actualizarEstado();
}

async function actualizarEstado() {
    try {
        const response = await fetch(`${BACKEND_URL}/estado`);
        const data = await response.json();

        document.getElementById("usuarioActual").innerText = data.data.usuario_actual || "-";
        document.getElementById("cantidadActual").innerText = data.data.cantidad;
        document.getElementById("activo").innerText = data.data.activo ? "ON" : "OFF";
        document.getElementById("estado").innerText = data.data.estado;
    } catch (error) {
        document.getElementById("estado").innerText = "Sin conexión";
    }
}

async function cargarGaleria() {
    const usuario = document.getElementById("usuarioProceso").value.trim();

    if (!validarUsuario(usuario)) {
        alert("Usuario inválido.");
        return;
    }

    const response = await fetch(`${BACKEND_URL}/fotos_usuario/${usuario}`);
    const data = await response.json();

    const galeria = document.getElementById("galeria");
    galeria.innerHTML = "";

    if (!data.fotos || data.fotos.length === 0) {
        galeria.innerHTML = "<p>No hay fotos para este usuario.</p>";
        return;
    }

    data.fotos.forEach(foto => {
        const card = document.createElement("div");
        card.className = "card-foto";

        card.innerHTML = `
            <img src="${BACKEND_URL}${foto.url}" alt="${foto.nombre}">
            <p><strong>${foto.etiqueta}</strong></p>
        `;

        galeria.appendChild(card);
    });
}
