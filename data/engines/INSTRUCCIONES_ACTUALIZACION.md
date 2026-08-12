Instrucciones para actualizar motores
Regla principal
Cada archivo es un motor independiente. No pegues un motor dentro de otro ni edites `data/dashboard.json`: Python lo reconstruye. El Directorio define el universo oficial; si un CeCo no existe ahí, sus valores quedan en blanco y la auditoría lo reporta.
Contratos
Base_Perfil Tienda.xlsx
Hojas obligatorias: `Perfil` e `Instrucciones_Ejemplo`.
Llave única por fila: `MES_NUM + CeCo`.
`MES_NUM`: entero de `1` a `12`; también se aceptan `YYYYMM` y etiquetas como `1_ene`.
Se permiten más o menos filas, CeCos y meses. No repitas una misma combinación `MES_NUM + CeCo`.
Mantén los encabezados de métricas. `-100%` comparativo significa “No aplica” y se convierte a blanco.
DT se interpreta como `mm:ss`; valores fuera del rango operativo de 00:20 a 30:00 quedan en blanco y se auditan como atípicos.
Base_Perfil Tienda.csv y Base_Perfil Tienda_2.csv
Exportación UTF-16 del reporte original.
El pipeline busca el encabezado real que comienza con `Mes` aunque existan líneas de título.
`Mes` usa `YYYYMM`; `Tiendas` contiene el CeCo.
Se validan y cruzan por separado. Aumentar o disminuir tiendas no requiere cambios de código.
Directorio_Perfil Tienda.csv
Codificación UTF-8 y llave única `CC` de cinco dígitos.
Actualiza altas/bajas aquí primero. Los filtros Tienda, DM y Región se generan dinámicamente.
`Tienda` y `Nombre APP y Signage` funcionan como alias; sólo se usa un alias si coincide con un único CeCo.
Base_Mix.csv
No se guarda monolítico porque supera 25 MB.
Ejecuta `split_mix.py`; genera una parte por mes y `mix/manifest.json` con filas, tamaño y SHA-256.
No renombres ni edites manualmente las partes. El build comprueba el checksum antes de usarlas.
Si una parte llegara a 24 MB, el script se detiene para evitar un archivo incompatible con GitHub Web.
Query.xlsx
Hoja obligatoria `Query`.
Requiere `NUM_EMP`, `NOM_PUESTO`, `SEXO`, `F.NAC`, `F_INGRESO`, `cc` y `STATUS_ EMP (ACTIVO/BAJA)`.
Deduplica por `cc + NUM_EMP` y resume sólo partners activos.
Checklist antes de publicar
```bash
python scripts/check_file_sizes.py
python scripts/build_data.py
python -m unittest discover -s tests -v
```
El resultado aceptable es: cero errores bloqueantes, archivos menores a 25 MB y todas las pruebas en `OK`. Las advertencias son trazables en `data/audit.json`.
