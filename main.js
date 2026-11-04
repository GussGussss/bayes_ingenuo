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
// Muestra errores (rojo) y avisos (amarillo) en el área de mensajes
// -----------------------------------------------------
function mostrarMensajes(errores, avisos) {
  const cont = $("mensajes");
  cont.innerHTML = "";
  const agregar = (clase, textos) =>
    textos.forEach((t) => {
      const d = document.createElement("div");
      d.className = clase;
      d.textContent = t;
      cont.appendChild(d);
    });
  agregar("error", errores);
  agregar("aviso", avisos);
}

// -----------------------------------------------------
// Botón "Análisis": valida -> divide -> clasifica -> evalúa -> muestra
// -----------------------------------------------------
const SEMILLA = 12345; // fija: el reparto aleatorio es reproducible

async function ejecutarAnalisis() {
  const config = leerConfiguracion();
  Resultados.limpiar();
  mostrarMensajes([], []);

  // 1. Validar parámetros
  const errParam = DatasetValidator.validarParametros(config);
  if (errParam.length) return mostrarMensajes(errParam, []);

  try {
    // 2. Cargar y validar el dataset
    const dat = DatasetValidator.validar(
      await DatasetLoader.leer(config.archivoDataset, config),
      config,
      null,
    );
    const avisos = [...dat.avisos];
    if (dat.errores.length) return mostrarMensajes(dat.errores, avisos);
    const { atributos, clases } = dat;

    let verdaderas = [],
      predichas = [];
    if (config.modo === "externo") {
      // 3a. Entrena con todo el dataset y prueba con el archivo externo
      const ext = DatasetValidator.validar(
        await DatasetLoader.leer(config.archivoExterno, config),
        config,
        { atributos, clases },
      );
      if (ext.errores.length)
        return mostrarMensajes(ext.errores, avisos.concat(ext.avisos));
      avisos.push(
        ...ext.avisos,
        `Entrenamiento: ${dat.filas.length} filas. Prueba (archivo externo): ${ext.filas.length} filas.`,
      );
      predichas = Clasificador.predecir(
        dat.filas,
        ext.filas,
        atributos,
        clases,
        config,
      );
      if (!ext.tieneClase) {
        mostrarMensajes([], avisos);
        return Resultados.mostrarPredicciones(ext.filas, predichas, atributos);
      }
      verdaderas = ext.filas.map((f) => f.clase);
    } else {
      // 3b. Mismo dataset: validación simple o cruzada 50%-50%
      const rondas =
        config.validacion === "simple"
          ? [
              DataSplitter.simple(
                dat.filas,
                config.porcentajeEntrenamiento,
                config.estratificado,
                SEMILLA,
              ),
            ]
          : DataSplitter.cruzada(dat.filas, SEMILLA);
      for (const r of rondas) {
        predichas.push(
          ...Clasificador.predecir(
            r.entrenamiento,
            r.prueba,
            atributos,
            clases,
            config,
          ),
        );
        verdaderas.push(...r.prueba.map((f) => f.clase));
      }
      // En la cruzada se juntan las predicciones de las 2 rondas: equivale a sumar las 2 matrices
      avisos.push(
        rondas.length === 1
          ? `Entrenamiento: ${rondas[0].entrenamiento.length} filas. Prueba: ${rondas[0].prueba.length} filas.`
          : `Validación cruzada: 2 rondas de ${rondas[0].entrenamiento.length} y ${rondas[1].entrenamiento.length} filas; se evaluaron las ${verdaderas.length} filas.`,
      );
    }

    // 4. Métricas y resultados
    mostrarMensajes([], avisos);
    Resultados.mostrar(Evaluator.evaluar(verdaderas, predichas, clases));
  } catch (err) {
    mostrarMensajes(["Error inesperado: " + err.message], []);
  }
}

// -----------------------------------------------------
// Eventos: cada vez que el usuario cambia algo, se actualiza
// -----------------------------------------------------
$("formulario").addEventListener("change", actualizarInterfaz);
$("btnAnalisis").addEventListener("click", ejecutarAnalisis);

// Estado inicial al abrir la página
actualizarInterfaz();
