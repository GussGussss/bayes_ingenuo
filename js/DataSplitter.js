// DataSplitter: Clase encargada de dividir las filas del dataset en conjuntos
// de entrenamiento y prueba, utilizando particiones aleatorias reproducibles o cruzadas.
class DataSplitter {
  // Función para crear un generador de números aleatorios pseudoaleatorios basado en una semilla (Mulberry32)
  static _rng(semillaInicial) {
    // generar números decimales entre 0 y 1 de forma reproducible usando una semilla

    let estadoSemilla = semillaInicial >>> 0;

    return () => {
      estadoSemilla = (estadoSemilla + 0x6d2b79f5) >>> 0;
      let valorMezclado = Math.imul(
        estadoSemilla ^ (estadoSemilla >>> 15),
        1 | estadoSemilla,
      );
      valorMezclado =
        (valorMezclado +
          Math.imul(
            valorMezclado ^ (valorMezclado >>> 7),
            61 | valorMezclado,
          )) ^
        valorMezclado;
      return ((valorMezclado ^ (valorMezclado >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Función para desordenar un arreglo de elementos sin modificar el arreglo original (Algoritmo Fisher-Yates)
  static _barajar(arregloOriginal, generadorAleatorio) {
    //  crear una copia desordenada al azar de un arreglo sin alterar el original

    const copiaArreglo = arregloOriginal.slice();

    for (
      let indiceActual = copiaArreglo.length - 1;
      indiceActual > 0;
      indiceActual--
    ) {
      const indiceAleatorio = Math.floor(
        generadorAleatorio() * (indiceActual + 1),
      );
      [copiaArreglo[indiceActual], copiaArreglo[indiceAleatorio]] = [
        copiaArreglo[indiceAleatorio],
        copiaArreglo[indiceActual],
      ];
    }

    return copiaArreglo;
  }

  // Función para agrupar las filas del dataset en listas separadas según su clase objetivo
  static _porClase(filasEstructuradas) {
    // clasificar y juntar los registros que pertenecen a la misma clase
    const mapaGrupos = new Map();

    for (const objetoFila of filasEstructuradas) {
      if (!mapaGrupos.has(objetoFila.clase)) {
        mapaGrupos.set(objetoFila.clase, []);
      }
      mapaGrupos.get(objetoFila.clase).push(objetoFila);
    }

    return [...mapaGrupos.values()];
  }

  // Función principal para realizar la validación simple (porcentaje de entrenamiento y prueba)
  static simple(
    filasEstructuradas,
    porcentajeEntrenamiento,
    esEstratificado,
    semilla,
  ) {
    // dividir el dataset en porcentaje% para entrenar y el resto para probar
    const generadorAleatorio = DataSplitter._rng(semilla);
    const listaGrupos = esEstratificado
      ? DataSplitter._porClase(filasEstructuradas)
      : [filasEstructuradas];

    const entrenamiento = [];
    const prueba = [];

    for (const grupoClase of listaGrupos) {
      const grupoBarajado = DataSplitter._barajar(
        grupoClase,
        generadorAleatorio,
      );
      const cantidadEntrenamiento = Math.max(
        1,
        Math.min(
          grupoBarajado.length > 1 ? grupoBarajado.length - 1 : 1,
          Math.round((porcentajeEntrenamiento / 100) * grupoBarajado.length),
        ),
      );

      entrenamiento.push(...grupoBarajado.slice(0, cantidadEntrenamiento));
      prueba.push(...grupoBarajado.slice(cantidadEntrenamiento));
    }

    return {
      entrenamiento: DataSplitter._barajar(entrenamiento, generadorAleatorio),
      prueba: DataSplitter._barajar(prueba, generadorAleatorio),
    };
  }

  // Función para realizar la validación cruzada 50%-50% en dos rondas conservando las clases
  static cruzada(filasEstructuradas, semilla) {
    //Bloque para alternar las filas entre dos subconjuntos y crear 2 rondas de prueba

    const generadorAleatorio = DataSplitter._rng(semilla);
    const conjuntoA = [];
    const conjuntoB = [];

    for (const grupoClase of DataSplitter._porClase(filasEstructuradas)) {
      DataSplitter._barajar(grupoClase, generadorAleatorio).forEach(
        (objetoFila, indicePosicion) => {
          if (indicePosicion % 2 === 0) {
            conjuntoA.push(objetoFila);
          } else {
            conjuntoB.push(objetoFila);
          }
        },
      );
    }

    return [
      { entrenamiento: conjuntoA, prueba: conjuntoB },
      { entrenamiento: conjuntoB, prueba: conjuntoA },
    ];
  }
}
