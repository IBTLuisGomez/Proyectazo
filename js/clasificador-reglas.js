// Reglas del clasificador local de pensamientos. Fuente única: las usa el navegador
// (js/captura-parser.js) y el microservicio Python (nexus_service.py lee el JSON entre los marcadores).
//
// - Se comparan sin acentos ni mayúsculas y por palabra completa: "sat" no coincide con "satisfecho".
// - Una palabra terminada en * coincide como prefijo: "concentr*" → concentrarme, concentración.
// - Gana la categoría con más palabras distintas encontradas; en empate, la que aparece antes en la lista.
// - Sin ninguna coincidencia el pensamiento queda "Sin clasificar" (nunca se inventa una categoría).
const CLASIFICADOR_REGLAS = /*REGLAS-JSON*/ {
  "version": 1,
  "categories": [
    {
      "category": "humo_rojo",
      "thoughtType": "urgente",
      "cognitiveWeight": "fuego",
      "keywords": ["urgente", "urgencia", "critico", "critica", "emergencia", "fuego", "hoy mismo", "ya mismo", "cuanto antes", "vence", "vencen", "vencimiento", "plazo", "fecha limite", "deadline", "asap", "pagar", "impuesto*", "sat", "multa", "recargo*"]
    },
    {
      "category": "humo_purpura",
      "thoughtType": "contacto",
      "cognitiveWeight": "medio",
      "keywords": ["llamar", "llamarle", "llamada", "escribirle", "mensaje a", "whatsapp a", "cumpleanos", "amigo", "amiga", "mama", "papa", "abuela", "abuelo", "hermano", "hermana", "familia", "pareja", "contacto", "visitar", "reunion con", "cafe con", "comer con"]
    },
    {
      "category": "humo_naranja",
      "thoughtType": "finanzas",
      "cognitiveWeight": "medio",
      "keywords": ["comprar", "compra", "dinero", "precio", "costo", "cuesta", "gasto", "gastar", "tarjeta", "factura", "presupuesto", "ahorr*", "deuda", "banco", "transferencia", "pesos", "dolares", "euros", "suscripcion"]
    },
    {
      "category": "humo_verde",
      "thoughtType": "habito",
      "cognitiveWeight": "ligero",
      "keywords": ["habito", "salud", "ejercicio", "gimnasio", "gym", "correr", "caminar", "dormir", "agua", "hidrat*", "medicacion", "medicina", "pastilla", "meditar", "dieta", "yoga", "racha", "estirar", "descansar"]
    },
    {
      "category": "humo_azul",
      "thoughtType": "deep_work",
      "cognitiveWeight": "pesado",
      "keywords": ["deep work", "concentr*", "programar", "codigo", "arquitectura", "estudiar", "investigar", "redactar", "analizar", "refactor*", "debug*", "documentar", "examen", "tesis"]
    },
    {
      "category": "humo_tarea",
      "thoughtType": "tarea",
      "cognitiveWeight": "medio",
      "keywords": ["tarea", "pendiente", "tengo que", "hay que", "debo", "recordar", "enviar", "mandar", "revisar", "tramite", "entregar", "terminar", "arreglar", "preparar", "agendar", "confirmar", "imprimir", "firmar"]
    },
    {
      "category": "humo_dorado",
      "thoughtType": "idea_proyecto",
      "cognitiveWeight": "medio",
      "keywords": ["idea", "ocurrencia", "se me ocurre", "seria bueno", "podria*", "proyecto nuevo", "negocio", "emprend*", "startup", "inventar", "prototipo", "lanzar"]
    },
    {
      "category": "humo_ceniza",
      "thoughtType": "hibernacion",
      "cognitiveWeight": "ligero",
      "keywords": ["algun dia", "someday", "quizas", "quiza", "tal vez", "en el futuro", "cuando tenga tiempo", "despues vere", "congelar"]
    },
    {
      "category": "humo_blanco",
      "thoughtType": "intrusivo",
      "cognitiveWeight": "ligero",
      "keywords": ["soltar", "olvidar", "me preocupa", "preocupacion", "ansiedad", "culpa", "rumiar", "rumiacion", "intrusivo", "no puedo dejar de pensar", "me agobia", "agobio", "estres", "miedo"]
    }
  ]
} /*FIN-REGLAS-JSON*/;

if (typeof module !== 'undefined' && module.exports) module.exports = CLASIFICADOR_REGLAS;
