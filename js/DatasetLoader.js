// DatasetLoader: Clase encargada de convertir el archivo cargado (.csv / .txt)
// en una estructura de datos en memoria (matriz de celdas de texto).
class DatasetLoader {
  //funcion simple para leer el dataset
  static leer(archivoObjeto, configuracion) {
    return archivoObjeto
      .text()
      .then((textoCompleto) =>
        DatasetLoader.parsear(textoCompleto, configuracion),
      );
  }

  //funcion que parsea todo el dataset y lo hace una matriz de datos
  static parsear(textoCompleto, configuracion) {
    //ajustar el separador y separar el texto en renglones limpios
    const separadorEfectivo =
      configuracion.separador === "\\t" ? "\t" : configuracion.separador;

    const lineasValidas = textoCompleto
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .filter((lineaTexto) => lineaTexto.trim() !== "");

    //Quitar comillas, dividir cada renglon y armar la matriz de datos
    const quitarComillasTexto = (contenidoCelda) =>
      contenidoCelda.trim().replace(/^"(.*)"$/, "$1");

    const dividirLinea = (lineaTexto) =>
      separadorEfectivo === " "
        ? lineaTexto.trim().split(/\s+/)
        : lineaTexto.split(separadorEfectivo).map(quitarComillasTexto);

    const matrizCeldas = lineasValidas.map(dividirLinea);

    //separar la fila de nombres de columnas y devolverlos limpios
    const encabezados =
      configuracion.tieneEncabezado && matrizCeldas.length
        ? matrizCeldas.shift()
        : null;

    return {
      encabezados,
      celdas: matrizCeldas,
    };
  }
}
