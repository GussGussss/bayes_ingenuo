// DatasetValidator: valida parámetros y el dataset, cada problema es un mensaje en "errores"

class DatasetValidator {
  //valida que las dependiendo la opcion seleccionada se haga lo correspondiente
  static validarParametros(config) {
    // juntar errores
    const e = [];

    if (!config.archivoDataset) e.push("Selecciona el archivo del dataset.");
    if (config.modo === "externo") {
      if (!config.archivoExterno)
        e.push("Selecciona el archivo de pruebas externo.");
    } else if (config.validacion === "simple") {
      const p = config.porcentajeEntrenamiento;
      if (!Number.isInteger(p) || p < 1 || p > 99)
        e.push(
          "El porcentaje de entrenamiento debe ser un entero entre 1 y 99.",
        );
    }
    if (config.tratamientoContinuas === "binning") {
      const k = config.intervalos;
      if (!Number.isInteger(k) || k < 2)
        e.push(
          "El intervalo de discretización debe ser un entero mayor o igual a 2.",
        );
    }
    return e;
  }

  // funciona que valida el archivo este bien parseado (mismas columnas por filas, que tenga datos etc)
  static validar(parseado, config, ref) {
    const errores = [],
      avisos = [];
    const { encabezados, celdas } = parseado;
    const fallo = () => ({
      errores,
      avisos,
      atributos: [],
      clases: [],
      filas: [],
      tieneClase: false,
    });

    if (celdas.length === 0) {
      errores.push("El archivo no tiene filas de datos.");
      return fallo();
    }
    const n = celdas[0].length;
    const mala = celdas.findIndex((f) => f.length !== n);
    if (mala >= 0) {
      errores.push(
        `La fila de datos ${mala + 1} tiene ${celdas[mala].length} columnas y se esperaban ${n}. Revisa el separador.`,
      );
      return fallo();
    }
    if (encabezados && encabezados.length !== n) {
      errores.push(
        `El encabezado tiene ${encabezados.length} columnas pero los datos tienen ${n}. Revisa el separador o la casilla de encabezado.`,
      );
      return fallo();
    }

    // Aqui determinamos donde esta la clase (inicio o final)
    let tieneClase = true;
    if (ref) {
      //archivo externo al dataset
      const na = ref.atributos.length;
      if (n === na) tieneClase = false;
      else if (n !== na + 1) {
        errores.push(
          `El archivo externo tiene ${n} columnas; debe tener ${na} (sin clase) o ${na + 1} (con clase).`,
        );
        return fallo();
      }
      //dataset
    } else if (n < 2) {
      errores.push(
        "El dataset solo tiene 1 columna: se necesita al menos 1 atributo y la clase. Revisa el separador.",
      );
      return fallo();
    }
    //guardamos los indices de la clase y atributos
    const iClase = tieneClase
      ? config.posicionClase === "inicio"
        ? 0
        : n - 1
      : -1;
    const iAttr = [...Array(n).keys()].filter((i) => i !== iClase);

    // Valores vacios se descartan la fila completa y se avisa
    const falta = (v) =>
      v === "" || ["?", "na", "nan", "null"].includes(v.toLowerCase());
    const buenas = celdas.filter((f) => !f.some(falta));
    const desc = celdas.length - buenas.length;
    if (desc > 0)
      avisos.push(`Se descartaron ${desc} fila(s) con valores faltantes.`);
    if (buenas.length === 0) {
      errores.push("Todas las filas tienen valores faltantes.");
      return fallo();
    }

    //Identificar si los datos numericos son continuos o categoricos
    const esNum = (v) => Number.isFinite(Number(v));
    let atributos;
    if (ref) {
      atributos = ref.atributos;
      atributos.forEach((a, j) => {
        if (a.tipo === "continuo" && !buenas.every((f) => esNum(f[iAttr[j]])))
          errores.push(
            `El atributo "${a.nombre}" es numérico en el dataset pero el archivo externo trae valores no numéricos.`,
          );
      });
    } else {
      atributos = iAttr.map((c, j) => ({
        nombre: (encabezados && encabezados[c]) || `atributo${j + 1}`,
        tipo: buenas.every((f) => esNum(f[c])) ? "continuo" : "categorico",
      }));
    }
    if (errores.length) return fallo();

    const filas = buenas.map((f) => ({
      valores: iAttr.map((c, j) =>
        atributos[j].tipo === "continuo" ? Number(f[c]) : f[c],
      ),
      clase: iClase >= 0 ? f[iClase] : null,
    }));

    let clases;
    if (ref) {
      clases = ref.clases;
      if (tieneClase) {
        const nuevas = [...new Set(filas.map((f) => f.clase))].filter(
          (c) => !clases.includes(c),
        );
        if (nuevas.length)
          errores.push(
            `El archivo externo tiene clases que no existen en el dataset: ${nuevas.join(", ")}.`,
          );
      }
    } else {
      clases = [...new Set(filas.map((f) => f.clase))].sort();
      if (clases.length < 2)
        errores.push(
          `El dataset solo tiene 1 clase ("${clases[0]}"). ¿Elegiste bien la posición de la clase (inicio o final)?`,
        );
      else if (clases.length > filas.length / 2)
        avisos.push(
          `Hay ${clases.length} clases para ${filas.length} filas. ¿La posición de la clase es la correcta?`,
        );
      if (filas.length < 4)
        errores.push(
          "El dataset tiene muy pocas filas para dividir en entrenamiento y prueba.",
        );
      atributos.forEach((a, j) => {
        if (
          a.tipo === "categorico" &&
          filas.length > 10 &&
          new Set(filas.map((f) => f.valores[j])).size === filas.length
        )
          avisos.push(
            `El atributo "${a.nombre}" tiene un valor distinto en cada fila (parece un ID); no aporta al clasificador.`,
          );
      });
      const nc = atributos.filter((a) => a.tipo === "continuo").length;
      avisos.push(
        `Atributos detectados: ${nc} continuo(s) y ${atributos.length - nc} categórico(s). Clases: ${clases.join(", ")}.`,
      );
    }
    if (errores.length) return fallo();
    return { errores, avisos, atributos, clases, filas, tieneClase };
  }
}
