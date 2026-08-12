# Perfil de Tienda · Remaster operativo

Dashboard estático para GitHub Pages construido con datos reales y un pipeline Python auditable. Los motores se validan por separado, se cruzan únicamente con llaves verificables y pueden aumentar o disminuir filas, CeCos y meses sin cambiar el código.

La navegación superior lleva directamente a Resumen, Indicadores, Equipo y Mix y Ayuda. En pantallas pequeñas se oculta para conservar una vista limpia; los filtros y pestañas continúan disponibles.

## Motores independientes

| Motor | Llave o cruce | Uso |
|---|---|---|
| `Directorio_Perfil Tienda.csv` | `CC` | Universo oficial, nombres y filtros |
| `Base_Perfil Tienda.xlsx` | `MES_NUM + CeCo` | Partner, Cliente y parte de Negocio |
| `Base_Perfil Tienda.csv` | `Mes + Tiendas` | Negocio AA |
| `Base_Perfil Tienda_2.csv` | `Mes + Tiendas` | Negocio real y presupuesto |
| `mix/*.csv` | nombre exacto único del Directorio | Mix de producto y orden |
| `Query.xlsx` | `cc + NUM_EMP` | Resumen de partners activos |

`MES_NUM` acepta `1..12` (`1 = Enero`), `YYYYMM` o la etiqueta histórica `1_ene`. El periodo visible se deriva de los motores; no hay listas fijas de CeCos. Un valor porcentual `-100%` se presenta en blanco. Los cruces no encontrados también quedan en blanco y se registran en `data/audit.json`.

## Actualización segura

1. Sustituye sólo el motor actualizado conservando su nombre y encabezados.
2. Si actualizas Mix, colócalo fuera del repositorio y ejecuta:

   ```bash
   python scripts/split_mix.py --source "/ruta/Base_Mix.csv" --output "data/engines/mix"
   ```

3. Ejecuta:

   ```bash
   python scripts/check_file_sizes.py
   python scripts/build_data.py
   python -m unittest discover -s tests -v
   ```

4. Revisa `data/audit.json`. Los errores bloquean la publicación; las advertencias identifican datos reales sin cruce y no fabrican valores.
5. Publica. GitHub Actions repite las validaciones y sólo despliega los archivos mínimos del sitio; nunca publica motores crudos.

Consulta [data/engines/INSTRUCCIONES_ACTUALIZACION.md](data/engines/INSTRUCCIONES_ACTUALIZACION.md) para el contrato detallado de cada archivo.

## Lectura operativa

- Cada tarjeta muestra Real, AA/PPTO y `Real - referencia`.
- Verde: resultado favorable. En Labor, Costo, Rotación y DT, menor es mejor.
- DT se normaliza a segundos y se presenta `mm:ss`; `01:15` representa un minuto con quince segundos.
- YTD de Rotación toma el último mes disponible; Venta suma; las demás métricas promedian los periodos disponibles.
- Las gráficas recalculan mínimo, máximo y separación según los valores visibles.

## Vista local

```bash
python scripts/build_data.py
python -m http.server 8000
```

Abre `http://localhost:8000`.

## Limpieza del proyecto anterior

Ejecuta manualmente el workflow **Eliminar archivos legados autorizados**. En modo `AUDITAR` sólo informa; con la confirmación exacta `ELIMINAR` borra únicamente las rutas de `scripts/obsolete-files.json`, incluido el Mix monolítico obsoleto.

La limpieza incluye los archivos históricos de raíz `Store_Master_Audit.csv`, `data.js`, `README.txt`, `manifest.json`, `style.css` y los iconos duplicados. Conserva `styles.css`, `manifest.webmanifest` y `assets/`.
