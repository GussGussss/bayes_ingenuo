// NaiveBayes: Clase encargada de entrenar el modelo de Clasificación Bayesiana e inferir
// la clase con mayor probabilidad. Se trabaja con suma de LOGARITMOS (log-probabilities)
// para evitar el problema de underflow aritmético al multiplicar probabilidades pequeñas.
class NaiveBayes {
  // Función constructora para recibir y almacenar la configuración elegida en la interfaz
  constructor(configuracion) {
    //guardar las opciones seleccionadas por el usuario en el formulario
    this.configuracion = configuracion;
  }

  // Función principal para entrenar el clasificador calculando las frecuencias y parámetros estadísticos
  entrenar(filasEntrenamiento, listaAtributos, listaClases) {
    //ajustar los intervalos numéricos si se seleccionó discretización (binning)

    this.listaClases = listaClases;
    this.listaAtributos = listaAtributos;
    this.usaBinning = this.configuracion.tratamientoContinuas === "binning";

    if (this.usaBinning) {
      this.instanciaDiscretizador = new Discretizer(
        this.configuracion.tipoBinning,
        this.configuracion.intervalos,
      );
      this.instanciaDiscretizador.ajustar(filasEntrenamiento, listaAtributos);
    }

    //determinar la cantidad de valores posibles por atributo y evitar la división entre cero en Gaussianas
    const totalFilasEntrenamiento = filasEntrenamiento.length;
    const esContinuoConDensidad = (objetoAtributo) =>
      objetoAtributo.tipo === "continuo" && !this.usaBinning;

    this.tamanoVocabularioAtributos = listaAtributos.map(
      (objetoAtributo, indiceAtributo) =>
        objetoAtributo.tipo === "continuo"
          ? this.configuracion.intervalos
          : new Set(
              filasEntrenamiento.map(
                (objetoFila) => objetoFila.valores[indiceAtributo],
              ),
            ).size,
    );

    this.factoresEpsilonVarianza = listaAtributos.map(
      (objetoAtributo, indiceAtributo) => {
        if (!esContinuoConDensidad(objetoAtributo)) return 0;

        const valoresAtributo = filasEntrenamiento.map(
          (objetoFila) => objetoFila.valores[indiceAtributo],
        );
        const mediaGlobalAtributo =
          valoresAtributo.reduce(
            (sumaAcumulada, valorAtributo) => sumaAcumulada + valorAtributo,
            0,
          ) / totalFilasEntrenamiento;

        const varianzaGlobal =
          valoresAtributo.reduce(
            (sumaAcumulada, valorAtributo) =>
              sumaAcumulada + (valorAtributo - mediaGlobalAtributo) ** 2,
            0,
          ) / totalFilasEntrenamiento;

        return 1e-9 * (varianzaGlobal || 1);
      },
    );

    //calcular P(Clase) y aprender las distribuciones (Gaussiana o conteos con Laplace) de cada atributo
    this.logProbabilidadesPrior = {};
    this.modeloEstadistico = {};

    for (const nombreClase of listaClases) {
      const filasDeClase = filasEntrenamiento.filter(
        (objetoFila) => objetoFila.clase === nombreClase,
      );
      const cantidadFilasDeClase = filasDeClase.length;

      this.logProbabilidadesPrior[nombreClase] = Math.log(
        cantidadFilasDeClase / totalFilasEntrenamiento,
      );

      this.modeloEstadistico[nombreClase] = listaAtributos.map(
        (objetoAtributo, indiceAtributo) => {
          if (esContinuoConDensidad(objetoAtributo)) {
            const valoresAtributo = filasDeClase.map(
              (objetoFila) => objetoFila.valores[indiceAtributo],
            );
            const mediaAtributoDeClase = cantidadFilasDeClase
              ? valoresAtributo.reduce(
                  (sumaAcumulada, valorAtributo) =>
                    sumaAcumulada + valorAtributo,
                  0,
                ) / cantidadFilasDeClase
              : 0;

            const varianzaAtributoDeClase =
              (cantidadFilasDeClase > 1
                ? valoresAtributo.reduce(
                    (sumaAcumulada, valorAtributo) =>
                      sumaAcumulada +
                      (valorAtributo - mediaAtributoDeClase) ** 2,
                    0,
                  ) /
                  (cantidadFilasDeClase - 1)
                : 0) + this.factoresEpsilonVarianza[indiceAtributo];

            return {
              gauss: true,
              mu: mediaAtributoDeClase,
              v: varianzaAtributoDeClase,
            };
          }

          const mapaCuentasFrecuencia = new Map();
          for (const objetoFila of filasDeClase) {
            const claveOIntervalo = this._obtenerClaveIdentificadora(
              objetoFila.valores[indiceAtributo],
              indiceAtributo,
            );
            mapaCuentasFrecuencia.set(
              claveOIntervalo,
              (mapaCuentasFrecuencia.get(claveOIntervalo) || 0) + 1,
            );
          }

          return {
            gauss: false,
            cuentas: mapaCuentasFrecuencia,
            n: cantidadFilasDeClase,
            V: this.tamanoVocabularioAtributos[indiceAtributo],
          };
        },
      );
    }
  }

  // Función auxiliar para obtener la clave representativa de un dato (índice de intervalo o valor cualitativo)
  _obtenerClaveIdentificadora(valorAtributo, indiceAtributo) {
    // traducir un valor numérico a su número de intervalo (0 a k-1) o devolver el valor tal cual
    return this.listaAtributos[indiceAtributo].tipo === "continuo" &&
      this.usaBinning
      ? this.instanciaDiscretizador.intervalo(indiceAtributo, valorAtributo)
      : valorAtributo;
  }

  // Función para predecir y retornar la clase con mayor probabilidad logarítmica para una nueva fila
  predecir(objetoFilaEvaluar) {
    //calcular el puntaje logarítmico de cada clase y elegir la ganadora

    let mejorClasePredicha = null;
    let mejorPuntajeLogProbabilidad = -Infinity;

    for (const nombreClase of this.listaClases) {
      let sumaLogProbabilidades = this.logProbabilidadesPrior[nombreClase];

      this.modeloEstadistico[nombreClase].forEach(
        (modeloAtributo, indiceAtributo) => {
          const valorAtributo = objetoFilaEvaluar.valores[indiceAtributo];

          if (modeloAtributo.gauss) {
            sumaLogProbabilidades +=
              -0.5 * Math.log(2 * Math.PI * modeloAtributo.v) -
              (valorAtributo - modeloAtributo.mu) ** 2 / (2 * modeloAtributo.v);
          } else {
            const claveOIntervalo = this._obtenerClaveIdentificadora(
              valorAtributo,
              indiceAtributo,
            );
            const conteoApariciones =
              modeloAtributo.cuentas.get(claveOIntervalo) || 0;

            sumaLogProbabilidades += Math.log(
              (conteoApariciones + 1) / (modeloAtributo.n + modeloAtributo.V),
            );
          }
        },
      );

      if (
        mejorClasePredicha === null ||
        sumaLogProbabilidades > mejorPuntajeLogProbabilidad
      ) {
        mejorClasePredicha = nombreClase;
        mejorPuntajeLogProbabilidad = sumaLogProbabilidades;
      }
    }

    return mejorClasePredicha;
  }
}
