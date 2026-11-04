class DatasetLoader {
  static leer(archivo, config) {
    return archivo.text().then((texto) => DatasetLoader.parsear(texto, config));
  }

  static parsear(texto, config) {
    //saber si hay tabuladores
    const sep = config.separador === "\\t" ? "\t" : config.separador;
    //quitar caracteres invisibles y divide el texto en unarreglo de lineas
    const lineas = texto
      .replace(/^/, "")
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "");

    const quitarComillas = (c) => c.trim().replace(/^"(.*)"$/, "$1");
    // Con espacio como separador se aceptan varios espacios seguidos
    const dividir = (l) =>
      sep === " " ? l.trim().split(/\s+/) : l.split(sep).map(quitarComillas);
    //llama a dividir para poner todo en una matriz
    const celdas = lineas.map(dividir);

    //saber si hay encabezados y con shif las quita
    const encabezados =
      config.tieneEncabezado && celdas.length ? celdas.shift() : null;

    return { encabezados, celdas };
  }
}
