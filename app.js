// Step 1: Fixed backend URL
const BACKEND_URL = "https://docker-planchaduria.onrender.com";

// Step 2: Load current state when page opens
window.addEventListener("DOMContentLoaded", () => {
    actualizarEstado();
});

// Step 3: Save quantity
async function guardarCantidad() {
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (isNaN(cantidad) || cantidad < 0) {
        alert("Ingresa una cantidad válida");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/set_cantidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad: cantidad })
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("Error al guardar la cantidad");
    }
}

// Step 4: Activate system
async function activarSistema() {
    try {
        const response = await fetch(`${BACKEND_URL}/activar`, {
            method: "POST"
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("Error al activar el sistema");
    }
}

// Step 5: Deactivate system
async function desactivarSistema() {
    try {
        const response = await fetch(`${BACKEND_URL}/desactivar`, {
            method: "POST"
        });

        const data = await response.json();
        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("Error al desactivar el sistema");
    }
}

// Step 6: Update current state
async function actualizarEstado() {
    try {
        const response = await fetch(`${BACKEND_URL}/estado`);
        const data = await response.json();

        document.getElementById("activo").innerText = data.data.activo ? "ON" : "OFF";
        document.getElementById("cantidadActual").innerText = data.data.cantidad;
        document.getElementById("estado").innerText = data.data.estado;
        document.getElementById("updatedAt").innerText = data.data.updated_at || "-";
    } catch (error) {
        document.getElementById("activo").innerText = "-";
        document.getElementById("cantidadActual").innerText = "-";
        document.getElementById("estado").innerText = "Sin conexión";
        document.getElementById("updatedAt").innerText = "-";
    }
}

// Step 7: Load gallery
async function cargarGaleria() {
    try {
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
    } catch (error) {
        alert("Error al cargar la galería");
    }
}
