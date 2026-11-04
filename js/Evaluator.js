// Evaluator: Clase encargada de construir la matriz de confusión y calcular
// las métricas de rendimiento estadístico (Precisión, Exhaustividad/Recall, Medida F1, Soporte y Accuracy).
class Evaluator {
  // Función principal para evaluar las predicciones comparándolas contra los valores reales
  static evaluar(clasesVerdaderas, clasesPredichas, listaClases) {
    // crear la matriz bidimensional e incrementar los conteos de intersección (Predicha vs Real)

    const mapaIndicesClases = new Map(
      listaClases.map((nombreClase, indiceClase) => [nombreClase, indiceClase]),
    );
    const cantidadClases = listaClases.length;
    const matrizConfusion = Array.from({ length: cantidadClases }, () =>
      Array(cantidadClases).fill(0),
    );

    clasesVerdaderas.forEach((claseVerdadera, indiceInstancia) => {
      const indicePredicho = mapaIndicesClases.get(
        clasesPredichas[indiceInstancia],
      );
      const indiceReal = mapaIndicesClases.get(claseVerdadera);
      matrizConfusion[indicePredicho][indiceReal]++;
    });

    // calcular las métricas individuales de cada categoría a partir de las filas y columnas de la matriz

    const totalInstanciasPrueba = clasesVerdaderas.length;
    const dividirSeguro = (numerador, denominador) =>
      denominador === 0 ? 0 : numerador / denominador;

    const metricasPorClase = listaClases.map((nombreClase, indiceClase) => {
      const verdaderosPositivos = matrizConfusion[indiceClase][indiceClase];

      const totalPredichasDeClase = matrizConfusion[indiceClase].reduce(
        (sumaAcumulada, valorConteo) => sumaAcumulada + valorConteo,
        0,
      );

      const totalRealesDeClase = matrizConfusion.reduce(
        (sumaAcumulada, filaMatriz) => sumaAcumulada + filaMatriz[indiceClase],
        0,
      );

      const precisionClase = dividirSeguro(
        verdaderosPositivos,
        totalPredichasDeClase,
      );
      const sensibilidadClase = dividirSeguro(
        verdaderosPositivos,
        totalRealesDeClase,
      );

      return {
        clase: nombreClase,
        precision: precisionClase,
        recall: sensibilidadClase,
        f1: dividirSeguro(
          2 * precisionClase * sensibilidadClase,
          precisionClase + sensibilidadClase,
        ),
        soporte: totalRealesDeClase,
      };
    });

    //calcular la fila del promedio ponderado por soporte y la exactitud general del modelo

    const calcularPromedioPonderado = (nombreCampoMetrica) =>
      dividirSeguro(
        metricasPorClase.reduce(
          (sumaAcumulada, objetoMetricaClase) =>
            sumaAcumulada +
            objetoMetricaClase[nombreCampoMetrica] * objetoMetricaClase.soporte,
          0,
        ),
        totalInstanciasPrueba,
      );

    const totalAciertosDiagonal = listaClases.reduce(
      (sumaAcumulada, _, indiceClase) =>
        sumaAcumulada + matrizConfusion[indiceClase][indiceClase],
      0,
    );

    return {
      clases: listaClases,
      matriz: matrizConfusion,
      porClase: metricasPorClase,
      promedio: {
        precision: calcularPromedioPonderado("precision"),
        recall: calcularPromedioPonderado("recall"),
        f1: calcularPromedioPonderado("f1"),
        soporte: totalInstanciasPrueba,
      },
      accuracy: dividirSeguro(totalAciertosDiagonal, totalInstanciasPrueba),
      total: totalInstanciasPrueba,
    };
  }
}
