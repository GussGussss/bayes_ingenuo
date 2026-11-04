// main.js: Módulo orquestador principal del sistema. Conecta los controles de la interfaz HTML
// con las clases lógicas del proyecto (DatasetLoader, DatasetValidator, DataSplitter, Clasificador, Evaluator y Resultados).

// Función auxiliar atajo para obtener elementos del DOM por su identificador ID
const obtenerElementoPorId = (idElemento) =>
  document.getElementById(idElemento);

// Función auxiliar para obtener el valor del botón de radio que esté actualmente marcado en un grupo
function obtenerValorRadioSeleccionado(nombreGrupoRadio) {
  //buscar qué opción radio de un grupo está seleccionada por el usuario

  return document.querySelector(
    'input[name="' + nombreGrupoRadio + '"]:checked',
  ).value;
}

// Función auxiliar para activar o desactivar todos los botones de radio pertenecientes a un grupo
function cambiarEstadoGrupoRadios(nombreGrupoRadio, estaHabilitado) {
  // habilitar o deshabilitar todos los radios de un mismo grupo en la interfaz
  document
    .querySelectorAll('input[name="' + nombreGrupoRadio + '"]')
    .forEach((elementoRadio) => {
      elementoRadio.disabled = !estaHabilitado;
    });
}

// Función para activar o desactivar dinámicamente los controles HTML del formulario según la selección del usuario
function actualizarInterfaz() {
  // Bloque para habilitar únicamente los campos válidos según las opciones seleccionadas

  const usaMismoDataset = obtenerValorRadioSeleccionado("modo") === "mismo";
  const esValidacionSimple =
    usaMismoDataset && obtenerValorRadioSeleccionado("validacion") === "simple";

  cambiarEstadoGrupoRadios("validacion", usaMismoDataset);
  obtenerElementoPorId("porcentaje").disabled = !esValidacionSimple;
  obtenerElementoPorId("estratificado").disabled = !esValidacionSimple;
  obtenerElementoPorId("archivoExterno").disabled = usaMismoDataset;

  const usaTratamientoBinning =
    obtenerValorRadioSeleccionado("continuas") === "binning";

  cambiarEstadoGrupoRadios("tipoBinning", usaTratamientoBinning);
  obtenerElementoPorId("intervalos").disabled = !usaTratamientoBinning;
}

// Función para recopilar todas las opciones seleccionadas en la interfaz y empaquetarlas en un objeto
function leerConfiguracion() {
  // Bloque para leer todos los valores ingresados por el usuario y crear el objeto de configuración

  return {
    archivoDataset: obtenerElementoPorId("archivoDataset").files[0] || null,
    posicionClase: obtenerValorRadioSeleccionado("posClase"),
    tieneEncabezado: obtenerElementoPorId("tieneEncabezado").checked,
    separador: obtenerElementoPorId("separador").value,

    modo: obtenerValorRadioSeleccionado("modo"),
    validacion: obtenerValorRadioSeleccionado("validacion"),
    porcentajeEntrenamiento: Number(obtenerElementoPorId("porcentaje").value),
    estratificado: obtenerElementoPorId("estratificado").checked,
    archivoExterno: obtenerElementoPorId("archivoExterno").files[0] || null,

    tratamientoContinuas: obtenerValorRadioSeleccionado("continuas"),
    tipoBinning: obtenerValorRadioSeleccionado("tipoBinning"),
    intervalos: Number(obtenerElementoPorId("intervalos").value),
  };
}

// Función para renderizar mensajes visuales de error (rojo) y avisos (amarillo) en el contenedor HTML
function mostrarMensajes(listaErrores, listaAvisos) {
  // Bloque para crear e inyectar divs con mensajes de error o advertencia en el DOM

  const contenedorMensajes = obtenerElementoPorId("mensajes");
  contenedorMensajes.innerHTML = "";

  const agregarDivisionesMensaje = (claseEstiloCss, listaTextosMensaje) =>
    listaTextosMensaje.forEach((textoMensaje) => {
      const elementoDivMensaje = document.createElement("div");
      elementoDivMensaje.className = claseEstiloCss;
      elementoDivMensaje.textContent = textoMensaje;
      contenedorMensajes.appendChild(elementoDivMensaje);
    });

  agregarDivisionesMensaje("error", listaErrores);
  agregarDivisionesMensaje("aviso", listaAvisos);
}

// Semilla numérica fija para garantizar que la generación pseudoaleatoria Mulberry32 sea totalmente reproducible
const SEMILLA_REPRODUCIBLE = 12345;

