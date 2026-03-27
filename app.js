const BACKEND_URL = "https://docker-planchaduria.onrender.com";

window.addEventListener("DOMContentLoaded", () => {
    actualizarEstado();
});

function obtenerUsuarioInput() {
    return document.getElementById("usuario").value.trim();
}

async function guardarUsuario() {
    const usuario = obtenerUsuarioInput();

    if (!usuario || !/^\d{1,5}$/.test(usuario)) {
        alert("Ingresa un número de usuario válido de máximo 5 dígitos.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/set_usuario`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuario })
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("No se pudo guardar el usuario.");
    }
}

async function guardarCantidad() {
    const cantidad = parseInt(document.getElementById("cantidad").value);
    const usuario = obtenerUsuarioInput();

    if (!usuario || !/^\d{1,5}$/.test(usuario)) {
        alert("Primero guarda un número de usuario válido.");
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Ingresa una cantidad válida.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/set_cantidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario: usuario,
                cantidad: cantidad
            })
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("No se pudo guardar la cantidad.");
    }
}

async function activarProceso() {
    const usuario = obtenerUsuarioInput();

    if (!usuario || !/^\d{1,5}$/.test(usuario)) {
        alert("Primero guarda un número de usuario válido.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/activar_plc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuario })
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("No se pudo activar el proceso.");
    }
}

async function actualizarEstado() {
    try {
        const response = await fetch(`${BACKEND_URL}/estado`);
        const data = await response.json();

        document.getElementById("usuarioActual").innerText = data.data.usuario_actual || "-";
        document.getElementById("activo").innerText = data.data.activo ? "ON" : "OFF";
        document.getElementById("cantidadActual").innerText = data.data.cantidad;
        document.getElementById("estado").innerText = data.data.estado;
        document.getElementById("updatedAt").innerText = data.data.updated_at || "-";
    } catch (error) {
        document.getElementById("usuarioActual").innerText = "-";
        document.getElementById("activo").innerText = "-";
        document.getElementById("cantidadActual").innerText = "-";
        document.getElementById("estado").innerText = "Sin conexión";
        document.getElementById("updatedAt").innerText = "-";
    }
}

async function cargarGaleriaUsuario() {
    const usuario = obtenerUsuarioInput();

    if (!usuario || !/^\d{1,5}$/.test(usuario)) {
        alert("Ingresa un número de usuario válido para consultar su galería.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/fotos_usuario/${usuario}`);
        const data = await response.json();

        const galeria = document.getElementById("galeria");
        galeria.innerHTML = "";

        if (!data.fotos || data.fotos.length === 0) {
            galeria.innerHTML = `<p class="mensaje-vacio">No hay fotos para este usuario.</p>`;
            return;
        }

        data.fotos.forEach(foto => {
            const card = document.createElement("div");
            card.className = "card-foto";

            card.innerHTML = `
                <img src="${BACKEND_URL}${foto.url}" alt="${foto.nombre}">
                <p><strong>Usuario:</strong> ${foto.usuario}</p>
                <p><strong>Fecha:</strong> ${foto.fecha}</p>
                <p><strong>Hora:</strong> ${foto.hora}</p>
            `;

            galeria.appendChild(card);
        });
    } catch (error) {
        alert("No se pudo cargar la galería.");
    }
}
