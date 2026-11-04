// Discretizer: Clase encargada de transformar atributos continuos (numéricos)
// en índices discretos (rangos del 0 al k-1), calculando los límites únicamente
// con el conjunto de entrenamiento para evitar fuga de información (data leakage).
class Discretizer {
  // Función constructora para definir el tipo de discretización y la cantidad de intervalos (k)
  constructor(tipoDiscretizacion, numeroIntervalosK) {
    //guardar la configuración de binning y preparar la estructura de límites
    this.tipoDiscretizacion = tipoDiscretizacion;
    this.numeroIntervalosK = numeroIntervalosK;
    this.fronterasCortes = [];
  }

  // Función para calcular las fronteras o puntos de corte usando solo el conjunto de entrenamiento
  ajustar(filasEntrenamiento, listaAtributos) {
    //calcular los k-1 límites de cada atributo numérico según el método elegido

    this.fronterasCortes = listaAtributos.map(
      (objetoAtributo, indiceAtributo) => {
        if (objetoAtributo.tipo !== "continuo") return null;

        const valoresOrdenados = filasEntrenamiento
          .map((objetoFila) => objetoFila.valores[indiceAtributo])
          .sort((primerValor, segundoValor) => primerValor - segundoValor);

        const listaFronteras = [];

        if (this.tipoDiscretizacion === "anchos") {
          const valorMinimo = valoresOrdenados[0];
          const anchoIntervalo =
            (valoresOrdenados[valoresOrdenados.length - 1] - valorMinimo) /
            this.numeroIntervalosK;

          for (
            let indiceFrontera = 1;
            indiceFrontera < this.numeroIntervalosK;
            indiceFrontera++
          ) {
            listaFronteras.push(valorMinimo + indiceFrontera * anchoIntervalo);
          }
        } else {
          for (
            let indiceFrontera = 1;
            indiceFrontera < this.numeroIntervalosK;
            indiceFrontera++
          ) {
            const indicePosicion = Math.floor(
              (indiceFrontera * valoresOrdenados.length) /
                this.numeroIntervalosK,
            );
            listaFronteras.push(valoresOrdenados[indicePosicion]);
          }
        }

        return listaFronteras;
      },
    );
  }

  // Función para determinar en qué número de intervalo (de 0 a k-1) cae un valor numérico específico
  intervalo(indiceColumnaAtributo, valorContinuo) {
    // comparar un valor numérico contra los límites calculados y devolver su intervalo
    let contadorIntervalo = 0;

    for (const valorCorte of this.fronterasCortes[indiceColumnaAtributo]) {
      if (valorContinuo >= valorCorte) {
        contadorIntervalo++;
      }
    }

    return contadorIntervalo;
  }
}
