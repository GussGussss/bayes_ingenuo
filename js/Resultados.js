// Resultados: Clase encargada de generar dinámicamente el código HTML para renderizar
// la matriz de confusión, las métricas estadísticas y los KPIs dentro de los contenedores de index.html.
class Resultados {
  // Función auxiliar para desinfectar cadenas de texto y prevenir vulnerabilidades Cross-Site Scripting (XSS)
  static _esc(textoCadena) {
    //reemplazar símbolos HTML por sus entidades seguras correspondientes
    return String(textoCadena)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Función para restaurar la interfaz al estado inicial antes de ejecutar un nuevo análisis
  static limpiar() {
    //  vaciar las tablas de resultados y resetear el valor de accuracy

    document.getElementById("contenedorMatriz").innerHTML =
      '<p class="vacio">Aún no hay resultados.</p>';
    document.getElementById("contenedorMetricas").innerHTML =
      '<p class="vacio">Aún no hay resultados.</p>';
    document.getElementById("accuracy").textContent = "—";
  }

  // Función principal para construir y mostrar las tablas de resultados y métricas completas
  static mostrar(objetoResultados) {
    // preparar los atajos de formateo de texto y precisión decimal

    const escaparHTML = Resultados._esc;
    const formatearDosDecimales = (valorNumero) => valorNumero.toFixed(2);

    // armar la estructura HTML de la matriz de confusión (filas = predicha, columnas = real)

    const totalesPorColumna = objetoResultados.clases.map((_, indiceColumna) =>
      objetoResultados.matriz.reduce(
        (sumaAcumulada, filaMatriz) =>
          sumaAcumulada + filaMatriz[indiceColumna],
        0,
      ),
    );

    let htmlMatrizConfusion =
      "<table><thead><tr><th>Predicha \\ Real</th>" +
      objetoResultados.clases
        .map((nombreClase) => `<th>${escaparHTML(nombreClase)}</th>`)
        .join("") +
      "<th>Total</th></tr></thead><tbody>";

    objetoResultados.matriz.forEach((filaMatriz, indiceFila) => {
      htmlMatrizConfusion +=
        `<tr><th>${escaparHTML(objetoResultados.clases[indiceFila])}</th>` +
        filaMatriz
          .map(
            (valorConteo, indiceColumna) =>
              `<td${indiceFila === indiceColumna ? ' class="score-cell"' : ""}>${valorConteo}</td>`,
          )
          .join("") +
        `<td>${filaMatriz.reduce((sumaAcumulada, valorConteo) => sumaAcumulada + valorConteo, 0)}</td></tr>`;
    });

    htmlMatrizConfusion +=
      `</tbody><tfoot><tr class="total-row"><td>Total</td>` +
      totalesPorColumna
        .map((totalColumna) => `<td>${totalColumna}</td>`)
        .join("") +
      `<td>${objetoResultados.total}</td></tr></tfoot></table>`;

    document.getElementById("contenedorMatriz").innerHTML = htmlMatrizConfusion;

    // armar la tabla con Precisión, Exhaustividad, F1-Score y actualizar el KPI de Accuracy

    let htmlTablaMetricas =
      "<table><thead><tr><th>Categoría</th><th>Precisión</th><th>Exhaustividad</th><th>Medida F</th><th>Soporte</th></tr></thead><tbody>";

    for (const objetoMetricaClase of objetoResultados.porClase) {
      htmlTablaMetricas += `<tr><td>${escaparHTML(objetoMetricaClase.clase)}</td><td>${formatearDosDecimales(
        objetoMetricaClase.precision,
      )}</td><td>${formatearDosDecimales(objetoMetricaClase.recall)}</td><td>${formatearDosDecimales(
        objetoMetricaClase.f1,
      )}</td><td>${objetoMetricaClase.soporte}</td></tr>`;
    }

    const objetoPromedios = objetoResultados.promedio;
    htmlTablaMetricas += `</tbody><tfoot><tr class="total-row"><td>Prom./total</td><td>${formatearDosDecimales(
      objetoPromedios.precision,
    )}</td><td>${formatearDosDecimales(objetoPromedios.recall)}</td><td>${formatearDosDecimales(
      objetoPromedios.f1,
    )}</td><td>${objetoPromedios.soporte}</td></tr></tfoot></table>`;

    document.getElementById("contenedorMetricas").innerHTML = htmlTablaMetricas;
    document.getElementById("accuracy").textContent =
      (objetoResultados.accuracy * 100).toFixed(2) + " %";
  }

  // Función para mostrar las predicciones individuales cuando se procesa un archivo externo sin clase objetivo
  static mostrarPredicciones(
    filasEvaluadas,
    listaPredicciones,
    listaAtributos,
  ) {
    // renderizar una tabla con los atributos de cada fila y la clase predicha asignada por el modelo

    const escaparHTML = Resultados._esc;

    let htmlTablaPredicciones =
      "<table><thead><tr><th>#</th>" +
      listaAtributos
        .map(
          (objetoAtributo) => `<th>${escaparHTML(objetoAtributo.nombre)}</th>`,
        )
        .join("") +
      "<th>Clase predicha</th></tr></thead><tbody>";

    filasEvaluadas.forEach((objetoFila, indiceInstancia) => {
      htmlTablaPredicciones +=
        `<tr><td>${indiceInstancia + 1}</td>` +
        objetoFila.valores
          .map((valorAtributo) => `<td>${escaparHTML(valorAtributo)}</td>`)
          .join("") +
        `<td class="score-cell">${escaparHTML(listaPredicciones[indiceInstancia])}</td></tr>`;
    });

    document.getElementById("contenedorMatriz").innerHTML =
      htmlTablaPredicciones + "</tbody></table>";
    document.getElementById("contenedorMetricas").innerHTML =
      '<p class="vacio">El archivo externo no trae la columna de clase: no se calculan métricas.</p>';
    document.getElementById("accuracy").textContent = "—";
  }
}
