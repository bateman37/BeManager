# ADR-0007: Motor de continuidad compartido y perfil de reglas de partido separado

**Estado:** ACCEPTED
**Última actualización:** 2026-09-29.

## Contexto

ME-04 pide un partido completo FIBA 2026 que reutilice la continuidad real
del tramo de ME-03 sin romper «una posesión», «comparar lote» ni «jugar
tramo», que separe la adjudicación FIBA del hecho deportivo y de la
proyección del acta, y cuyo contrato admita en el futuro perfiles NBA/NCAA
sin tres motores. Hasta ME-03, toda la orquestación vivía en una clase
privada de `play-tramo.ts` con el quinteto, el sentido de ataque, la
cobertura y el final del tramo fijados dentro.

## Decisión

1. **`LinkedRun`** (`domain/sequence/linked-run.ts`) es el motor de
   continuidad compartido: marco local, relojes, saques, transición,
   rebotes, balón suelto, materialización de hechos. Lo que distingue un
   modo se inyecta por métodos `protected` explícitos (quinteto, sentido de
   ataque, cobertura de quien defiende, qué hacer al agotarse el reloj,
   cierre de posesión, reglas del núcleo, minutos). `play-tramo.ts` es ahora
   una subclase fina; `domain/game/play-full-game.ts` es la otra.
2. **Reglas de partido opcionales en el núcleo** (`LinkedGameRules`):
   libres diferidos, vía sin tiro por contención y segunda entrada. Sin
   ellas (posesión individual, lotes, tramo) el núcleo se comporta como en
   ME-03; lo verifican dos huellas fijas en las pruebas.
3. **Perfil de reglas puro** (`domain/game/fiba-2026-rules.ts`): funciones
   puras con fronteras en milisegundos para períodos, bocina, reloj tras
   canasta, faltas/bonus, saque tras falta, salto, alternancia y
   oportunidades de sustitución. El partido y los casos de frontera de la
   interfaz llaman a las mismas funciones. Un perfil NBA/NCAA futuro
   implementaría `GameRulesProfile` y sus propias funciones.
4. **Acta como proyección** (`domain/game/box-score.ts`): una pasada por los
   hechos ya adjudicados; no lee el estado interno del motor. La
   conciliación con los minutos del motor es una comprobación, no un ajuste.
5. **Nueva carpeta `domain/game/`** para el partido; `domain/sequence/`
   conserva el tramo y el motor compartido.

## Consecuencias

- Un cambio en la continuidad afecta a los dos modos a la vez; las huellas
  de ME-01/02/03 en las pruebas detectan cualquier desviación del tramo.
- La clase base expone estado `protected`: acoplamiento consciente entre
  los dos modos del mismo módulo, no un contrato público.
- La interfaz no contiene reglas: presenta los casos de frontera que
  construye el dominio.

## Alternativas descartadas

- **Copiar `play-tramo.ts` para el partido:** duplicaría la continuidad y
  divergiría con el tiempo (el prompt pide extraer fronteras comunes).
- **Concatenar tramos de cuatro posesiones:** reiniciaría el fixture en
  cada tramo, prohibido desde ME-03.
- **Parámetros de modo dentro del núcleo para el bonus o la bocina:**
  mezclaría la adjudicación FIBA con el hecho deportivo.
