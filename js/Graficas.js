// Graficas: genera gráficas en SVG (sin librerías) del dataset cargado y de la configuración elegida.
// Cada gráfica se puede descargar como PNG. Usa DatasetLoader, DatasetValidator, DataSplitter, Clasificador y Evaluator.
class Graficas {
  static get PALETA_COLORES() {
    return [
      "#2d6a2e",
      "#eab308",
      "#3b7a9e",
      "#b4533c",
      "#7a5ea8",
      "#6b7f67",
      "#c27ba0",
      "#8a6d1d",
    ];
  }

  // Cadenas SVG de la última generación; el botón "Descargar PNG" lee de aquí
  static listaSvgGenerados = [];

  static _escaparTexto(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Flujo principal: carga y valida el dataset, calcula y dibuja todas las gráficas
  static async generar(objetoConfiguracion, semillaAleatoria) {
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

    let datasetExterno = null;
    if (objetoConfiguracion.modo === "externo") {
      datasetExterno = DatasetValidator.validar(
        await DatasetLoader.leer(
          objetoConfiguracion.archivoExterno,
          objetoConfiguracion,
        ),
        objetoConfiguracion,
        {
          atributos: datasetPrincipal.atributos,
          clases: datasetPrincipal.clases,
        },
      );
      if (datasetExterno.errores.length)
        return mostrarMensajes(
          datasetExterno.errores,
          listaAvisos.concat(datasetExterno.avisos),
        );
    }

    const paleta = Graficas.PALETA_COLORES,
      listaGraficas = [];

    // 1. Cuántas instancias hay de cada clase
    const instanciasPorClase = datasetPrincipal.clases.map(
      (nombreClase) =>
        datasetPrincipal.filas.filter(
          (objetoFila) => objetoFila.clase === nombreClase,
        ).length,
    );
    listaGraficas.push(
      Graficas._dibujarBarras({
        titulo: "Distribución de las clases",
        categorias: datasetPrincipal.clases.map(
          (nombreClase) => "Clase " + nombreClase,
        ),
        colorPorCategoria: true,
        series: [{ nombre: "Instancias", valores: instanciasPorClase }],
        formatearValor: (valor) => String(Math.round(valor)),
        tituloEjeY: "Instancias",
      }),
    );

    // 2. Distribución de cada atributo por clase (máximo 12 atributos)
    datasetPrincipal.atributos
      .slice(0, 12)
      .forEach((objetoAtributo, indiceAtributo) =>
        listaGraficas.push(
          Graficas._graficarDistribucionAtributo(
            datasetPrincipal,
            objetoAtributo,
            indiceAtributo,
          ),
        ),
      );
    if (datasetPrincipal.atributos.length > 12)
      listaAvisos.push(
        `Solo se grafican los primeros 12 de ${datasetPrincipal.atributos.length} atributos.`,
      );

    // 3. Métricas por clase con la configuración elegida
    const resultadoEvaluacion = Graficas._evaluarConfiguracion(
      datasetPrincipal,
      datasetExterno,
      objetoConfiguracion,
      semillaAleatoria,
    );
    if (resultadoEvaluacion) {
      listaGraficas.push(
        Graficas._dibujarBarras({
          titulo: `Métricas por clase (accuracy ${(resultadoEvaluacion.accuracy * 100).toFixed(2)} %)`,
          categorias: ["Precisión", "Exhaustividad", "Medida F1"],
          valorMaximoEjeY: 1,
          formatearValor: (valor) => valor.toFixed(2),
          series: resultadoEvaluacion.porClase.map(
            (objetoMetricaClase, indiceClase) => ({
              nombre: "Clase " + objetoMetricaClase.clase,
              valores: [
                objetoMetricaClase.precision,
                objetoMetricaClase.recall,
                objetoMetricaClase.f1,
              ],
              color: paleta[indiceClase % paleta.length],
            }),
          ),
        }),
      );
    } else
      listaAvisos.push(
        "El archivo externo no trae la columna de clase: no se grafican métricas.",
      );

    // 4 y 5. Comparación de tratamientos de variables continuas (solo si hay atributos continuos)
    if (
      resultadoEvaluacion &&
      datasetPrincipal.atributos.some(
        (objetoAtributo) => objetoAtributo.tipo === "continuo",
      )
    ) {
      const descripcionMetodo =
        objetoConfiguracion.modo === "externo"
          ? "archivo externo"
          : objetoConfiguracion.validacion === "simple"
            ? `validación simple ${objetoConfiguracion.porcentajeEntrenamiento} %`
            : "validación cruzada 50%-50%";
      const intervalosActuales =
        objetoConfiguracion.tratamientoContinuas === "binning"
          ? objetoConfiguracion.intervalos
          : 4;
      const calcularAccuracy = (
        tratamientoContinuas,
        tipoBinning,
        intervalos,
      ) =>
        Graficas._evaluarConfiguracion(
          datasetPrincipal,
          datasetExterno,
          {
            ...objetoConfiguracion,
            tratamientoContinuas,
            tipoBinning,
            intervalos,
          },
          semillaAleatoria,
        ).accuracy;

      listaGraficas.push(
        Graficas._dibujarBarras({
          titulo: `Accuracy por tratamiento de continuas (k = ${intervalosActuales})`,
          subtitulo: descripcionMetodo,
          categorias: [
            "Función de densidad",
            "Anchos iguales",
            "Frecuencias iguales",
          ],
          colorPorCategoria: true,
          valorMaximoEjeY: 1,
          formatearValor: (valor) => (valor * 100).toFixed(1) + " %",
          series: [
            {
              nombre: "Accuracy",
              valores: [
                calcularAccuracy("densidad", "anchos", intervalosActuales),
                calcularAccuracy("binning", "anchos", intervalosActuales),
                calcularAccuracy("binning", "frecuencias", intervalosActuales),
              ],
            },
          ],
        }),
      );

      const listaValoresK = [2, 3, 4, 5, 6, 8, 10];
      listaGraficas.push(
        Graficas._dibujarLineas({
          titulo: "Accuracy según el número de intervalos (k)",
          subtitulo: descripcionMetodo,
          tituloEjeX: "Intervalos (k)",
          etiquetasX: listaValoresK.map(String),
          referencia: {
            nombre: "Función de densidad",
            valor: calcularAccuracy("densidad", "anchos", 4),
          },
          series: [
            {
              nombre: "Anchos iguales",
              valores: listaValoresK.map((k) =>
                calcularAccuracy("binning", "anchos", k),
              ),
              color: paleta[1],
            },
            {
              nombre: "Frecuencias iguales",
              valores: listaValoresK.map((k) =>
                calcularAccuracy("binning", "frecuencias", k),
              ),
              color: paleta[0],
            },
          ],
        }),
      );
    } else if (resultadoEvaluacion)
      listaAvisos.push(
        "El dataset no tiene atributos continuos: no aplica la comparación de tratamientos.",
      );

    Graficas.listaSvgGenerados = listaGraficas;
    document.getElementById("contenedorGraficas").innerHTML = listaGraficas
      .map(
        (cadenaSvg, indiceGrafica) =>
          `<figure class="grafica">${cadenaSvg}<button type="button" class="btn-png" data-indice-grafica="${indiceGrafica}">Descargar PNG</button></figure>`,
      )
      .join("");
    mostrarMensajes([], listaAvisos);
  }

  // Corre una validación completa con la configuración dada (mismo procedimiento que ejecutarAnalisis en main.js)
  // y devuelve el resultado de Evaluator (o null si el archivo externo no trae clase)
  static _evaluarConfiguracion(
    datasetPrincipal,
    datasetExterno,
    objetoConfiguracion,
    semillaAleatoria,
  ) {
    const clasesVerdaderas = [],
      clasesPredichas = [];
    if (objetoConfiguracion.modo === "externo") {
      if (!datasetExterno || !datasetExterno.tieneClase) return null;
      clasesPredichas.push(
        ...Clasificador.predecir(
          datasetPrincipal.filas,
          datasetExterno.filas,
          datasetPrincipal.atributos,
          datasetPrincipal.clases,
          objetoConfiguracion,
        ),
      );
      clasesVerdaderas.push(
        ...datasetExterno.filas.map((objetoFila) => objetoFila.clase),
      );
    } else {
      const listaRondasEvaluacion =
        objetoConfiguracion.validacion === "simple"
          ? [
              DataSplitter.simple(
                datasetPrincipal.filas,
                objetoConfiguracion.porcentajeEntrenamiento,
                objetoConfiguracion.estratificado,
                semillaAleatoria,
              ),
            ]
          : DataSplitter.cruzada(datasetPrincipal.filas, semillaAleatoria);
      for (const objetoRonda of listaRondasEvaluacion) {
        clasesPredichas.push(
          ...Clasificador.predecir(
            objetoRonda.entrenamiento,
            objetoRonda.prueba,
            datasetPrincipal.atributos,
            datasetPrincipal.clases,
            objetoConfiguracion,
          ),
        );
        clasesVerdaderas.push(
          ...objetoRonda.prueba.map((objetoFila) => objetoFila.clase),
        );
      }
    }
    return Evaluator.evaluar(
      clasesVerdaderas,
      clasesPredichas,
      datasetPrincipal.clases,
    );
  }

  // Distribución de un atributo por clase: histograma (continuo) o conteo por valor (categórico)
  static _graficarDistribucionAtributo(
    datasetPrincipal,
    objetoAtributo,
    indiceAtributo,
  ) {
    const paleta = Graficas.PALETA_COLORES,
      totalFilas = datasetPrincipal.filas.length;
    let etiquetasCategorias, conteoPorClaseYCategoria; // conteoPorClaseYCategoria[indiceClase][indiceCategoria]

    if (objetoAtributo.tipo === "continuo") {
      const valoresColumna = datasetPrincipal.filas.map(
        (objetoFila) => objetoFila.valores[indiceAtributo],
      );
      const valorMinimo = Math.min(...valoresColumna),
        valorMaximo = Math.max(...valoresColumna);
      const cantidadIntervalos =
        valorMaximo === valorMinimo
          ? 1
          : Math.min(15, Math.max(5, Math.ceil(Math.log2(totalFilas)) + 1));
      const anchoIntervalo = (valorMaximo - valorMinimo) / cantidadIntervalos;
      const obtenerIndiceIntervalo = (valor) =>
        cantidadIntervalos === 1
          ? 0
          : Math.min(
              cantidadIntervalos - 1,
              Math.floor((valor - valorMinimo) / anchoIntervalo),
            );
      etiquetasCategorias = Array.from(
        { length: cantidadIntervalos },
        (_, indiceIntervalo) =>
          String(
            +(valorMinimo + indiceIntervalo * anchoIntervalo).toPrecision(3),
          ),
      );
      conteoPorClaseYCategoria = datasetPrincipal.clases.map(() =>
        Array(cantidadIntervalos).fill(0),
      );
      datasetPrincipal.filas.forEach(
        (objetoFila) =>
          conteoPorClaseYCategoria[
            datasetPrincipal.clases.indexOf(objetoFila.clase)
          ][obtenerIndiceIntervalo(objetoFila.valores[indiceAtributo])]++,
      );
    } else {
      const frecuenciaPorValor = new Map();
      datasetPrincipal.filas.forEach((objetoFila) =>
        frecuenciaPorValor.set(
          objetoFila.valores[indiceAtributo],
          (frecuenciaPorValor.get(objetoFila.valores[indiceAtributo]) || 0) + 1,
        ),
      );
      const valoresOrdenados = [...frecuenciaPorValor.entries()]
        .sort((a, b) => b[1] - a[1])
        .map((par) => par[0]);
      const valoresMasFrecuentes = valoresOrdenados.slice(0, 10),
        existenOtros = valoresOrdenados.length > 10;
      etiquetasCategorias = existenOtros
        ? [...valoresMasFrecuentes, "otros"]
        : valoresMasFrecuentes;
      conteoPorClaseYCategoria = datasetPrincipal.clases.map(() =>
        Array(etiquetasCategorias.length).fill(0),
      );
      datasetPrincipal.filas.forEach((objetoFila) => {
        const posicion = valoresMasFrecuentes.indexOf(
          objetoFila.valores[indiceAtributo],
        );
        conteoPorClaseYCategoria[
          datasetPrincipal.clases.indexOf(objetoFila.clase)
        ][posicion >= 0 ? posicion : etiquetasCategorias.length - 1]++;
      });
    }
    const tituloCompleto = `Distribución de «${objetoAtributo.nombre}» por clase`;
    return Graficas._dibujarBarras({
      titulo:
        tituloCompleto.length > 72
          ? tituloCompleto.slice(0, 71) + "…"
          : tituloCompleto,
      subtitulo:
        objetoAtributo.tipo === "continuo"
          ? "intervalos de igual ancho (se muestra el inicio de cada uno)"
          : "valores más frecuentes",
      categorias: etiquetasCategorias,
      formatearValor: (valor) => String(Math.round(valor)),
      tituloEjeY: "Instancias",
      ocultarCeros: true,
      series: datasetPrincipal.clases.map((nombreClase, indiceClase) => ({
        nombre: "Clase " + nombreClase,
        valores: conteoPorClaseYCategoria[indiceClase],
        color: paleta[indiceClase % paleta.length],
      })),
    });
  }

  // ---------------------------- dibujo SVG ----------------------------
  static _iniciarSvg(anchoSvg, altoSvg, titulo, subtitulo) {
    const esc = Graficas._escaparTexto;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoSvg}" height="${altoSvg}" viewBox="0 0 ${anchoSvg} ${altoSvg}" font-family="Arial, Helvetica, sans-serif">` +
      `<rect width="${anchoSvg}" height="${altoSvg}" fill="#fff"/><text x="${anchoSvg / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#1b3815">${esc(titulo)}</text>` +
      (subtitulo
        ? `<text x="${anchoSvg / 2}" y="39" text-anchor="middle" font-size="11" fill="#4b6b47">${esc(subtitulo)}</text>`
        : "")
    );
  }

  // Leyenda en filas de 4 elementos. items = [{ nombre, color, esLinea }]
  static _dibujarLeyenda(listaItems, anchoSvg, yInicial) {
    const esc = Graficas._escaparTexto,
      itemsPorFila = 4,
      anchoItem = (anchoSvg - 72) / itemsPorFila;
    let cadenaSvg = "";
    listaItems.forEach((objetoItem, indiceItem) => {
      const x = 56 + (indiceItem % itemsPorFila) * anchoItem,
        y = yInicial + Math.floor(indiceItem / itemsPorFila) * 18;
      cadenaSvg +=
        (objetoItem.esLinea
          ? `<line x1="${x}" x2="${x + 14}" y1="${y - 4}" y2="${y - 4}" stroke="${objetoItem.color}" stroke-width="2" stroke-dasharray="4 3"/>`
          : `<rect x="${x}" y="${y - 10}" width="12" height="12" fill="${objetoItem.color}"/>`) +
        `<text x="${x + 18}" y="${y}" font-size="11" fill="#1b3815">${esc(objetoItem.nombre)}</text>`;
    });
    return cadenaSvg;
  }

  // Barras agrupadas. opciones = { titulo, subtitulo, categorias, series:[{nombre, valores, color}],
  //   valorMaximoEjeY, formatearValor, tituloEjeY, colorPorCategoria, ocultarCeros }
  static _dibujarBarras(opciones) {
    const esc = Graficas._escaparTexto,
      anchoSvg = 640,
      altoSvg = 340,
      margenIzq = 56,
      margenDer = 16,
      margenSup = 60;
    const cantidadSeries = opciones.series.length,
      cantidadCategorias = opciones.categorias.length;
    const mostrarLeyenda = cantidadSeries > 1 && !opciones.colorPorCategoria;
    const rotarEtiquetas =
      cantidadCategorias > 6 ||
      opciones.categorias.some(
        (etiqueta) =>
          String(etiqueta).length * 6.2 >
          ((anchoSvg - margenIzq - margenDer) / cantidadCategorias) * 0.95,
      );
    const filasLeyenda = mostrarLeyenda ? Math.ceil(cantidadSeries / 4) : 0;
    const margenInf =
      (rotarEtiquetas ? 80 : 32) + filasLeyenda * 18 + (mostrarLeyenda ? 6 : 0);
    const anchoPlano = anchoSvg - margenIzq - margenDer,
      altoPlano = altoSvg - margenSup - margenInf;

    // Eje Y con marcas "redondas": se busca un paso (1, 2, 5, 10, 20...) con a lo más 6 marcas
    let maximoEjeY = opciones.valorMaximoEjeY,
      cantidadMarcas = 5;
    if (!maximoEjeY) {
      const valorMasGrande = Math.max(
        1e-9,
        ...opciones.series.flatMap((objetoSerie) => objetoSerie.valores),
      );
      let paso = 1;
      for (const candidato of [
        1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
        50000, 100000, 1e6, 1e7,
      ]) {
        paso = candidato;
        if (Math.ceil(valorMasGrande / candidato) <= 6) break;
      }
      cantidadMarcas = Math.ceil(valorMasGrande / paso);
      maximoEjeY = paso * cantidadMarcas;
    }
    const convertirValorAY = (valor) =>
      margenSup + altoPlano - (valor / maximoEjeY) * altoPlano;

    let cadenaSvg = Graficas._iniciarSvg(
      anchoSvg,
      altoSvg,
      opciones.titulo,
      opciones.subtitulo,
    );
    for (let i = 0; i <= cantidadMarcas; i++) {
      const valorMarca = (maximoEjeY * i) / cantidadMarcas;
      cadenaSvg +=
        `<line x1="${margenIzq}" x2="${anchoSvg - margenDer}" y1="${convertirValorAY(valorMarca)}" y2="${convertirValorAY(valorMarca)}" stroke="#d1e2cb"/>` +
        `<text x="${margenIzq - 6}" y="${convertirValorAY(valorMarca) + 4}" text-anchor="end" font-size="11" fill="#4b6b47">${esc(opciones.formatearValor(valorMarca))}</text>`;
    }
    if (opciones.tituloEjeY)
      cadenaSvg += `<text x="14" y="${margenSup + altoPlano / 2}" text-anchor="middle" font-size="11" fill="#4b6b47" transform="rotate(-90 14 ${margenSup + altoPlano / 2})">${esc(opciones.tituloEjeY)}</text>`;

    const anchoGrupo = anchoPlano / cantidadCategorias,
      anchoBarra = Math.min(46, (anchoGrupo * 0.8) / cantidadSeries);
    opciones.categorias.forEach((etiquetaCategoria, indiceCategoria) => {
      const xInicioGrupo =
        margenIzq +
        anchoGrupo * indiceCategoria +
        (anchoGrupo - anchoBarra * cantidadSeries) / 2;
      opciones.series.forEach((objetoSerie, indiceSerie) => {
        const valor = objetoSerie.valores[indiceCategoria],
          xBarra = xInicioGrupo + anchoBarra * indiceSerie;
        const colorBarra = opciones.colorPorCategoria
          ? Graficas.PALETA_COLORES[indiceCategoria % 8]
          : objetoSerie.color;
        cadenaSvg += `<rect x="${xBarra}" y="${convertirValorAY(valor)}" width="${Math.max(1, anchoBarra - 1)}" height="${margenSup + altoPlano - convertirValorAY(valor)}" fill="${colorBarra}"/>`;
        if (
          (anchoBarra >= 18 || cantidadSeries * cantidadCategorias <= 12) &&
          !(opciones.ocultarCeros && valor === 0)
        )
          cadenaSvg += `<text x="${xBarra + anchoBarra / 2}" y="${convertirValorAY(valor) - 4}" text-anchor="middle" font-size="10" fill="#1b3815">${esc(opciones.formatearValor(valor))}</text>`;
      });
      const xCentro = margenIzq + anchoGrupo * indiceCategoria + anchoGrupo / 2,
        yEtiqueta = margenSup + altoPlano + 16;
      const textoEtiqueta =
        String(etiquetaCategoria).length > 22
          ? String(etiquetaCategoria).slice(0, 21) + "…"
          : String(etiquetaCategoria);
      cadenaSvg += rotarEtiquetas
        ? `<text x="${xCentro}" y="${yEtiqueta}" font-size="11" text-anchor="end" fill="#1b3815" transform="rotate(-35 ${xCentro} ${yEtiqueta})">${esc(textoEtiqueta)}</text>`
        : `<text x="${xCentro}" y="${yEtiqueta}" font-size="11" text-anchor="middle" fill="#1b3815">${esc(textoEtiqueta)}</text>`;
    });
    cadenaSvg += `<line x1="${margenIzq}" x2="${anchoSvg - margenDer}" y1="${margenSup + altoPlano}" y2="${margenSup + altoPlano}" stroke="#555"/>`;
    if (mostrarLeyenda)
      cadenaSvg += Graficas._dibujarLeyenda(
        opciones.series.map((objetoSerie) => ({
          nombre: objetoSerie.nombre,
          color: objetoSerie.color,
        })),
        anchoSvg,
        altoSvg - 6 - (filasLeyenda - 1) * 18,
      );
    return cadenaSvg + "</svg>";
  }

  // Líneas con una referencia horizontal opcional. opciones = { titulo, subtitulo, etiquetasX, series, referencia:{nombre, valor}, tituloEjeX }
  static _dibujarLineas(opciones) {
    const esc = Graficas._escaparTexto,
      anchoSvg = 640,
      altoSvg = 340,
      margenIzq = 56,
      margenDer = 16,
      margenSup = 56,
      margenInf = 84;
    const anchoPlano = anchoSvg - margenIzq - margenDer,
      altoPlano = altoSvg - margenSup - margenInf,
      cantidadPuntos = opciones.etiquetasX.length;
    const todosLosValores = opciones.series
      .flatMap((objetoSerie) => objetoSerie.valores)
      .concat(opciones.referencia ? [opciones.referencia.valor] : []);
    const valorMinimo = Math.min(...todosLosValores),
      valorMaximo = Math.max(...todosLosValores);
    const minimoEjeY = Math.max(0, Math.floor((valorMinimo - 0.02) * 50) / 50);
    let maximoEjeY = Math.min(1, Math.ceil((valorMaximo + 0.02) * 50) / 50);
    if (maximoEjeY <= minimoEjeY) maximoEjeY = minimoEjeY + 0.1;
    const convertirValorAY = (valor) =>
      margenSup +
      altoPlano -
      ((valor - minimoEjeY) / (maximoEjeY - minimoEjeY)) * altoPlano;
    const convertirIndiceAX = (indice) =>
      margenIzq + (anchoPlano * (indice + 0.5)) / cantidadPuntos;

    let cadenaSvg = Graficas._iniciarSvg(
      anchoSvg,
      altoSvg,
      opciones.titulo,
      opciones.subtitulo,
    );
    for (let i = 0; i <= 5; i++) {
      const valorMarca = minimoEjeY + ((maximoEjeY - minimoEjeY) * i) / 5;
      cadenaSvg +=
        `<line x1="${margenIzq}" x2="${anchoSvg - margenDer}" y1="${convertirValorAY(valorMarca)}" y2="${convertirValorAY(valorMarca)}" stroke="#d1e2cb"/>` +
        `<text x="${margenIzq - 6}" y="${convertirValorAY(valorMarca) + 4}" text-anchor="end" font-size="11" fill="#4b6b47">${(valorMarca * 100).toFixed(1)} %</text>`;
    }
    opciones.etiquetasX.forEach(
      (etiqueta, indice) =>
        (cadenaSvg += `<text x="${convertirIndiceAX(indice)}" y="${margenSup + altoPlano + 16}" text-anchor="middle" font-size="11" fill="#1b3815">${esc(etiqueta)}</text>`),
    );
    cadenaSvg += `<text x="${margenIzq + anchoPlano / 2}" y="${margenSup + altoPlano + 32}" text-anchor="middle" font-size="11" fill="#4b6b47">${esc(opciones.tituloEjeX)}</text>`;
    if (opciones.referencia)
      cadenaSvg += `<line x1="${margenIzq}" x2="${anchoSvg - margenDer}" y1="${convertirValorAY(opciones.referencia.valor)}" y2="${convertirValorAY(opciones.referencia.valor)}" stroke="#6b7f67" stroke-width="2" stroke-dasharray="6 4"/>`;
    for (const objetoSerie of opciones.series) {
      cadenaSvg += `<polyline fill="none" stroke="${objetoSerie.color}" stroke-width="2" points="${objetoSerie.valores.map((valor, indice) => convertirIndiceAX(indice) + "," + convertirValorAY(valor)).join(" ")}"/>`;
      objetoSerie.valores.forEach(
        (valor, indice) =>
          (cadenaSvg += `<circle cx="${convertirIndiceAX(indice)}" cy="${convertirValorAY(valor)}" r="3.5" fill="${objetoSerie.color}"/>`),
      );
    }
    cadenaSvg += `<line x1="${margenIzq}" x2="${anchoSvg - margenDer}" y1="${margenSup + altoPlano}" y2="${margenSup + altoPlano}" stroke="#555"/>`;
    const listaItems = opciones.series.map((objetoSerie) => ({
      nombre: objetoSerie.nombre,
      color: objetoSerie.color,
    }));
    if (opciones.referencia)
      listaItems.push({
        nombre: opciones.referencia.nombre,
        color: "#6b7f67",
        esLinea: true,
      });
    return (
      cadenaSvg +
      Graficas._dibujarLeyenda(listaItems, anchoSvg, altoSvg - 12) +
      "</svg>"
    );
  }

  // Descarga la gráfica indicada como PNG (dibuja el SVG en un canvas al doble de tamaño)
  static descargarPng(indiceGrafica) {
    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement("canvas");
      lienzo.width = imagen.width * 2;
      lienzo.height = imagen.height * 2;
      const contexto = lienzo.getContext("2d");
      contexto.fillStyle = "#fff";
      contexto.fillRect(0, 0, lienzo.width, lienzo.height);
      contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      const enlaceDescarga = document.createElement("a");
      enlaceDescarga.download = `grafica_${indiceGrafica + 1}.png`;
      enlaceDescarga.href = lienzo.toDataURL("image/png");
      enlaceDescarga.click();
    };
    imagen.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(Graficas.listaSvgGenerados[indiceGrafica]);
  }
}
