// =====================================================
// main.js  -  Conecta la interfaz (HTML) con el programa
// En esta fase solo manejamos la interfaz:
//   1. Habilitar / deshabilitar opciones según lo elegido
//   2. Leer la configuración que eligió el usuario
// =====================================================

// Atajo para no escribir document.getElementById todo el tiempo
const $ = (id) => document.getElementById(id);

// Devuelve el valor del radio seleccionado de un grupo (por su "name")
function valorRadio(nombre) {
  return document.querySelector('input[name="' + nombre + '"]:checked').value;
}

// Activa o desactiva todos los radios de un grupo
function habilitarRadios(nombre, habilitado) {
  document.querySelectorAll('input[name="' + nombre + '"]').forEach((r) => {
    r.disabled = !habilitado;
  });
}

// -----------------------------------------------------
// Habilita solo lo que tiene sentido según las opciones
// -----------------------------------------------------
function actualizarInterfaz() {
  // --- Pruebas ---
  const usaMismoDataset = valorRadio("modo") === "mismo";
  const esSimple = usaMismoDataset && valorRadio("validacion") === "simple";

  habilitarRadios("validacion", usaMismoDataset);
  $("porcentaje").disabled = !esSimple;
  $("estratificado").disabled = !esSimple;
  $("archivoExterno").disabled = usaMismoDataset;

  // --- Variables continuas ---
  const usaBinning = valorRadio("continuas") === "binning";

  habilitarRadios("tipoBinning", usaBinning);
  $("intervalos").disabled = !usaBinning;
}

// -----------------------------------------------------
// Junta todo lo que eligió el usuario en un solo objeto.
// Más adelante este objeto se le pasará a las demás clases.
// -----------------------------------------------------
function leerConfiguracion() {
  return {
    archivoDataset: $("archivoDataset").files[0] || null,
    posicionClase: valorRadio("posClase"), // "inicio" | "final"
    tieneEncabezado: $("tieneEncabezado").checked,
    separador: $("separador").value,

    modo: valorRadio("modo"), // "mismo" | "externo"
    validacion: valorRadio("validacion"), // "simple" | "cruzada"
    porcentajeEntrenamiento: Number($("porcentaje").value),
    estratificado: $("estratificado").checked,
    archivoExterno: $("archivoExterno").files[0] || null,

    tratamientoContinuas: valorRadio("continuas"), // "densidad" | "binning"
    tipoBinning: valorRadio("tipoBinning"), // "anchos" | "frecuencias"
    intervalos: Number($("intervalos").value),
  };
}

// -----------------------------------------------------
// Botón "Análisis" (por ahora solo muestra la configuración)
// -----------------------------------------------------
function alPresionarAnalisis() {
  const config = leerConfiguracion();
  console.log("Configuración leída:", config);

  const mensajes = $("mensajes");
  mensajes.innerHTML = "";

  const aviso = document.createElement("div");
  aviso.className = "aviso";
  aviso.textContent =
    "Configuración leída correctamente (revisa la consola del navegador con F12). " +
    "Todavía no se clasifica nada: es el esqueleto de la interfaz.";
  mensajes.appendChild(aviso);
}

// -----------------------------------------------------
// Eventos: cada vez que el usuario cambia algo, se actualiza
// -----------------------------------------------------
$("formulario").addEventListener("change", actualizarInterfaz);
$("btnAnalisis").addEventListener("click", alPresionarAnalisis);

// Estado inicial al abrir la página
actualizarInterfaz();