// Función principal asíncrona que orquesta todo el pipeline al presionar el botón "Análisis"
async function ejecutarAnalisis() {
  // leer las opciones seleccionadas, resetear la pantalla y validar parámetros básicos

  const objetoConfiguracion = leerConfiguracion();
  Resultados.limpiar();
  mostrarMensajes([], []);

  const erroresParametros =
    DatasetValidator.validarParametros(objetoConfiguracion);
  if (erroresParametros.length) return mostrarMensajes(erroresParametros, []);

  try {
    // Bloque para parsear el archivo con DatasetLoader.js y validar su estructura con DatasetValidator.js

    const datasetPrincipal = DatasetValidator.validar(
      await DatasetLoader.leer(
        objetoConfiguracion.archivoDataset,
        objetoConfiguracion,
      ),
      objetoConfiguracion,
      null,
    );

    const listaAvisos = [...datasetPrincipal.avisos];
    if (datasetPrincipal.errores.length)
      return mostrarMensajes(datasetPrincipal.errores, listaAvisos);

    const { atributos: listaAtributos, clases: listaClases } = datasetPrincipal;
    let clasesVerdaderas = [];
    let clasesPredichas = [];

    if (objetoConfiguracion.modo === "externo") {
      // entrenar con todo el dataset principal y predecir sobre las filas del archivo externo

      const datasetExterno = DatasetValidator.validar(
        await DatasetLoader.leer(
          objetoConfiguracion.archivoExterno,
          objetoConfiguracion,
        ),
        objetoConfiguracion,
        { atributos: listaAtributos, clases: listaClases },
      );

      if (datasetExterno.errores.length)
        return mostrarMensajes(
          datasetExterno.errores,
          listaAvisos.concat(datasetExterno.avisos),
        );

      listaAvisos.push(
        ...datasetExterno.avisos,
        `Entrenamiento: ${datasetPrincipal.filas.length} filas. Prueba (archivo externo): ${datasetExterno.filas.length} filas.`,
      );

      clasesPredichas = Clasificador.predecir(
        datasetPrincipal.filas,
        datasetExterno.filas,
        listaAtributos,
        listaClases,
        objetoConfiguracion,
      );

      if (!datasetExterno.tieneClase) {
        mostrarMensajes([], listaAvisos);
        return Resultados.mostrarPredicciones(
          datasetExterno.filas,
          clasesPredichas,
          listaAtributos,
        );
      }

      clasesVerdaderas = datasetExterno.filas.map(
        (objetoFila) => objetoFila.clase,
      );
    } else {
      // dividir el dataset en rondas de entrenamiento y prueba usando DataSplitter.js
      const listaRondasEvaluacion =
        objetoConfiguracion.validacion === "simple"
          ? [
              DataSplitter.simple(
                datasetPrincipal.filas,
                objetoConfiguracion.porcentajeEntrenamiento,
                objetoConfiguracion.estratificado,
                SEMILLA_REPRODUCIBLE,
              ),
            ]
          : DataSplitter.cruzada(datasetPrincipal.filas, SEMILLA_REPRODUCIBLE);

      for (const objetoRonda of listaRondasEvaluacion) {
        clasesPredichas.push(
          ...Clasificador.predecir(
            objetoRonda.entrenamiento,
            objetoRonda.prueba,
            listaAtributos,
            listaClases,
            objetoConfiguracion,
          ),
        );
        clasesVerdaderas.push(
          ...objetoRonda.prueba.map((objetoFila) => objetoFila.clase),
        );
      }

      listaAvisos.push(
        listaRondasEvaluacion.length === 1
          ? `Entrenamiento: ${listaRondasEvaluacion[0].entrenamiento.length} filas. Prueba: ${listaRondasEvaluacion[0].prueba.length} filas.`
          : `Validación cruzada: 2 rondas de ${listaRondasEvaluacion[0].entrenamiento.length} y ${listaRondasEvaluacion[1].entrenamiento.length} filas; se evaluaron las ${clasesVerdaderas.length} filas.`,
      );
    }

    // generar la matriz de confusión con Evaluator.js y renderizar las tablas con Resultados.js
    mostrarMensajes([], listaAvisos);
    Resultados.mostrar(
      Evaluator.evaluar(clasesVerdaderas, clasesPredichas, listaClases),
    );
  } catch (errorExcepcion) {
    mostrarMensajes(["Error inesperado: " + errorExcepcion.message], []);
  }
}

// conectar las acciones del usuario en el formulario y cargar el estado inicial

obtenerElementoPorId("formulario").addEventListener(
  "change",
  actualizarInterfaz,
);
obtenerElementoPorId("btnAnalisis").addEventListener("click", ejecutarAnalisis);

actualizarInterfaz();
