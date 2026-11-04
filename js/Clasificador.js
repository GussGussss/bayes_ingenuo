// Clasificador: Clase que actúa como puente de conexión para instanciar,
// entrenar el modelo Bayesiano y predecir las etiquetas del conjunto de prueba.
class Clasificador {
  // Función principal para coordinar el entrenamiento del modelo Naive Bayes y obtener sus predicciones
  static predecir(
    filasEntrenamiento,
    filasPrueba,
    listaAtributos,
    listaClases,
    configuracion,
  ) {
    // crear la instancia del algoritmo y calibrarlo con los datos de entrenamiento
    const instanciaNaiveBayes = new NaiveBayes(configuracion);
    instanciaNaiveBayes.entrenar(
      filasEntrenamiento,
      listaAtributos,
      listaClases,
    );

    // recorrer cada fila del conjunto de prueba y obtener su clase predicha
    return filasPrueba.map((objetoFilaPrueba) =>
      instanciaNaiveBayes.predecir(objetoFilaPrueba),
    );
  }
}
