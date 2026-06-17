CORRECCIÓN AWS PROMEDIO DM / RD

Problema detectado:
La pestaña DM y RD estaba SUMANDO el AWS de sus tiendas.
Ejemplo: 10 tiendas x ~$419K promedio = ~$4,196K mostrado.

Corrección aplicada:
1. Tienda:
   AWS = (Venta Mes / días del mes) * 7

2. DM:
   AWS DM = Promedio simple de los AWS de sus tiendas con dato del mes.

3. RD:
   AWS RD = Promedio simple de los AWS de todas sus tiendas con dato del mes.

4. Venta Mes:
   Se mantiene como SUMA mensual del portafolio.

Archivos a subir a GitHub:
- data.js
- app.js

Importante:
Sube ambos archivos. Si solo subes data.js, el sitio puede seguir sumando AWS porque la lógica estaba en app.js.
