// Step 1: Fixed backend URL
const BACKEND_URL = "https://docker-planchaduria.onrender.com";

// Step 2: Load current state when page opens
window.addEventListener("DOMContentLoaded", () => {
    actualizarEstado();
});

// Step 3: Save quantity in database
async function guardarCantidad() {
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (isNaN(cantidad) || cantidad < 0) {
        alert("Ingresa una cantidad válida");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/set_cantidad`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ cantidad: cantidad })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Error al guardar la cantidad");
            return;
        }

        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("No se pudo conectar con el backend");
    }
}

// Step 4: Activate PLC
async function activarPLC() {
    try {
        const response = await fetch(`${BACKEND_URL}/activar_plc`, {
            method: "POST"
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Error al activar el PLC");
            return;
        }

        alert(data.message);
        actualizarEstado();
    } catch (error) {
        alert("No se pudo conectar con el backend");
    }
}

// Step 5: Update state
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

// Step 6: Load gallery
async function cargarGaleria() {
    try {
        const response = await fetch(`${BACKEND_URL}/fotos`);
        const data = await response.json();

        const galeria = document.getElementById("galeria");
        galeria.innerHTML = "";

        if (!data.fotos || data.fotos.length === 0) {
            galeria.innerHTML = `<p class="mensaje-vacio">No hay fotos aún.</p>`;
            return;
        }

        data.fotos.forEach(foto => {
            const img = document.createElement("img");
            img.src = `${BACKEND_URL}${foto.url}`;
            img.alt = foto.nombre;
            galeria.appendChild(img);
        });
    } catch (error) {
        alert("No se pudo cargar la galería");
    }
}
