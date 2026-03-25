// Step 1: Load backend URL from localStorage or use default
let BACKEND_URL = localStorage.getItem("backendUrl") || "http://127.0.0.1:5000";

// Step 2: Put saved URL in input when page loads
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("backendUrl").value = BACKEND_URL;
    actualizarEstado();
});

// Step 3: Save backend URL
function guardarBackend() {
    const value = document.getElementById("backendUrl").value.trim();

    if (!value) {
        alert("Ingresa una URL válida.");
        return;
    }

    BACKEND_URL = value.replace(/\/$/, "");
    localStorage.setItem("backendUrl", BACKEND_URL);
    mostrarMensaje("URL backend guardada: " + BACKEND_URL);
}

// Step 4: Show messages
function mostrarMensaje(texto) {
    document.getElementById("mensaje").innerText = texto;
}

// Step 5: Test connection
async function probarConexion() {
    try {
        const response = await fetch(`${BACKEND_URL}/`);
        const data = await response.json();
        mostrarMensaje(data.message || "Conexión correcta con backend");
        alert("Conexión correcta");
    } catch (error) {
        mostrarMensaje("No se pudo conectar al backend");
        alert("Error de conexión con el backend");
    }
}

// Step 6: Start batch
async function iniciarLote() {
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (!cantidad || cantidad <= 0) {
        alert("Ingresa una cantidad válida.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/iniciar_lote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad: cantidad })
        });

        const data = await response.json();
        mostrarMensaje(data.message || "Respuesta recibida");
        alert(data.message);
    } catch (error) {
        mostrarMensaje("Error al iniciar lote");
        alert("No se pudo iniciar el lote");
    }
}

// Step 7: Manual start
async function startManual() {
    try {
        const response = await fetch(`${BACKEND_URL}/start`, {
            method: "POST"
        });

        const data = await response.json();
        mostrarMensaje(data.message || "Start enviado");
        alert(data.message);
    } catch (error) {
        mostrarMensaje("Error al enviar START");
        alert("No se pudo enviar START");
    }
}

// Step 8: Manual stop
async function stopManual() {
    try {
        const response = await fetch(`${BACKEND_URL}/stop`, {
            method: "POST"
        });

        const data = await response.json();
        mostrarMensaje(data.message || "Stop enviado");
        alert(data.message);
    } catch (error) {
        mostrarMensaje("Error al enviar STOP");
        alert("No se pudo enviar STOP");
    }
}

// Step 9: Take photo
async function tomarFoto() {
    try {
        const response = await fetch(`${BACKEND_URL}/tomar_foto`, {
            method: "POST"
        });

        const data = await response.json();

        if (data.ok) {
            mostrarMensaje("Foto guardada en: " + data.archivo);
            alert("Foto tomada correctamente");
        } else {
            mostrarMensaje(data.error || "Error al tomar foto");
            alert("Error al tomar foto");
        }
    } catch (error) {
        mostrarMensaje("No se pudo tomar la foto");
        alert("No se pudo tomar la foto");
    }
}

// Step 10: Update state every second
async function actualizarEstado() {
    try {
        const response = await fetch(`${BACKEND_URL}/estado`);
        const data = await response.json();

        document.getElementById("estado").innerText = data.estado;
        document.getElementById("activo").innerText = data.trabajo_activo ? "Sí" : "No";
        document.getElementById("total").innerText = data.total_prendas;
        document.getElementById("actual").innerText = data.prenda_actual;
        document.getElementById("fotos").innerText = data.fotos.length;
        document.getElementById("error").innerText = data.error ? data.error : "Ninguno";
    } catch (error) {
        document.getElementById("estado").innerText = "Sin conexión";
        document.getElementById("activo").innerText = "-";
        document.getElementById("total").innerText = "-";
        document.getElementById("actual").innerText = "-";
        document.getElementById("fotos").innerText = "-";
        document.getElementById("error").innerText = "No se pudo conectar al backend";
    }
}

setInterval(actualizarEstado, 1000);
