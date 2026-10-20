/**
 * lib/language-study/placement/es.ts — Spanish placement bank (DELE format)
 *
 * Original items in the shape of DELE tasks: Comprensión de lectura,
 * Comprensión auditiva, and Uso de la lengua gaps. Five per level; a run
 * draws four. The right option is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const LECTURA = "Comprensión de lectura"
const AUDITIVA = "Comprensión auditiva"
const USO = "Uso de la lengua"

export const ES_PLACEMENT: PlacementBank = {
  lang: "es",
  questions: [
    // A1
    { id: "es-a1-1", level: "A1", skill: "listening", task: AUDITIVA, ask: "Listen, then answer.",
      passage: "Hola, soy Carlos. Tengo treinta años y trabajo en un hospital. Soy enfermero.",
      stem: "¿Cuál es la profesión de Carlos?", choices: ["Enfermero", "Médico", "Profesor", "Camarero"],
      why: "«Soy enfermero» — I'm a nurse." },
    { id: "es-a1-2", level: "A1", skill: "reading", task: LECTURA, ask: "Read the sign, then answer.",
      passage: "Museo de la Ciudad. Horario: de martes a sábado, de 10:00 a 18:00. Domingo, de 10:00 a 14:00. Lunes, cerrado.",
      stem: "¿A qué hora cierra el museo el domingo?", choices: ["A las 14:00", "A las 18:00", "A las 10:00", "No abre"],
      why: "«Domingo, de 10:00 a 14:00»." },
    { id: "es-a1-3", level: "A1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Mis padres ___ en Madrid.", choices: ["viven", "vive", "vivimos", "vives"],
      why: "Mis padres is ellos: viven." },
    { id: "es-a1-4", level: "A1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Mi hermana ___ muy alta.", choices: ["es", "está", "hay", "tiene"],
      why: "A lasting trait like height takes ser." },
    { id: "es-a1-5", level: "A1", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "Hace frío. Necesito mi ___.", choices: ["abrigo", "bañador", "vaso", "cuchara"],
      why: "Un abrigo is a coat." },

    // A2
    { id: "es-a2-1", level: "A2", skill: "listening", task: AUDITIVA, ask: "Listen to the announcement, then answer.",
      passage: "Atención, señores pasajeros: el vuelo con destino a Sevilla saldrá por la puerta doce en lugar de la puerta ocho.",
      stem: "¿Qué ha cambiado?", choices: ["La puerta de embarque", "La hora de salida", "El destino", "El número del vuelo"],
      why: "«por la puerta doce en lugar de la puerta ocho»." },
    { id: "es-a2-2", level: "A2", skill: "reading", task: LECTURA, ask: "Read the note, then answer.",
      passage: "Querida Ana: El fin de semana pasado fui a la playa con mis primos. El sábado hizo sol, pero el domingo llovió todo el día y nos quedamos en casa jugando a las cartas. Un beso, Lucía",
      stem: "¿Qué hicieron el domingo?", choices: ["Jugaron a las cartas en casa", "Fueron a la playa", "Tomaron el sol", "Visitaron a Ana"],
      why: "«nos quedamos en casa jugando a las cartas»." },
    { id: "es-a2-3", level: "A2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Ayer ___ a mi abuela.", choices: ["visité", "visito", "visitaré", "visitar"],
      why: "Ayer, a finished past action: pretérito indefinido." },
    { id: "es-a2-4", level: "A2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "¿Te gusta el chocolate? Sí, ___ encanta.", choices: ["me", "te", "le", "mi"],
      why: "Encantar works like gustar: (a mí) me encanta." },
    { id: "es-a2-5", level: "A2", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "Para pagar en la tienda, uso la ___ de crédito.", choices: ["tarjeta", "carta", "cuenta", "caja"],
      why: "Tarjeta de crédito — credit card." },

    // B1
    { id: "es-b1-1", level: "B1", skill: "listening", task: AUDITIVA, ask: "Listen to the voicemail, then answer.",
      passage: "Le llamo de la academia de idiomas. Su curso de inglés empieza el lunes, pero la clase del primer día será en el aula cinco, no en la tres, porque la están pintando.",
      stem: "¿Por qué cambia el aula?", choices: ["Porque están pintando el aula tres", "Porque hay más alumnos", "Porque el curso empieza el lunes", "Porque el profesor está enfermo"],
      why: "«porque la están pintando»." },
    { id: "es-b1-2", level: "B1", skill: "reading", task: LECTURA, ask: "Read the article, then answer.",
      passage: "Cada vez más ciudades españolas prohíben la entrada de coches contaminantes en el centro. Los comerciantes temían perder clientes, pero según un estudio reciente, las ventas en las calles peatonales han aumentado un diez por ciento.",
      stem: "¿Qué ha pasado con las ventas?", choices: ["Han subido", "Han bajado", "No han cambiado", "Los comercios han cerrado"],
      why: "«han aumentado un diez por ciento»." },
    { id: "es-b1-3", level: "B1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Cuando ___ a casa, te llamaré.", choices: ["llegue", "llego", "llegaré", "llegaría"],
      why: "Cuando about the future takes the subjunctive." },
    { id: "es-b1-4", level: "B1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Si tuviera dinero, ___ por todo el mundo.", choices: ["viajaría", "viajaré", "viajo", "viaje"],
      why: "Si + imperfect subjunctive pairs with the conditional." },
    { id: "es-b1-5", level: "B1", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "Me he quedado sin batería; tengo que ___ el móvil.", choices: ["cargar", "llevar", "cobrar", "colgar"],
      why: "Cargar — to charge a battery." },

    // B2
    { id: "es-b2-1", level: "B2", skill: "reading", task: LECTURA, ask: "Read, then answer.",
      passage: "Aunque muchos asocian la siesta con la pereza, varios estudios demuestran que un descanso breve después de comer mejora la concentración y reduce el estrés, siempre que no supere los treinta minutos.",
      stem: "Según el texto, la siesta es beneficiosa…", choices: ["si es corta", "si dura más de una hora", "solo para los perezosos", "solo por la noche"],
      why: "«siempre que no supere los treinta minutos»." },
    { id: "es-b2-2", level: "B2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Me sorprendió que no ___ a la reunión.", choices: ["vinieras", "vienes", "vendrás", "has venido"],
      why: "A past emotion verb takes the imperfect subjunctive." },
    { id: "es-b2-3", level: "B2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Por mucho que ___, no conseguirás convencerlo.", choices: ["insistas", "insistes", "insistirás", "insistías"],
      why: "Por mucho que about a hypothetical future takes the subjunctive." },
    { id: "es-b2-4", level: "B2", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "La empresa ha decidido ___ a cien trabajadores por la crisis.", choices: ["despedir", "despejar", "desplegar", "despertar"],
      why: "Despedir — to dismiss, to lay off." },
    { id: "es-b2-5", level: "B2", skill: "listening", task: AUDITIVA, ask: "Listen, then answer.",
      passage: "Lo que más me llamó la atención del congreso no fueron las ponencias, sino las conversaciones informales en los pasillos, donde surgieron las ideas más interesantes.",
      stem: "¿Qué destaca el hablante del congreso?", choices: ["Las conversaciones informales", "Las ponencias", "La organización", "Los pasillos amplios"],
      why: "«no fueron las ponencias, sino las conversaciones»." },

    // C1
    { id: "es-c1-1", level: "C1", skill: "reading", task: LECTURA, ask: "Read, then answer.",
      passage: "El autor no pretende demonizar las redes sociales, sino advertir de que su lógica, basada en la inmediatez, empobrece el debate público al premiar la reacción sobre la reflexión.",
      stem: "¿Qué critica el autor?", choices: ["Que las redes premian la reacción rápida frente a la reflexión", "Que las redes son ilegales", "Que nadie usa las redes", "Que el debate público es demasiado lento"],
      why: "«al premiar la reacción sobre la reflexión»." },
    { id: "es-c1-2", level: "C1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "De ___ sabido antes, no habría aceptado el trabajo.", choices: ["haberlo", "saberlo", "haber", "habiéndolo"],
      why: "De + perfect infinitive is a conditional: had I known it." },
    { id: "es-c1-3", level: "C1", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "Su argumento carece de ___: no se apoya en ningún dato.", choices: ["fundamento", "fundición", "fundador", "fundido"],
      why: "Carecer de fundamento — to be groundless." },
    { id: "es-c1-4", level: "C1", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Se lo explicaré, ___ no lo entienda.", choices: ["aunque", "porque", "ya que", "puesto que"],
      why: "Aunque + subjunctive: even if he does not understand." },
    { id: "es-c1-5", level: "C1", skill: "listening", task: AUDITIVA, ask: "Listen, then answer.",
      passage: "Si bien las cifras de empleo han mejorado, conviene no echar las campanas al vuelo: buena parte de los nuevos contratos son temporales y de baja calidad.",
      stem: "¿Qué actitud muestra el hablante?", choices: ["Prudencia ante los datos", "Entusiasmo total", "Indiferencia", "Rechazo de las cifras"],
      why: "No echar las campanas al vuelo — don't celebrate too soon." },

    // C2
    { id: "es-c2-1", level: "C2", skill: "reading", task: LECTURA, ask: "Read, then answer.",
      passage: "Pocas veces una novela ha conseguido, como esta, que la ironía no degenere en cinismo: el narrador se burla de sus personajes, pero nunca les retira su compasión.",
      stem: "¿Qué elogia el texto de la novela?", choices: ["Que combina ironía y compasión", "Que es cínica", "Que no tiene ironía", "Que el narrador odia a sus personajes"],
      why: "Irony that never loses compassion." },
    { id: "es-c2-2", level: "C2", skill: "vocabulary", task: USO, ask: "Choose the meaning.",
      stem: "Decir que alguien «se ha ido por los cerros de Úbeda» significa que…", choices: ["se ha desviado del tema", "ha viajado a Andalucía", "se ha perdido en el campo", "ha cambiado de trabajo"],
      why: "The idiom means wandering off the subject." },
    { id: "es-c2-3", level: "C2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "Quienquiera que ___ el responsable, deberá dar explicaciones.", choices: ["sea", "es", "será", "fue"],
      why: "Quienquiera que takes the subjunctive." },
    { id: "es-c2-4", level: "C2", skill: "vocabulary", task: USO, ask: "Fill the gap.",
      stem: "Su actitud ___ fue criticada por todos: no se comprometía con nada.", choices: ["ambigua", "ambiciosa", "ambulante", "ambiental"],
      why: "Committing to nothing is ambiguous." },
    { id: "es-c2-5", level: "C2", skill: "grammar", task: USO, ask: "Fill the gap.",
      stem: "No es que no ___ ayudarte, es que no puedo.", choices: ["quiera", "quiero", "querré", "querría"],
      why: "No es que denies a reason and takes the subjunctive." },
  ],
}
