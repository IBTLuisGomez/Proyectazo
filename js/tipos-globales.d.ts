// Globales compartidos entre los <script> clásicos, para la comprobación de tipos (npm run typecheck).
declare const app: Record<string, any>;
declare const module: { exports: any } | undefined;
declare function require(name: string): any;
// Definido en js/clasificador-reglas.js (que también lo exporta para Node)
declare const CLASIFICADOR_REGLAS: { version: number; categories: Array<{ category: string; thoughtType: string; cognitiveWeight: string; keywords: string[] }> };
